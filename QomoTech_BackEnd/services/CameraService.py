"""相机模块对外门面 —— ``CameraService``。

设计参考 ``MotionService``：

- **单例**：``CameraService.获取实例()`` 全局唯一；首次调用时延迟创建。
- **生命周期**：``启动 / 停止`` —— 启动会确保 SDK 初始化、按 bootstrap 缓存默认参数；
  停止会断开当前设备并关闭 SDK。
- **设备**：``枚举设备 / 连接 / 断开 / 是否已连接``。
- **取帧**：``取_jpeg(timeout_ms, quality)`` —— 单次抓帧；连续推流交给 WebSocket 路由。
- **参数**：曝光 / 帧率 / 镜像 / 白平衡 / 引导参数。
- **诊断**：``获取诊断``、``速度档位``。

复用 ``api.dependencies.camera_driver`` 全局单例，避免 DLL 双实例化导致 SDK 状态冲突；
也支持构造时注入自定义 ``CameraDriver``。
"""

from __future__ import annotations

import asyncio
import threading
from typing import Any, Dict, List, Optional

from configs.camera_config import CameraConfig, camera_config
from drivers.camera_driver import CameraDiagnostics, CameraDriver
from services.camera_control.CGcamera_adapter import (
    CameraError,
    设备信息,
    相机适配器,
)
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("CameraService")


def _默认driver() -> CameraDriver:
    """惰性获取 ``api.dependencies.camera_driver`` 单例（避免顶层 import 副作用）。"""

    from api.dependencies import camera_driver  # noqa: WPS433（迁移期容忍）

    return camera_driver


class CameraService:
    _实例: Optional["CameraService"] = None
    _实例锁 = threading.Lock()

    @classmethod
    def 获取实例(cls) -> "CameraService":
        if cls._实例 is None:
            with cls._实例锁:
                if cls._实例 is None:
                    cls._实例 = cls()
        return cls._实例

    @classmethod
    def 重置实例(cls) -> None:
        with cls._实例锁:
            cls._实例 = None

    # ------------------------------------------------------------------
    # 构造与生命周期
    # ------------------------------------------------------------------

    def __init__(
        self,
        driver: Optional[CameraDriver] = None,
        配置: Optional[CameraConfig] = None,
    ) -> None:
        self._配置: CameraConfig = 配置 if 配置 is not None else camera_config
        self._driver: CameraDriver = driver if driver is not None else _默认driver()
        self._adapter: 相机适配器 = 相机适配器(self._driver)
        self._服务锁 = asyncio.Lock()
        self._已启动: bool = False

    async def 启动(self) -> None:
        """初始化 SDK + 缓存 bootstrap 参数；不会自动 connect 相机。"""
        async with self._服务锁:
            if self._已启动:
                return
            await self._adapter.确保_sdk_初始化()
            bootstrap_dump = self._配置.bootstrap.model_dump(exclude_none=True)
            if bootstrap_dump:
                try:
                    await self._adapter.设置引导参数(bootstrap_dump)  # type: ignore[arg-type]
                except CameraError as exc:
                    日志.warning(f"bootstrap 参数缓存失败（启动继续）: {exc}")
            self._已启动 = True
            日志.info("CameraService 已启动")

    async def 停止(self) -> None:
        """断开当前设备并关闭 SDK。"""
        async with self._服务锁:
            if not self._已启动:
                return
            try:
                await self._adapter.关闭()
            except Exception as exc:
                日志.warning(f"关闭相机异常（已忽略）: {exc}")
            self._已启动 = False
            日志.info("CameraService 已停止")

    # ------------------------------------------------------------------
    # 设备
    # ------------------------------------------------------------------

    async def 枚举设备(self) -> List[设备信息]:
        await self._保证已启动()
        return await self._adapter.枚举设备()

    async def 连接(self, index: Optional[int] = None) -> 设备信息:
        await self._保证已启动()
        idx = self._配置.sdk.default_index if index is None else int(index)
        await self._adapter.连接(idx)
        diag = self._adapter.同步_诊断()
        return 设备信息(index=int(diag.selected_index or idx), name=f"#{idx}")

    async def 断开(self) -> None:
        await self._保证已启动()
        await self._adapter.断开()

    async def 是否已连接(self) -> bool:
        await self._保证已启动()
        return await self._adapter.是否已连接()

    # ------------------------------------------------------------------
    # 取帧
    # ------------------------------------------------------------------

    async def 取_jpeg(
        self,
        timeout_ms: Optional[int] = None,
        quality: Optional[int] = None,
    ) -> bytes:
        await self._保证已启动()
        t = self._配置.frame.default_timeout_ms if timeout_ms is None else int(timeout_ms)
        q = self._配置.frame.default_quality if quality is None else int(quality)
        return await self._adapter.取_jpeg(timeout_ms=t, quality=q)

    # ------------------------------------------------------------------
    # 参数
    # ------------------------------------------------------------------

    async def 设置引导参数(self, settings: Dict[str, Any]) -> None:
        await self._保证已启动()
        await self._adapter.设置引导参数(settings)  # type: ignore[arg-type]

    async def 设置曝光(
        self,
        *,
        auto_exposure: Optional[bool] = None,
        exposure_time: Optional[int] = None,
    ) -> None:
        await self._保证已启动()
        await self._adapter.设置曝光(
            auto_exposure=auto_exposure, exposure_time=exposure_time,
        )

    async def 设置帧率(
        self,
        *,
        speed_level: Optional[int] = None,
        auto_tune: bool = True,
        tune: Optional[float] = None,
    ) -> None:
        await self._保证已启动()
        await self._adapter.设置帧率(
            speed_level=speed_level, auto_tune=auto_tune, tune=tune,
        )

    async def 设置镜像(
        self,
        *,
        horizontal: Optional[bool] = None,
        vertical: Optional[bool] = None,
    ) -> None:
        await self._保证已启动()
        await self._adapter.设置镜像(horizontal=horizontal, vertical=vertical)

    async def 设置白平衡(
        self,
        *,
        auto_white_balance: Optional[bool] = None,
        once: bool = False,
        r_gain: Optional[int] = None,
        g_gain: Optional[int] = None,
        b_gain: Optional[int] = None,
    ) -> None:
        await self._保证已启动()
        await self._adapter.设置白平衡(
            auto_white_balance=auto_white_balance,
            once=once,
            r_gain=r_gain,
            g_gain=g_gain,
            b_gain=b_gain,
        )

    # ------------------------------------------------------------------
    # 诊断
    # ------------------------------------------------------------------

    def 获取诊断(self) -> CameraDiagnostics:
        """同步读取诊断（不依赖事件循环，便于路由层快速响应）。"""
        return self._adapter.同步_诊断()

    def 速度档位(self) -> Dict[str, int]:
        return self._adapter.速度档位映射()

    def 取_推流默认值(self) -> Dict[str, int]:
        return {
            "timeout_ms": self._配置.frame.ws_push_timeout_ms,
            "quality": self._配置.frame.ws_push_quality,
        }

    # ------------------------------------------------------------------
    # 内部
    # ------------------------------------------------------------------

    async def _保证已启动(self) -> None:
        if self._已启动:
            return
        await self.启动()
