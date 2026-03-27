from __future__ import annotations

import logging
from threading import Event, Thread
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.state_manager import StateManager
    from drivers.zmotion_driver import ZMotionDriver


class HardwareStatusPoller:
    """
    后台采集线程：
    - 固定周期读取运动/相机状态
    - 将结果写入 StateManager，供前端读取快照
    """

    def __init__(
        self,
        motion: ZMotionDriver,
        state: StateManager,
        *,
        interval_s: float = 0.05,
        io_start: int = 0,
        io_end: int = 8,
    ) -> None:
        self._motion = motion
        self._state = state
        self._interval_s = float(interval_s)
        self._io_start = int(io_start)
        self._io_end = int(io_end)
        self._stop_event = Event()
        self._thread: Thread | None = None
        self._logger = logging.getLogger("qomotech.status_poller")

    def _io_dict(self, io_status: dict[int, bool]) -> dict[str, bool]:
        return {
            str(i): bool(io_status.get(i, False))
            for i in range(self._io_start, self._io_end + 1)
        }

    def _build_driver_status(self) -> dict[str, object]:
        axes_status = self._motion.get_axes_status()
        inputs_status = self._motion.get_inputs_status(self._io_start, self._io_end)
        outputs_status = self._motion.get_outputs_status(self._io_start, self._io_end)
        return {
            "driver_mode": self._motion.driver_mode,
            "last_error": self._motion.last_error,
            "last_error_code": self._motion.last_error_code,
            "axis_status": axes_status,
            "io": {
                "inputs": self._io_dict(inputs_status),
                "outputs": self._io_dict(outputs_status),
                "invert_inputs": {str(i): False for i in range(self._io_start, self._io_end + 1)},
                "axis_io_mapping": {},
            },
        }

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = Thread(target=self._run, name="hardware-status-poller", daemon=True)
        self._thread.start()
        self._logger.info("HardwareStatusPoller started (interval=%.0fms)", self._interval_s * 1000)

    def stop(self, timeout_s: float = 1.0) -> None:
        self._stop_event.set()
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=timeout_s)
        self._thread = None
        self._logger.info("HardwareStatusPoller stopped")

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                motion_ok = self._motion.is_connected()
                driver_status = self._build_driver_status()

                self._state.update(
                    motion_connected=motion_ok,
                    hardware_connected=bool(motion_ok),
                )
                self._state.sync_from_driver_status(driver_status)
            except Exception as exc:
                self._logger.exception("poll hardware status failed: %s", exc)

            self._stop_event.wait(self._interval_s)

