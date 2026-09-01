"""自由编辑参数几何计算 —— 根据直径/高度/分度生成切割实体。"""

import math
from typing import Any
from utils.logger import 获取日志记录器
from services.SystemSettingService import 获取4P旋转中心的补偿值
from services.SystemSettingService import 获取R轴旋转中心点
from core.calc_rotation import 计算点绕坐标轴旋转

日志 = 获取日志记录器("freeparamgeometry")


def 构建配方数据(配方数据: dict[str, Any], 配方ID: str) -> dict[str, Any]:
    """根据配方ID从完整配方数据中查找主配方 → 加工/扫黑 → 子配方链。

    返回: {
        selectedMachining, selectedVertical, selectedHorizontal, selectedMachiningLaser,
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
        "selectedMachining": [加工配方] if 加工配方 else [],
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
    # 日志.log("新扫描长度",新扫描长度)
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
        "补偿X": float(行数据.get("compX", 0)),
        "补偿Y": float(行数据.get("compY", 0)),
        "补偿Z": float(行数据.get("compZ", 0)),
        "补偿角度": float(行数据.get("compAngle", 0)),
        "弦长倍率": float(行数据.get("chordRatio", 2)),
        "K": float(行数据.get("k", 0)),
        "B": float(行数据.get("b", 0)),
        "X": float(行数据.get("x", 0)),
    }
def 构建R轴的补偿(行数据: dict[str, Any]) -> dict[str, Any]:
    """构建R轴的补偿。

    从行数据中提取 R 轴补偿参数：多少圈进行一次补偿 + 每次补偿值。
    对应前端工具栏"每旋转 N 圈补偿 M mm"的全局配置，payload 中每行附带 rInterval / rCompensation。
    """
    return {
        "多少圈进行一次补偿": float(行数据.get("rInterval", 0)),
        "补偿值": float(行数据.get("rCompensation", 0)),
    }

def 构建执行任务的参数(数据: dict[str, Any],当前平面Z的位置, 所有高度总和: float = 0.0, 累计高度: float = 0.0 ) -> dict[str, Any]:
    """将前端解析的行数据转换为执行任务的参数。

    根据直径和分割数计算圆心到等分弦线的垂直距离：
        d = R × cos(π / N)
    其中 R = 直径/2，N = 分割数。
    """

    U轴旋转中心的位置 = 获取4P旋转中心的补偿值()
    R轴旋转中心的位置 = 获取R轴旋转中心点()
    工位的X坐标 = R轴旋转中心的位置.X
    工位的Y坐标 = R轴旋转中心的位置.Y
    工位的Z坐标 = R轴旋转中心的位置.Z
    计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离 = R轴旋转中心的位置.X - U轴旋转中心的位置.X 
    当前平面与旋转中心的Z的距离 = abs(U轴旋转中心的位置.Z)-abs(当前平面Z的位置)

    K = float(数据.get("K", 0))
    B = float(数据.get("B", 0))
    X = float(数据.get("X", 0))
    线性关系的补偿 = float(K*abs(当前平面Z的位置 - X)+B)

    高度 = float(数据.get("高度", 0))

    分割数 = int(数据.get("分割数", 0))
    是否启用R轴旋转 = True if 分割数 == 0 or 分割数 >= 48 else False
    R轴旋转角度 = 360 / 分割数 if 分割数 > 0 else 0.0
    
    角度 = float(数据.get("角度", 0))
    角度补偿 = float(数据.get("补偿角度", 0))
    U轴的旋转角度 = 90 - (角度 + 角度补偿) if 角度 > 0 else -(-90 - (角度 + 角度补偿))
    是否反向 =False if 角度 > 0 else True

    直径 = float(数据.get("直径", 0))
    半径 = 直径 / 2
    圆心到等分直线的垂直距离 = round(半径 * math.cos(math.pi / 分割数),4) if  not 是否启用R轴旋转 else 半径
    弦长 = round(2 * 半径 * math.sin(math.pi / 分割数),4) if not 是否启用R轴旋转 else 0.0

    # TODO:我这个需要拿到点的坐标 -------------可能会出现错误
    _角度接近零 = abs(角度) < 1e-9
    _角度接近九十 = abs(abs(角度) - 90.0) < 1e-9



    if not 是否反向:
        真正的实际半径 = 圆心到等分直线的垂直距离 + 累计高度 / math.tan(math.radians(角度))
        初始位置直角三角形斜边 = math.hypot(真正的实际半径, 当前平面与旋转中心的Z的距离)
        在初始位置需要的角度 = math.degrees(math.atan2(真正的实际半径, 当前平面与旋转中心的Z的距离))
        日志.info(
            f"RX{R轴旋转中心的位置.X},真正的实际半径{真正的实际半径} 🔺X{计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离}"
            f"初始直角三角形 对边(半径)={半径}"
            f"邻边(Z)={当前平面与旋转中心的Z的距离}"
            f"对边(真正的实际半径)={真正的实际半径}"
            f"斜边={初始位置直角三角形斜边}"
            f"底角={在初始位置需要的角度}°"
        )
        X需要移动的位置偏移量 = math.sin(math.radians(U轴的旋转角度+在初始位置需要的角度)) * 初始位置直角三角形斜边
        偏移后的三角形的高度 = math.cos(math.radians(U轴的旋转角度+在初始位置需要的角度)) * 初始位置直角三角形斜边
        从旋转圆心下降的距离 = 当前平面与旋转中心的Z的距离 - 偏移后的三角形的高度

        X方向进行再补偿 = round(math.sin(math.radians(float(数据.get("补偿X", 0)))) * 从旋转圆心下降的距离,4)
        Y方向进行再补偿 = round(math.cos(math.radians(float(数据.get("补偿Y", 0)))) * 从旋转圆心下降的距离,4)
        Z方向进行再补偿 = round(float(数据.get("补偿Z", 0)),4)
        R与U通过旋转之后得到的的值 = round(math.sin(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4)
        日志.info(
            f"X需要移动的位置偏移量={X需要移动的位置偏移量} "
            f"偏移后的三角形的高度={偏移后的三角形的高度} "
            f"从旋转圆心下降的距离={从旋转圆心下降的距离} "
            f"X方向进行再补偿={X方向进行再补偿} "
            f"Y方向进行再补偿={Y方向进行再补偿} "
            f"Z方向进行再补偿={Z方向进行再补偿} "
            f"R与U通过旋转之后得到的的值={R与U通过旋转之后得到的的值} "
        )
        切割中点的坐标={
            "X": 工位的X坐标 + X需要移动的位置偏移量 + X方向进行再补偿 + R与U通过旋转之后得到的的值 ,
            "Y": 工位的Y坐标 + Y方向进行再补偿,
            "Z": 工位的Z坐标 - 从旋转圆心下降的距离 + Z方向进行再补偿,
        }

    else:
        # 当切负角度的时候出现上面的高度那我就需要有高度的延长来计算，导致我的半径会变大
        真正的实际半径 = 圆心到等分直线的垂直距离 + 累计高度 / math.tan(math.radians(abs(角度)))
        初始位置直角三角形斜边 = math.hypot(真正的实际半径, 当前平面与旋转中心的Z的距离)
        在初始位置需要的角度 = math.degrees(math.atan2(真正的实际半径, 当前平面与旋转中心的Z的距离))
        日志.info(
            f"真正的实际半径{真正的实际半径}🔺X{计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离} 初始直角三角形 对边(半径)={半径} 邻边(Z)={当前平面与旋转中心的Z的距离} "
            f"斜边={初始位置直角三角形斜边} 底角={在初始位置需要的角度}°"
        )
        X需要移动的位置偏移量 = math.sin(math.radians(U轴的旋转角度-在初始位置需要的角度)) * 初始位置直角三角形斜边
        偏移后的三角形的高度 = math.cos(math.radians(U轴的旋转角度-在初始位置需要的角度)) * 初始位置直角三角形斜边
        从旋转圆心下降的距离 = 当前平面与旋转中心的Z的距离 - 偏移后的三角形的高度

        X方向进行再补偿 = round(math.sin(math.radians(float(数据.get("补偿X", 0)))) * 从旋转圆心下降的距离,4)
        Y方向进行再补偿 = round(math.cos(math.radians(float(数据.get("补偿Y", 0)))) * 从旋转圆心下降的距离,4)
        Z方向进行再补偿 = round(float(数据.get("补偿Z", 0)),4)
        R与U通过旋转之后得到的的值 = round(math.sin(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4)
        日志.info(
            f"X需要移动的位置偏移量={X需要移动的位置偏移量} "
            f"偏移后的三角形的高度={偏移后的三角形的高度} "
            f"从旋转圆心下降的距离={从旋转圆心下降的距离} "
            f"X方向进行再补偿={X方向进行再补偿} "
            f"Y方向进行再补偿={Y方向进行再补偿} "
            f"Z方向进行再补偿={Z方向进行再补偿} "
            f"R与U通过旋转之后得到的的值={R与U通过旋转之后得到的的值} "
        )
        切割中点的坐标={
            "X": 工位的X坐标 + X需要移动的位置偏移量 + X方向进行再补偿 + R与U通过旋转之后得到的的值,
            "Y": 工位的Y坐标 + Y方向进行再补偿,
            "Z": 工位的Z坐标 - 从旋转圆心下降的距离 + Z方向进行再补偿,
        }


    # TODO:如果要更改角度这里也需要进行更改
    # 切割产品的高度 = (高度+累计高度) / math.sin(math.radians(abs(角度)))
    if _角度接近零:
        # 竖直壁：沿切割面长度等于垂直高度
        切割产品的高度 = 高度 + 累计高度
    else:
        切割产品的高度 = (高度 + 累计高度) / math.sin(math.radians(abs(角度)))

    # TODO:计算最长的那条边的长度
    # 缩放的圆的半径 = abs((高度/math.tan(math.radians(角度)) + 半径))
    if _角度接近零:
        # 竖直圆柱：半径不随高度放大
        缩放的圆的半径 = abs(半径)
    elif _角度接近九十:
        缩放的圆的半径 = abs(半径)
    else:
        缩放的圆的半径 = abs((高度 / math.tan(math.radians(角度)) + 半径))

    弦长倍率 = float(数据.get("弦长倍率", 2))
    最长那条边的切割长度 = 缩放的圆的半径 * 弦长倍率 if 缩放的圆的半径 > 弦长 else 弦长 * 弦长倍率

    return {
        "是否反向":是否反向,
        "R轴旋转的分割数": 分割数,
        "是否启用R轴旋转":是否启用R轴旋转,
        "U轴的旋转角度": U轴的旋转角度,
        "R轴旋转角度": R轴旋转角度,
        "等分线的长度": 弦长,
        "切割中点的坐标":切割中点的坐标,
        "切割产品的高度":切割产品的高度,
        "最长的那条边的切割长度":最长那条边的切割长度,
    }

# def 构建执行任务的参数(数据: dict[str, Any],当前平面Z的位置, 所有高度总和: float = 0.0, 累计高度: float = 0.0 ) -> dict[str, Any]:
#     """将前端解析的行数据转换为执行任务的参数。

#     根据直径和分割数计算圆心到等分弦线的垂直距离：
#         d = R × cos(π / N)
#     其中 R = 直径/2，N = 分割数。
#     """

#     U轴旋转中心的位置 = 获取4P旋转中心的补偿值()
#     R轴旋转中心的位置 = 获取快速移动点()

#     角度补偿 = float(数据.get("补偿角度", 0))
#     弦长倍率 = float(数据.get("弦长倍率", 2))


#     K = float(数据.get("K", 0))
#     B = float(数据.get("B", 0))
#     X = float(数据.get("X", 0))
#     线性关系的补偿 = float(K*abs(当前平面Z的位置 - X)+B)

    
#     直径 = float(数据.get("直径", 0))
#     分割数 = int(数据.get("分割数", 0))
#     角度 = float(数据.get("角度", 0))
#     高度 = float(数据.get("高度", 0))
#     是否启用R轴旋转 = True if 分割数 == 0 or 分割数 >= 48 else False
#     R轴旋转角度 = 360 / 分割数 if 分割数 > 0 else 0.0
#     U轴的旋转角度 = 90 - (角度 + 角度补偿) if 角度  > 0 else -90 - (角度 + 角度补偿)

#     是否反向 =False if 角度 > 0 else True

#     # TODO:这里可能相反
#     计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离 = U轴旋转中心的位置.X - R轴旋转中心的位置.X
#     当前平面与旋转中心的Z的距离 = abs(U轴旋转中心的位置.Z)-abs(当前平面Z的位置)

#     # R轴旋转中心与U轴旋转中心的角度_大 = math.degrees(math.atan(当前平面与旋转中心的Z的距离 / 计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离))
#     # R轴旋转中心与U轴旋转中心的角度_小 = math.degrees(math.atan(计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离 / 当前平面与旋转中心的Z的距离 ))

    
#     # if 角度 > 0:
#     #     补偿角度的值 = abs(U轴的旋转角度)
#     #     角度补偿的X = math.cos(math.radians(补偿角度的值)) * 计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离
#     #     角度补偿的Z = math.sin(math.radians(补偿角度的值)) * 计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离
#     # elif 角度 < 0:
#     #     补偿角度的值 = abs(U轴的旋转角度)
#     #     角度补偿的X =  math.cos(math.radians(补偿角度的值)) * 计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离
#     #     角度补偿的Z = math.sin(math.radians(补偿角度的值)) * 计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离

#     半径 = 直径 / 2
#     圆心到等分直线的垂直距离 = round(半径 * math.cos(math.pi / 分割数),4) if  not 是否启用R轴旋转 else 半径
#     弦长 = round(2 * 半径 * math.sin(math.pi / 分割数),4) if not 是否启用R轴旋转 else 0.0

#     # # 安全处理：角度为 0 或接近 0 时，tan 和 sin 会趋近 0，导致除零
#     # # 用极小值 0.001° 兜底，避免除零异常，同时保持几何计算的连续性
#     # _安全角度 = 角度 if abs(角度) > 0.001 else (0.001 if 角度 >= 0 else -0.001)

#     # TODO：始终要到最高的那段开始切割
#     如果上方是有物体的高度的距离 = 累计高度 * math.cos(math.radians(-角度)) if 角度< 0 else 0

#     # TODO:我这个需要拿到点的坐标 -------------可能会出现错误
#     _角度接近零 = abs(角度) < 1e-9
#     _角度接近九十 = abs(abs(角度) - 90.0) < 1e-9

#     角度X = 累计高度 / math.tan(math.radians(角度)) if 角度 != 90 else 0

#     if 角度 == 90:
#         得到等分直线中点的坐标 = {"x": 圆心到等分直线的垂直距离 - 角度X, "y": 0, "z": 当前平面与旋转中心的Z的距离}
#     else:
#         if 是否反向:
#             得到等分直线中点的坐标 = {"x": -(圆心到等分直线的垂直距离 - 角度X) - 计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离, "y": 0, "z": 当前平面与旋转中心的Z的距离}
#         else:
#             得到等分直线中点的坐标 = {"x": 圆心到等分直线的垂直距离 - 角度X - 计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离, "y": 0, "z": 当前平面与旋转中心的Z的距离}
 
#     # 得到等分直线中点的坐标 = {"x": 圆心到等分直线的垂直距离 - 角度X - 计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离 , "y": 0, "z": 产品到旋转中心的高度}
#     # 得到等分直线中点的坐标 = {"x": 圆心到等分直线的垂直距离 - 角度X, "y": 0, "z": 产品到旋转中心的高度}
#     日志.info(f"圆心到等分直线的垂直距离:{圆心到等分直线的垂直距离}")
#     日志.info(f"角度X:{角度X}")
#     日志.info(f"计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离:{计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离}")
#     日志.info(f"得到等分直线中点的坐标:{得到等分直线中点的坐标}")
#     切割中点的坐标 = 计算点绕坐标轴旋转(得到等分直线中点的坐标, U轴的旋转角度, "Y")
#     垂直到旋转后下降的高度 = float(abs(切割中点的坐标.get("z")) - abs(当前平面与旋转中心的Z的距离))
#     # 中点的坐标要加上旋转中心 = {"X":切割中点的坐标.get("x")+U轴旋转中心的位置.X + 角度补偿的X + X方向进行再补偿, "Y":切割中点的坐标.get("y")+U轴旋转中心的位置.Y + Y方向进行再补偿, "Z":切割中点的坐标.get("z") + U轴旋转中心的位置.Z + 角度补偿的Z + Z方向进行再补偿

#     X方向进行再补偿 = math.sin(math.radians(float(数据.get("补偿X", 0)))) * 垂直到旋转后下降的高度
#     Y方向进行再补偿 = math.cos(math.radians(float(数据.get("补偿Y", 0)))) * 垂直到旋转后下降的高度
#     Z方向进行再补偿 = float(数据.get("补偿Z", 0))
#     # Y方向进行再补偿 = math.cos(math.radians(float(数据.get("补偿Y", 0)))) * 产品到旋转中心的高度 * math.sin(math.radians(float(数据.get("补偿Y", 0))))
    
#     中点的坐标要加上旋转中心 = {
#         "X":切割中点的坐标.get("x") + U轴旋转中心的位置.X + X方向进行再补偿 + 线性关系的补偿 , 
#         "Y":切割中点的坐标.get("y") + U轴旋转中心的位置.Y + Y方向进行再补偿, 
#         "Z":切割中点的坐标.get("z") + U轴旋转中心的位置.Z + Z方向进行再补偿
#         }
#     # 中点的坐标要加上旋转中心 = {
#     #     "X":切割中点的坐标.get("x") + X方向进行再补偿 + R轴旋转中心的位置.X + 线性关系的补偿, 
#     #     "Y":切割中点的坐标.get("y") + Y方向进行再补偿 + R轴旋转中心的位置.Y, 
#     #     "Z":Z方向进行再补偿 + R轴旋转中心的位置.Z + 垂直到旋转后下降的高度
#     #     }

#     # TODO:如果要更改角度这里也需要进行更改
#     # 切割产品的高度 = (高度+累计高度) / math.sin(math.radians(abs(角度)))
#     if _角度接近零:
#         # 竖直壁：沿切割面长度等于垂直高度
#         切割产品的高度 = 高度 + 累计高度
#     else:
#         切割产品的高度 = (高度 + 累计高度) / math.sin(math.radians(abs(角度)))

#     # TODO:计算最长的那条边的长度
#     # 缩放的圆的半径 = abs((高度/math.tan(math.radians(角度)) + 半径))
#     if _角度接近零:
#         # 竖直圆柱：半径不随高度放大
#         缩放的圆的半径 = abs(半径)
#     elif _角度接近九十:
#         缩放的圆的半径 = abs(半径)
#     else:
#         缩放的圆的半径 = abs((高度 / math.tan(math.radians(角度)) + 半径))

#     最长那条边的切割长度 = 缩放的圆的半径 * 弦长倍率 if 缩放的圆的半径 > 弦长 else 弦长 * 弦长倍率

#     return {
#         "是否反向":是否反向,
#         "R轴旋转的分割数": 分割数,
#         "是否启用R轴旋转":是否启用R轴旋转,
#         "U轴的旋转角度": U轴的旋转角度,
#         "R轴旋转角度": R轴旋转角度,
#         "等分线的长度": 弦长,
#         "切割中点的坐标":中点的坐标要加上旋转中心,
#         "切割产品的高度":切割产品的高度,
#         "最长的那条边的切割长度":最长那条边的切割长度,
#     }