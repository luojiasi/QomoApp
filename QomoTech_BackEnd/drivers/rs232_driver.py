from __future__ import annotations

import binascii
import copy
import logging
import threading
import time
from collections import deque
from typing import Any, Literal

from config.rs232_config import Rs232Config

try:
    import serial
    from serial.tools import list_ports
except ImportError:  # pragma: no cover
    serial = None  # type: ignore[assignment]
    list_ports = None  # type: ignore[assignment]


FlowControl = Literal["none", "xon_xoff", "rts_cts", "dsr_dtr"]
Parity = Literal["none", "odd", "even", "mark", "space"]
SendMode = Literal["ascii", "hex"]


class Rs232Driver:
    """单路 RS232：进程内单例，对接 pyserial。"""

    def __init__(self, config: Rs232Config) -> None:
        self._config = config
        self._logger = logging.getLogger("qomotech.rs232")
        self._lock = threading.RLock()
        self._ser: Any = None
        self._current_port: str | None = None
        self._encoding: str = "utf-8"
        self._receive_lines: deque[str] = deque(maxlen=500)
        self._read_stop = threading.Event()
        self._read_thread: threading.Thread | None = None
        self._show_timestamp = False
        self._preferred_session: dict[str, Any] | None = None

    def pyserial_available(self) -> bool:
        return serial is not None

    @staticmethod
    def list_ports_info() -> list[dict[str, str]]:
        if list_ports is None:
            return []
        out: list[dict[str, str]] = []
        for p in list_ports.comports():
            out.append(
                {
                    "device": getattr(p, "device", "") or "",
                    "name": getattr(p, "name", "") or "",
                    "description": getattr(p, "description", "") or "",
                }
            )
        return out

    def is_connected(self) -> bool:
        with self._lock:
            return self._ser is not None and getattr(self._ser, "is_open", False)

    def current_port_name(self) -> str | None:
        with self._lock:
            return self._current_port

    def set_preferred_session(self, session: dict[str, Any]) -> None:
        """
        缓存前端上报的 RS232 会话参数（port/send/receive）。
        仅用于后续非 RS232 页面场景下的默认串口选择。
        """
        with self._lock:
            self._preferred_session = copy.deepcopy(session)

    def get_preferred_session(self) -> dict[str, Any] | None:
        with self._lock:
            if self._preferred_session is None:
                return None
            return copy.deepcopy(self._preferred_session)

    def get_receive_buffer(self, *, clear: bool = False) -> str:
        with self._lock:
            text = "\n".join(self._receive_lines)
            if clear:
                self._receive_lines.clear()
            return text

    def _parity_const(self, p: Parity) -> Any:
        assert serial is not None
        mapping = {
            "none": serial.PARITY_NONE,
            "odd": serial.PARITY_ODD,
            "even": serial.PARITY_EVEN,
            "mark": serial.PARITY_MARK,
            "space": serial.PARITY_SPACE,
        }
        return mapping[p]

    def _stopbits_const(self, s: float) -> Any:
        assert serial is not None
        if s == 1:
            return serial.STOPBITS_ONE
        if s == 1.5:
            return serial.STOPBITS_ONE_POINT_FIVE
        return serial.STOPBITS_TWO

    def _bytesize_const(self, bits: int) -> Any:
        assert serial is not None
        mapping = {
            5: serial.FIVEBITS,
            6: serial.SIXBITS,
            7: serial.SEVENBITS,
            8: serial.EIGHTBITS,
        }
        return mapping[int(bits)]

    def _flow_to_flags(self, fc: FlowControl) -> tuple[bool, bool, bool]:
        if fc == "xon_xoff":
            return True, False, False
        if fc == "rts_cts":
            return False, True, False
        if fc == "dsr_dtr":
            return False, False, True
        return False, False, False

    def _open_serial(self, port_cfg: dict[str, Any]) -> Any:
        assert serial is not None
        port = str(port_cfg["portName"])
        timeout = max(float(port_cfg.get("timeoutMs", 0)) / 1000.0, 0.0)
        xonxoff, rtscts, dsrdtr = self._flow_to_flags(port_cfg["flowControl"])
        return serial.Serial(
            port=port,
            baudrate=int(port_cfg["baudRate"]),
            bytesize=self._bytesize_const(int(port_cfg["dataBits"])),
            parity=self._parity_const(port_cfg["parity"]),
            stopbits=self._stopbits_const(float(port_cfg["stopBits"])),
            timeout=timeout,
            xonxoff=xonxoff,
            rtscts=rtscts,
            dsrdtr=dsrdtr,
        )

    def _reader_loop(self, receive_mode: SendMode, max_raw: int) -> None:
        assert serial is not None
        buf = bytearray()
        poll = self._config.read_thread_poll_ms / 1000.0
        while not self._read_stop.is_set():
            ser = self._ser
            if ser is None or not ser.is_open:
                time.sleep(poll)
                continue
            try:
                waiting = getattr(ser, "in_waiting", 0) or 0
                chunk = ser.read(max(1, int(waiting)))
            except (serial.SerialException, ValueError, OSError) as e:
                self._logger.warning("RS232 read error: %s", e)
                time.sleep(poll)
                continue
            if not chunk:
                time.sleep(poll)
                continue
            buf.extend(chunk)
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
                raw = raw[-max_raw:] if len(raw) > max_raw else raw
                if not raw:
                    continue
                if receive_mode == "hex":
                    text = binascii.hexlify(raw).decode("ascii")
                else:
                    try:
                        text = raw.decode(self._encoding, errors="replace")
                    except Exception:
                        text = raw.decode("utf-8", errors="replace")
                    text = text[:max_raw].rstrip("\r\n")
                prefix = f"{time.strftime('%H:%M:%S')} " if self._show_timestamp else ""
                with self._lock:
                    self._receive_lines.append(f"{prefix}{text}")

    def open_session(self, port_cfg: dict[str, Any], receive_cfg: dict[str, Any]) -> tuple[bool, str]:
        if serial is None:
            return False, "未安装 pyserial，请执行 pip install pyserial"

        self.close()

        try:
            new_ser = self._open_serial(port_cfg)
        except (serial.SerialException, ValueError, OSError) as e:
            return False, f"打开串口失败: {e}"

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

        self._read_stop.clear()
        self._read_thread = threading.Thread(
            target=self._reader_loop,
            args=(receive_mode, self._config.max_receive_line_length),
            name="rs232-reader",
            daemon=True,
        )
        self._read_thread.start()
        return True, "串口已打开"

    def close(self) -> bool:
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
        return True

    def _build_payload(self, send_cfg: dict[str, Any]) -> tuple[bytes | None, str]:
        mode: SendMode = send_cfg.get("mode", "ascii")
        if mode not in ("ascii", "hex"):
            mode = "ascii"
        raw_s = str(send_cfg.get("payload", ""))
        try:
            if mode == "hex":
                h = "".join(raw_s.split())
                data = binascii.unhexlify(h)
            else:
                data = raw_s.encode(self._encoding, errors="replace")
        except (binascii.Error, ValueError, LookupError) as e:
            return None, f"编码或十六进制无效: {e}"

        if send_cfg.get("appendCr"):
            data += b"\r"
        if send_cfg.get("appendLf"):
            data += b"\n"
        return data, ""

    def send(self, send_cfg: dict[str, Any]) -> tuple[bool, str]:
        data, err = self._build_payload(send_cfg)
        if data is None:
            return False, err

        with self._lock:
            ser = self._ser
            if ser is None or not getattr(ser, "is_open", False):
                return False, "串口未打开"
            try:
                ser.write(data)
                ser.flush()
            except (serial.SerialException, ValueError, OSError) as e:
                return False, f"发送失败: {e}"
        return True, "已发送"
