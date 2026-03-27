from __future__ import annotations

from dataclasses import asdict, dataclass, field
from threading import Lock
from typing import Any


@dataclass
class MotionAxisFeedback:
    # 与前端 ControllerAxisDriverRead 对齐
    dpos: float = 0.0
    mpos: float = 0.0
    endmove: float = 0.0
    fs_limit: int = 0
    rs_limit: int = 0
    idle: int = 0
    mspeed: float = 0.0
    mtype: int = 0
    ntype: int = 0
    vp_speed: float = 0.0
    axisstatus: int = 0
    move_mark: int = 0
    move_curmark: int = 0
    axis_stopforeason: int = 0
    move_buffered: int = 0
    force_speed: float = 0.0
    startmove_speed: float = 0.0
    endmove_speed: float = 0.0


@dataclass
class MotionIoFeedback:
    # 与前端 ioMap 对齐：digitalIn 可写、digitalOut 回读
    digitalIn: bool = False
    digitalOut: bool = False


def _default_axis_feedback() -> dict[str, MotionAxisFeedback]:
    return {str(axis_no): MotionAxisFeedback() for axis_no in range(5)}


def _default_io_feedback() -> list[MotionIoFeedback]:
    return [MotionIoFeedback() for _ in range(9)]


@dataclass
class StateManager:
    hardware_connected: bool = False
    motion_connected: bool = False
    motion_positions: dict[str, float] = field(default_factory=dict)
    motion_axis_feedback: dict[str, MotionAxisFeedback] = field(default_factory=_default_axis_feedback)
    motion_io_map: list[MotionIoFeedback] = field(default_factory=_default_io_feedback)
    motion_driver_status: dict[str, Any] = field(default_factory=dict)
    motion_driver_mode: str = "sim"
    motion_last_error: str | None = None
    motion_last_error_code: int | None = None
    _lock: Lock = field(default_factory=Lock, repr=False)

    _AXIS_FLOAT_MAP = {
        "dpos": ("dpos",),
        "mpos": ("mpos",),
        "endmove": ("endmove",),
        "mspeed": ("mspeed",),
        "vp_speed": ("vp_speed", "speed"),
        "force_speed": ("force_speed",),
        "startmove_speed": ("startmove_speed",),
        "endmove_speed": ("endmove_speed",),
    }
    _AXIS_INT_MAP = {
        "fs_limit": ("fs_limit",),
        "rs_limit": ("rs_limit",),
        "mtype": ("mtype",),
        "ntype": ("ntype",),
        "axisstatus": ("axisstatus", "axis_status"),
        "move_mark": ("move_mark",),
        "move_curmark": ("move_curmark",),
        "axis_stopforeason": ("axis_stopforeason",),
        "move_buffered": ("move_buffered",),
    }

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "hardware_connected": self.hardware_connected,
                "motion_connected": self.motion_connected,
                "motion_positions": dict(self.motion_positions),
                "motion_axis_feedback": {
                    axis_no: asdict(feedback) for axis_no, feedback in self.motion_axis_feedback.items()
                },
                "motion_io_map": [asdict(item) for item in self.motion_io_map],
                "motion_driver_status": dict(self.motion_driver_status),
                "motion_driver_mode": self.motion_driver_mode,
                "motion_last_error": self.motion_last_error,
                "motion_last_error_code": self.motion_last_error_code,
            }

    def update(self, **kwargs: Any) -> None:
        with self._lock:
            for key, value in kwargs.items():
                setattr(self, key, value)

    def update_axis_feedback(self, axis_no: int, **kwargs: Any) -> None:
        axis_key = str(int(axis_no))
        with self._lock:
            if axis_key not in self.motion_axis_feedback:
                self.motion_axis_feedback[axis_key] = MotionAxisFeedback()
            axis_state = self.motion_axis_feedback[axis_key]
            for key, value in kwargs.items():
                if hasattr(axis_state, key):
                    setattr(axis_state, key, value)

    def update_io_feedback(
        self,
        io_no: int,
        *,
        digital_in: bool | None = None,
        digital_out: bool | None = None,
    ) -> None:
        idx = int(io_no)
        if idx < 0 or idx >= len(self.motion_io_map):
            return
        with self._lock:
            io_state = self.motion_io_map[idx]
            if digital_in is not None:
                io_state.digitalIn = bool(digital_in)
            if digital_out is not None:
                io_state.digitalOut = bool(digital_out)

    @staticmethod
    def _safe_float(value: Any, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _safe_int(value: Any, default: int) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _pick(axis_data: dict[str, Any], keys: tuple[str, ...], fallback: Any) -> Any:
        for key in keys:
            if key in axis_data:
                return axis_data[key]
        return fallback

    def sync_from_driver_status(self, status: dict[str, Any]) -> None:
        """
        将驱动器回读状态映射到前端 controllerSettings 结构。
        """
        axis_status_raw = status.get("axis_status", {}) or {}
        io_raw = status.get("io", {}) or {}
        io_inputs = io_raw.get("inputs", {}) or {}
        io_outputs = io_raw.get("outputs", {}) or {}

        with self._lock:
            self.motion_driver_status = dict(status)
            self.motion_driver_mode = str(status.get("driver_mode", self.motion_driver_mode))
            self.motion_last_error = status.get("last_error")
            self.motion_last_error_code = status.get("last_error_code")

            for axis_key, axis_data in axis_status_raw.items():
                if not isinstance(axis_data, dict):
                    continue
                axis_no = str(axis_key)
                if axis_no not in self.motion_axis_feedback:
                    self.motion_axis_feedback[axis_no] = MotionAxisFeedback()
                axis_fb = self.motion_axis_feedback[axis_no]

                for field, aliases in self._AXIS_FLOAT_MAP.items():
                    current = getattr(axis_fb, field)
                    raw = self._pick(axis_data, aliases, current)
                    setattr(axis_fb, field, self._safe_float(raw, current))
                for field, aliases in self._AXIS_INT_MAP.items():
                    current = getattr(axis_fb, field)
                    raw = self._pick(axis_data, aliases, current)
                    setattr(axis_fb, field, self._safe_int(raw, current))

                idle_raw = axis_data.get("idle", axis_fb.idle)
                axis_fb.idle = 1 if bool(idle_raw) else 0

                self.motion_positions[axis_no] = axis_fb.dpos

            for io_key, io_val in io_inputs.items():
                idx = int(io_key)
                if 0 <= idx < len(self.motion_io_map):
                    self.motion_io_map[idx].digitalIn = bool(io_val)

            for io_key, io_val in io_outputs.items():
                idx = int(io_key)
                if 0 <= idx < len(self.motion_io_map):
                    self.motion_io_map[idx].digitalOut = bool(io_val)


state_manager = StateManager()

