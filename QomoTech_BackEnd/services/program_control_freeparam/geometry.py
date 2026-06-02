"""自由编辑参数几何计算 —— 根据直径/高度/分度生成切割实体。"""

from typing import Any


def 生成切割实体(*, 直径: float, 中心X: float = 0, 中心Y: float = 0) -> dict[str, Any]:
    """根据直径生成 CIRCLE 切割实体。"""
    return {
        "type": "CIRCLE",
        "center": {"x": 中心X, "y": 中心Y},
        "radius": 直径 / 2,
        "surfaceAngle": 0,
        "openDirection": "RIGHT",
    }
