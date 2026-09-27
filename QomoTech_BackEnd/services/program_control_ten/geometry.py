"""十工位自由参数 · 几何与任务参数。

阅读顺序与本文件分区一致：

  1. 常量与路径类型
  2. 入口 —— 构建执行任务的参数（按路径类型分发）
  3. 行数据 / 配方 / 目标 / 层高（runner 组任务时用）
  4. 机台运动学（U 角、切割中点）
  5. 开口随切深变化（切割循环里更新 XY 偏移 / 曲线等距）
  6. 等分线段
  7. 非等分直线（切角矩形）
  8. 曲线（采样圆弧 → 绕石心转到右侧 → 转到右侧切割面 → 点列转插补（绕U心））

路径三种：等分线段、非等分直线、曲线。
超椭圆 / 中心圆垂直切后转到右侧再插补。
"""

import math
from typing import Any
from utils.logger import 获取日志记录器
from services.SystemSettingService import 获取一拖五R轴旋转中心点的位置, 获取一拖五U轴旋转中心的补偿值
from services.program_control_ten.ten_plus_cutting_persistence import 按工位号取点位
from services.motion_control.config_loader import 加载运动配置
from core.calc_offset_ljs import 根据开口方向偏移开放折线
from core.calc_rotation import 计算点绕轴心旋转

日志 = 获取日志记录器("freeparamgeometry")


# ======================================================================
# 1. 常量与路径类型
# 与前端 TEN_PLUS_PATH_TYPE_OPTIONS / curveKind 对齐
# ======================================================================

# 路径类型标识，与前端 TEN_PLUS_PATH_TYPE_OPTIONS 一一对应
等分线段路径 = "equalSegments"
非等分直线路径 = "unEqualSegments"
曲线路径 = "curve"
中心圆曲线 = "circle"
超椭圆曲线 = "superellipse"


def 解析曲线类型(数据: dict[str, Any]) -> str:
    """前端 curveKind；旧任务无该字段时，超椭圆指数 >0 仍按超椭圆。"""
    raw = str(数据.get("曲线类型") or 数据.get("curveKind") or "").strip()
    if raw in (超椭圆曲线, "超椭圆"):
        return 超椭圆曲线
    if raw in (中心圆曲线, "中心圆", "中心圆曲线"):
        return 中心圆曲线
    if float(数据.get("超椭圆指数", 0) or 0) > 0:
        return 超椭圆曲线
    return 中心圆曲线

# 切角矩形（祖母绿 / 雷迪恩轮廓）固定 8 条边：4 条直边 + 4 个 45° 切角
切角矩形边数 = 8
# 45° 切角使 8 个内角均为 135°，轮廓外扩 t 时每条边增长 t·2·cot(67.5°) = t·(2√2−2)
切角矩形边长外扩系数 = 2 * math.sqrt(2) - 2
# 行业 corner ratio 默认值：祖母绿 14%，雷迪恩 15%
默认切角比例 = 14.0
# 曲线段按起止角均匀采样的点数（含两端），初稿固定，不上表
圆弧采样点数 = 36


# ======================================================================
# 2. 入口
# runner 每行调用这里，再进入 6/7/8
# ======================================================================

def 构建执行任务的参数(数据: dict[str, Any],累计高度:float,是否存在台面:bool,台面设置的位置X:float) -> dict[str, Any]:

    """将前端解析的行数据转换为执行任务的参数。

    等分线段：根据直径和分割数计算圆心到等分弦线的垂直距离 d = R × cos(π / N)，
    其中 R = 直径/2，N = 分割数，每条弦的距离与长度都相同。

    非等分直线：切角矩形（祖母绿 / 雷迪恩轮廓），由长、宽、切角比例确定 8 条边，
    每条边的中心距与边长各不相同，见 构建非等分直线的参数。

    曲线：一行一段。中心圆垂直切管线目前是占位，等逐步重写；超椭圆按长/宽/n 采极径点。
    同一圈腰棱用 同层 编组，见 构建曲线的参数。
    """

    路径类型 = str(数据.get("路径类型", 等分线段路径))

    if 路径类型 == 非等分直线路径:
        结果 = 构建非等分直线的参数(数据,累计高度,是否存在台面,台面设置的位置X)
    elif 路径类型 == 曲线路径:
        # 这里会存在一个问题就是R轴旋转不会每次都到指定的位置,所以需要R轴记录位置
        结果 = 构建曲线的参数(数据,累计高度)
    elif 路径类型 == 等分线段路径:
        结果 = 构建等分直线的参数(数据,累计高度,是否存在台面,台面设置的位置X)
    else:
        raise ValueError(f"未知路径类型：{路径类型}")
        
    起始, 结束 = 夹紧切割百分比(数据.get("起始切割百分比", 0), 数据.get("结束切割百分比", 100))
    结果["起始切割百分比"] = 起始
    结果["结束切割百分比"] = 结束
    try:
        圈数 = float(数据.get("R轴旋转圈数", 2.0))
    except (TypeError, ValueError):
        圈数 = 2.0
    if not math.isfinite(圈数) or 圈数 <= 0:
        圈数 = 2.0
    结果["R轴旋转圈数"] = 圈数
    return 结果


def 夹紧切割百分比(起始: Any, 结束: Any) -> tuple[float, float]:
    """把起始/结束切割百分比夹到 [0, 100]，并保证结束 ≥ 起始。"""
    try:
        起 = float(起始)
    except (TypeError, ValueError):
        起 = 0.0
    try:
        止 = float(结束)
    except (TypeError, ValueError):
        止 = 100.0
    if not math.isfinite(起):
        起 = 0.0
    if not math.isfinite(止):
        止 = 100.0
    起 = max(0.0, min(100.0, 起))
    止 = max(0.0, min(100.0, 止))
    if 止 < 起:
        止 = 起
    return 起, 止


# ======================================================================
# 3. 行数据 / 配方 / 目标 / 层高
# ======================================================================

def 构建总任务目标(目标列表: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """将扁平行按 targetId + targetName 归并为目标数组。

    入参为前端展平后的 rows（每行带 targetId / targetName）。
    返回按首次出现顺序排列的目标列表，每项：
      { "id", "name", "rows": [属于该目标的全部行] }
    """
    分组: dict[tuple[str, str], dict[str, Any]] = {}
    顺序: list[tuple[str, str]] = []
    for 行 in 目标列表 or []:
        目标ID = str(行.get("targetId") or "")
        目标名 = str(行.get("targetName") or "")
        键 = (目标ID, 目标名)
        if 键 not in 分组:
            分组[键] = {"id": 目标ID, "name": 目标名, "rows": []}
            顺序.append(键)
        分组[键]["rows"].append(行)
    return [分组[k] for k in 顺序]


def _解析点位XYZ(raw: Any) -> tuple[float, float, float] | None:
    """解析前端下发的点位字符串，格式 "(x,y,z)"。"""
    if raw is None:
        return None
    文本 = str(raw).strip()
    if not 文本:
        return None
    内层 = 文本.strip("()[]").replace("，", ",")
    分段 = [p.strip() for p in 内层.split(",") if p.strip()]
    if len(分段) < 3:
        return None
    try:
        return float(分段[0]), float(分段[1]), float(分段[2])
    except ValueError:
        return None


def 判断是否存在台面且计算位置(目标列表: list[dict[str, Any]]) -> tuple[bool, float, float]:
    """查找每个目标的参数行：存在角度为 0 的一行则视为存在台面。

    发现台面时读取：该工位一拖五 U 轴旋转中心、该工位示教点位、该行下发的台面设置点位 XYZ。
    """
    for 目标 in 目标列表 or []:
        for 行 in 目标.get("rows") or []:
            角度 = float(行.get("angle") or 0)
            if 角度 != 0:
                continue
            try:
                工位号 = int(行.get("slotIndex"))
            except (TypeError, ValueError):
                日志.warning("[TenPlus] 发现台面但缺少工位号: 目标=%s",目标.get("name") or 目标.get("id"))
                return True, 0.0, 0.0

            旋转中心的位置 = 获取一拖五U轴旋转中心的补偿值(工位号)
            该工位的的位置 = 按工位号取点位(工位号)
            if 该工位的的位置 is None:
                日志.warning("[TenPlus] 发现台面但工位未示教: 目标=%s 工位=%s",目标.get("name") or 目标.get("id"),工位号)
                return True, 0.0, 0.0
            台面设置的位置 = _解析点位XYZ(行.get("pointXyz"))
            if 台面设置的位置 is None:
                日志.warning("[TenPlus] 发现台面但缺少台面设置点位 XYZ: 目标=%s 工位=%s",目标.get("name") or 目标.get("id"),工位号)
                return True, 0.0, 0.0

            台面设置的位置X, 台面设置的位置Y, 台面设置的位置Z = 台面设置的位置
            当前平面与旋转中心的Z的距离 = round(float(abs(旋转中心的位置.Z) - abs(float(该工位的的位置.get("z", 0)))),4)
            旋转90之后与旋转中心的X的距离 = round(abs(float(abs(台面设置的位置X) - abs(旋转中心的位置.X))),4)
            距离 = round(当前平面与旋转中心的Z的距离 - 旋转90之后与旋转中心的X的距离,4)
            return True, 距离, 台面设置的位置X
    return False, 0.0, 0.0

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

def 构建任务的数据(行数据: dict[str, Any], 工位的轴位置: dict[str, Any], 工位号: int) -> dict[str, Any]:
    """将前端解析的行数据转换为切割任务的数据。"""
    台面点 = _解析点位XYZ(行数据.get("pointXyz"))
    起始切割百分比, 结束切割百分比 = 夹紧切割百分比(行数据.get("cutStartPercent", 0),行数据.get("cutEndPercent", 100))
    return {
        "配方ID": str(行数据.get("recipeId", "")),
        "路径类型": str(行数据.get("pathType", "equalSegments")),
        "直径": float(行数据.get("diameter", 3.825)),
        "长": float(行数据.get("length", 0)),
        "宽": float(行数据.get("width", 0)),
        "角度": float(行数据.get("angle", 0)),
        "高度": float(行数据.get("height", 0)),
        "分割数": int(行数据.get("divisions", 0)),
        "切角比例": float(行数据.get("cornerRatio", 默认切角比例)),
        "圆弧起始角": float(行数据.get("arcStart", -45)),
        "圆弧结束角": float(行数据.get("arcEnd", 45)),
        "圆心偏X": float(行数据.get("arcOffsetX", 0)),
        "圆心偏Y": float(行数据.get("arcOffsetY", 0)),
        "曲线类型": str(行数据.get("curveKind") or ""),
        "超椭圆指数": float(行数据.get("superellipseN", 0)),
        "同层": bool(行数据.get("sameLayer", False)),
        "补偿角度": float(行数据.get("compAngle", 0)),
        "直径百分比": float(行数据.get("diameterPercent", 100)),
        "高度百分比": float(行数据.get("heightPercent", 100)),
        "起始切割百分比": 起始切割百分比,
        "结束切割百分比": 结束切割百分比,
        "弦长倍率": float(行数据.get("chordRatio", 1.2)),
        "R轴旋转圈数": float(行数据.get("rTurns", 2.0)),
        "工位号": int(工位号),
        "工位的X坐标": float(工位的轴位置.get("x", 0)),
        "工位的Y坐标": float(工位的轴位置.get("y", 0)),
        "工位的Z坐标": float(工位的轴位置.get("z", 0)),
        "工位的U坐标": float(工位的轴位置.get("u", 0)),
        "台面X": float(台面点[0]) if 台面点 else None,
        "台面Y": float(台面点[1]) if 台面点 else None,
        "台面Z": float(台面点[2]) if 台面点 else None,
        "K": float(行数据.get("k", 0)),
        "B": float(行数据.get("b", 0)),
        "X": float(行数据.get("x", 0)),
        "是否对切": bool(行数据.get("oppositeCut", True)),
    }

def 取行的实际高度(行数据: dict[str, Any]) -> float:
    """行高度按高度百分比缩放后的实际值，用于累计高度统计。"""
    return float(行数据.get("height", 0)) * (float(行数据.get("heightPercent", 100)) / 100.0)

def 行是否同层(行数据: dict[str, Any]) -> bool:
    """曲线段勾选「与上一行同层」时不计入层高累加。"""
    return bool(行数据.get("sameLayer", False)) and str(行数据.get("pathType", "")) == 曲线路径

def 取同层累计高度(行列表: list[dict[str, Any]], 序号: int) -> float:
    """第 序号 行上方已完成的层高：同层跟随行不叠进累计高度。"""
    return sum(取行的实际高度(行列表[k]) for k in range(序号) if not 行是否同层(行列表[k]))

def 构建R轴的补偿(行数据: dict[str, Any]) -> dict[str, Any]:
    """构建R轴的补偿。

    从行数据中提取 R 轴补偿参数：十轴切割R旋转圈数 + 每次补偿值。
    对应前端工具栏"每旋转 N 圈补偿 M mm"的全局配置，payload 中每行附带 十轴切割R旋转圈数 / rCompensation。
    """
    return {"十轴切割R旋转圈数": float(行数据.get("十轴切割R旋转圈数", 0)),"补偿值": float(行数据.get("十轴切割R旋转补偿值", 0)),}


# ======================================================================
# 4. 机台运动学
# U 工程位移→角度；中心距→激光头 XYZ（等分/切角/曲线共用）
# ======================================================================

def U工程位移转角度(工程位移: float) -> float:
    """将 U 轴工程位移（mpos）转换为角度（度）。

    换算口径与 ``zmc_adapter.U轴旋转的角度参数`` 一致：
        角度 = (工程位移 × units / 有效每圈脉冲数) × 360
    其中 有效每圈脉冲数 = pulses_per_rev × electronic_gear_ratio × gear_ratio。
    """
    cfg = 加载运动配置().u_axis
    units = float(cfg.units)
    有效每圈脉冲数 = (
        float(cfg.pulses_per_rev)
        * float(cfg.electronic_gear_ratio)
        * float(cfg.gear_ratio)
    )
    if units <= 0 or 有效每圈脉冲数 <= 0:
        日志.warning(
            "U轴 units/每圈脉冲非法，无法将工程位移转角度: units=%s pulses=%s",
            units,
            有效每圈脉冲数,
        )
        return 0.0
    return (float(工程位移) * units / 有效每圈脉冲数) * 360.0

# ======================================================================
# 5. 开口随切深变化
# V 型与平行型在 Z 下降过程中改扫描范围
# ======================================================================

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

def 按开口等距偏移插补点(点列: list[dict[str, Any]],*,开口值: float,是否反向: bool,) -> list[dict[str, float]]:
    """把十轴插补点列交给 calc_offset_ljs 做等距偏移。

    先按原始点序偏移，往返切割再反转结果，避免折线反向后面法向翻向。
    是否反向 / 开口值符号对应 LEFT/RIGHT，与原先 X±开口 在竖直边上一致。
    """
    平面点 = [{"x": float(p["X"]), "y": float(p["Y"])} for p in 点列]
    if len(平面点) < 2:
        return 平面点
    开口方向 = "RIGHT" if 是否反向 else "LEFT"
    距离 = float(开口值)
    if 距离 < 0:
        距离 = -距离
        开口方向 = "LEFT" if 开口方向 == "RIGHT" else "RIGHT"
    return 根据开口方向偏移开放折线(平面点, 开口方向, 距离)


# ======================================================================
# 6. 等分线段
# 圆的等分弦；台面扫面 / 正角度 / 负角度三支
# ======================================================================

def 构建等分直线的参数(数据: dict[str, Any],累计高度:float,是否存在台面:bool,台面设置的位置X:float) -> dict[str, Any]:
    
    工位号 = int(数据.get("工位号", 0))
    旋转中心的位置 = 获取一拖五U轴旋转中心的补偿值(工位号)
    R轴旋转中心的位置 = 获取一拖五R轴旋转中心点的位置(工位号)
    计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离 = R轴旋转中心的位置.X - 旋转中心的位置.X

    工位的X坐标 = float(数据.get("工位的X坐标", 0))
    工位的Y坐标 = float(数据.get("工位的Y坐标", 0))
    工位的U坐标 = float(数据.get("工位的U坐标", 0))
    工位的Z坐标 = float(数据.get("工位的Z坐标", 0))
    转化的做坐标 = U工程位移转角度(工位的U坐标)
    

    if not 是否存在台面:
    # 第一种通过相机来看:
        当前平面与旋转中心的Z的距离 = float(abs(旋转中心的位置.Z)-abs(工位的Z坐标))
    else:
    # 第二种通过X轴来计算:
        当前平面与旋转中心的Z的距离 = float(abs(工位的X坐标 - 台面设置的位置X))

    高度百分比 = float(数据.get("高度百分比", 100))
    高度 = float(数据.get("高度", 0)) * (高度百分比 / 100.0)

    角度 = float(数据.get("角度", 0))
    角度补偿 = float(数据.get("补偿角度", 0))
    这个是否为台面数据 = True if 角度 == 0 else False
    U轴的旋转角度 = 90 - (角度 + 角度补偿) if 角度 > 0 else -(-90 - (角度 + 角度补偿))

    是否对切 = bool(数据.get("是否对切", False))
    分割数 = int(数据.get("分割数", 0))
    是否启用R轴旋转 = 是否对切 if 这个是否为台面数据 else (分割数 == 0 or 分割数 >= 48)
    R轴旋转角度 = 360 / 分割数 if 分割数 > 0 else 0.0

    是否反向 =False if 角度 >= 0 else True

    直径百分比 = float(数据.get("直径百分比", 100))
    直径 = float(数据.get("直径", 0)) * (直径百分比 / 100.0)
    半径 = 直径 / 2
    _用等分弦 = (not 是否启用R轴旋转) and 分割数 > 0
    弦长 = round(2 * 半径 * math.sin(math.pi / 分割数), 4) if _用等分弦 else 0.0
    弦长倍率 = float(数据.get("弦长倍率", 1.2))



    # 这个就是冠 角度是正的
    if not 是否反向 and not 这个是否为台面数据:
        
        # 这一段的目的是计算出靠近下面这个圆的大圆的直径然后按照最大的圆的直径来计算出切割弧线
        切割产品的高度 = ((高度 + 累计高度) / math.sin(math.radians(abs(角度)))) + (弦长倍率-1)
        缩放的圆的半径 = abs((高度 / math.tan(math.radians(角度)) + 半径))
        最长那条边的切割长度 = 缩放的圆的半径 * 弦长倍率 if 缩放的圆的半径 > 弦长 else 弦长 * 弦长倍率
 
        真正的实际半径 = round((半径 + 累计高度 / math.tan(math.radians(角度))) * math.cos(math.pi / 分割数), 4) if _用等分弦 else (半径 + 累计高度 / math.tan(math.radians(角度)))
        初始位置直角三角形斜边 = math.hypot(真正的实际半径, 当前平面与旋转中心的Z的距离)
        在初始位置需要的角度 = math.degrees(math.atan2(真正的实际半径, 当前平面与旋转中心的Z的距离))
        日志.info(f"初始直角三角形 对边(半径)={半径} 邻边(Z)={当前平面与旋转中心的Z的距离} 对边(真正的实际半径)={真正的实际半径} "f"斜边={初始位置直角三角形斜边} 底角={在初始位置需要的角度}°")
        X需要移动的位置偏移量 = math.sin(math.radians(U轴的旋转角度+在初始位置需要的角度)) * 初始位置直角三角形斜边
        偏移后的三角形的高度 = math.cos(math.radians(U轴的旋转角度+在初始位置需要的角度)) * 初始位置直角三角形斜边
        从旋转圆心下降的距离 = 当前平面与旋转中心的Z的距离 - 偏移后的三角形的高度

        R与U通过旋转之后得到的的值X = round(math.sin(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4) 
        R与U通过旋转之后得到的的值Z = round(math.cos(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4) if U轴的旋转角度 != 0 else 0
        日志.info(f"X需要移动的位置偏移量={X需要移动的位置偏移量} "f"偏移后的三角形的高度={偏移后的三角形的高度} "f"从旋转圆心下降的距离={从旋转圆心下降的距离} "f"R与U通过旋转之后得到的的值={R与U通过旋转之后得到的的值X} ")
        切割中点的坐标={
            "X": 工位的X坐标+X需要移动的位置偏移量+R与U通过旋转之后得到的的值X,
            "Y": 工位的Y坐标,
            "Z": 工位的Z坐标-从旋转圆心下降的距离 -R与U通过旋转之后得到的的值Z,
        }
    # 这个就是亭 角度是负的
    elif 是否反向 and not 这个是否为台面数据:

        切割产品的高度 = ((高度 + 累计高度) / math.sin(math.radians(abs(角度)))) + (弦长倍率-1)
        缩放的圆的半径 = abs((高度 / math.tan(math.radians(角度)) + 半径))
        最长那条边的切割长度 = 缩放的圆的半径 * 弦长倍率 if 缩放的圆的半径 > 弦长 else 弦长 * 弦长倍率


        # 当切负角度的时候出现上面的高度那我就需要有高度的延长来计算，导致我的半径会变大
        真正的实际半径 = round((半径 + 累计高度 / math.tan(math.radians(abs(角度)))) * math.cos(math.pi / 分割数), 4) if _用等分弦 else (半径 + 累计高度 / math.tan(math.radians(abs(角度))))
        初始位置直角三角形斜边 = math.hypot(真正的实际半径, 当前平面与旋转中心的Z的距离)
        在初始位置需要的角度 = math.degrees(math.atan2(真正的实际半径, 当前平面与旋转中心的Z的距离))
        日志.info(f"{是否反向}+初始直角三角形 对边(半径)={半径} 邻边(Z)={当前平面与旋转中心的Z的距离} "  f"斜边={初始位置直角三角形斜边} 底角={在初始位置需要的角度}°")
        X需要移动的位置偏移量 = math.sin(math.radians(U轴的旋转角度-在初始位置需要的角度)) * 初始位置直角三角形斜边
        偏移后的三角形的高度 = math.cos(math.radians(U轴的旋转角度-在初始位置需要的角度)) * 初始位置直角三角形斜边
        从旋转圆心下降的距离 = 当前平面与旋转中心的Z的距离 - 偏移后的三角形的高度

        R与U通过旋转之后得到的的值X = round(math.sin(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4)
        R与U通过旋转之后得到的的值Z = round(math.cos(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4)
        日志.info(f"X需要移动的位置偏移量={X需要移动的位置偏移量} "f"偏移后的三角形的高度={偏移后的三角形的高度} "f"从旋转圆心下降的距离={从旋转圆心下降的距离} "f"R与U通过旋转之后得到的的值={R与U通过旋转之后得到的的值X} ")
        切割中点的坐标={
            "X": 工位的X坐标+X需要移动的位置偏移量+R与U通过旋转之后得到的的值X,
            "Y": 工位的Y坐标,
            "Z": 工位的Z坐标-从旋转圆心下降的距离 -R与U通过旋转之后得到的的值Z ,
        }
    elif 这个是否为台面数据:
        台面X = 数据.get("台面X")
        台面Y = 数据.get("台面Y")
        台面Z = 数据.get("台面Z")
        if 台面X is None or 台面Y is None or 台面Z is None:
            raise ValueError("台面行缺少点位 XYZ，无法构建切割中点")
        切割中点的坐标 = {
            "X": float(台面X),
            "Y": float(台面Y),
            "Z": float(台面Z),
        }
        最长那条边的切割长度 = round(直径 * 弦长倍率,4)
        切割产品的高度 = round(直径 * 弦长倍率,4)
        日志.info("[TenPlus] 台面切割中点直接使用点位 XYZ=(%.3f,%.3f,%.3f)",切割中点的坐标["X"],切割中点的坐标["Y"],切割中点的坐标["Z"],)


    # 下发 U 轴：工艺倾角 + 工位示教 U（转化的做坐标）
    U轴的旋转角度 = U轴的旋转角度 + 转化的做坐标

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
        "这个数据是否是台面数据": 这个是否为台面数据,
        "是否对切":是否对切,
    }


# ======================================================================
# 7. 非等分直线（切角矩形）
# 祖母绿 / 雷迪恩：8 条边各有中心距与 R 朝向
# ======================================================================

def 构建切角矩形的边(长: float, 宽: float, 切角比例: float) -> list[dict[str, Any]]:
    """切角矩形（祖母绿 / 雷迪恩轮廓）的 8 条边。列表顺序即切割顺序。

    R 仍按 45° 整数倍转（边法线），保证刀路贴着切角边。
    切角边中点用 切角方位角 投到已转正的机台坐标，起刀点在中点而不是垂足。
    相邻相对角经 归一化角度 收到 (-180, 180]。

    令 a = 长/2、b = 宽/2、c = 切角量：
        左右短边   中心距 a                    边长 宽 − 2c
        上下长边   中心距 b                    边长 长 − 2c
        四个切角   中心距 hypot(a−c/2, b−c/2)  边长 c√2
    """
    a = 长 / 2.0
    b = 宽 / 2.0
    c = 宽 * (切角比例 / 100.0)

    短边长 = 宽 - 2 * c
    长边长 = 长 - 2 * c
    切角边长 = c * math.sqrt(2)
    切角中点X = a - c / 2.0
    切角中点Y = b - c / 2.0
    切角边中心距 = math.hypot(切角中点X, 切角中点Y)
    切角方位角 = math.degrees(math.atan2(切角中点Y, 切角中点X))

    边定义 = [
        ("右短边", 0.0, a, 短边长),
        ("右上切角", 切角方位角, 切角边中心距, 切角边长),
        ("左上切角", 180.0 - 切角方位角, 切角边中心距, 切角边长),
        ("左下切角", 180.0 + 切角方位角, 切角边中心距, 切角边长),
        ("右下切角", 360.0 - 切角方位角, 切角边中心距, 切角边长),

        ("上长边", 90.0, b, 长边长),
        ("左短边", 180.0, a, 短边长),
        ("下长边", 270.0, b, 长边长),
    ]
    中点方位 = {
        "右上切角": 切角方位角,
        "左上切角": 180.0 - 切角方位角,
        "左下切角": 180.0 + 切角方位角,
        "右下切角": 360.0 - 切角方位角,
    }

    边列表: list[dict[str, Any]] = []
    for 序号, (名称, 法线角度, 中心距, 边长) in enumerate(边定义):
        上一条法线角度 = 边定义[序号 - 1][1]
        边列表.append({
            "序号": 序号 + 1,
            "名称": 名称,
            "法线角度": 法线角度,
            "相对旋转角度": round(归一化角度(法线角度 - 上一条法线角度), 4),
            "中心到边的距离": round(中心距, 4),
            "切角方位角": round(中点方位.get(名称, 法线角度), 4),
            "边长": round(边长, 4),
        })
    return 边列表

def 构建非等分直线的参数(数据: dict[str, Any],累计高度: float,是否存在台面:bool,台面设置的位置X:float) -> dict[str, Any]:
    # TODO:出现一个问题就是长和宽方面的角度问题要去怎么处理!
    
    
    """切角矩形（祖母绿 / 雷迪恩）的执行参数：8 条边各自的 R 轴朝向、切割中点与切割长度。

    与等分线段的差别在于「石心到边中点」的方位和距离不再是常数，因此不能靠 360/N 复用同一组
    中点坐标，返回值里额外给出 边参数列表，由 runner 按边取用。
    """
    工位号 = int(数据.get("工位号", 0))
    旋转中心的位置 = 获取一拖五U轴旋转中心的补偿值(工位号)
    R轴旋转中心的位置 = 获取一拖五R轴旋转中心点的位置(工位号)
    计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离 = R轴旋转中心的位置.X - 旋转中心的位置.X 

    工位的X坐标 = float(数据.get("工位的X坐标", 0))
    工位的Y坐标 = float(数据.get("工位的Y坐标", 0))
    工位的U坐标 = float(数据.get("工位的U坐标", 0))
    工位的Z坐标 = float(数据.get("工位的Z坐标", 0))
    转化的做坐标 = U工程位移转角度(工位的U坐标)

    当前平面与旋转中心的Z的距离 = float(abs(旋转中心的位置.Z)-abs(工位的Z坐标))

    if not 是否存在台面:
    # 第一种通过相机来看:
        当前平面与旋转中心的Z的距离 = float(abs(旋转中心的位置.Z)-abs(工位的Z坐标))
    else:
    # 第二种通过X轴来计算:
        当前平面与旋转中心的Z的距离 = float(abs(工位的X坐标 - 台面设置的位置X))
    
    高度百分比 = float(数据.get("高度百分比", 100))
    高度 = float(数据.get("高度", 0)) * (高度百分比 / 100.0)

    角度 = float(数据.get("角度", 0))
    角度补偿 = float(数据.get("补偿角度", 0))
    这个是否为台面数据 = True if 角度 == 0 else False
    U轴的旋转角度 = 90 - (角度 + 角度补偿) if 角度 > 0 else -(-90 - (角度 + 角度补偿))
    是否反向 = False if 角度 >= 0 else True

    是否对切 = bool(数据.get("是否对切", True))
    弦长倍率 = float(数据.get("弦长倍率", 1.2))

    原始最基础的尺寸的长 = float(数据.get("长", 0))
    原始最基础的尺寸的宽 = float(数据.get("宽", 0))
    切角比例 = float(数据.get("切角比例", 默认切角比例))
    原始最基础的尺寸的边列表 = 构建切角矩形的边(原始最基础的尺寸的长, 原始最基础的尺寸的宽, 切角比例)

    尺寸百分比 = float(数据.get("直径百分比", 100)) / 100.0
    计算出需要的长 = float(数据.get("长", 0)) * 尺寸百分比
    计算出需要的宽 = float(数据.get("宽", 0)) * 尺寸百分比
    切角比例 = float(数据.get("切角比例", 默认切角比例))
    边列表 = 构建切角矩形的边(计算出需要的长, 计算出需要的宽, 切角比例)


    切割产品的高度 = (高度 + 累计高度) / math.sin(math.radians(abs(角度))) + (弦长倍率-1)

    for 边 in 边列表:
        中心距 = float(边["中心到边的距离"])

        if not 是否反向:
            真正的实际半径  = 中心距 + 累计高度 / math.tan(math.radians(角度))
            初始位置直角三角形斜边 = math.hypot(真正的实际半径,当前平面与旋转中心的Z的距离)
            在初始位置需要的角度 = math.degrees(math.atan2(中心距, 当前平面与旋转中心的Z的距离))
            X需要移动的位置偏移量 = math.sin(math.radians(U轴的旋转角度+在初始位置需要的角度)) * 初始位置直角三角形斜边
            偏移后的三角形的高度 = math.cos(math.radians(U轴的旋转角度+在初始位置需要的角度)) * 初始位置直角三角形斜边
            从旋转圆心下降的距离 = 当前平面与旋转中心的Z的距离 - 偏移后的三角形的高度

            R与U通过旋转之后得到的的值X = round(math.sin(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4)
            R与U通过旋转之后得到的的值Z = round(math.cos(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4) if U轴的旋转角度 != 0 else 0
            坐标 = {
                "X": 工位的X坐标 + X需要移动的位置偏移量 + R与U通过旋转之后得到的的值X,
                "Y": 工位的Y坐标,
                "Z": 工位的Z坐标 - 从旋转圆心下降的距离 - R与U通过旋转之后得到的的值Z,
            }
            最大长 = float(数据.get("长", 0))
            最大宽 = float(数据.get("宽", 0))
            最大边列表 = 构建切角矩形的边(最大长, 最大宽, 切角比例)
            最大边长按名称 = {边["名称"]: float(边["边长"]) for 边 in 最大边列表}
        elif 是否反向:
            #TODO: 是不是这里会出现问题?  每个边都是需要有U轴的旋转角度
            真正的实际半径  = 中心距 + 累计高度 / math.tan(math.radians(abs(角度)))
            初始位置直角三角形斜边 = math.hypot(真正的实际半径,当前平面与旋转中心的Z的距离)
            在初始位置需要的角度 = math.degrees(math.atan2(中心距, 当前平面与旋转中心的Z的距离))
            X需要移动的位置偏移量 = math.sin(math.radians(U轴的旋转角度-在初始位置需要的角度)) * 初始位置直角三角形斜边
            偏移后的三角形的高度 = math.cos(math.radians(U轴的旋转角度-在初始位置需要的角度)) * 初始位置直角三角形斜边
            从旋转圆心下降的距离 = 当前平面与旋转中心的Z的距离 - 偏移后的三角形的高度

            R与U通过旋转之后得到的的值X = round(math.sin(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4)
            R与U通过旋转之后得到的的值Z = round(math.cos(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4) 
            坐标 = {
                "X": 工位的X坐标 + X需要移动的位置偏移量 + R与U通过旋转之后得到的的值X,
                "Y": 工位的Y坐标,
                "Z": 工位的Z坐标 - 从旋转圆心下降的距离 - R与U通过旋转之后得到的的值Z,
            }
            真正的实际半径  = 中心距 + 累计高度 / math.tan(math.radians(角度))
            最大长 = float(数据.get("长", 0)) * (真正的实际半径/中心距)
            最大宽 = float(数据.get("宽", 0)) * (真正的实际半径/中心距)
            最大边列表 = 构建切角矩形的边(最大长, 最大宽, 切角比例)
            最大边长按名称 = {边["名称"]: float(边["边长"]) for 边 in 最大边列表}
        边["切割中点的坐标"] = 坐标
        最大边长 = 最大边长按名称[边["名称"]]
        边["最长的那条边的切割长度"] = round(最大边长 + (弦长倍率 - 1), 4)
        日志.info(f"[TenPlus] 切角矩形 边{边['序号']}({边['名称']}) 法线={边['法线角度']}° "f"中点方位={边.get('切角方位角', 边['法线角度'])}° "f"相对角={边['相对旋转角度']}° 中心距={边['中心到边的距离']} 边长={边['边长']} "f"切割长度={边['最长的那条边的切割长度']} "f"中点=({坐标['X']:.4f},{坐标['Y']:.4f},{坐标['Z']:.4f})")

    首边 = 边列表[0]
    return {
        "是否反向": 是否反向,
        "R轴旋转的分割数": 切角矩形边数,
        # 每条边的中心距不同，无法边转边切，只能逐边定位
        "是否启用R轴旋转": False,
        "U轴的旋转角度": U轴的旋转角度 + 转化的做坐标,
        "R轴旋转角度": 360.0 / 切角矩形边数,
        "开始前R轴角度": float(首边["法线角度"]),
        "等分线的长度": 首边["边长"],
        "切割中点的坐标": 首边["切割中点的坐标"],
        "切割产品的高度": 切割产品的高度,
        "最长的那条边的切割长度": 首边["最长的那条边的切割长度"],
        "这个数据是否是台面数据": 这个是否为台面数据,
        "是否对切": 是否对切,
        "边参数列表": 边列表,
    }


# ======================================================================
# 8. 曲线（中心圆 / 超椭圆）
# 中心圆：采样 → 超 180° 沿走刀方向拆段 → 每段绕石心转到 +X、从 X=0 起 → 90°插补 → 绕U心 → Z拍最高。
# 超椭圆：采样 → 转到右侧 → 90°插补 → 绕U心 → Z拍最高。
# ======================================================================

# --- 8.1 中心圆工件轮廓采样 ---

def 采样圆弧点(圆心x: float, 圆心y: float, 半径: float, 起始角: float, 结束角: float, 点数: int = 圆弧采样点数) -> list[tuple[float, float]]:
    """中心圆：等圆心角采样 x = xc + r·cosθ，y = yc + r·sinθ。不自动走劣弧。"""
    if 点数 < 2:
        raise ValueError(f"圆弧采样点数至少 2，当前 {点数}")
    if 半径 <= 0:
        raise ValueError(f"曲线半径必须大于 0，当前 {半径}")
    if 起始角 == 结束角:
        raise ValueError(f"圆弧起始角与结束角不能相同：{起始角}")
    跨度 = 结束角 - 起始角
    点列: list[tuple[float, float]] = []
    for i in range(点数):
        t = i / (点数 - 1)
        弧度 = math.radians(起始角 + 跨度 * t)
        点列.append((圆心x + 半径 * math.cos(弧度), 圆心y + 半径 * math.sin(弧度)))
    return 取6位点列(点列)

# --- 8.2 超椭圆工件轮廓采样 ---


def 超椭圆极径(弧度: float, 半长: float, 半宽: float, 指数: float) -> float:
    """垫型超椭圆：r(θ) = a·b / [ (b·|cosθ|)ⁿ + (a·|sinθ|)ⁿ ]^(1/n)。"""
    c = abs(math.cos(弧度))
    s = abs(math.sin(弧度))
    分母 = (半宽 * c) ** 指数 + (半长 * s) ** 指数
    if 分母 <= 0:
        return 0.0
    return (半长 * 半宽) / (分母 ** (1.0 / 指数))


def 采样超椭圆弧(半长: float,半宽: float,指数: float,起始角: float,结束角: float,点数: int = 圆弧采样点数,) -> list[tuple[float, float]]:
    """超椭圆：等极角采样，r(θ) 随角变化，不是定半径圆。

    相对公式坐标再转 45°（尖角离开坐标轴），与前端预览同一套。
    """
    if 点数 < 2:
        raise ValueError(f"超椭圆采样点数至少 2，当前 {点数}")
    if 半长 <= 0 or 半宽 <= 0:
        raise ValueError(f"超椭圆半长/半宽必须大于 0，当前 {半长}, {半宽}")
    if 指数 <= 0:
        raise ValueError(f"超椭圆指数必须大于 0，当前 {指数}")
    if 起始角 == 结束角:
        raise ValueError(f"超椭圆起始角与结束角不能相同：{起始角}")
    跨度 = 结束角 - 起始角
    轮廓旋转 = math.radians(45.0)
    点列: list[tuple[float, float]] = []
    for i in range(点数):
        t = i / (点数 - 1)
        放置角 = math.radians(起始角 + 跨度 * t)
        形状角 = 放置角 - 轮廓旋转
        r = 超椭圆极径(形状角, 半长, 半宽, 指数)
        点列.append((r * math.cos(放置角), r * math.sin(放置角)))
    return 取6位点列(点列)

# --- 8.3 绕石心转到右侧（超椭圆仍在用；中心圆重写时再决定是否共用） ---

工件坐标小数位 = 6


def 取6位点列(点列: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return [(round(float(x), 工件坐标小数位), round(float(y), 工件坐标小数位)) for x, y in 点列]


def 转到右侧切割面(点列: list[tuple[float, float]], 法线角度: float) -> list[tuple[float, float]]:
    """绕工位中心把这段弧的朝向转到 +X（机台右侧）。

    U 只能左右倾、不能前后倾：下一段弧靠 R 把那一面转到右侧，XY 插补仍走右侧。
    旋转 -法线角：x' = x cosθ + y sinθ，y' = -x sinθ + y cosθ。
    """
    弧度 = math.radians(法线角度)
    c = math.cos(弧度)
    s = math.sin(弧度)
    return 取6位点列([(x * c + y * s, -x * s + y * c) for x, y in 点列])

def 转到左侧切割面(点列: list[tuple[float, float]], 法线角度: float) -> list[tuple[float, float]]:
    """绕工位中心把这段弧的朝向转到 -X（机台左侧）。

    相对转到右侧再转 180°：法线落到 -X，点序不镜像。
    x' = -x cosθ - y sinθ，y' = x sinθ - y cosθ。
    """
    弧度 = math.radians(法线角度)
    c = math.cos(弧度)
    s = math.sin(弧度)
    return 取6位点列([(-x * c - y * s, x * s - y * c) for x, y in 点列])


def 根据旋转角度计算工件点列(点列: list[tuple[float, float]], 旋转角度: float,) -> list[tuple[float, float]]:
    """转到右侧后，点视为 (x, y, 0)，绕石心平行 Y 转（与 U 同轴）。

    矩阵与 ``计算点绕坐标轴旋转(..., 'y')`` 相同：x' = x cosθ + z sinθ，y' = y。
    z=0 时 x' = x cosθ，y 不变。三维半径不变：hypot(x', y, -x sinθ) = hypot(x, y)。
    旋转角用 U 轴角（相对垂直切）：工艺 90° → U=0° → 点列不变。
    """
    if not 点列:
        return 点列
    if abs(float(旋转角度)) < 1e-12:
        return 取6位点列(点列)
    弧度 = math.radians(float(旋转角度))
    c = math.cos(弧度)
    return 取6位点列([(x * c, y) for x, y in 点列])


def 按弦长倍率沿Y展开工件点列(点列: list[tuple[float, float]],弦长倍率: float,) -> list[tuple[float, float]]:
    """转到右侧后，以 Y 中点为心把 wy 乘倍率。口径与等分线段「弦长 × 弦长倍率」相同：只加长走刀，不放大径向 wx。"""
    if len(点列) < 2 or abs(弦长倍率 - 1.0) < 1e-9:
        return 取6位点列(点列) if 点列 else 点列
    ys = [p[1] for p in 点列]
    y0 = (min(ys) + max(ys)) / 2.0
    return 取6位点列([(x, y0 + (y - y0) * 弦长倍率) for x, y in 点列])


def 归一化角度(角度: float) -> float:
    """收到 (-180, 180]。"""
    值 = float(角度)
    while 值 > 180.0:
        值 -= 360.0
    while 值 <= -180.0:
        值 += 360.0
    return 值


def 选择绕石心转到右侧的法线(点列: list[tuple[float, float]]) -> float:
    """绕石心旋转，让这段弧成为右侧半圆：起点 X=0，其余点 X≥0，弦沿 Y。

    只试起点极角的 0/±90/180。先比转后最小 X（贴 +X）；并列时再比起终点 Y 跨度，
    避免起点已在石心/Y 轴时选成「直径躺在 X 上、法线=0、R 不转」。
    """
    if not 点列:
        raise ValueError("中心圆点列为空，无法计算转到右侧的法线")
    x0, y0 = 点列[0]
    起点极角 = math.degrees(math.atan2(y0, x0))
    候选 = (起点极角, 起点极角 + 90.0, 起点极角 - 90.0, 起点极角 + 180.0)
    最佳角 = 候选[0]
    最佳最小X = float("-inf")
    最佳Y跨 = float("-inf")
    for 角 in 候选:
        转后 = 转到右侧切割面(点列, 角)
        最小X = min(p[0] for p in 转后)
        y跨 = abs(转后[-1][1] - 转后[0][1])
        最小X更好 = 最小X > 最佳最小X + 1e-9
        y跨更好 = abs(最小X - 最佳最小X) <= 1e-9 and y跨 > 最佳Y跨
        if 最小X更好 or y跨更好:
            最佳最小X = 最小X
            最佳Y跨 = y跨
            最佳角 = 角
    return 归一化角度(最佳角)


# --- 8.4 按行收集点列 ---

def 收集超椭圆工件点列(数据: dict[str, Any], 尺寸百分比: float) -> tuple[list[tuple[float, float]], float, dict[str, float]]:
    """从外接长/宽 + 指数 n + 起止角收集超椭圆点列，不用半径。"""
    半长 = float(数据.get("长", 0)) * 尺寸百分比 / 2.0
    半宽 = float(数据.get("宽", 0)) * 尺寸百分比 / 2.0
    指数 = float(数据.get("超椭圆指数", 0) or 0)
    起始角 = float(数据.get("圆弧起始角", -45))
    结束角 = float(数据.get("圆弧结束角", 45))
    点列 = 采样超椭圆弧(半长, 半宽, 指数, 起始角, 结束角)
    法线角度 = (起始角 + 结束角) / 2.0
    return 点列, 法线角度, {
        "半长": 半长,
        "半宽": 半宽,
        "超椭圆指数": 指数,
        "起始角": 起始角,
        "结束角": 结束角,
    }


def 插补点绕U轴中心旋转并拍平最高Z(路径: list[dict[str, float]],中心: Any,角度: float,拍平最高Z: bool = True) -> list[dict[str, float]]:
    """机台插补点绕该工位 U 心、平行 Y 轴旋转。拍平时全部点的 Z 改成旋转后最高点。"""
    if not 路径: return 路径
    转后 = 计算点绕轴心旋转([{"x": p["X"], "y": p["Y"], "z": p["Z"]} for p in 路径],角度,"y",中心)
    if not isinstance(转后, list):转后 = [转后]
    最高z = max(q["z"] for q in 转后)
    return [{"X": round(q["x"], 工件坐标小数位), "Y": round(q["y"], 工件坐标小数位), "Z": round(最高z if 拍平最高Z else q["z"], 工件坐标小数位)} for q in 转后]


# --- 8.5 生成执行参数 ---

def 构建曲线的参数(数据: dict[str, Any], 累计高度: float = 0.0) -> dict[str, Any]:
    """一行一段曲线。垫形/马眼/水滴由多行同层曲线拼成，不在此函数里写死形状。

    点列按 曲线类型 分两路：
    - 中心圆：半径 + 圆心偏置 + 起止角，超 180° 沿方向拆段，每段绕石心转到右侧
    - 超椭圆：外接长/宽 + 指数 n + 起止角，等极角变半径采样

    台面（0°）用示教点扫面。非台面点列顺序：
    采样 → 绕石心转到右侧 → 转到右侧切割面 → 点列转插补（90° 出点后绕 U 心，Z 拍最高）。
    平面上的圆不再先按 U 角压 X：倾角只在绕 U 心时做一次。
    """
    工位号 = int(数据.get("工位号", 0))
    U轴旋转中心的位置 = 获取一拖五U轴旋转中心的补偿值(工位号)
    R轴旋转中心的位置 = 获取一拖五R轴旋转中心点的位置(工位号)
    计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离 = R轴旋转中心的位置.X - U轴旋转中心的位置.X
    
    工位的X坐标 = float(数据.get("工位的X坐标", 0))
    工位的Y坐标 = float(数据.get("工位的Y坐标", 0))
    工位的Z坐标 = float(数据.get("工位的Z坐标", 0))        
    工位的U坐标 = float(数据.get("工位的U坐标", 0))
    转化的做坐标 = U工程位移转角度(工位的U坐标)
    
    高度百分比 = float(数据.get("高度百分比", 100))
    高度 = float(数据.get("高度", 0)) * (高度百分比 / 100.0)
    角度 = float(数据.get("角度", 0))
    角度补偿 = float(数据.get("补偿角度", 0))
    U轴的旋转角度 = 90 - (角度 + 角度补偿) if 角度 > 0 else -(-90 - (角度 + 角度补偿))
    是否反向 = False if 角度 >= 0 else True
    是否对切 = bool(数据.get("是否对切", True))
    弦长倍率 = float(数据.get("弦长倍率", 1.2))

    尺寸百分比 = float(数据.get("直径百分比", 100)) / 100.0
    曲线类型 = 解析曲线类型(数据)

    切割产品的高度 =((高度 + 累计高度) / math.sin(math.radians(abs(角度))) ) + (弦长倍率-1)

    def 点列转插补(工件点列: list[tuple[float, float]], 拍平最高Z: bool = True) -> list[dict[str, float]]:
        """先贴到工位 XYZ，再绕 U 心转；不共线的 ΔX/ΔZ 已在旋转里，不再加 sin(U)×(R.X−U.X)。"""
        路径: list[dict[str, float]] = []
        # 工件点只有石心坐标系里的 (wx, wy)。这里加上示教工位，变成还没倾的机台点
        for wx, wy in 工件点列:
            路径.append({
                "X": round(工位的X坐标 + wx, 工件坐标小数位),
                "Y": round(工位的Y坐标 + wy, 工件坐标小数位),
                "Z": round(工位的Z坐标, 工件坐标小数位),
            })
        绕U轴旋转后的点 = 插补点绕U轴中心旋转并拍平最高Z(路径, U轴旋转中心的位置, U轴的旋转角度, 拍平最高Z)
        R与U通过旋转之后得到的的值X = round(math.cos(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4)if U轴的旋转角度 != 0 else 0
        R与U通过旋转之后得到的的值Z = round(math.sin(math.radians(U轴的旋转角度))*计算得到U轴的旋转中心点与R轴旋转中心点的X轴的位置距离,4) 
        绕U轴旋转后并增加R与U之间补偿的值的点 = [{"X": p["X"] + R与U通过旋转之后得到的的值X, "Y": p["Y"], "Z": p["Z"] - R与U通过旋转之后得到的的值Z} for p in 绕U轴旋转后的点]
        return 绕U轴旋转后并增加R与U之间补偿的值的点

    def 组装边(名称: str, 法线角度: float, 相对旋转角度: float, 插补路径点: list[dict[str, float]]) -> dict[str, Any]:
        ys = [p["Y"] for p in 插补路径点]
        切割长度 = round((max(ys) - min(ys)) if ys else 0.0, 4)
        # 中点 = 插补路径点[len(插补路径点) // 2] if 插补路径点 else {"X": 0.0, "Y": 0.0, "Z": 0.0}
        中点 = 插补路径点[0] if 插补路径点 else {"X": 0.0, "Y": 0.0, "Z": 0.0}

        return {
            "名称": 名称,
            "法线角度": 法线角度,
            "相对旋转角度": 相对旋转角度,
            "切割中点的坐标": 中点,
            "最长的那条边的切割长度": 切割长度,
            "插补路径点": 插补路径点,
        }

    边列表: list[dict[str, Any]] = []
    if 曲线类型 == 超椭圆曲线:
        if not 是否反向:
            工件点列, 法线角度, 采样信息 = 收集超椭圆工件点列(数据, 尺寸百分比)
            print(工件点列,"==========工件点列===========",法线角度,"==========法线角度===========",采样信息,"==========采样信息===========RDONE")
            工件点列 = 转到右侧切割面(工件点列, 法线角度)
            print(工件点列,"工件点列")
            插补路径点 = 点列转插补(工件点列)
            print(插补路径点,"插补路径点")
            边列表.append(组装边("超椭圆", 法线角度, 0.0, 插补路径点))
            中点 = 边列表[0]["切割中点的坐标"]
            日志.info(
                f"[TenPlus] 超椭圆段 a={采样信息['半长']} b={采样信息['半宽']} n={采样信息['超椭圆指数']} "
                f"角={采样信息['起始角']}°→{采样信息['结束角']}° 法线={法线角度}°(已转到右侧) "
                f"U={U轴的旋转角度}° 累计高度={累计高度} 本层高度={高度} 弦长倍率={弦长倍率} "
                f"点数={len(插补路径点)} 中点=({中点['X']},{中点['Y']},{中点['Z']}) Z最高={中点['Z']}"
            )
        elif 是否反向:
            工件点列, 法线角度, 采样信息 = 收集超椭圆工件点列(数据, 尺寸百分比)
            工件点列 = 转到左侧切割面(工件点列, 法线角度)
            插补路径点 = 点列转插补(工件点列)
            边列表.append(组装边("超椭圆", 法线角度, 0.0, 插补路径点))
            中点 = 边列表[0]["切割中点的坐标"]
            日志.info(
                f"[TenPlus] 超椭圆段 a={采样信息['半长']} b={采样信息['半宽']} n={采样信息['超椭圆指数']} "
                f"角={采样信息['起始角']}°→{采样信息['结束角']}° 法线={法线角度}°(已转到右侧) "
                f"U={U轴的旋转角度}° 累计高度={累计高度} 本层高度={高度} 弦长倍率={弦长倍率} "
                f"点数={len(插补路径点)} 中点=({中点['X']},{中点['Y']},{中点['Z']}) Z最高={中点['Z']}"
            )

    elif 曲线类型 == 中心圆曲线:
        if not 是否反向:
            半径 = float(数据.get("直径", 0)) * 尺寸百分比
            圆心偏X = float(数据.get("圆心偏X", 0))
            圆心偏Y = float(数据.get("圆心偏Y", 0))
            起始角 = float(数据.get("圆弧起始角", -45))
            结束角 = float(数据.get("圆弧结束角", 45))
            # 1:首先获取圆弧上的点的点列
            工件点列 = 采样圆弧点(圆心偏X, 圆心偏Y, 半径, 起始角, 结束角)
            # 2:计算该圆弧上的点距离石心的距离同时计算出每个点R轴需要旋转的角度
            极角列: list[float] = []
            右侧点列: list[tuple[float, float]] = []
            for x, y in 工件点列:
                极径 = math.hypot(x, y)
                if 极径 <= 1e-9: raise ValueError(f"中心圆采样点落在石心上：({x}, {y})")
                极角列.append(math.degrees(math.atan2(y, x)))
                右侧点列.append((极径, 0.0))
            # 刀尖只走右侧切割线上的极径。圆心不在石心时极径会变，U 倾斜后各点保留自己的 Z。
            插补路径点 = 点列转插补(右侧点列, 拍平最高Z=False)
            边 = 组装边("圆弧", 极角列[0], 0.0, 插补路径点)
            边["沿途R的绝对角"] = [round(角度, 4) for 角度 in 极角列]
            边列表.append(边)
    首边 = 边列表[0]
    切割长度 = float(首边["最长的那条边的切割长度"])
    中点 = 首边["切割中点的坐标"]
    return {
        "是否反向": 是否反向,
        "R轴旋转的分割数": len(边列表),
        "是否启用R轴旋转": 曲线类型 == 中心圆曲线,
        "U轴的旋转角度": U轴的旋转角度 + 转化的做坐标,
        "R轴旋转角度": 0.0,
        "等分线的长度": 切割长度,
        "切割中点的坐标": 中点,
        "切割产品的高度": 切割产品的高度,
        "最长的那条边的切割长度": 切割长度,
        "这个数据是否是台面数据": False,
        "是否对切": 是否对切,
        "边参数列表": 边列表,
    }


# --- 9. 单直线 ---

直线起终点形式 = "endpoints"
直线中点长形式 = "midLength"

