"""自由编辑参数几何计算 —— 根据直径/高度/分度生成切割实体。"""

from typing import Any


def 构建配方数据(配方链: dict[str, Any]) -> dict[str, Any]:
    """将前端解析的配方链转换为 PragramService/RecipeResolver 期望的格式。"""
    主配方 = 配方链.get("main") or {}
    加工配方 = 配方链.get("machining")
    扫黑配方 = 配方链.get("blackening")
    垂直配方 = 配方链.get("vertical")
    水平配方 = 配方链.get("horizontal")
    加工激光 = 配方链.get("machiningLaser")
    扫黑激光 = 配方链.get("blackeningLaser")
    激光配方列表 = [r for r in (加工激光, 扫黑激光) if r]
    return {
        "selectedMainRecipe": 主配方,
        "selectedMachiningRecipe": [加工配方] if 加工配方 else [],
        "selectedBlackeningRecipe": [扫黑配方] if 扫黑配方 else [],
        "selectedLaserRecipe": 激光配方列表,
        "selectedHorizontal": [水平配方] if 水平配方 else [],
        "selectedVertical": [垂直配方] if 垂直配方 else []
    }
def 构建任务的数据(行数据: dict[str, Any]) -> dict[str, Any]:
    """将前端解析的行数据转换为切割任务的数据。"""
    return {
        "直径": float(行数据.get("diameter", 0)),
        "角度": float(行数据.get("angle", 0)),
        "高度": float(行数据.get("height", 0)),
        "分割数": int(行数据.get("divisions", 0)),
    }
