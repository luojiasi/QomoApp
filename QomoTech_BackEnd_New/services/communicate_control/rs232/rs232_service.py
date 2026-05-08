"""RS232 串口服务 —— 进程内单例，对外门面。

功能：
  - 枚举系统串口
  - 打开 / 关闭串口会话
  - 发送数据（ASCII / HEX）
  - 后台读线程逐行缓存接收数据，并通过 asyncio.Queue 推送给 WebSocket 订阅者
  - 同步会话参数（前端工作台 → 后端持久化）
"""

from __future__ import annotations

import asyncio
import binascii
import threading
import time
from collections import deque
from typing import Any, Dict, List, Literal, Optional

from utils.logger import 获取日志记录器

日志 = 获取日志记录器("Rs232Service")

try:
    import serial
    from serial.tools import list_ports as _list_ports_mod
except ImportError:  # pragma: no cover
    serial = None  # type: ignore[assignment]
    _list_ports_mod = None  # type: ignore[assignment]


SendMode = Literal["ascii", "hex"]
FlowControl = Literal["none", "xon_xoff", "rts_cts", "dsr_dtr"]
Parity = Literal["none", "odd", "even", "mark", "space"]


class Rs232Error(Exception):
    """RS232 操作异常基类。"""


class Rs232Service:
    """RS232 串口服务单例。"""

    _实例: Optional["Rs232Service"] = None
    _实例锁 = threading.Lock()

    # ------------------------------------------------------------------
    # 单例
    # ------------------------------------------------------------------

    @classmethod
    def 获取实例(cls) -> "Rs232Service":
        with cls._实例锁:
            if cls._实例 is None:
                cls._实例 = cls()
            return cls._实例

    @classmethod
    def 重置实例(cls) -> None:
        """仅供单元测试使用。"""
        with cls._实例锁:
            cls._实例 = None

    # ------------------------------------------------------------------
    # 初始化
    # ------------------------------------------------------------------

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._ser: Any = None
        self._current_port: Optional[str] = None
        self._encoding: str = "utf-8"
        self._show_timestamp: bool = False
        self._receive_lines: deque[str] = deque(maxlen=500)
        self._preferred_session: Optional[Dict[str, Any]] = None

        # 读线程
        self._read_stop = threading.Event()
        self._read_thread: Optional[threading.Thread] = None
        self._receive_mode: SendMode = "ascii"
        self._max_receive_line_length: int = 4096

        # WebSocket 订阅（asyncio Queue，每条接收行推送一次）
        self._订阅者: List[asyncio.Queue] = []
        self._订阅锁 = threading.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    # ------------------------------------------------------------------
    # 启动 / 停止（供 app.py lifespan 调用）
    # ------------------------------------------------------------------

    async def 启动(self) -> None:
        self._loop = asyncio.get_running_loop()
        日志.info("Rs232Service 已就绪")

    async def 停止(self) -> None:
        self.关闭()
        日志.info("Rs232Service 已停止")

    # ------------------------------------------------------------------
    # 串口枚举
    # ------------------------------------------------------------------

    @staticmethod
    def pyserial可用() -> bool:
        return serial is not None

    @staticmethod
    def 枚举串口() -> List[Dict[str, str]]:
        if _list_ports_mod is None:
            return []
        out: List[Dict[str, str]] = []
        for p in _list_ports_mod.comports():
            out.append(
                {
                    "device": getattr(p, "device", "") or "",
                    "name": getattr(p, "name", "") or "",
                    "description": getattr(p, "description", "") or "",
                }
            )
        return out

    # ------------------------------------------------------------------
    # 状态查询
    # ------------------------------------------------------------------

    def 已连接(self) -> bool:
        with self._lock:
            return self._ser is not None and getattr(self._ser, "is_open", False)

    def 当前端口(self) -> Optional[str]:
        with self._lock:
            return self._current_port

    def 获取缓冲区(self, *, 清空: bool = False) -> str:
        with self._lock:
            text = "\n".join(self._receive_lines)
            if 清空:
                self._receive_lines.clear()
            return text

    # ------------------------------------------------------------------
    # 会话参数持久化
    # ------------------------------------------------------------------

    def 同步会话参数(self, session: Dict[str, Any]) -> None:
        import copy
        with self._lock:
            self._preferred_session = copy.deepcopy(session)

    def 获取会话参数(self) -> Optional[Dict[str, Any]]:
        import copy
        with self._lock:
            if self._preferred_session is None:
                return None
            return copy.deepcopy(self._preferred_session)

    # ------------------------------------------------------------------
    # 打开 / 关闭串口
    # ------------------------------------------------------------------

    def 打开会话(
        self,
        port_cfg: Dict[str, Any],
        receive_cfg: Dict[str, Any],
    ) -> tuple[bool, str]:
        if serial is None:
            return False, "未安装 pyserial，请执行: pip install pyserial"

        self.关闭()

        try:
            new_ser = self._打开串口(port_cfg)
        except Exception as exc:
            return False, f"打开串口失败: {exc}"

        receive_mode: SendMode = receive_cfg.get("mode", "ascii")
        if receive_mode not in ("ascii", "hex"):
            receive_mode = "ascii"

        max_lines = int(receive_cfg.get("maxBufferLines", 500))
        max_lines = max(10, min(max_lines, 10_000))

        with self._lock:
            self._receive_lines = deque(maxlen=max_lines)
            self._encoding = str(port_cfg.get("encoding", "utf-8"))
            self._show_timestamp = bool(receive_cfg.get("showTimestamp", False))
            self._ser = new_ser
            self._current_port = str(port_cfg["portName"])
            self._receive_mode = receive_mode

        self._read_stop.clear()
        self._read_thread = threading.Thread(
            target=self._读线程,
            args=(receive_mode,),
            name="rs232-reader",
            daemon=True,
        )
        self._read_thread.start()
        日志.info(f"串口已打开: {port_cfg['portName']}")
        return True, "串口已打开"

    def 关闭(self) -> None:
        self._read_stop.set()
        t = self._read_thread
        self._read_thread = None
        if t is not None and t.is_alive():
            t.join(timeout=2.0)
        with self._lock:
            ser = self._ser
            self._ser = None
            self._current_port = None
        if ser is not None:
            try:
                ser.close()
            except Exception:
                pass
        日志.info("串口已关闭")

    # ------------------------------------------------------------------
    # 发送数据
    # ------------------------------------------------------------------

    def 发送(self, send_cfg: Dict[str, Any]) -> tuple[bool, str]:
        data, err = self._构建发送数据(send_cfg)
        if data is None:
            return False, err

        with self._lock:
            ser = self._ser
            if ser is None or not getattr(ser, "is_open", False):
                return False, "串口未打开"
            try:
                ser.write(data)
                ser.flush()
            except Exception as exc:
                return False, f"发送失败: {exc}"
        return True, "已发送"

    # ------------------------------------------------------------------
    # WebSocket 订阅（接收行推送）
    # ------------------------------------------------------------------

    def 订阅接收(self, maxsize: int = 50) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=maxsize)
        with self._订阅锁:
            self._订阅者.append(q)
        return q

    def 取消订阅(self, q: asyncio.Queue) -> None:
        with self._订阅锁:
            try:
                self._订阅者.remove(q)
            except ValueError:
                pass

    def _推送接收行(self, line: str) -> None:
        """在读线程中调用，将新行推送到所有 asyncio.Queue 订阅者。"""
        loop = self._loop
        if loop is None or not loop.is_running():
            return
        with self._订阅锁:
            subscribers = list(self._订阅者)
        for q in subscribers:
            try:
                loop.call_soon_threadsafe(q.put_nowait, line)
            except asyncio.QueueFull:
                pass
            except Exception:
                pass

    # ------------------------------------------------------------------
    # 私有辅助
    # ------------------------------------------------------------------

    def _打开串口(self, port_cfg: Dict[str, Any]) -> Any:
        assert serial is not None
        port = str(port_cfg["portName"])
        timeout = max(float(port_cfg.get("timeoutMs", 0)) / 1000.0, 0.0)
        xonxoff, rtscts, dsrdtr = self._流控标志(port_cfg["flowControl"])
        return serial.Serial(
            port=port,
            baudrate=int(port_cfg["baudRate"]),
            bytesize=self._字节大小(int(port_cfg["dataBits"])),
            parity=self._校验位(port_cfg["parity"]),
            stopbits=self._停止位(float(port_cfg["stopBits"])),
            timeout=timeout,
            xonxoff=xonxoff,
            rtscts=rtscts,
            dsrdtr=dsrdtr,
        )

    def _校验位(self, p: str) -> Any:
        assert serial is not None
        mapping = {
            "none": serial.PARITY_NONE,
            "odd": serial.PARITY_ODD,
            "even": serial.PARITY_EVEN,
            "mark": serial.PARITY_MARK,
            "space": serial.PARITY_SPACE,
        }
        return mapping.get(p, serial.PARITY_NONE)

    def _停止位(self, s: float) -> Any:
        assert serial is not None
        if s == 1:
            return serial.STOPBITS_ONE
        if s == 1.5:
            return serial.STOPBITS_ONE_POINT_FIVE
        return serial.STOPBITS_TWO

    def _字节大小(self, bits: int) -> Any:
        assert serial is not None
        mapping = {5: serial.FIVEBITS, 6: serial.SIXBITS, 7: serial.SEVENBITS, 8: serial.EIGHTBITS}
        return mapping.get(bits, serial.EIGHTBITS)

    def _流控标志(self, fc: str) -> tuple[bool, bool, bool]:
        if fc == "xon_xoff":
            return True, False, False
        if fc == "rts_cts":
            return False, True, False
        if fc == "dsr_dtr":
            return False, False, True
        return False, False, False

    def _构建发送数据(self, send_cfg: Dict[str, Any]) -> tuple[Optional[bytes], str]:
        mode: str = send_cfg.get("mode", "ascii")
        raw_s = str(send_cfg.get("payload", ""))
        try:
            if mode == "hex":
                h = "".join(raw_s.split())
                data: bytes = binascii.unhexlify(h)
            else:
                data = raw_s.encode(self._encoding, errors="replace")
        except (binascii.Error, ValueError, LookupError) as exc:
            return None, f"编码或十六进制无效: {exc}"

        if send_cfg.get("appendCr"):
            data += b"\r"
        if send_cfg.get("appendLf"):
            data += b"\n"
        return data, ""

    def _读线程(self, receive_mode: SendMode) -> None:
        """后台读线程：逐行解析并推送。"""
        assert serial is not None
        buf = bytearray()
        poll = 0.02  # 20ms 轮询

        while not self._read_stop.is_set():
            ser = self._ser
            if ser is None or not getattr(ser, "is_open", False):
                time.sleep(poll)
                continue
            try:
                waiting = getattr(ser, "in_waiting", 0) or 0
                chunk = ser.read(max(1, int(waiting)))
            except (Exception,) as exc:
                日志.warning(f"RS232 读取错误: {exc}")
                time.sleep(poll)
                continue
            if not chunk:
                time.sleep(poll)
                continue

            buf.extend(chunk)
            # 按 \n 或 \r 分行
            while True:
                nl = buf.find(b"\n")
                cr = buf.find(b"\r")
                if nl < 0 and cr < 0:
                    break
                if nl >= 0 and (cr < 0 or nl < cr):
                    raw = bytes(buf[:nl])
                    del buf[: nl + 1]
                elif cr >= 0:
                    raw = bytes(buf[:cr])
                    del buf[: cr + 1]
                    if buf and buf[0:1] == b"\n":
                        del buf[:1]
                else:
                    break

                raw = raw[-self._max_receive_line_length:]
                if not raw:
                    continue

                if receive_mode == "hex":
                    text = binascii.hexlify(raw).decode("ascii")
                else:
                    try:
                        text = raw.decode(self._encoding, errors="replace")
                    except Exception:
                        text = raw.decode("utf-8", errors="replace")
                    text = text.rstrip("\r\n")

                prefix = f"{time.strftime('%H:%M:%S')} " if self._show_timestamp else ""
                line = f"{prefix}{text}"

                with self._lock:
                    self._receive_lines.append(line)

                self._推送接收行(line)
