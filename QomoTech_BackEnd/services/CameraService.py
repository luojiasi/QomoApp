"""相机服务单例编排层。

与 MotionService 结构对齐：
  - 状态机 + 状态快照
  - 适配器直接调用 libs/cameradll SDK
  - 路由层通过单例调用

用法：
    svc = CameraService.获取实例()
    await svc.启动()
    info = await svc.连接(0)
"""
from __future__ import annotations

import asyncio
import threading
from typing import Any, Dict, List, Optional

from services.camera_control.camera_models import 相机快照, 相机状态
from services.camera_control.camera_state_machine import 相机事件, 相机状态机
from services.camera_control.CGcamera_adapter import (
    CameraError,
    相机适配器,
    设备信息,
)
from services.camera_control import camera_persistence
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("相机服务")

_默认推流质量 = 85
_默认推流超时毫秒 = 1000


class CameraService:
    """相机服务单例编排器。"""

    _实例: Optional["CameraService"] = None
    _实例锁 = threading.Lock()

    # ------------------------------------------------------------------
    # 单例
    # ------------------------------------------------------------------

    @classmethod
    def 获取实例(cls) -> "CameraService":
        with cls._实例锁:
            if cls._实例 is None:
                cls._实例 = cls()
            return cls._实例

    @classmethod
    def 重置实例(cls) -> None:
        with cls._实例锁:
            cls._实例 = None

    def __init__(self) -> None:
        self._状态机: 相机状态机 = 相机状态机()
        self.适配器: Optional[相机适配器] = None
        self._服务锁 = asyncio.Lock()
        self._引导参数缓存: Dict[str, Any] = {}
        self._文件加载的设置: Dict[str, Any] = {}
        self._最新快照: 相机快照 = 相机快照.未初始化()

    # ==================================================================
    # 生命周期
    # ==================================================================

    async def 启动(self) -> None:
        """初始化相机 SDK + 适配器；从文件加载已保存的设置。"""
        async with self._服务锁:
            if self._状态机.当前 != 相机状态.UNINITIALIZED:
                return

        # 从文件加载已保存的设置
        try:
            文件数据 = camera_persistence.从文件加载()
            if 文件数据:
                self._文件加载的设置 = 文件数据
                日志.info("已从文件加载相机设置")
        except Exception as exc:
            日志.warning(f"从文件加载相机设置失败: {exc}")

        adapter = 相机适配器()
        try:
            await adapter.确保_sdk_初始化()
        except CameraError:
            raise
        except Exception as exc:
            raise CameraError(f"SDK 初始化失败: {exc}") from exc

        self.适配器 = adapter
        self._状态机.触发(相机事件.INIT)
        self._刷新快照()
        日志.info("CameraService 已启动")

    async def 停止(self) -> None:
        async with self._服务锁:
            当前 = self._状态机.当前
            if 当前 == 相机状态.UNINITIALIZED:
                return
            日志.info("CameraService 停止中...")
            if self.适配器 is not None:
                try:
                    await self.适配器.关闭()
                except Exception as exc:
                    日志.warning(f"关闭相机适配器异常: {exc}")
            self.适配器 = None
            self._状态机.触发(相机事件.SHUTDOWN, 强制=True)
            self._最新快照 = 相机快照.未初始化()
            日志.info("CameraService 已停止")

    # ==================================================================
    # 设备操作
    # ==================================================================

    async def 枚举设备(self) -> List[设备信息]:
        async with self._服务锁:
            self._准入(相机状态.IDLE, 相机状态.CONNECTED)
            设备列表 = await self.适配器.枚举设备()
            日志.info(f"枚举相机设备: {[d.name for d in 设备列表]}")
            return 设备列表

    async def 连接(self, index: int = 0) -> 设备信息:
        async with self._服务锁:
            self._准入(相机状态.IDLE)
            try:
                await self.适配器.连接(index)
            except CameraError:
                raise
            except Exception as exc:
                raise CameraError(f"连接相机失败: {exc}") from exc

            self._状态机.触发(相机事件.CONNECT)
            日志.info(f"相机连接成功 index={index}")

            # 连接后下发设置：优先用引导参数缓存，其次用文件加载的设置
            待下发 = self._引导参数缓存 or self._文件加载的设置
            if 待下发:
                try:
                    await self.适配器.设置引导参数(待下发)
                    日志.info(f"相机设置已下发: {待下发}")
                except Exception as exc:
                    日志.warning(f"相机设置下发失败: {exc}")
                self._引导参数缓存.clear()

            self._刷新快照()
            return 设备信息(index=index, name=f"#{index}")

    async def 断开(self) -> None:
        async with self._服务锁:
            self._准入(相机状态.CONNECTED)
            try:
                await self.适配器.断开()
            except CameraError:
                raise
            except Exception as exc:
                raise CameraError(f"断开相机失败: {exc}") from exc

            self._状态机.触发(相机事件.DISCONNECT)
            self._刷新快照()
            日志.info("相机已断开")

    async def 是否已连接(self) -> bool:
        return self._状态机.当前 == 相机状态.CONNECTED

    # ==================================================================
    # 取帧
    # ==================================================================

    async def 取_jpeg(
        self,
        timeout_ms: int = 1000,
        quality: int = 90,
    ) -> bytes:
        async with self._服务锁:
            self._准入(相机状态.CONNECTED)

        # 锁在此处已释放 —— 取帧期间不再阻塞参数设置/断开等操作
        # 若取帧途中相机被断开，adapter 内部 _断言已连接 会抛出 CameraError，
        # 由上层 WS 推送循环捕获并重试
        adapter = self.适配器
        if adapter is None:
            raise CameraError("相机服务未就绪")
        数据 = await adapter.取_jpeg(
            timeout_ms=timeout_ms, quality=quality,
        )
        日志.debug(f"取帧成功 size={len(数据)}B quality={quality}")
        return 数据

    # ==================================================================
    # 参数设置
    # ==================================================================

    async def 设置引导参数(self, settings: Dict[str, Any]) -> None:
        async with self._服务锁:
            self._准入(相机状态.IDLE, 相机状态.CONNECTED)
            if self._状态机.当前 == 相机状态.IDLE:
                self._引导参数缓存 = dict(settings)
            else:
                await self.适配器.设置引导参数(settings)

    async def 保存并下发设置(self, data: Dict[str, Any]) -> None:
        """保存相机设置到文件；若已连接则立即下发到相机。"""
        # 始终保存到文件
        camera_persistence.保存到文件(data)
        self._文件加载的设置 = dict(data)
        日志.info("相机设置已保存到文件")

        # 已连接时直接下发
        async with self._服务锁:
            if self._状态机.当前 != 相机状态.CONNECTED or self.适配器 is None:
                日志.info("相机未连接，跳过下发")
                return
            try:
                await self.适配器.设置引导参数(data)
                日志.info("相机设置已下发到相机")
            except Exception as exc:
                日志.warning(f"相机设置下发失败: {exc}")

    async def 设置曝光(
        self,
        *,
        auto_exposure: Optional[bool] = None,
        exposure_time: Optional[int] = None,
    ) -> None:
        async with self._服务锁:
            self._准入(相机状态.CONNECTED)
            await self.适配器.设置曝光(
                auto_exposure=auto_exposure, exposure_time=exposure_time,
            )
            日志.info(f"设置曝光 auto={auto_exposure} time={exposure_time}")

    async def 设置帧率(
        self,
        *,
        speed_level: Optional[int] = None,
        auto_tune: bool = True,
        tune: Optional[float] = None,
    ) -> None:
        async with self._服务锁:
            self._准入(相机状态.CONNECTED)
            await self.适配器.设置帧率(
                speed_level=speed_level, auto_tune=auto_tune, tune=tune,
            )
            日志.info(f"设置帧率 level={speed_level} auto_tune={auto_tune} tune={tune}")

    async def 设置镜像(
        self,
        *,
        horizontal: Optional[bool] = None,
        vertical: Optional[bool] = None,
    ) -> None:
        async with self._服务锁:
            self._准入(相机状态.CONNECTED)
            await self.适配器.设置镜像(
                horizontal=horizontal, vertical=vertical,
            )
            日志.info(f"设置镜像 horizontal={horizontal} vertical={vertical}")

    async def 设置白平衡(
        self,
        *,
        auto_white_balance: Optional[bool] = None,
        once: bool = False,
        r_gain: Optional[int] = None,
        g_gain: Optional[int] = None,
        b_gain: Optional[int] = None,
    ) -> None:
        async with self._服务锁:
            self._准入(相机状态.CONNECTED)
            await self.适配器.设置白平衡(
                auto_white_balance=auto_white_balance,
                once=once,
                r_gain=r_gain,
                g_gain=g_gain,
                b_gain=b_gain,
            )
            日志.info(f"设置白平衡 auto={auto_white_balance} once={once} gain=({r_gain},{g_gain},{b_gain})")

    # ==================================================================
    # 状态 / 诊断
    # ==================================================================

    def 获取快照(self) -> 相机快照:
        return self._最新快照

    def 获取诊断(self):
        """同步读取底层驱动诊断。"""
        if self.适配器 is None:
            return None
        return self.适配器.同步_诊断()

    @staticmethod
    def 速度档位() -> Dict[str, int]:
        return 相机适配器.速度档位映射()

    @staticmethod
    def 取_推流默认值() -> Dict[str, Any]:
        return {
            "quality": _默认推流质量,
            "timeout_ms": _默认推流超时毫秒,
        }

    # ==================================================================
    # 内部
    # ==================================================================

    def _准入(self, *允许状态: 相机状态) -> None:
        当前 = self._状态机.当前
        if 当前 not in 允许状态:
            raise CameraError(
                f"当前状态 {当前.value} 不允许该操作"
                f"（需要 {' / '.join(s.value for s in 允许状态)}）"
            )

    def _刷新快照(self) -> None:
        if self.适配器 is None:
            self._最新快照 = 相机快照.未初始化()
            return
        diag = self.适配器.同步_诊断()
        self._最新快照 = 相机快照(
            状态=self._状态机.当前,
            已连接=bool(diag.connected),
            推流中=bool(diag.streaming),
            选中索引=diag.selected_index,
            最后错误=diag.last_error,
        )
