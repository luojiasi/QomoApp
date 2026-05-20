import math
from typing import Any



def 提取坐标(pt: dict[str, Any] | None) -> tuple[float, float]:
    """从 {X, Y} 提取坐标，缺失时回退 0。"""
    if not isinstance(pt, dict): return 0.0, 0.0
    return float(pt.get("X", 0)), float(pt.get("Y", 0))

def 计算钻石几何参数(diamond_params: dict[str, Any], radius: float) -> dict[str, Any]:
    """从 diamondParams + radius 派生所有切割几何参数。"""
    直径 = radius * 2
    台百分比 = float(diamond_params.get("Table", 58))
    冠百分比 = float(diamond_params.get("Crown", 14.7))
    亭百分比 = float(diamond_params.get("Pavilion", 43.5))
    腰百分比 = float(diamond_params.get("Girdle", 4))

    台面半径 = (台百分比 / 100.0) * radius
    冠高 = (冠百分比 / 100.0) * 直径
    亭高 = (亭百分比 / 100.0) * 直径
    腰厚 = (腰百分比 / 100.0) * 直径

    # 冠角 = atan(冠高 / 水平距离) ; 水平距离 = radius − 台面半径
    水平距 = max(radius - 台面半径, 1e-6)
    冠角 = math.degrees(math.atan(冠高 / 水平距))
    亭角 = math.degrees(math.atan(亭高 / radius))
    return {
        "直径": 直径,
        "台面半径": 台面半径,
        "冠高": 冠高,
        "亭高": 亭高,
        "腰厚": 腰厚,
        "冠角": 冠角,
        "亭角": 亭角,
    }