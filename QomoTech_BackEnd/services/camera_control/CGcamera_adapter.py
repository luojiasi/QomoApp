"""CGImageTech 相机适配器 —— 直接调用 libs/cameradll SDK。

与 zmc_adapter 结构对齐：
  - import DLL Python 封装（CGimagetechPython）
  - 所有阻塞调用走 asyncio.to_thread
  - 自身持 CameraError 异常 + CameraDiagnostics 数据类

不再依赖 drivers/camera_driver.py。
"""
from __future__ import annotations

import asyncio
import io
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

from libs.cameradll.CGimagetechPython import CGImageTechCamera
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("相机适配器")

# ------------------------------------------------------------------
# 常量（与 CGimagetechPython 对齐）
# ------------------------------------------------------------------
DATA_ISP_RGB24 = 0x00
HIGHEST_SPEED = 0x00
HIGH_SPEED = 0x01
LOW_SPEED = 0x02
LOWEST_SPEED = 0x03
MD_HORIZONTAL = 0x00
MD_VERTICAL = 0x01

CAMERA_SPEED_LEVELS: Dict[str, int] = {
    "HIGHEST": HIGHEST_SPEED,
    "HIGH": HIGH_SPEED,
    "LOW": LOW_SPEED,
    "LOWEST": LOWEST_SPEED,
}


# ==================================================================
# 异常 / 数据载体
# ==================================================================


class CameraError(Exception):
    """相机操作失败的统一异常（路由层映射到 HTTP 502）。"""


@dataclass
class CameraDiagnostics:
    """相机诊断信息（同步读取，仅字段访问）。"""

    initialized: bool = False
    connected: bool = False
    streaming: bool = False
    selected_index: Optional[int] = None
    last_error: Optional[str] = None


@dataclass(frozen=True)
class 设备信息:
    """通用设备描述。"""

    index: int
    name: str
    serial: Optional[str] = None

    @classmethod
    def 从原始(cls, raw: Dict[str, Any]) -> "设备信息":
        return cls(
            index=int(raw.get("devIndex", raw.get("list_index", 0))),
            name=str(raw.get("name", "Unknown")),
            serial=raw.get("devSN"),
        )


# ==================================================================
# 适配器
# ==================================================================


class 相机适配器:
    """直接操作 CGImageTechCamera SDK 的异步适配器。"""

    def __init__(self) -> None:
        self._cam: Optional[CGImageTechCamera] = None
        self._已连接: bool = False
        self._已推流: bool = False
        self._选中索引: Optional[int] = None
        self._最后错误: Optional[str] = None

    # ------------------------------------------------------------------
    # SDK 生命周期
    # ------------------------------------------------------------------

    async def 确保_sdk_初始化(self) -> bool:
        """初始化 SDK。"""
        cam = CGImageTechCamera()
        status = await asyncio.to_thread(cam.initialize)
        if status != 0:
            raise CameraError(f"SDK 初始化失败，错误码: {status}")
        self._cam = cam
        日志.info("相机 SDK 初始化成功")
        return True

    async def 关闭(self) -> None:
        """关闭 SDK + 设备。"""
        if self._cam is None:
            return
        try:
            await self.断开()
        except Exception:
            pass
        cam = self._cam
        self._cam = None
        await asyncio.to_thread(cam.uninitialize_sdk)
        self._已连接 = False
        self._已推流 = False
        日志.info("相机 SDK 已关闭")

    # ------------------------------------------------------------------
    # 设备枚举 / 连接 / 断开
    # ------------------------------------------------------------------

    async def 枚举设备(self) -> List[设备信息]:
        self._断言sdk()
        raw_list = await asyncio.to_thread(self._cam.enum_devices)
        return [设备信息.从原始(r) for r in raw_list]

    async def 连接(self, index: int = 0) -> None:
        """打开相机 → 初始化 GetMode → 启动视频流。"""
        self._断言sdk()
        cam = self._cam

        # 1. 打开设备
        h = await asyncio.to_thread(cam.open_camera, int(index))
        if h is None:
            raise CameraError(f"打开相机 index={index} 失败")
        日志.info(f"相机 index={index} 已打开")

        # 2. 初始化为 GetMode
        status = await asyncio.to_thread(
            cam.init_camera_for_getmode, DATA_ISP_RGB24, True,
        )
        if status != 0:
            await asyncio.to_thread(cam.close_camera)
            raise CameraError(f"相机 DeviceInit 失败，错误码: {status}")

        # 3. 启动视频流（取帧前必须调用）
        status = await asyncio.to_thread(cam.start_stream)
        if status != 0:
            await asyncio.to_thread(cam.close_camera)
            raise CameraError(f"相机启动推流失败，错误码: {status}")

        self._已连接 = True
        self._已推流 = True
        self._选中索引 = int(index)
        self._最后错误 = None
        日志.info(f"相机 index={index} 连接并启动推流成功")

    async def 断开(self) -> None:
        """停止推流 + 关闭设备。"""
        cam = self._cam
        if cam is None:
            self._已连接 = False
            self._已推流 = False
            return

        if self._已推流:
            try:
                await asyncio.to_thread(cam.stop_stream)
            except Exception as exc:
                日志.warning(f"停止推流异常: {exc}")
            self._已推流 = False

        await asyncio.to_thread(cam.close_camera)
        self._已连接 = False
        self._选中索引 = None
        日志.info("相机已断开")

    # ------------------------------------------------------------------
    # 取帧
    # ------------------------------------------------------------------

    async def 取_jpeg(self, timeout_ms: int = 1000, quality: int = 90) -> bytes:
        """抓取一帧并编码为 JPEG 字节流。"""
        self._断言已连接()
        cam = self._cam

        try:
            img_bgr = await asyncio.to_thread(
                cam.capture_frame, int(timeout_ms), True,
            )
        except Exception as exc:
            raise CameraError(str(exc)) from exc

        if img_bgr is None or img_bgr.size == 0:
            raise CameraError("取帧返回空图像")

        success, buf = cv2.imencode(".jpg", img_bgr, [
            cv2.IMWRITE_JPEG_QUALITY, int(quality),
        ])
        if not success:
            raise CameraError("JPEG 编码失败")
        return bytes(buf)

    # ------------------------------------------------------------------
    # 参数设置
    # ------------------------------------------------------------------

    async def 设置引导参数(self, settings: Dict[str, Any]) -> None:
        """连接前缓存/连接后立即下发引导参数。"""
        self._断言sdk()
        cam = self._cam
        errors: List[str] = []

        if "auto_exposure" in settings:
            st = await asyncio.to_thread(cam.set_auto_exposure, bool(settings["auto_exposure"]))
            if st != 0:
                errors.append(f"auto_exposure={settings['auto_exposure']} 失败({st})")
        if "exposure_time" in settings:
            st = await asyncio.to_thread(cam.set_exposure_time, int(settings["exposure_time"]))
            if st != 0:
                errors.append(f"exposure_time={settings['exposure_time']} 失败({st})")
        if "speed_level" in settings:
            st = await asyncio.to_thread(cam.set_frame_speed, int(settings["speed_level"]), bool(settings.get("auto_tune", True)))
            if st != 0:
                errors.append(f"speed_level={settings['speed_level']} 失败({st})")
        if "tune" in settings:
            st = await asyncio.to_thread(cam.set_frame_speed_tune, float(settings["tune"]))
            if st != 0:
                errors.append(f"tune={settings['tune']} 失败({st})")
        if "mirror_horizontal" in settings:
            st = await asyncio.to_thread(cam.set_horizontal_mirror, bool(settings["mirror_horizontal"]))
            if st != 0:
                errors.append(f"mirror_horizontal 失败({st})")
        if "mirror_vertical" in settings:
            st = await asyncio.to_thread(cam.set_vertical_mirror, bool(settings["mirror_vertical"]))
            if st != 0:
                errors.append(f"mirror_vertical 失败({st})")
        if all(k in settings for k in ("r_gain", "g_gain", "b_gain")):
            # 设手动增益前先关闭自动白平衡，否则 SDK 会报错 -3
            st = await asyncio.to_thread(cam.set_auto_white_balance, False)
            if st != 0:
                errors.append(f"关闭自动白平衡失败({st})")
            st = await asyncio.to_thread(
                cam.set_white_balance_gain,
                int(settings["r_gain"]),
                int(settings["g_gain"]),
                int(settings["b_gain"]),
            )
            if st != 0:
                日志.warning(f"白平衡增益失败({st})，该相机可能不支持手动增益，跳过")
        elif "auto_white_balance" in settings:
            st = await asyncio.to_thread(cam.set_auto_white_balance, bool(settings["auto_white_balance"]))
            if st != 0:
                errors.append(f"auto_white_balance 失败({st})")
        if settings.get("once"):
            st = await asyncio.to_thread(cam.once_white_balance)
            if st != 0:
                errors.append(f"once_white_balance 失败({st})")

        if errors:
            raise CameraError("；".join(errors))

    async def 设置曝光(
        self,
        *,
        auto_exposure: Optional[bool] = None,
        exposure_time: Optional[int] = None,
    ) -> None:
        self._断言已连接()
        cam = self._cam
        if auto_exposure is not None:
            st = await asyncio.to_thread(cam.set_auto_exposure, bool(auto_exposure))
            if st != 0:
                raise CameraError(f"设置自动曝光失败: {st}")
        if exposure_time is not None:
            st = await asyncio.to_thread(cam.set_exposure_time, int(exposure_time))
            if st != 0:
                raise CameraError(f"设置曝光时间失败: {st}")
        日志.debug(f"曝光参数已设置 auto={auto_exposure} time={exposure_time}")

    async def 设置帧率(
        self,
        *,
        speed_level: Optional[int] = None,
        auto_tune: bool = True,
        tune: Optional[float] = None,
    ) -> None:
        self._断言已连接()
        cam = self._cam
        if speed_level is not None:
            st = await asyncio.to_thread(cam.set_frame_speed, int(speed_level), bool(auto_tune))
            if st != 0:
                raise CameraError(f"设置帧率档位失败: {st}")
        if tune is not None:
            st = await asyncio.to_thread(cam.set_frame_speed_tune, float(tune))
            if st != 0:
                raise CameraError(f"设置帧率微调失败: {st}")
        日志.debug(f"帧率参数已设置 level={speed_level} tune={tune}")

    async def 设置镜像(
        self,
        *,
        horizontal: Optional[bool] = None,
        vertical: Optional[bool] = None,
    ) -> None:
        self._断言已连接()
        cam = self._cam
        if horizontal is not None:
            st = await asyncio.to_thread(cam.set_horizontal_mirror, bool(horizontal))
            if st != 0:
                raise CameraError(f"设置水平镜像失败: {st}")
        if vertical is not None:
            st = await asyncio.to_thread(cam.set_vertical_mirror, bool(vertical))
            if st != 0:
                raise CameraError(f"设置垂直镜像失败: {st}")
        日志.debug(f"镜像参数已设置 horizontal={horizontal} vertical={vertical}")

    async def 设置白平衡(
        self,
        *,
        auto_white_balance: Optional[bool] = None,
        once: bool = False,
        r_gain: Optional[int] = None,
        g_gain: Optional[int] = None,
        b_gain: Optional[int] = None,
    ) -> None:
        self._断言已连接()
        cam = self._cam
        if auto_white_balance is not None:
            st = await asyncio.to_thread(cam.set_auto_white_balance, bool(auto_white_balance))
            if st != 0:
                raise CameraError(f"设置自动白平衡失败: {st}")
        if once:
            st = await asyncio.to_thread(cam.once_white_balance)
            if st != 0:
                raise CameraError(f"一次白平衡失败: {st}")
        if all(v is not None for v in (r_gain, g_gain, b_gain)):
            st = await asyncio.to_thread(
                cam.set_white_balance_gain,
                int(r_gain), int(g_gain), int(b_gain),
            )
            if st != 0:
                raise CameraError(f"设置白平衡增益失败: {st}")
        日志.debug(f"白平衡参数已设置 auto={auto_white_balance} once={once} gain=({r_gain},{g_gain},{b_gain})")

    # ------------------------------------------------------------------
    # 诊断 / 元信息
    # ------------------------------------------------------------------

    def 同步_诊断(self) -> CameraDiagnostics:
        return CameraDiagnostics(
            initialized=self._cam is not None,
            connected=self._已连接,
            streaming=self._已推流,
            selected_index=self._选中索引,
            last_error=self._最后错误,
        )

    @staticmethod
    def 速度档位映射() -> Dict[str, int]:
        return dict(CAMERA_SPEED_LEVELS)

    # ------------------------------------------------------------------
    # 内部
    # ------------------------------------------------------------------

    def _断言sdk(self) -> None:
        if self._cam is None:
            raise CameraError("SDK 未初始化，请先调用 确保_sdk_初始化")

    def _断言已连接(self) -> None:
        self._断言sdk()
        if not self._已连接:
            raise CameraError("相机未连接")
