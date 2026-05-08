
"""全局日志系统 。

功能：
  - 运行时可开关
  - 按天轮转：活动文件名为 "{基础名}.txt"，轮转文件名为 "{基础名}_YYYY-MM-DD.txt"
  - 时间戳格式：[YYYY-MM-DD HH:MM:SS.mmm] [标签] 消息
  - 通过 QueueHandler + QueueListener 实现非阻塞写入
  - 写入失败：仅向 stderr 报告一次，后续静默抑制
  - 全局异常钩子：sys.excepthook + threading.excepthook
  - 可选的 stdout/stderr 拦截（将 print() 重定向到日志）
"""

import faulthandler
import logging
import logging.handlers
import os
import queue
import sys
import threading
from datetime import datetime, date


# ---------------------------------------------------------------------------
# 自定义文件处理器 —— 仿 FlutterLogger 的按天轮转
# ---------------------------------------------------------------------------

class _每日轮转文件处理器(logging.Handler):
    """按天轮转的日志文件处理器。

    活动文件：  {日志目录}/{基础名}.txt
    轮转文件：  {日志目录}/{基础名}_YYYY-MM-DD.txt
    """

    def __init__(self, 日志目录: str, 基础名: str = "qomo_logs", 保留天数: int = 7):
        super().__init__()
        self._日志目录 = 日志目录
        self._基础名 = 基础名
        self._保留天数 = 保留天数
        self._活动文件名 = f"{基础名}.txt"
        self._轮转文件前缀 = f"{基础名}_"
        self._文件句柄 = None
        self._文件句柄日期: date | None = None
        self._写入错误已报告 = False
        self._锁 = threading.Lock()

    def _确保文件句柄(self):
        现在 = datetime.now()
        今天 = 现在.date()
        if self._文件句柄 is not None and self._文件句柄日期 == 今天: return

        self._关闭文件句柄()

        os.makedirs(self._日志目录, exist_ok=True)

        活动路径 = os.path.join(self._日志目录, self._活动文件名)
        if os.path.exists(活动路径):
            try:
                修改时间 = datetime.fromtimestamp(os.path.getmtime(活动路径)).date()
                if 修改时间 != 今天:
                    # Windows 上 os.rename 要求目标文件不被其他句柄占用，
                    # 先释放崩溃日志句柄，轮转完成后再恢复
                    _释放崩溃日志句柄()
                    后缀 = 修改时间.strftime("%Y-%m-%d")
                    轮转路径 = os.path.join(self._日志目录, f"{self._轮转文件前缀}{后缀}.txt")
                    if os.path.exists(轮转路径):
                        序号 = 1
                        while os.path.exists(os.path.join(self._日志目录,f"{self._轮转文件前缀}{后缀}_{序号}.txt",)):
                            序号 += 1
                        轮转路径 = os.path.join(self._日志目录,f"{self._轮转文件前缀}{后缀}_{序号}.txt",)
                    os.rename(活动路径, 轮转路径)
                    _恢复崩溃日志句柄(self._日志目录)
            except OSError:
                pass

        self._文件句柄 = open(活动路径, "a", encoding="utf-8")
        self._文件句柄日期 = 今天

    def _关闭文件句柄(self):
        if self._文件句柄 is not None:
            try:
                self._文件句柄.close()
            except Exception:
                pass
            self._文件句柄 = None
            self._文件句柄日期 = None

    def _清理旧日志(self):
        if self._保留天数 <= 0:
            return
        try:
            截止时间 = datetime.now().timestamp() - self._保留天数 * 86400
            for 文件名 in os.listdir(self._日志目录):
                if 文件名.startswith(self._轮转文件前缀) and 文件名.endswith(".txt"):
                    文件路径 = os.path.join(self._日志目录, 文件名)
                    try:
                        if os.path.getmtime(文件路径) < 截止时间:
                            os.remove(文件路径)
                    except OSError:
                        pass
        except Exception:
            pass

    def emit(self, 记录: logging.LogRecord):
        消息 = self.format(记录)
        with self._锁:
            try:
                self._确保文件句柄()
                self._文件句柄.write(消息 + "\n")
                self._文件句柄.flush()
            except Exception:
                self._关闭文件句柄()
                if not self._写入错误已报告:
                    self._写入错误已报告 = True
                    try:
                        print("[QomoLogger] 写入失败，后续写入错误将不再报告。",file=sys.stderr,)
                    except Exception:
                        pass

    def close(self):
        self._关闭文件句柄()
        super().close()


# ---------------------------------------------------------------------------
# 自定义格式化器
# ---------------------------------------------------------------------------

class _Qomo格式化器(logging.Formatter):
    """格式：[2026-05-07 14:30:05.123] [标签] 消息"""

    def __init__(self):
        super().__init__(datefmt="%Y-%m-%d %H:%M:%S")

    def formatTime(self, 记录: logging.LogRecord, datefmt=None):
        时间 = datetime.fromtimestamp(记录.created)
        return 时间.strftime("%Y-%m-%d %H:%M:%S") + f".{时间.microsecond // 1000:03d}"

    def format(self, 记录: logging.LogRecord):
        时间戳 = self.formatTime(记录)
        return f"[{时间戳}] [{记录.name}] {记录.getMessage()}"


# ---------------------------------------------------------------------------
# 模块状态
# ---------------------------------------------------------------------------

_队列: queue.Queue | None = None
_监听器: logging.handlers.QueueListener | None = None
_文件处理器: _每日轮转文件处理器 | None = None
_根日志记录器: logging.Logger | None = None
_原始标准输出 = None
_原始标准错误 = None
_拦截已开启 = False
_上次日志目录 = ""
_上次保留天数 = 7
_上次基础名 = "qomo_logs"
_上次崩溃日志名 = "errlog"
_崩溃日志文件 = None


# ---------------------------------------------------------------------------
# 公开 API
# ---------------------------------------------------------------------------

def 初始化(日志目录: str,日志配置: dict | None = None):
    """初始化日志系统。应用启动时调用一次。

    参数：
        日志目录: 日志文件存放目录。
        日志配置: 日志设置字典，对应 configs/app_config.json 中的 "日志" 键。
                  格式：{"是否开启": bool, "级别": str, "保留天数": int}
                  为 None 时使用默认值。
        拦截print: 是否将 stdout/stderr 重定向到日志。
    """
    if 日志配置 is None:日志配置 = {}

    是否开启 = 日志配置.get("是否开启", True)
    级别 = 日志配置.get("级别", "DEBUG")
    保留天数 = 日志配置.get("保留天数", 7)
    基础名 = 日志配置.get("日志文件基础名", "qomo_logs")
    崩溃日志名 = 日志配置.get("崩溃日志文件名", "errlog")
    拦截print = 日志配置.get("拦截print", False)

    _内部初始化(是否开启=是否开启, 级别=级别, 日志目录=日志目录, 保留天数=保留天数, 基础名=基础名, 崩溃日志名=崩溃日志名, 拦截print=拦截print)


def _内部初始化(是否开启: bool, 级别: str, 日志目录: str, 保留天数: int, 基础名: str, 崩溃日志名: str, 拦截print: bool):
    global _队列, _监听器, _文件处理器, _根日志记录器
    global _上次日志目录, _上次保留天数, _上次基础名, _上次崩溃日志名
    global _拦截已开启

    级别数值 = _级别名称转数值(级别)

    _根日志记录器 = logging.getLogger("qomo")
    _根日志记录器.setLevel(级别数值)

    _根日志记录器.handlers.clear()

    if not 是否开启:
        _根日志记录器.addHandler(logging.NullHandler())
        return

    _上次日志目录 = 日志目录
    _上次保留天数 = 保留天数
    _上次基础名 = 基础名
    _上次崩溃日志名 = 崩溃日志名

    _文件处理器 = _每日轮转文件处理器(日志目录, 基础名, 保留天数)
    _文件处理器.setLevel(级别数值)
    _文件处理器.setFormatter(_Qomo格式化器())

    _队列 = queue.Queue(-1)
    队列处理器 = logging.handlers.QueueHandler(_队列)
    _监听器 = logging.handlers.QueueListener(_队列, _文件处理器,respect_handler_level=True)
    _监听器.start()

    _根日志记录器.addHandler(队列处理器)

    if 拦截print:
        _拦截已开启 = True
        _开始拦截()

    _启用崩溃日志(日志目录, 崩溃日志名)


def _启用崩溃日志(日志目录: str, 崩溃日志名: str = "errlog"):
    """将 faulthandler 的 C 层崩溃 dump 重定向到日志文件。

    必须在日志文件处理器创建后调用。faulthandler 在 C 层通过 fd 直接写入，
    不经过 Python 队列，段错误发生时数据能落盘。
    """
    global _崩溃日志文件

    日志路径 = os.path.join(日志目录, f"{崩溃日志名}.txt")
    os.makedirs(日志目录, exist_ok=True)

    if _崩溃日志文件:
        try:
            _崩溃日志文件.close()
        except Exception:
            pass

    _崩溃日志文件 = open(日志路径, "a", encoding="utf-8")
    faulthandler.enable(file=_崩溃日志文件)


def _释放崩溃日志句柄():
    """轮转前临时关闭崩溃日志句柄，避免 Windows 上 os.rename 失败。"""
    global _崩溃日志文件
    if _崩溃日志文件:
        try:
            _崩溃日志文件.close()
        except Exception:
            pass
        _崩溃日志文件 = None


def _恢复崩溃日志句柄(日志目录: str):
    """轮转完成后重新打开崩溃日志句柄。"""
    global _上次崩溃日志名
    _启用崩溃日志(日志目录, _上次崩溃日志名)


def 设置是否开启(是否开启: bool):
    """运行时切换日志开关。"""
    global _队列, _监听器, _文件处理器, _根日志记录器
    global _上次日志目录, _上次保留天数, _上次基础名, _上次崩溃日志名, _崩溃日志文件

    if _根日志记录器 is None:return

    if 是否开启 and _监听器 is not None:return
    if not 是否开启 and _监听器 is None:return

    if 是否开启:
        级别 = _根日志记录器.level
        _根日志记录器.handlers.clear()

        _文件处理器 = _每日轮转文件处理器(_上次日志目录, _上次基础名, _上次保留天数)
        _文件处理器.setLevel(级别)
        _文件处理器.setFormatter(_Qomo格式化器())

        _队列 = queue.Queue(-1)
        队列处理器 = logging.handlers.QueueHandler(_队列)
        _监听器 = logging.handlers.QueueListener(_队列, _文件处理器, respect_handler_level=True)
        _监听器.start()
        _根日志记录器.addHandler(队列处理器)

        # 重新打开崩溃日志句柄（关闭时已释放）
        _启用崩溃日志(_上次日志目录, _上次崩溃日志名)
    else:
        # 释放崩溃日志句柄，避免 Windows 上 os.rename 失败
        if _崩溃日志文件:
            try:
                _崩溃日志文件.close()
            except Exception:
                pass
            _崩溃日志文件 = None

        if _文件处理器:
            _上次日志目录 = _文件处理器._日志目录
            _上次保留天数 = _文件处理器._保留天数
            _上次基础名 = _文件处理器._基础名
        if _监听器:
            _监听器.stop()
            _监听器 = None
        if _文件处理器:
            _文件处理器.close()
            _文件处理器 = None
        _队列 = None
        _根日志记录器.handlers.clear()
        _根日志记录器.addHandler(logging.NullHandler())


def 获取日志记录器(名称: str) -> logging.Logger:
    """获取子日志记录器。名称会作为日志输出中的 [标签]。"""
    _确保根记录器存在()
    return logging.getLogger(f"qomo.{名称}")


def 停止():
    """停止日志系统，等待队列排空后关闭文件。应用退出前调用。"""
    global _监听器, _队列, _文件处理器, _根日志记录器

    if _监听器:
        _监听器.stop()
        _监听器 = None

    if _文件处理器:
        _文件处理器.close()
        _文件处理器 = None

    _队列 = None
    _根日志记录器 = None


def 拦截标准输出(启用: bool = True):
    """将 stdout/stderr 重定向到日志（使 print() 输出写入日志文件）。"""
    global _拦截已开启

    if 启用 and not _拦截已开启:
        _开始拦截()
        _拦截已开启 = True
    elif not 启用 and _拦截已开启:
        _停止拦截()
        _拦截已开启 = False


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------

def _确保根记录器存在():
    global _根日志记录器
    if _根日志记录器 is None:
        _根日志记录器 = logging.getLogger("qomo")
        _根日志记录器.setLevel(logging.DEBUG)
        if not _根日志记录器.handlers:
            处理器 = logging.StreamHandler(sys.stderr)
            处理器.setFormatter(_Qomo格式化器())
            _根日志记录器.addHandler(处理器)


def _级别名称转数值(名称: str) -> int:
    return getattr(logging, 名称.upper(), logging.DEBUG)


# ---------------------------------------------------------------------------
# stdout / stderr 拦截
# ---------------------------------------------------------------------------

class _日志写入器:
    """类似文件的对象，将写入内容重定向到日志记录器。"""

    def __init__(self, 标签: str):
        self._标签 = 标签
        self._缓冲区 = ""

    def write(self, 内容: str):
        if not 内容:
            return
        self._缓冲区 += 内容
        if "\n" in self._缓冲区:
            行列表 = self._缓冲区.split("\n")
            self._缓冲区 = 行列表.pop()
            记录器 = 获取日志记录器(self._标签)
            for 行 in 行列表:
                去除空白 = 行.rstrip("\r")
                if 去除空白:
                    记录器.info(去除空白)

    def flush(self):
        if self._缓冲区:
            记录器 = 获取日志记录器(self._标签)
            记录器.info(self._缓冲区.rstrip("\r"))
            self._缓冲区 = ""


def _开始拦截():
    global _原始标准输出, _原始标准错误
    _原始标准输出 = sys.stdout
    _原始标准错误 = sys.stderr
    sys.stdout = _日志写入器("print")
    sys.stderr = _日志写入器("stderr")


def _停止拦截():
    global _原始标准输出, _原始标准错误
    if _原始标准输出:
        sys.stdout = _原始标准输出
        _原始标准输出 = None
    if _原始标准错误:
        sys.stderr = _原始标准错误
        _原始标准错误 = None
