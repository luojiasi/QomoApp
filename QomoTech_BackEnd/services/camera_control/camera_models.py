"""相机数据模型 —— 状态枚举与快照。

比运动控制简单：无多轴协调、无物理安全风险。
状态迁移仅反映 SDK 初始化 → 相机连接 → 断开 的生命周期。
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional


class 相机状态(str, Enum):
    """相机整体状态。

    UNINITIALIZED  ──INIT──→ IDLE
    IDLE           ──CONNECT──→ CONNECTED
    CONNECTED      ──DISCONNECT──→ IDLE
    任意状态       ──SHUTDOWN──→ UNINITIALIZED
    """

    UNINITIALIZED = "UNINITIALIZED"
    IDLE = "IDLE"
    CONNECTED = "CONNECTED"


@dataclass(frozen=True)
class 相机快照:
    """相机瞬时状态快照。

    供 HTTP GET /api/camera/status 与内部诊断使用。
    """

    状态: 相机状态 = 相机状态.UNINITIALIZED
    已连接: bool = False
    推流中: bool = False
    选中索引: Optional[int] = None
    最后错误: Optional[str] = None
    时间戳: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "state": self.状态.value,
            "connected": self.已连接,
            "streaming": self.推流中,
            "selected_index": self.选中索引,
            "last_error": self.最后错误,
            "timestamp": self.时间戳,
        }

    @classmethod
    def 未初始化(cls) -> "相机快照":
        return cls(状态=相机状态.UNINITIALIZED)

    @classmethod
    def 空闲(cls) -> "相机快照":
        return cls(状态=相机状态.IDLE)
