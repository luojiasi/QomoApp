from __future__ import annotations

import binascii
import copy
import threading
import time
from collections import deque
from typing import Any, Literal

from configs.rs232_config import 串口配置实例
from utils.logger import 获取日志记录器

try:
    import serial
    from serial.tools import list_ports as 枚举串口模块
except ImportError:  # pragma: no cover
    serial = None  # type: ignore[assignment]
    枚举串口模块 = None  # type: ignore[assignment]


流控类型 = Literal["none", "xon_xoff", "rts_cts", "dsr_dtr"]
校验位类型 = Literal["none", "odd", "even", "mark", "space"]
发送模式 = Literal["ascii", "hex"]


class 串口驱动:
    """单路RS232：进程内单例，对接pyserial。"""

    def __init__(self, 配置: 串口配置实例) -> None:
        self._配置 = 配置
        self._日志 = 获取日志记录器("串口适配器")
        self._锁 = threading.RLock()
        self._串口: Any = None
        self._当前端口: str | None = None
        self._编码: str = "utf-8"
        self._接收行队列: deque[str] = deque(maxlen=500)
        self._读线程停止 = threading.Event()
        self._读线程: threading.Thread | None = None
        self._显示时间戳 = False
        self._首选会话: dict[str, Any] | None = None

    def pyserial是否可用(self) -> bool:
        return serial is not None

    @staticmethod
    def 枚举串口信息() -> list[dict[str, str]]:
        if 枚举串口模块 is None: return []
        结果: list[dict[str, str]] = []
        for 端口 in 枚举串口模块.comports():
            结果.append(
                {
                    "device": getattr(端口, "device", "") or "",
                    "name": getattr(端口, "name", "") or "",
                    "description": getattr(端口, "description", "") or "",
                }
            )
        return 结果

    def 是否已连接(self) -> bool:
        with self._锁:
            return self._串口 is not None and getattr(self._串口, "is_open", False)

    def 当前端口名(self) -> str | None:
        with self._锁:
            return self._当前端口

    def 设置首选会话(self, 会话: dict[str, Any]) -> None:
        """
        缓存前端上报的 RS232 会话参数（port/send/receive）。
        仅用于后续非 RS232 页面场景下的默认串口选择。
        """
        with self._锁:
            self._首选会话 = copy.deepcopy(会话)

    def 获取首选会话(self) -> dict[str, Any] | None:
        with self._锁:
            if self._首选会话 is None:
                return None
            return copy.deepcopy(self._首选会话)

    def 获取接收缓冲区(self, *, 清空: bool = False) -> str:
        with self._锁:
            文本 = "\n".join(self._接收行队列)
            if 清空:
                self._接收行队列.clear()
            return 文本

    def _校验位常量(self, 校验: 校验位类型) -> Any:
        assert serial is not None
        映射 = {
            "none": serial.PARITY_NONE,
            "odd": serial.PARITY_ODD,
            "even": serial.PARITY_EVEN,
            "mark": serial.PARITY_MARK,
            "space": serial.PARITY_SPACE,
        }
        return 映射[校验]

    def _停止位常量(self, 停止位: float) -> Any:
        assert serial is not None
        if 停止位 == 1:
            return serial.STOPBITS_ONE
        if 停止位 == 1.5:
            return serial.STOPBITS_ONE_POINT_FIVE
        return serial.STOPBITS_TWO

    def _数据位常量(self, 位数: int) -> Any:
        assert serial is not None
        映射 = {
            5: serial.FIVEBITS,
            6: serial.SIXBITS,
            7: serial.SEVENBITS,
            8: serial.EIGHTBITS,
        }
        return 映射[int(位数)]

    def _流控转布尔三元组(self, 流控: 流控类型) -> tuple[bool, bool, bool]:
        if 流控 == "xon_xoff":
            return True, False, False
        if 流控 == "rts_cts":
            return False, True, False
        if 流控 == "dsr_dtr":
            return False, False, True
        return False, False, False

    def _打开串口对象(self, 端口配置: dict[str, Any]) -> Any:
        assert serial is not None
        端口名 = str(端口配置["portName"])
        超时秒 = max(float(端口配置.get("timeoutMs", 0)) / 1000.0, 0.0)
        xonxoff, rtscts, dsrdtr = self._流控转布尔三元组(端口配置["flowControl"])
        return serial.Serial(
            port=端口名,
            baudrate=int(端口配置["baudRate"]),
            bytesize=self._数据位常量(int(端口配置["dataBits"])),
            parity=self._校验位常量(端口配置["parity"]),
            stopbits=self._停止位常量(float(端口配置["stopBits"])),
            timeout=超时秒,
            xonxoff=xonxoff,
            rtscts=rtscts,
            dsrdtr=dsrdtr,
        )

    def _读循环(self, 接收模式: 发送模式, 单行最大原始字节: int) -> None:
        assert serial is not None
        缓冲区 = bytearray()
        轮询间隔秒 = self._配置.read_thread_poll_ms / 1000.0
        while not self._读线程停止.is_set():
            with self._锁:
                串口 = self._串口
            if 串口 is None or not 串口.is_open:
                time.sleep(轮询间隔秒)
                continue
            try:
                # 非阻塞模式：只在有数据时才调 ReadFile，避免驱动 Bug
                可读字节数 = getattr(串口, "in_waiting", 0) or 0
                if 可读字节数 <= 0:
                    块 = b""
                else:
                    读取字节数 = min(int(可读字节数), 65536)
                    块 = 串口.read(读取字节数)
            except (serial.SerialException, ValueError, OSError) as 错误:
                self._日志.warning("RS232 读取错误: %s", 错误)
                time.sleep(轮询间隔秒)
                continue
            if not 块:
                time.sleep(轮询间隔秒)
                continue
            缓冲区.extend(块)
            while True:
                换行位置 = 缓冲区.find(b"\n")
                回车位置 = 缓冲区.find(b"\r")
                if 换行位置 < 0 and 回车位置 < 0:
                    break
                if 换行位置 >= 0 and (回车位置 < 0 or 换行位置 < 回车位置):
                    原始 = bytes(缓冲区[:换行位置])
                    del 缓冲区[: 换行位置 + 1]
                elif 回车位置 >= 0:
                    原始 = bytes(缓冲区[:回车位置])
                    del 缓冲区[: 回车位置 + 1]
                    if 缓冲区 and 缓冲区[0:1] == b"\n":
                        del 缓冲区[:1]
                else:
                    break
                原始 = 原始[-单行最大原始字节:] if len(原始) > 单行最大原始字节 else 原始
                if not 原始:
                    continue
                if 接收模式 == "hex":
                    文本 = binascii.hexlify(原始).decode("ascii")
                else:
                    try:
                        文本 = 原始.decode(self._编码, errors="replace")
                    except Exception:
                        文本 = 原始.decode("utf-8", errors="replace")
                    文本 = 文本[:单行最大原始字节].rstrip("\r\n")
                前缀 = f"{time.strftime('%H:%M:%S')} " if self._显示时间戳 else ""
                with self._锁:
                    self._接收行队列.append(f"{前缀}{文本}")

    def 打开会话(self, 端口配置: dict[str, Any], 接收配置: dict[str, Any]) -> tuple[bool, str]:
        if serial is None:
            return False, "未安装 pyserial，请执行 pip install pyserial"

        self.关闭()

        try:
            新串口 = self._打开串口对象(端口配置)
        except (serial.SerialException, ValueError, OSError) as 错误:
            self._日志.warning("打开串口失败: %s", 错误)
            return False, f"打开串口失败: {错误}"

        接收模式: 发送模式 = 接收配置.get("mode", "ascii")
        if 接收模式 not in ("ascii", "hex"):
            接收模式 = "ascii"

        最大行数 = int(接收配置.get("maxBufferLines", 500))
        最大行数 = max(10, min(最大行数, 10_000))

        with self._锁:
            self._接收行队列 = deque(maxlen=最大行数)
            self._编码 = str(端口配置.get("encoding", "utf-8"))
            self._显示时间戳 = bool(接收配置.get("showTimestamp", False))
            # 非阻塞模式：只在 in_waiting>0 确认有数据时才调 ReadFile
            # 避免 ELTIMA 等虚拟串口驱动在等待数据时触发访问违例
            新串口.timeout = 0
            self._串口 = 新串口
            self._当前端口 = str(端口配置["portName"])

        self._读线程停止.clear()
        self._读线程 = threading.Thread(
            target=self._读循环,
            args=(接收模式, self._配置.max_receive_line_length),
            name="rs232-reader",
            daemon=True,
        )
        self._读线程.start()
        self._日志.info("串口已打开 %s @ %s baud", 端口配置["portName"], 端口配置.get("baudRate"))
        return True, "串口已打开"

    def 关闭(self) -> bool:
        self._读线程停止.set()
        线程 = self._读线程
        self._读线程 = None
        if 线程 is not None and 线程.is_alive():
            线程.join(timeout=2.0)
        with self._锁:
            串口 = self._串口
            self._串口 = None
            端口名 = self._当前端口
            self._当前端口 = None
        if 串口 is not None:
            try:
                串口.close()
                self._日志.info("串口 %s 已关闭", 端口名)
            except Exception as exc:
                self._日志.warning("关闭串口 %s 异常: %s", 端口名, exc)
        return True

    def _构建发送字节(self, 发送配置: dict[str, Any]) -> tuple[bytes | None, str]:
        模式: 发送模式 = 发送配置.get("mode", "ascii")
        if 模式 not in ("ascii", "hex"):
            模式 = "ascii"
        原始字符串 = str(发送配置.get("payload", ""))
        try:
            if 模式 == "hex":
                十六进制串 = "".join(原始字符串.split())
                数据 = binascii.unhexlify(十六进制串)
            else:
                数据 = 原始字符串.encode(self._编码, errors="replace")
        except (binascii.Error, ValueError, LookupError) as 错误:
            return None, f"编码或十六进制无效: {错误}"

        if 发送配置.get("appendCr"):
            数据 += b"\r"
        if 发送配置.get("appendLf"):
            数据 += b"\n"
        return 数据, ""

    def 发送(self, 发送配置: dict[str, Any]) -> tuple[bool, str]:
        数据, 错误信息 = self._构建发送字节(发送配置)
        if 数据 is None:
            return False, 错误信息

        with self._锁:
            串口 = self._串口
            if 串口 is None or not getattr(串口, "is_open", False):
                return False, "串口未打开"
            try:
                串口.write(数据)
                串口.flush()
            except (serial.SerialException, ValueError, OSError) as 错误:
                return False, f"发送失败: {错误}"
        模式 = 发送配置.get("mode", "ascii")
        self._日志.info("RS232 发送 %s (%d 字节)", 模式, len(数据))
        return True, "已发送"
