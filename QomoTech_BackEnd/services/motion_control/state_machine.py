"""运动状态机 —— 定义合法状态迁移。

线程安全：内部 RLock 保护，可从任意线程调用：
  - HTTP/WS 路由（asyncio 事件循环线程）
  - status_monitor 采集线程（检测全 IDLE 时触发 COMPLETE）
  - zmc_adapter IO 线程（捕获 alarm 时触发 ALARM）

设计选择：
  - 急停 / 报警是「全局事件」，任意状态都可触发到吸收态；
  - COMPLETE 由采集线程在所有轴 IDLE 时发出，让状态机自动归位；
  - 非法迁移默认抛 RuntimeError；急停路径用 强制=True 强行进入 ESTOP，避免
    DLL 调用失败时业务状态卡死。
"""
from __future__ import annotations

import threading
from enum import Enum
from typing import Callable, List, Optional

from services.motion_control.models import 运动状态
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("StateMachine")


class 状态事件(str, Enum):
    """状态机事件 —— 由 service 编排层 / 采集线程 / adapter 发出。"""

    CONNECT = "connect"
    DISCONNECT = "disconnect"
    HOME_START = "home_start"
    MOVE_START = "move_start"
    COMPLETE = "complete"           # 运动 / 回零自然结束（采集线程发出）
    PAUSE = "pause"
    RESUME = "resume"
    STOP = "stop"                   # 主动减速停止
    ESTOP = "estop"                 # 急停
    ALARM = "alarm"                 # 报警
    RESET = "reset"                 # 清除 ESTOP / ALARM


# ----------------------------------------------------------------------
# 合法迁移表：(源状态, 事件) → 目标状态
# ----------------------------------------------------------------------
_迁移表: dict[tuple[运动状态, 状态事件], 运动状态] = {
    (运动状态.DISCONNECTED, 状态事件.CONNECT):    运动状态.IDLE,

    (运动状态.IDLE, 状态事件.HOME_START):         运动状态.HOMING,
    (运动状态.IDLE, 状态事件.MOVE_START):         运动状态.MOVING,
    (运动状态.IDLE, 状态事件.DISCONNECT):         运动状态.DISCONNECTED,

    (运动状态.HOMING, 状态事件.COMPLETE):         运动状态.IDLE,
    (运动状态.HOMING, 状态事件.STOP):             运动状态.IDLE,

    (运动状态.MOVING, 状态事件.COMPLETE):         运动状态.IDLE,
    (运动状态.MOVING, 状态事件.STOP):             运动状态.IDLE,
    (运动状态.MOVING, 状态事件.PAUSE):            运动状态.PAUSED,
    # 同状态：MOVING 期间允许追加 move 指令（不重置状态机），保留语义占位
    (运动状态.MOVING, 状态事件.MOVE_START):       运动状态.MOVING,

    (运动状态.PAUSED, 状态事件.RESUME):           运动状态.MOVING,
    (运动状态.PAUSED, 状态事件.STOP):             运动状态.IDLE,

    (运动状态.ESTOP, 状态事件.RESET):             运动状态.IDLE,
    (运动状态.ESTOP, 状态事件.DISCONNECT):        运动状态.DISCONNECTED,

    (运动状态.ALARM, 状态事件.RESET):             运动状态.IDLE,
    (运动状态.ALARM, 状态事件.DISCONNECT):        运动状态.DISCONNECTED,
}

# ----------------------------------------------------------------------
# 全局事件 —— 任意状态都能进入对应吸收态（急停 / 报警）
# ----------------------------------------------------------------------
_全局事件: dict[状态事件, 运动状态] = {
    状态事件.ESTOP: 运动状态.ESTOP,
    状态事件.ALARM: 运动状态.ALARM,
}


# 监听器签名：(源状态, 目标状态, 触发事件) → None
监听器类型 = Callable[[运动状态, 运动状态, 状态事件], None]


class 状态机:
    """运动控制状态机 —— 线程安全。"""

    def __init__(self, 初始: 运动状态 = 运动状态.DISCONNECTED) -> None:
        self._当前: 运动状态 = 初始
        self._锁 = threading.RLock()
        self._监听器: List[监听器类型] = []

    # ------------------------------------------------------------------
    # 状态查询
    # ------------------------------------------------------------------

    @property
    def 当前(self) -> 运动状态:
        with self._锁:
            return self._当前

    def 是否能(self, 事件: 状态事件) -> bool:
        """事件能否在当前状态下触发（是否有合法迁移）。"""
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

    def 触发(self, 事件: 状态事件, 强制: bool = False) -> 运动状态:
        """触发事件并返回新状态。

        非法迁移：
          - 强制=False（默认）：抛 RuntimeError；
          - 强制=True：日志警告并保持当前状态返回（用于急停 / 报警等"必须落地"
            的事件，避免 DLL 调用失败时业务状态机卡住）。

        监听器在锁外调用，避免业务回调内再触发状态机时死锁。
        """
        with self._锁:
            目标 = self._解析目标(self._当前, 事件)
            if 目标 is None:
                if 强制:
                    日志.warning(f"非法迁移已忽略: {self._当前.value} ─{事件.value}→ ?")
                    return self._当前
                raise RuntimeError(
                    f"非法状态迁移: {self._当前.value} ─{事件.value}→ ?"
                )

            if 目标 == self._当前:
                # 同状态迁移（如 MOVING + MOVE_START）：不通知监听器，节省开销
                return self._当前

            源 = self._当前
            self._当前 = 目标
            监听器副本 = list(self._监听器)

        日志.debug(f"状态迁移: {源.value} ─{事件.value}→ {目标.value}")
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
    def _解析目标(源: 运动状态, 事件: 状态事件) -> Optional[运动状态]:
        if 事件 in _全局事件:
            return _全局事件[事件]
        return _迁移表.get((源, 事件))
