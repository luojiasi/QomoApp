"""自由编辑参数几何计算 —— 根据直径/高度/分度生成切割实体。"""

import math
from typing import Any
from services.SystemSettingService import 获取4P旋转中心的补偿值
from core.calc_rotation import 计算点绕坐标轴旋转


def 构建配方数据(配方数据: dict[str, Any], 配方ID: str) -> dict[str, Any]:
    """根据配方ID从完整配方数据中查找主配方 → 加工/扫黑 → 子配方链。

    返回: {
        selectedVertical, selectedHorizontal, selectedMachiningLaser,
        selectedBlackeningLaser, selectedBlackeningRecipe
    }
    """
    主配方列表 = 配方数据.get("mainRecipes") or []
    加工配方列表 = 配方数据.get("machiningRecipes") or []
    扫黑配方列表 = 配方数据.get("blackeningRecipes") or []
    激光配方列表 = 配方数据.get("laserPowerRecipes") or []
    水平配方列表 = 配方数据.get("horizontalFormulaRecipes") or []
    垂直配方列表 = 配方数据.get("verticalFormulaRecipes") or []

    # 1. 找到选中的主配方
    主配方: dict[str, Any] = {}
    for r in 主配方列表:
        if r.get("id") == 配方ID:
            主配方 = r
            break

    # 2. 根据主配方找到加工配方
    加工配方: dict[str, Any] = {}
    加工配方ID = 主配方.get("machiningRecipeId", "")
    for r in 加工配方列表:
        if r.get("id") == 加工配方ID:
            加工配方 = r
            break

    # 3. 根据主配方找到扫黑配方
    扫黑配方: dict[str, Any] = {}
    扫黑配方ID = 主配方.get("blackeningRecipeId", "")
    for r in 扫黑配方列表:
        if r.get("id") == 扫黑配方ID:
            扫黑配方 = r
            break

    # 4. 从加工配方 → 水平/垂直/加工激光
    水平配方: dict[str, Any] = {}
    水平配方ID = 加工配方.get("horizontalFormulaId", "")
    for r in 水平配方列表:
        if r.get("id") == 水平配方ID:
            水平配方 = r
            break

    垂直配方: dict[str, Any] = {}
    垂直配方ID = 加工配方.get("verticalFormulaId", "")
    for r in 垂直配方列表:
        if r.get("id") == 垂直配方ID:
            垂直配方 = r
            break

    加工激光配方: dict[str, Any] = {}
    加工激光ID = 加工配方.get("laserPowerRecipeId", "")
    for r in 激光配方列表:
        if r.get("id") == 加工激光ID:
            加工激光配方 = r
            break

    # 5. 从扫黑配方 → 扫黑激光
    扫黑激光配方: dict[str, Any] = {}
    扫黑激光ID = 扫黑配方.get("laserPowerRecipeId", "")
    for r in 激光配方列表:
        if r.get("id") == 扫黑激光ID:
            扫黑激光配方 = r
            break

    return {
        "selectedVertical": [垂直配方] if 垂直配方 else [],
        "selectedHorizontal": [水平配方] if 水平配方 else [],
        "selectedMachiningLaser": [加工激光配方] if 加工激光配方 else [],
        "selectedBlackeningLaser": [扫黑激光配方] if 扫黑激光配方 else [],
        "selectedBlackeningRecipe": [扫黑配方] if 扫黑配方 else [],
    }


    

def 计算开口范围(*,高度: float,下开口K: float,下开口B: float,深度补偿K: float,深度补偿B: float,正切角度: float) -> tuple[float, float]:
    """计算下开口值和上开口值（单位：mm）。"""
    下开口值 = 下开口K * 高度 + 下开口B
    上开口值 = 深度补偿K * 1000 * (高度 + 深度补偿B) * 正切角度 + 下开口值
    return 下开口值, 上开口值

def 更新V型开口偏移(*,上开口值: float,正切角度: float,累计下降量: float) -> tuple[float, float]:
    """V 型开口：根据累计下降量重新计算最小/最大偏移。"""
    新扫描长度 = 上开口值 - 正切角度 * 累计下降量 * 2 * 1000
    扫描长度差值 = (上开口值 - 新扫描长度) / 2
    return round(扫描长度差值, 6), round(上开口值 - 扫描长度差值, 6)

def 更新平行型开口偏移(*,上开口值: float,正切角度: float,累计下降量: float) -> tuple[float, float]:
    """平行型（// 或 ||）开口：最小偏移随深度增加，最大偏移 = 最小 + 上开口值。"""
    最小偏移 = 正切角度 * 累计下降量 * 2 * 1000
    最大偏移 = 最小偏移 + 上开口值
    return 最小偏移, 最大偏移



def 构建任务的数据(行数据: dict[str, Any]) -> dict[str, Any]:
    """将前端解析的行数据转换为切割任务的数据。"""
    return {
        "配方ID": str(行数据.get("recipeId", "")),
        "直径": float(行数据.get("diameter", 0)),
        "角度": float(行数据.get("angle", 0)),
        "高度": float(行数据.get("height", 0)),
        "分割数": int(行数据.get("divisions", 0)),
    }

def 构建执行任务的参数(数据: dict[str, Any], 当前平面的Z位置: float = 0.0) -> dict[str, Any]:
    """将前端解析的行数据转换为执行任务的参数。

    根据直径和分割数计算圆心到等分弦线的垂直距离：
        d = R × cos(π / N)
    其中 R = 直径/2，N = 分割数。
    """
    直径 = float(数据.get("直径", 0))
    分割数 = int(数据.get("分割数", 0))
    角度 = float(数据.get("角度", 0))
    是否启用R轴旋转 = True if 分割数 == 0 or 分割数 >= 24 else False
    R轴旋转角度 = 360 / 分割数 if 分割数 > 0 else 0.0
    U轴的旋转角度 = 90 - 角度 if 角度 > 0 else -90 - 角度

    旋转中心的位置 = 获取4P旋转中心的补偿值()

    半径 = 直径 / 2
    圆心到等分直线的垂直距离 = round(半径 * math.cos(math.pi / 分割数),4) if 分割数 > 0 else 0.0
    弦长 = round(2 * 半径 * math.sin(math.pi / 分割数),4) if 分割数 > 0 else 0.0


    # TODO:我这个需要拿到点的坐标 -------------可能会出现错误
    得到等分直线中点的坐标 = {"x": 圆心到等分直线的垂直距离, "y": 0, "z": abs(旋转中心的位置.Z)-当前平面的Z位置}
    切割中点的坐标 = 计算点绕坐标轴旋转(得到等分直线中点的坐标, U轴的旋转角度, "Y")
    中点的坐标要加上旋转中心 = {"X":切割中点的坐标.get("x")+旋转中心的位置.X, "Y":切割中点的坐标.get("y")+旋转中心的位置.Y, "Z":切割中点的坐标.get("z")+旋转中心的位置.Z}

    # TODO:如果要更改角度这里也需要进行更改
    切割产品的高度 = math.sin(math.radians(角度)) * float(数据.get("高度", 0))

    return {
        "R轴旋转的分割数": 分割数,
        "是否启用R轴旋转":是否启用R轴旋转,
        "U轴的旋转角度": U轴的旋转角度,
        "R轴旋转角度": R轴旋转角度,
        "等分线的长度": 弦长,
        "切割中点的坐标":中点的坐标要加上旋转中心,
        "切割产品的高度":切割产品的高度
    }