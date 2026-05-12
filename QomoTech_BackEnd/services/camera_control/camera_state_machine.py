"""相机状态机 —— 合法状态迁移。

线程安全：内部 RLock 保护，可从任意线程调用。

比运动状态机简单：
  - 无多轴协调（不需 MOVING/HOMING/PAUSED/ESTOP/ALARM）
  - 无物理安全风险（不需全局急停吸收态）
  - 仅 SDK 初始化 → 连接 → 断开 三个状态的线性迁移
"""
from __future__ import annotations

import threading
from enum import Enum
from typing import Callable, List, Optional

from services.camera_control.camera_models import 相机状态
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("相机状态机")


class 相机事件(str, Enum):
    """状态机事件 —— 由 CameraService 发出。"""

    INIT = "init"                    # SDK 初始化完成
    CONNECT = "connect"              # 连接相机
    DISCONNECT = "disconnect"        # 断开相机
    SHUTDOWN = "shutdown"            # 关闭 SDK


# ----------------------------------------------------------------------
# 合法迁移表
# ----------------------------------------------------------------------
_迁移表: dict[tuple[相机状态, 相机事件], 相机状态] = {
    (相机状态.UNINITIALIZED, 相机事件.INIT):         相机状态.IDLE,

    (相机状态.IDLE, 相机事件.CONNECT):               相机状态.CONNECTED,
    (相机状态.IDLE, 相机事件.SHUTDOWN):              相机状态.UNINITIALIZED,

    (相机状态.CONNECTED, 相机事件.DISCONNECT):       相机状态.IDLE,
    (相机状态.CONNECTED, 相机事件.SHUTDOWN):         相机状态.UNINITIALIZED,
}

# 监听器签名：(源状态, 目标状态, 触发事件) → None
监听器类型 = Callable[[相机状态, 相机状态, 相机事件], None]


class 相机状态机:
    """相机状态机 —— 线程安全。"""

    def __init__(self, 初始: 相机状态 = 相机状态.UNINITIALIZED) -> None:
        self._当前: 相机状态 = 初始
        self._锁 = threading.RLock()
        self._监听器: List[监听器类型] = []

    # ------------------------------------------------------------------
    # 状态查询
    # ------------------------------------------------------------------

    @property
    def 当前(self) -> 相机状态:
        with self._锁:
            return self._当前

    def 是否能(self, 事件: 相机事件) -> bool:
        with self._锁:
            return self._解析目标(self._当前, 事件) is not None

    # ------------------------------------------------------------------
    # 监听器
    # ------------------------------------------------------------------

    def 添加监听器(self, 回调: 监听器类型) -> None:
        with self._锁:
            self._监听器.append(回调)

    def 移除监听器(self, 回调: 监听器类型) -> None:
        with self._锁:
            try:
                self._监听器.remove(回调)
            except ValueError:
                pass

    # ------------------------------------------------------------------
    # 触发
    # ------------------------------------------------------------------

    def 触发(self, 事件: 相机事件, 强制: bool = False) -> 相机状态:
        with self._锁:
            目标 = self._解析目标(self._当前, 事件)
            if 目标 is None:
                if 强制:
                    日志.warning(
                        f"非法迁移已忽略: {self._当前.value} ─{事件.value}→ ?"
                    )
                    return self._当前
                raise RuntimeError(
                    f"非法状态迁移: {self._当前.value} ─{事件.value}→ ?"
                )

            if 目标 == self._当前:
                return self._当前

            源 = self._当前
            self._当前 = 目标
            监听器副本 = list(self._监听器)

        日志.debug(f"相机状态迁移: {源.value} ─{事件.value}→ {目标.value}")
        for 回调 in 监听器副本:
            try:
                回调(源, 目标, 事件)
            except Exception as exc:
                日志.warning(f"状态监听器异常: {exc}")
        return 目标

    # ------------------------------------------------------------------
    # 内部
    # ------------------------------------------------------------------

    @staticmethod
    def _解析目标(源: 相机状态, 事件: 相机事件) -> Optional[相机状态]:
        return _迁移表.get((源, 事件))
