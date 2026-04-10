from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import TypedDict

import cv2

from libs.cameradll.CGimagetechPython import (
    CGImageTechCamera,
    HIGH_SPEED,
    HIGHEST_SPEED,
    LOW_SPEED,
    LOWEST_SPEED,
    MD_HORIZONTAL,
    MD_VERTICAL,
)


@dataclass
class CameraDiagnostics:
    initialized: bool
    connected: bool
    streaming: bool
    selected_index: int | None
    last_error: str | None


class CameraBootstrapSettings(TypedDict, total=False):
    auto_exposure: bool
    exposure_time: int
    speed_level: int
    auto_tune: bool
    tune: float
    mirror_horizontal: bool
    mirror_vertical: bool
    auto_white_balance: bool
    r_gain: int
    g_gain: int
    b_gain: int


class CameraDriver:
    """CGImageTech 相机驱动单例包装。"""

    def __init__(self, dll_path: str = "CGDEVSDK.dll") -> None:
        self._camera = CGImageTechCamera(dll_path=dll_path)
        self._lock = threading.RLock()
        self._selected_index: int | None = None
        self._last_error: str | None = None
        self._bootstrap_settings: CameraBootstrapSettings = {}

    def _set_error(self, exc: Exception) -> None:
        self._last_error = str(exc)

    def _clear_error(self) -> None:
        self._last_error = None

    def _safe_speed_level(self, value: int) -> int:
        if value in (HIGHEST_SPEED, HIGH_SPEED, LOW_SPEED, LOWEST_SPEED):
            return value
        return HIGH_SPEED
# 首次相机连接发送给相机的数据
    def set_bootstrap_settings(self, settings: CameraBootstrapSettings) -> bool:
        with self._lock:
            try:
                self._bootstrap_settings = dict(settings)
                self._clear_error()
                return True
            except Exception as exc:  # noqa: BLE001
                self._set_error(exc)
                return False
    def diagnostics(self) -> CameraDiagnostics:
        with self._lock:
            return CameraDiagnostics(
                initialized=bool(self._camera.initialized),
                connected=bool(self._camera.device_handle),
                streaming=bool(self._camera._streaming),
                selected_index=self._selected_index,
                last_error=self._last_error,
            )

    def ensure_initialized(self) -> bool:
        with self._lock:
            if self._camera.initialized:
                return True
            status = self._camera.initialize()
            if status != 0:
                self._last_error = f"SDK 初始化失败: {status}"
                return False
            self._clear_error()
            return True

    def enum_devices(self) -> list[dict[str, int | str]]:
        with self._lock:
            if not self.ensure_initialized():
                return []
            try:
                devices = self._camera.enum_devices()
                self._clear_error()
                return devices
            except Exception as exc:  # noqa: BLE001
                self._set_error(exc)
                return []

    def connect(self, index: int = 0) -> bool:
        with self._lock:
            try:
                if not self.ensure_initialized():
                    return False
                self._camera.close_camera()


                handle = self._camera.open_camera(int(index))
                if not handle:
                    self._last_error = f"打开相机失败: index={index}"
                    return False

                status = self._camera.init_camera_for_getmode()
                if status != 0:
                    self._last_error = f"相机初始化失败: DeviceInit={status}"
                    self._camera.close_camera()
                    return False

                status = self._camera.start_stream()
                if status != 0:
                    self._last_error = f"启动视频流失败: DeviceStart={status}"
                    self._camera.close_camera()
                    return False
                cfg = dict(self._bootstrap_settings)

                mirror_horizontal = bool(cfg.get("mirror_horizontal", True))
                status = self._camera.set_mirror(MD_HORIZONTAL, mirror_horizontal)
                if status != 0:
                    self._last_error = f"设置水平镜像失败: {status}"
                    self._camera.close_camera()
                    return False
                if "mirror_vertical" in cfg:
                    status = self._camera.set_mirror(MD_VERTICAL, bool(cfg["mirror_vertical"]))
                    if status != 0:
                        self._last_error = f"设置垂直镜像失败: {status}"
                        self._camera.close_camera()
                        return False

                speed_level = self._safe_speed_level(int(cfg.get("speed_level", HIGH_SPEED)))
                auto_tune = bool(cfg.get("auto_tune", True))
                status = self._camera.set_frame_speed(speed_level, auto_tune)
                if status != 0:
                    self._last_error = f"设置帧率失败: {status}"
                    self._camera.close_camera()
                    return False
                if "tune" in cfg:
                    status = self._camera.set_frame_speed_tune(float(cfg["tune"]))
                    if status != 0:
                        self._last_error = f"设置帧率微调失败: {status}"
                        self._camera.close_camera()
                        return False

                auto_exposure = bool(cfg.get("auto_exposure", True))
                status = self._camera.set_auto_exposure(auto_exposure)
                if status != 0:
                    self._last_error = f"设置自动曝光失败: {status}"
                    self._camera.close_camera()
                    return False
                if "exposure_time" in cfg:
                    status = self._camera.set_exposure_time(int(cfg["exposure_time"]))
                    if status != 0:
                        self._last_error = f"设置曝光时间失败: {status}"
                        self._camera.close_camera()
                        return False

                auto_white_balance = bool(cfg.get("auto_white_balance", True))
                status = self._camera.set_auto_white_balance(auto_white_balance)
                if status != 0:
                    self._last_error = f"设置自动白平衡失败: {status}"
                    self._camera.close_camera()
                    return False
                if all(k in cfg for k in ("r_gain", "g_gain", "b_gain")):
                    status = self._camera.set_white_balance_gain(
                        int(cfg["r_gain"]),
                        int(cfg["g_gain"]),
                        int(cfg["b_gain"]),
                    )
                    if status != 0:
                        self._last_error = f"设置白平衡增益失败: {status}"
                        self._camera.close_camera()
                        return False

                self._selected_index = int(index)
                self._clear_error()
                return True
            except Exception as exc:  # noqa: BLE001
                self._set_error(exc)
                return False

    def disconnect(self) -> bool:
        with self._lock:
            try:
                self._camera.close_camera()
                self._selected_index = None
                self._clear_error()
                return True
            except Exception as exc:  # noqa: BLE001
                self._set_error(exc)
                return False

    def shutdown(self) -> None:
        with self._lock:
            try:
                self._camera.close_camera()
            finally:
                self._camera.uninitialize_sdk()
                self._selected_index = None

    def is_connected(self) -> bool:
        with self._lock:
            return bool(self._camera.device_handle)

    def get_jpeg_bytes(self, *, timeout_ms: int = 1000, quality: int = 90) -> bytes:
        with self._lock:
            if not self.is_connected():
                raise RuntimeError("相机未连接")
            frame = self._camera.capture_frame(timeout_ms=int(timeout_ms), as_bgr=True)
            ok, enc = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, int(quality)])
            if not ok:
                raise RuntimeError("JPEG 编码失败")
            self._clear_error()
            return enc.tobytes()

    def set_exposure(self, *, auto_exposure: bool | None = None, exposure_time: int | None = None) -> bool:
        with self._lock:
            if not self.is_connected():
                self._last_error = "相机未连接"
                return False
            try:
                if auto_exposure is not None:
                    st = self._camera.set_auto_exposure(bool(auto_exposure))
                    if st != 0:
                        self._last_error = f"设置自动曝光失败: {st}"
                        return False
                if exposure_time is not None:
                    st = self._camera.set_exposure_time(int(exposure_time))
                    if st != 0:
                        self._last_error = f"设置曝光时间失败: {st}"
                        return False
                self._clear_error()
                return True
            except Exception as exc:  # noqa: BLE001
                self._set_error(exc)
                return False

    def set_frame_speed(
        self,
        *,
        speed_level: int | None = None,
        auto_tune: bool = True,
        tune: float | None = None,
    ) -> bool:
        with self._lock:
            if not self.is_connected():
                self._last_error = "相机未连接"
                return False
            try:
                if speed_level is not None:
                    st = self._camera.set_frame_speed(int(speed_level), bool(auto_tune))
                    if st != 0:
                        self._last_error = f"设置帧率档位失败: {st}"
                        return False
                if tune is not None:
                    st = self._camera.set_frame_speed_tune(float(tune))
                    if st != 0:
                        self._last_error = f"设置帧率微调失败: {st}"
                        return False
                self._clear_error()
                return True
            except Exception as exc:  # noqa: BLE001
                self._set_error(exc)
                return False

    def set_mirror(self, *, horizontal: bool | None = None, vertical: bool | None = None) -> bool:
        with self._lock:
            if not self.is_connected():
                self._last_error = "相机未连接"
                return False
            try:
                if horizontal is not None:
                    st = self._camera.set_mirror(MD_HORIZONTAL, bool(horizontal))
                    if st != 0:
                        self._last_error = f"设置水平镜像失败: {st}"
                        return False
                if vertical is not None:
                    st = self._camera.set_mirror(MD_VERTICAL, bool(vertical))
                    if st != 0:
                        self._last_error = f"设置垂直镜像失败: {st}"
                        return False
                self._clear_error()
                return True
            except Exception as exc:  # noqa: BLE001
                self._set_error(exc)
                return False

    def set_white_balance(
        self,
        *,
        auto_white_balance: bool | None = None,
        once: bool = False,
        r_gain: int | None = None,
        g_gain: int | None = None,
        b_gain: int | None = None,
    ) -> bool:
        with self._lock:
            if not self.is_connected():
                self._last_error = "相机未连接"
                return False
            try:
                if auto_white_balance is not None:
                    st = self._camera.set_auto_white_balance(bool(auto_white_balance))
                    if st != 0:
                        self._last_error = f"设置自动白平衡失败: {st}"
                        return False
                if once:
                    st = self._camera.once_white_balance()
                    if st != 0:
                        self._last_error = f"一次白平衡失败: {st}"
                        return False
                if r_gain is not None and g_gain is not None and b_gain is not None:
                    st = self._camera.set_white_balance_gain(int(r_gain), int(g_gain), int(b_gain))
                    if st != 0:
                        self._last_error = f"设置白平衡增益失败: {st}"
                        return False
                self._clear_error()
                return True
            except Exception as exc:  # noqa: BLE001
                self._set_error(exc)
                return False


CAMERA_SPEED_LEVELS = {
    "HIGHEST_SPEED": HIGHEST_SPEED,
    "HIGH_SPEED": HIGH_SPEED,
    "LOW_SPEED": LOW_SPEED,
    "LOWEST_SPEED": LOWEST_SPEED,
}
