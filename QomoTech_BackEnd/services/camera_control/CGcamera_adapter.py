"""CGImageTech 相机适配器 —— 包装旧 ``drivers.camera_driver.CameraDriver``。

设计要点：

1. **异步桥**：所有阻塞调用走 ``asyncio.to_thread``，避免阻塞事件循环。
2. **串行化**：底层 ``CameraDriver`` 内部已用 ``RLock`` 保护，无须再额外加锁；
   但 service 层若需要"取帧 vs. 配置"互斥，可在 ``CameraService`` 加锁。
3. **错误规约**：把 ``CameraDriver`` 的 ``bool 返回 + last_error`` 风格统一翻译为
   ``CameraError`` 异常，便于路由层用统一 try/except 处理（HTTP 502）。
4. **不创建副本**：直接持有用户传入的 ``CameraDriver`` 实例（建议 service 层
   注入由旧 ``api.dependencies.camera_driver`` 提供的全局单例，避免与旧代码冲突）。
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from drivers.camera_driver import (
    CAMERA_SPEED_LEVELS,
    CameraBootstrapSettings,
    CameraDiagnostics,
    CameraDriver,
)
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("CameraAdapter")


# ==================================================================
# 异常 / 数据载体
# ==================================================================


class CameraError(Exception):
    """相机操作失败的统一异常（路由层应映射到 HTTP 502）。"""


@dataclass(frozen=True)
class 设备信息:
    """通用设备描述，``enum_devices`` 的返回结构归一。"""

    index: int
    name: str
    serial: Optional[str] = None

    @classmethod
    def 从原始(cls, raw: Dict[str, Any]) -> "设备信息":
        return cls(
            index=int(raw.get("devIndex", raw.get("index", 0))),
            name=str(raw.get("devName") or raw.get("name") or "Unknown"),
            serial=raw.get("devSN") or raw.get("serial"),
        )


# ==================================================================
# 适配器
# ==================================================================


class 相机适配器:
    """对外暴露的相机异步接口；内部委托给 ``CameraDriver``。"""

    def __init__(self, driver: CameraDriver) -> None:
        self._driver = driver

    # ------------------------------------------------------------------
    # SDK 级生命周期
    # ------------------------------------------------------------------

    async def 确保_sdk_初始化(self) -> bool:
        """确保 SDK 已初始化；返回是否成功。失败时抛 CameraError。"""
        ok = await asyncio.to_thread(self._driver.ensure_initialized)
        if not ok:
            raise CameraError(self._最后错误() or "SDK 初始化失败")
        return True

    async def 关闭(self) -> None:
        """关闭 SDK + 设备（程序退出时调用）。"""
        await asyncio.to_thread(self._driver.shutdown)

    # ------------------------------------------------------------------
    # 设备枚举 / 连接 / 断开
    # ------------------------------------------------------------------

    async def 枚举设备(self) -> List[设备信息]:
        raw_list: List[Dict[str, Any]] = await asyncio.to_thread(
            self._driver.enum_devices,
        )
        return [设备信息.从原始(r) for r in raw_list]

    async def 设置引导参数(self, settings: CameraBootstrapSettings) -> None:
        ok = await asyncio.to_thread(self._driver.set_bootstrap_settings, settings)
        if not ok:
            raise CameraError(self._最后错误() or "引导参数缓存失败")

    async def 连接(self, index: int = 0) -> None:
        ok = await asyncio.to_thread(self._driver.connect, int(index))
        if not ok:
            raise CameraError(self._最后错误() or f"打开相机 index={index} 失败")
        日志.info(f"相机 index={index} 已连接")

    async def 断开(self) -> None:
        ok = await asyncio.to_thread(self._driver.disconnect)
        if not ok:
            raise CameraError(self._最后错误() or "相机断开失败")
        日志.info("相机已断开")

    async def 是否已连接(self) -> bool:
        return await asyncio.to_thread(self._driver.is_connected)

    # ------------------------------------------------------------------
    # 取帧
    # ------------------------------------------------------------------

    async def 取_jpeg(self, timeout_ms: int = 1000, quality: int = 90) -> bytes:
        try:
            return await asyncio.to_thread(
                self._driver.get_jpeg_bytes,
                timeout_ms=int(timeout_ms),
                quality=int(quality),
            )
        except Exception as exc:
            raise CameraError(str(exc)) from exc

    # ------------------------------------------------------------------
    # 参数设置（透传）
    # ------------------------------------------------------------------

    async def 设置曝光(
        self,
        *,
        auto_exposure: Optional[bool] = None,
        exposure_time: Optional[int] = None,
    ) -> None:
        ok = await asyncio.to_thread(
            self._driver.set_exposure,
            auto_exposure=auto_exposure,
            exposure_time=exposure_time,
        )
        if not ok:
            raise CameraError(self._最后错误() or "曝光参数设置失败")

    async def 设置帧率(
        self,
        *,
        speed_level: Optional[int] = None,
        auto_tune: bool = True,
        tune: Optional[float] = None,
    ) -> None:
        ok = await asyncio.to_thread(
            self._driver.set_frame_speed,
            speed_level=speed_level,
            auto_tune=auto_tune,
            tune=tune,
        )
        if not ok:
            raise CameraError(self._最后错误() or "帧率参数设置失败")

    async def 设置镜像(
        self,
        *,
        horizontal: Optional[bool] = None,
        vertical: Optional[bool] = None,
    ) -> None:
        ok = await asyncio.to_thread(
            self._driver.set_mirror,
            horizontal=horizontal,
            vertical=vertical,
        )
        if not ok:
            raise CameraError(self._最后错误() or "镜像参数设置失败")

    async def 设置白平衡(
        self,
        *,
        auto_white_balance: Optional[bool] = None,
        once: bool = False,
        r_gain: Optional[int] = None,
        g_gain: Optional[int] = None,
        b_gain: Optional[int] = None,
    ) -> None:
        ok = await asyncio.to_thread(
            self._driver.set_white_balance,
            auto_white_balance=auto_white_balance,
            once=once,
            r_gain=r_gain,
            g_gain=g_gain,
            b_gain=b_gain,
        )
        if not ok:
            raise CameraError(self._最后错误() or "白平衡参数设置失败")

    # ------------------------------------------------------------------
    # 诊断 / 元信息
    # ------------------------------------------------------------------

    def 同步_诊断(self) -> CameraDiagnostics:
        """非阻塞读取诊断信息（CameraDriver 内部仅是字段读取，安全直接调用）。"""
        return self._driver.diagnostics()

    @staticmethod
    def 速度档位映射() -> Dict[str, int]:
        return dict(CAMERA_SPEED_LEVELS)

    # ------------------------------------------------------------------
    # 内部
    # ------------------------------------------------------------------

    def _最后错误(self) -> Optional[str]:
        return self._driver.diagnostics().last_error
