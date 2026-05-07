"""全局异常捕获 —— 对标 kelivo 的 FlutterLogger.installGlobalHandlers()。

两层拦截：
  1. 未捕获异常兜底（sys.excepthook + threading.excepthook）
  2. 全量异常追踪（sys.settrace）—— 在异常抛出瞬间截获，即使被 try/except 吃掉也会记录

启用异常追踪后有性能开销（每条 Python 指令都会触发回调），
调试阶段或需要全面审计时开启，生产环境按需使用。
"""

import faulthandler
import sys
import threading

# ---------------------------------------------------------------------------
# 模块状态
# ---------------------------------------------------------------------------

_已安装 = False
_原始异常钩子 = None
_原始线程异常钩子 = None
_正在处理 = False  # 防递归标志

_异常追踪已启用 = False
_已追踪异常: set[int] | None = None  # id(exc_value) 去重
_应用根目录: str | None = None


# ---------------------------------------------------------------------------
# 公开 API —— 未捕获异常兜底
# ---------------------------------------------------------------------------

def 安装():
    """安装全局异常钩子（未捕获异常兜底）。重复调用安全。"""
    global _已安装, _原始异常钩子, _原始线程异常钩子

    if _已安装: return

    # 注册 C 层崩溃处理器（段错误等），初始指向 stderr，
    # 日志系统初始化后 logger 会自动重定向到日志文件
    faulthandler.enable()

    _原始异常钩子 = sys.excepthook
    _原始线程异常钩子 = threading.excepthook

    sys.excepthook = _主线程异常钩子
    threading.excepthook = _线程异常钩子

    _已安装 = True


# ---------------------------------------------------------------------------
# 公开 API —— 全量异常追踪（拦截被 try/except 吃掉的异常）
# ---------------------------------------------------------------------------

def 启用异常追踪():
    """启用全量异常追踪——用户代码中的异常（含被捕获的）在抛出时即刻记录。

    原理：sys.settrace() 在 Python 解释器执行每条指令前回调，
    当 event='exception' 时截获异常，在 except 处理它之前记录。

    仅记录应用根目录下的用户代码异常，跳过 stdlib/site-packages 内部异常。

    注意：有性能开销，调试/审计阶段使用。
    """
    global _异常追踪已启用, _已追踪异常, _应用根目录

    if _异常追踪已启用: return

    from utils.path_utils import 路径工具
    _应用根目录 = 路径工具.获取应用根目录()

    _已追踪异常 = set()
    _异常追踪已启用 = True
    sys.settrace(_异常追踪器)


def 停用异常追踪():
    """停用全量异常追踪，恢复正常性能。"""
    global _异常追踪已启用, _已追踪异常

    if not _异常追踪已启用:return

    sys.settrace(None)
    _异常追踪已启用 = False
    _已追踪异常 = None


# ---------------------------------------------------------------------------
# trace 函数 —— 每指令回调，只处理 exception 事件
# ---------------------------------------------------------------------------

def _异常追踪器(frame, event, arg):
    """sys.settrace 回调：只监听 'exception' 事件。"""
    if event == 'exception':_处理追踪异常(arg)
    return _异常追踪器


def _处理追踪异常(arg):
    """截获一个刚抛出的异常（可能即将被 except 捕获）。

    仅记录应用根目录下用户代码抛出的异常，跳过 stdlib/site-packages 内部异常。
    """
    global _已追踪异常, _应用根目录

    exc_type, exc_value, exc_traceback = arg

    # 跳过不重要的异常类型
    if exc_type is None or exc_value is None:
        return
    if isinstance(exc_value, (KeyboardInterrupt, SystemExit, StopIteration, GeneratorExit)):
        return

    # 只记录用户代码中抛出的异常（跳过 stdlib / site-packages / pytest 内部异常）
    if not _是否用户代码异常(exc_traceback):
        return

    # 去重：同一异常实例在栈帧展开时会触发多次，只记一次
    exc_id = id(exc_value)
    if _已追踪异常 is not None:
        if exc_id in _已追踪异常:
            return
        _已追踪异常.add(exc_id)

    import traceback as tb
    文本 = "".join(tb.format_exception(exc_type, exc_value, exc_traceback)).strip()

    # 输出到 stderr
    try:
        print(f"\n{'='*60}\n[异常追踪] {文本}\n{'='*60}\n", file=sys.stderr)
    except Exception:
        pass

    # 写入日志
    try:
        from utils.logger import 获取日志记录器
        获取日志记录器("Trace").error(文本)
    except Exception:
        pass


def _是否用户代码异常(tb) -> bool:
    """检查异常回溯栈中是否有任何帧来自应用根目录（仅开发模式调用）。

    通过绝对路径判断：帧路径是否在应用根目录下，以此区分用户代码与 stdlib/site-packages。
    PyInstaller 打包后不调用此函数（打包模式下不启用 settrace）。
    """
    import os
    while tb is not None:
        frame_path = tb.tb_frame.f_code.co_filename
        if os.path.isabs(frame_path) and _应用根目录:
            try:
                if os.path.commonpath([_应用根目录, frame_path]) == _应用根目录:
                    return True
            except ValueError:
                pass
        tb = tb.tb_next
    return False


# ---------------------------------------------------------------------------
# 钩子实现 —— 未捕获异常兜底（保持不变）
# ---------------------------------------------------------------------------

def _主线程异常钩子(异常类型, 异常值, 异常回溯):
    """主线程未捕获异常 → 日志 + stderr + 原始钩子。"""
    global _正在处理

    if _正在处理:
        _调用原始钩子安全(异常类型, 异常值, 异常回溯)
        return

    _正在处理 = True
    try:
        import traceback
        回溯文本 = "".join(traceback.format_exception(异常类型, 异常值, 异常回溯)).strip()

        _安全写入控制台(f"\n{'='*60}\n[未捕获异常] {回溯文本}\n{'='*60}\n")

        写入日志成功 = False
        try:
            from utils.logger import 获取日志记录器
            获取日志记录器("Uncaught").critical(回溯文本)
            写入日志成功 = True
        except Exception:
            pass

        # 日志系统不可用时（如启动早期崩溃），直接写到 logs/crash.txt
        if not 写入日志成功:
            _紧急写入崩溃文件(f"[未捕获异常]\n{回溯文本}")

        _调用原始钩子安全(异常类型, 异常值, 异常回溯)
    finally:
        _正在处理 = False


def _线程异常钩子(参数):
    """子线程未捕获异常 → 日志 + stderr + 原始钩子。"""
    global _正在处理

    if _正在处理:
        _调用原始线程钩子安全(参数)
        return

    _正在处理 = True
    try:
        异常类型 = 参数.exc_type
        异常值 = 参数.exc_value
        异常回溯 = 参数.exc_traceback
        线程名 = getattr(参数.thread, 'name', str(参数.thread))

        if 异常类型 and 异常值:
            import traceback
            消息 = "".join(traceback.format_exception(异常类型, 异常值, 异常回溯)).strip()
            完整消息 = f"线程={线程名}\n{消息}"

            _安全写入控制台(f"\n{'='*60}\n[线程异常] {完整消息}\n{'='*60}\n")

            写入日志成功 = False
            try:
                from utils.logger import 获取日志记录器
                获取日志记录器("ThreadCrash").critical(完整消息)
                写入日志成功 = True
            except Exception:
                pass

            if not 写入日志成功:
                _紧急写入崩溃文件(f"[线程异常]\n{完整消息}")

        _调用原始线程钩子安全(参数)
    finally:
        _正在处理 = False


# ---------------------------------------------------------------------------
# 内部辅助
# ---------------------------------------------------------------------------

def _安全写入控制台(文本: str):
    try:
        print(文本, file=sys.stderr)
    except Exception:
        pass


def _紧急写入崩溃文件(文本: str):
    """日志系统不可用时的兜底：直接将崩溃信息追加到 logs/crash.txt。

    不依赖任何日志模块，确保即使在最早期崩溃时也能落盘。
    """
    try:
        from utils.path_utils import 路径工具
        import os
        from datetime import datetime
        日志目录 = os.path.join(路径工具.获取应用根目录(), "logs")
        os.makedirs(日志目录, exist_ok=True)
        崩溃文件 = os.path.join(日志目录, "crash.txt")
        时间戳 = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(崩溃文件, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*60}\n[{时间戳}]\n{文本}\n{'='*60}\n")
    except Exception:
        pass


def _调用原始钩子安全(异常类型, 异常值, 异常回溯):
    if _原始异常钩子 is None:
        return
    if _原始异常钩子 is _主线程异常钩子:
        return
    try:
        _原始异常钩子(异常类型, 异常值, 异常回溯)
    except Exception:
        pass


def _调用原始线程钩子安全(参数):
    if _原始线程异常钩子 is None:
        return
    if _原始线程异常钩子 is _线程异常钩子:
        return
    try:
        _原始线程异常钩子(参数)
    except Exception:
        pass
