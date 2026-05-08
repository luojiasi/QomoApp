"""运动控制数据模型 —— 状态枚举与快照。

供 services 内的其它组件共享：
  - state_machine     使用 运动状态 枚举做合法迁移；
  - status_monitor    构造 状态快照 / 轴快照 投递给订阅者；
  - safe_controller   使用 运动状态 做指令准入；
  - MotionService     对外暴露 状态快照.to_dict() 给路由层。

快照对象使用 dataclass(frozen=True)，不可变 → 多线程间安全传递；JSON 化时
保持英文字段，与前端契约对齐（state/position/mposition/idle/...）。
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional


class 运动状态(str, Enum):
    """整体运动状态。

    继承 str：JSON 序列化直接得字符串值，前端可直接用 `if (state==='IDLE') ...`。

    迁移语义（由 state_machine 强制约束）：
      DISCONNECTED ──CONNECT────→ IDLE
      IDLE         ──MOVE_START─→ MOVING
      IDLE         ──HOME_START─→ HOMING
      MOVING       ──PAUSE──────→ PAUSED   ──RESUME──→ MOVING
      MOVING/HOMING ──COMPLETE──→ IDLE      （由 status_monitor 在全空闲时驱动）
      MOVING/HOMING/PAUSED ──STOP→ IDLE
      任意状态     ──ESTOP──────→ ESTOP    ──RESET───→ IDLE
      任意状态     ──ALARM──────→ ALARM    ──RESET───→ IDLE
    """

    DISCONNECTED = "DISCONNECTED"     # 未连接
    IDLE = "IDLE"                     # 空闲（已连接、无运动）
    HOMING = "HOMING"                 # 回零中
    MOVING = "MOVING"                 # 运动中
    PAUSED = "PAUSED"                 # 暂停
    ESTOP = "ESTOP"                   # 急停（吸收态，需 RESET）
    ALARM = "ALARM"                   # 报警（吸收态，需 RESET）


@dataclass(frozen=True)
class 轴快照:
    """单轴瞬时状态。

    指令位置 / 实际位置 单位 = 工程单位（mm 或 °），由 ZAux_Direct_SetUnits
    完成换算。空闲 来自 ZAux_Direct_GetIfIdle，DLL 返回 -1=停止 / 0=运动中，
    本类已归一化为 bool。
    """

    名称: str
    轴号: int
    指令位置: float = 0.0
    实际位置: float = 0.0
    空闲: bool = True
    报警码: int = 0
    使能: bool = True

    def to_dict(self) -> dict:
        return {
            "name": self.名称,
            "axis_no": self.轴号,
            "dpos": self.指令位置,
            "mpos": self.实际位置,
            "idle": self.空闲,
            "alarm_code": self.报警码,
            "enabled": self.使能,
        }


@dataclass(frozen=True)
class 状态快照:
    """整机瞬时状态。

    供 HTTP `/api/motion/state` 与 WS `/ws/motion/status` 推送使用。
    to_dict() 输出的顶层字段为英文，与前端契约一致。
    """

    状态: 运动状态
    轴: Dict[str, 轴快照] = field(default_factory=dict)
    时间戳: float = field(default_factory=time.time)
    错误消息: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "state": self.状态.value,
            "position": {名: ax.指令位置 for 名, ax in self.轴.items()},
            "mposition": {名: ax.实际位置 for 名, ax in self.轴.items()},
            "idle": {名: ax.空闲 for 名, ax in self.轴.items()},
            "alarms": {名: ax.报警码 for 名, ax in self.轴.items()},
            "enabled": {名: ax.使能 for 名, ax in self.轴.items()},
            "axes": [ax.to_dict() for ax in self.轴.values()],
            "timestamp": self.时间戳,
            "error": self.错误消息,
        }

    @classmethod
    def 未连接(cls) -> "状态快照":
        return cls(状态=运动状态.DISCONNECTED)
