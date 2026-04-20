import json
import math
from pathlib import Path
from collections import defaultdict
from typing import Any, Dict, List, NotRequired, Optional, Set, Tuple, TypedDict


OPEN_PATH_SAMPLE_SEGMENTS = 96
DEFAULT_OPEN_SIZE = 0.5
POINT_EPS = 1e-6
LINE_PARALLEL_EPS = 1e-9
# 与 QomoTech_FrontEnd threeGeometry.ts 一致
MITER_LIMIT = 8


class PointDict(TypedDict):
    x: float
    y: float
    z: NotRequired[float]


class EntityOffsetProfile(TypedDict):
    entity: Dict[str, Any]
    original_start: PointDict
    original_end: PointDict
    offset_points: List[PointDict]


def 安全转化点位(obj: Any) -> Optional[PointDict]:
    """
    作用：把任意对象安全转换为 PointDict。
    逻辑：
        必须是 dict，且有 x/y，且为数值且有限（非 NaN/Inf）。
        若传入 z，也必须为数值且有限（非 NaN/Inf）。
        合法则转为 float 返回；否则 None。
    用途：统一输入校验，避免后续几何计算崩溃。
    """
    if not isinstance(obj, dict):
        return None
    x = obj.get("x")
    y = obj.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return None
    if not math.isfinite(float(x)) or not math.isfinite(float(y)):
        return None
    point: PointDict = {"x": float(x), "y": float(y)}
    if "z" in obj:
        z = obj.get("z")
        if not isinstance(z, (int, float)) or not math.isfinite(float(z)):
            return None
        point["z"] = float(z)
    return point


def 规范开口方向(value: Any) -> str:
    """
    作用：规范开口方向。
    逻辑：
        仅接受 "RIGHT" / "LEFT"（大小写不敏感）。
        其他一律回退 "RIGHT"。
    用途：保证方向逻辑稳定。
    """
    if isinstance(value, str) and value.upper() in {"RIGHT", "LEFT"}:
        return value.upper()
    return "RIGHT"


def 反转开口方向(entity: Dict[str, Any]) -> Dict[str, Any]:
    """浅拷贝实体并将 openDirection 取反（RIGHT↔LEFT），供从 LJS 读取后整体反转开口侧。"""
    out = dict(entity)
    od = 规范开口方向(out.get("openDirection"))
    out["openDirection"] = "LEFT" if od == "RIGHT" else "RIGHT"
    return out


def 判断是否重复点(a: PointDict, b: PointDict, eps: float = POINT_EPS) -> bool:
    """
    作用：用 POINT_EPS 判断两点是否视为相同，用于接缝去重。
    """
    return abs(a["x"] - b["x"]) <= eps and abs(a["y"] - b["y"]) <= eps

# =========================================================共享端点的优化========================================================
def 求两条直线的交点(a0: PointDict, a1: PointDict, b0: PointDict, b1: PointDict) -> Optional[PointDict]:
    """
    无限长直线求交；近平行返回 None。与 threeGeometry.intersectLines2D 一致。
    """
    ax = a1["x"] - a0["x"]
    ay = a1["y"] - a0["y"]
    bx = b1["x"] - b0["x"]
    by = b1["y"] - b0["y"]
    det = ax * by - ay * bx
    if abs(det) < LINE_PARALLEL_EPS:
        return None
    dx = b0["x"] - a0["x"]
    dy = b0["y"] - a0["y"]
    t = (dx * by - dy * bx) / det
    return {"x": a0["x"] + ax * t, "y": a0["y"] + ay * t}


def 获取偏移端点切线(offset_points: List[PointDict], side: str) -> Optional[Tuple[PointDict, PointDict, PointDict]]:
    """
    偏移轮廓在 start/end 侧的切线（from→to）及原始偏移端点 base（用于 miter 距离）。
    side: 'start' | 'end'。与 getOffsetEndpointLine 一致。
    """
    if len(offset_points) < 2:
        return None
    if side == "start":
        return (offset_points[0], offset_points[1], offset_points[0])
    return (offset_points[-1], offset_points[-2], offset_points[-1])


def 根据侧边获取原始端点(profile: EntityOffsetProfile, side: str) -> PointDict:
    return profile["original_start"] if side == "start" else profile["original_end"]


def 获取稳定实体ID(profile: EntityOffsetProfile, index: int) -> str:
    eid = 实体ID转化为字符串(profile["entity"])
    return eid if eid else f"__idx_{index}"


def 覆盖偏移相交端点(profiles: List[EntityOffsetProfile], open_size: float) -> None:
    """
    共享原始端点处，对两侧「偏移端点切线」求交，通过 miter 限制则覆盖首尾偏移点。
    仅修改 offset_points 的首/末坐标；与 line-offset-join-diagram.md / buildOpenEntityOffsetOverrides 一致。
    """
    if len(profiles) < 2:
        return
    keys = [获取稳定实体ID(p, i) for i, p in enumerate(profiles)]
    overrides: Dict[str, Dict[str, PointDict]] = {}

    for i, profile in enumerate(profiles):
        kid = keys[i]
        pts = profile["offset_points"]
        for side in ("start", "end"):
            joint = 根据侧边获取原始端点(profile, side)
            line_a = 获取偏移端点切线(pts, side)
            if line_a is None:
                continue
            a0, a1, base_a = line_a

            candidates: List[Tuple[int, str]] = []
            for j, other in enumerate(profiles):
                if j == i:
                    continue
                if 判断是否重复点(other["original_start"], joint):
                    candidates.append((j, "start"))
                elif 判断是否重复点(other["original_end"], joint):
                    candidates.append((j, "end"))
            if not candidates:
                continue

            best_intersection: Optional[PointDict] = None
            best_score = float("inf")
            for j, oside in candidates:
                other_pts = profiles[j]["offset_points"]
                line_b = 获取偏移端点切线(other_pts, oside)
                if line_b is None:
                    continue
                b0, b1, _base_b = line_b
                intersection = 求两条直线的交点(a0, a1, b0, b1)
                if intersection is None:
                    continue
                miter_distance = math.hypot(
                    intersection["x"] - base_a["x"],
                    intersection["y"] - base_a["y"],
                )
                other_open = open_size  # 当前后端批内统一 open_size，与 profile.openSize 等价
                if miter_distance > max(open_size, other_open) * MITER_LIMIT:
                    continue
                if miter_distance < best_score:
                    best_score = miter_distance
                    best_intersection = intersection

            if best_intersection is None:
                continue
            slot = overrides.setdefault(kid, {})
            slot[side] = dict(best_intersection)

    for i, profile in enumerate(profiles):
        kid = keys[i]
        ov = overrides.get(kid)
        if not ov:
            continue
        pts = profile["offset_points"]
        if "start" in ov:
            pts[0] = dict(ov["start"])
        if "end" in ov:
            pts[-1] = dict(ov["end"])
# =========================================================共享端点的优化========================================================

def 删除连续的重复点(points: List[PointDict]) -> List[PointDict]:
    """
    作用：删除连续的重复点（粗粒度清理），然后本链结果并入 stitched
    """
    if not points:
        return []
    out: List[PointDict] = [points[0]]
    for point in points[1:]:
        if not 判断是否重复点(out[-1], point):
            out.append(point)
    return out


def 采样圆弧上的点(center: PointDict,radius: float,start_angle: float,end_angle: float,segments: int = 48,) -> List[PointDict]:
    """
    作用：按角度范围采样圆弧点列。
    关键逻辑：
        1.先算 sweep = end - start，并归一化到 (-360, 360] 范围；
        2.若 sweep 近似 0，当作整圆（+360 或 -360）；
        3.均匀步进采样 segments + 1 个点。
    用途：生成原弧/偏移弧的离散点序列。
    """
    # 与前端 createArcPoints 保持一致
    sweep = end_angle - start_angle
    while sweep > 360:
        sweep -= 360
    while sweep <= -360:
        sweep += 360
    if abs(sweep) < 1e-9:
        sweep = 360 if sweep >= 0 else -360

    step = sweep / max(segments, 1)
    points: List[PointDict] = []
    for idx in range(segments + 1):
        angle = start_angle + step * idx
        rad = math.radians(angle)
        points.append(
            {
                "x": center["x"] + radius * math.cos(rad),
                "y": center["y"] + radius * math.sin(rad),
            }
        )
    return points


def 从局部坐标转换到世界坐标(center: PointDict, rotation_deg: float, local_x: float, local_y: float) -> PointDict:
    """
    作用：将局部坐标点按 rotationDeg 旋转并平移到世界坐标。
    用途：与前端不规则图形（oval/marquise/pear/heart）生成规则对齐。
    """
    rot = math.radians(rotation_deg)
    ux = math.cos(rot)
    uy = math.sin(rot)
    vx = -uy
    vy = ux
    return {
        "x": center["x"] + local_x * ux + local_y * vx,
        "y": center["y"] + local_x * uy + local_y * vy,
    }


def 采样椭圆上的点(center: PointDict,radius_x: float,radius_y: float,rotation_deg: float,start_angle_deg: float = 0.0,end_angle_deg: float = 360.0,segments: int = 96,) -> List[PointDict]:
    """
    作用：按参数角采样椭圆点列（含旋转）。
    规则：与前端 createEllipsePoints 一致。
    """
    sweep = end_angle_deg - start_angle_deg
    while sweep > 360:
        sweep -= 360
    while sweep <= -360:
        sweep += 360
    if abs(sweep) < 1e-9:
        sweep = 360 if sweep >= 0 else -360

    step = sweep / max(segments, 1)
    points: List[PointDict] = []
    for idx in range(segments + 1):
        t_deg = start_angle_deg + step * idx
        t = math.radians(t_deg)
        local_x = radius_x * math.cos(t)
        local_y = radius_y * math.sin(t)
        points.append(从局部坐标转换到世界坐标(center, rotation_deg, local_x, local_y))
    return points


def 采样方形上的点(center: PointDict, radius_x: float, radius_y: float, rotation_deg: float) -> List[PointDict]:
    """
    作用：采样方形（square）顶点。
    规则：与前端 createSquarePoints 一致，返回四个角点（不额外闭合）。
    """
    hx = max(radius_x, 1e-6)
    hy = max(radius_y, 1e-6)
    return [
        从局部坐标转换到世界坐标(center, rotation_deg, -hx, -hy),
        从局部坐标转换到世界坐标(center, rotation_deg, hx, -hy),
        从局部坐标转换到世界坐标(center, rotation_deg, hx, hy),
        从局部坐标转换到世界坐标(center, rotation_deg, -hx, hy),
    ]


def 采样马眼上的点(center: PointDict, radius_x: float, radius_y: float, rotation_deg: float, segments: int = 96) -> List[PointDict]:
    """
    作用：采样马眼（marquise）闭合点列。
    规则：与前端 createMarquisePoints 一致。
    """
    rx = max(radius_x, 1e-6)
    ry = max(radius_y, 1e-6)
    half_segments = max(int(math.floor(segments / 2)), 16)
    shoulder_exponent = 0.72
    points: List[PointDict] = []

    def local_y_at(s: float) -> float:
        clamped = min(max(s, 0.0), 1.0)
        profile = max(0.0, math.sin(math.pi * clamped))
        return ry * (profile ** shoulder_exponent)

    for idx in range(half_segments + 1):
        s = idx / half_segments
        local_x = -rx + 2 * rx * s
        points.append(从局部坐标转换到世界坐标(center, rotation_deg, local_x, local_y_at(s)))

    for idx in range(1, half_segments + 1):
        s = 1 - idx / half_segments
        local_x = -rx + 2 * rx * s
        points.append(从局部坐标转换到世界坐标(center, rotation_deg, local_x, -local_y_at(s)))

    return points


def 采样梨形上的点(center: PointDict, radius_x: float, radius_y: float, rotation_deg: float, segments: int = 96) -> List[PointDict]:
    """
    作用：采样梨形（pear）闭合点列。
    规则：与前端 createPearPoints 一致。
    """
    rx = max(radius_x, 1e-6)
    ry = max(radius_y, 1e-6)
    half_segments = max(int(math.floor(segments / 2)), 16)
    alpha = 1.85
    beta = 2.65
    shoulder_exponent = 0.82
    peak_s = (alpha - 1) / (alpha + beta - 2)
    peak_profile = (peak_s ** (alpha - 1)) * ((1 - peak_s) ** (beta - 1))
    points: List[PointDict] = []

    def local_y_at(s: float) -> float:
        clamped = min(max(s, 0.0), 1.0)
        profile = (clamped ** (alpha - 1)) * ((1 - clamped) ** (beta - 1))
        return ry * ((profile / peak_profile) ** shoulder_exponent)

    for idx in range(half_segments + 1):
        s = idx / half_segments
        local_x = -rx + 2 * rx * s
        points.append(从局部坐标转换到世界坐标(center, rotation_deg, local_x, local_y_at(s)))

    for idx in range(1, half_segments + 1):
        s = 1 - idx / half_segments
        local_x = -rx + 2 * rx * s
        points.append(从局部坐标转换到世界坐标(center, rotation_deg, local_x, -local_y_at(s)))

    return points


def 采样心形上的点(center: PointDict, radius_x: float, radius_y: float, rotation_deg: float, segments: int = 96) -> List[PointDict]:
    """
    作用：采样心形（heart）闭合点列。
    规则：与前端 createHeartPoints 一致。
    """
    rx = max(radius_x, 1e-6)
    ry = max(radius_y, 1e-6)
    total_segments = max(segments, 48)
    points: List[PointDict] = []
    raw_min_y = float("inf")
    raw_max_y = float("-inf")

    for idx in range(total_segments + 1):
        t = (idx / total_segments) * math.pi * 2
        raw_x = 16 * (math.sin(t) ** 3)
        raw_y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        raw_min_y = min(raw_min_y, raw_y)
        raw_max_y = max(raw_max_y, raw_y)
        points.append({"x": raw_x / 16, "y": raw_y})

    y_center = (raw_min_y + raw_max_y) / 2
    y_radius = max((raw_max_y - raw_min_y) / 2, 1e-6)
    return [
        从局部坐标转换到世界坐标(
            center=center,
            rotation_deg=rotation_deg,
            local_x=(-(point["y"] - y_center) / y_radius) * rx,
            local_y=point["x"] * ry * 0.98,
        )
        for point in points
    ]


def 采样不规则图形上的点(shape: str, center: PointDict, radius_x: float, radius_y: float, rotation_deg: float, segments: int) -> List[PointDict]:
    """
    作用：按 shape 采样不规则图形点列。
    支持：oval / marquise / pear / heart / square。
    """
    if shape == "square":
        return 采样方形上的点(center, radius_x, radius_y, rotation_deg)
    if shape == "marquise":
        return 采样马眼上的点(center, radius_x, radius_y, rotation_deg, segments)
    if shape == "pear":
        return 采样梨形上的点(center, radius_x, radius_y, rotation_deg, segments)
    if shape == "heart":
        return 采样心形上的点(center, radius_x, radius_y, rotation_deg, segments)
    return 采样椭圆上的点(center, radius_x, radius_y, rotation_deg, 0.0, 360.0, segments)


def 计算贝塞尔曲线上的点(points: List[PointDict], t: float) -> PointDict:
    """
    作用：按 De Casteljau 算法计算贝塞尔在参数 t 处的点。
    用途：与前端 evaluateBezierPoint 对齐。
    """
    if not points: return {"x": 0.0, "y": 0.0}
    working = [dict(point) for point in points]
    while len(working) > 1:
        next_points: List[PointDict] = []
        for idx in range(len(working) - 1):
            next_points.append(
                {
                    "x": working[idx]["x"] * (1 - t) + working[idx + 1]["x"] * t,
                    "y": working[idx]["y"] * (1 - t) + working[idx + 1]["y"] * t,
                }
            )
        working = next_points
    return working[0]


def 采样贝塞尔上的点(control_points: List[PointDict], segments: int = 64) -> List[PointDict]:
    """
    作用：将贝塞尔控制点离散采样为折线点列。
    规则：与前端 createBezierPoints 一致，segments 至少为 2。
    """
    if len(control_points) == 0: return []
    if len(control_points) == 1: return [dict(control_points[0])]
    安全取点数 = max(2, segments)
    贝塞尔曲线采样点列: List[PointDict] = []
    for idx in range(安全取点数 + 1):
        t = idx / 安全取点数
        贝塞尔曲线采样点列.append(计算贝塞尔曲线上的点(control_points, t))
    return 贝塞尔曲线采样点列


def 根据开口方向偏移开放折线(points: List[PointDict], open_direction: str, open_size: float , 是否需要Z轴位置: bool = False) -> List[PointDict]:
    """
    作用：按开口方向偏移开放折线（用于贝塞尔采样后的点列）。
    规则：与前端 offsetOpenPolylineByOpenDirection 一致。
    """
    if len(points) < 2 or open_size < 1e-9: return [dict(point) for point in points]

    方向符号 = -1.0 if open_direction == "RIGHT" else 1.0
    分段法向: List[Optional[PointDict]] = []
    for idx in range(len(points) - 1):
        p = points[idx]
        q = points[idx + 1]
        dx = q["x"] - p["x"]
        dy = q["y"] - p["y"]
        length = math.hypot(dx, dy)
        if length < 1e-9:
            分段法向.append(None)
            continue
        分段法向.append({"x": (dy / length) * 方向符号, "y": (-dx / length) * 方向符号})

    最终输出值: List[PointDict] = []
    for idx, point in enumerate(points):
        候选法向: List[PointDict] = []
        if idx > 0 and 分段法向[idx - 1] is not None: 候选法向.append(分段法向[idx - 1])  # type: ignore[arg-type]
        if idx < len(分段法向) and 分段法向[idx] is not None: 候选法向.append(分段法向[idx])  # type: ignore[arg-type]
        if not 候选法向: 最终输出值.append(dict(point)); continue

        nx = sum(item["x"] for item in 候选法向)
        ny = sum(item["y"] for item in 候选法向)
        nlen = math.hypot(nx, ny)
        if nlen < 1e-9:
            兜底法向 = 候选法向[0]
            if 是否需要Z轴位置:
                最终输出值.append(
                    {
                        "x": point["x"] + 兜底法向["x"] * open_size,
                        "y": point["y"] + 兜底法向["y"] * open_size,
                        "z": point["z"]
                    }
                )
            else:
                最终输出值.append(
                    {
                        "x": point["x"] + 兜底法向["x"] * open_size,
                        "y": point["y"] + 兜底法向["y"] * open_size,
                    }
                )
            continue

        if 是否需要Z轴位置:
            最终输出值.append(
                {
                    "x": point["x"] + (nx / nlen) * open_size,
                    "y": point["y"] + (ny / nlen) * open_size,
                    "z": point["z"]
                }
            )
        else:
            最终输出值.append(
                {
                    "x": point["x"] + (nx / nlen) * open_size,
                    "y": point["y"] + (ny / nlen) * open_size,
                }
            )
    return 最终输出值


def 根据开口方向偏移线段(start: PointDict, end: PointDict, open_direction: str, open_size: float,是否需要Z轴位置:bool = False) -> List[PointDict]:
    """
    作用：给线段做“左右法向”偏移。
    关键逻辑：
        1.线方向 (dx, dy)，右法向 (dy, -dx)/|L|；
        2.根据 RIGHT/LEFT 选择符号；
        3.起点和终点都加同一个偏移向量。
        退化处理：长度几乎 0 时直接返回原点对。
    用途：线实体偏移。
    """
    # 在 2D 内，右侧法向为 (dy, -dx) / |L|
    dx = end["x"] - start["x"]
    dy = end["y"] - start["y"]
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return [dict(start), dict(end)]

    rx = dy / length
    ry = -dx / length
    sign = -1.0 if open_direction == "RIGHT" else 1.0
    ox = rx * open_size * sign
    oy = ry * open_size * sign
    if 是否需要Z轴位置:
        
        return [{"x": start["x"] + ox, "y": start["y"] + oy, "z": start["z"]},{"x": end["x"] + ox, "y": end["y"] + oy, "z": end["z"]}]
    return [{"x": start["x"] + ox, "y": start["y"] + oy},{"x": end["x"] + ox, "y": end["y"] + oy}]


def 计算圆弧偏移后半径(entity: Dict[str, Any], open_size: float) -> Optional[float]:
    """
    作用：计算圆弧偏移后的半径。
    关键逻辑：
        1.根据 startAngle/endAngle 的扫角正负判断方向（CCW/CW）；
        2.结合 openDirection 决定半径是增还是减；
        3.半径下限夹到 1e-6，避免非正半径。
    用途：弧实体偏移核心。
    """
    圆弧半径 = entity.get("radius")
    圆弧起点角度 = entity.get("startAngle")
    圆弧终点角度 = entity.get("endAngle")
    if not isinstance(圆弧半径, (int, float)):
        return None
    if not isinstance(圆弧起点角度, (int, float)) or not isinstance(圆弧终点角度, (int, float)):
        return None

    # TODO:任然要思考怎么才能作为逆时针和顺时针的区别
    sweep = float(圆弧终点角度) - float(圆弧起点角度)
    if abs(sweep) < 1e-9: sweep = 360 if sweep >= 0 else -360
    方向符号 = 1.0 if sweep >= 0 else -1.0
    开口方向 = 规范开口方向(entity.get("openDirection"))
    偏移半径 = -((方向符号 if 开口方向 == "RIGHT" else -方向符号) * open_size)
    return max(1e-6, float(圆弧半径) + 偏移半径)


def 计算圆偏移后半径(entity: Dict[str, Any], open_size: float) -> Optional[float]:
    """
    作用：计算圆偏移后的半径（与前端 threeGeometry.ts 保持一致）。
    规则：
        - RIGHT：向外偏移，半径增大；
        - LEFT：向内偏移，半径减小（最小夹到 1e-6）。
    """
    圆半径 = entity.get("radius")
    if not isinstance(圆半径, (int, float)):return None
    开口方向 = 规范开口方向(entity.get("openDirection"))
    if 开口方向 == "RIGHT": return float(圆半径) + open_size
    return max(1e-6, float(圆半径) - open_size)


def 创建偏移实体(entity: Dict[str, Any], open_size: float) -> Optional[EntityOffsetProfile]:
    """
    作用：把单个实体转成 EntityOffsetProfile(偏移实体)。
    分支：
        1.LINE：解析 start/end -> 偏移 2 点
        2.ARC：
            解析 center/radius/startAngle/endAngle -> 采样原弧与偏移弧
            original_start/end 优先用实体显式端点（startPoint/endPoint 或 start/end），避免角度反算与原数据细微不一致。
        3.CIRCLE：
            解析 center/radius -> 采样原圆与偏移圆（0~360）。
        4.IRREGULAR/ELLIPSE/HEART/PEAR/MARQUISE/SQUARE：
            解析 center/radiusX/radiusY/rotationDeg 与 shape，采样原始轮廓与偏移轮廓。
        5.BEZIER：
            解析 points -> 采样原曲线 -> 按开口方向偏移采样折线。
        6.其他类型返回 None。
    用途：统一各实体为可拼接格式。
    """
    实体类型 = str(entity.get("type", "")).upper()
    开口方向 = 规范开口方向(entity.get("openDirection"))
    if 实体类型 == "LINE":
        直线的起点 = 安全转化点位(entity.get("start"))
        直线的终点 = 安全转化点位(entity.get("end"))
        if not 直线的起点 or not 直线的终点: return None
        偏移后的点 = 根据开口方向偏移线段(直线的起点, 直线的终点, 开口方向, open_size)
        return {"entity": entity,"original_start": 直线的起点,"original_end": 直线的终点,"offset_points": 偏移后的点}
    if 实体类型 == "ARC":
        圆弧中心点 = 安全转化点位(entity.get("center"))
        圆弧半径 = entity.get("radius")
        圆弧起点角度 = entity.get("startAngle")
        圆弧终点角度 = entity.get("endAngle")
        # TODO:了解到底该怎么去做这个圆偏移半径
        偏移后的圆弧半径 = 计算圆弧偏移后半径(entity, open_size)
        if ( not 圆弧中心点 or not isinstance(圆弧半径, (int, float)) or not isinstance(圆弧起点角度, (int, float)) or not isinstance(圆弧终点角度, (int, float)) or 偏移后的圆弧半径 is None ): return None
        原始圆弧采样点 = 采样圆弧上的点(center=圆弧中心点,radius=float(圆弧半径),start_angle=float(圆弧起点角度),end_angle=float(圆弧终点角度),segments=OPEN_PATH_SAMPLE_SEGMENTS)
        if len(原始圆弧采样点) < 2: return None
        # 优先使用实体自带端点用于连通判定，避免角度反算端点与实际端点存在微小不一致。
        显式起点 = 安全转化点位(entity.get("startPoint")) or 安全转化点位(entity.get("start"))
        显式终点 = 安全转化点位(entity.get("endPoint")) or 安全转化点位(entity.get("end"))
        原始起点 = 显式起点 if 显式起点 else 原始圆弧采样点[0]
        原始终点 = 显式终点 if 显式终点 else 原始圆弧采样点[-1]
        偏移后的圆弧采样点 = 采样圆弧上的点(center=圆弧中心点,radius=偏移后的圆弧半径,start_angle=float(圆弧起点角度),end_angle=float(圆弧终点角度),segments=OPEN_PATH_SAMPLE_SEGMENTS,)
        return {"entity": entity,"original_start": 原始起点,"original_end": 原始终点,"offset_points": 偏移后的圆弧采样点}
    if 实体类型 == "CIRCLE":
        圆心 = 安全转化点位(entity.get("center"))
        圆半径 = entity.get("radius")
        偏移后的圆半径 = 计算圆偏移后半径(entity, open_size)
        if ( not 圆心 or not isinstance(圆半径, (int, float)) or 偏移后的圆半径 is None ): return None
        原始圆采样点 = 采样圆弧上的点(center=圆心,radius=float(圆半径),start_angle=0.0,end_angle=360.0,segments=360,)
        if len(原始圆采样点) < 2: return None
        偏移后的圆采样点 = 采样圆弧上的点(center=圆心,radius=偏移后的圆半径,start_angle=0.0,end_angle=360.0,segments=360)
        return {"entity": entity,"original_start": 原始圆采样点[0],"original_end": 原始圆采样点[-1],"offset_points": 偏移后的圆采样点}
    if 实体类型 in {"IRREGULAR", "ELLIPSE", "HEART", "PEAR", "MARQUISE", "SQUARE"}:
        图形中心 = 安全转化点位(entity.get("center"))
        图形宽度 = entity.get("radiusX")
        图形长度 = entity.get("radiusY")
        图形旋转角度 = entity.get("rotationDeg", 0.0)
        if (not 图形中心 or not isinstance(图形宽度, (int, float)) or not isinstance(图形长度, (int, float))): return None
        if not isinstance(图形旋转角度, (int, float)): 图形旋转角度 = 0.0
        图形旋转角度 = float(图形旋转角度)
        if 实体类型 == "IRREGULAR":
            形状 = str(entity.get("shape", "oval")).lower()
            形状 = "oval" if 形状 == "ellipse" else 形状
        elif 实体类型 == "ELLIPSE": 形状 = "oval"
        elif 实体类型 == "HEART": 形状 = "heart"
        elif 实体类型 == "PEAR": 形状 = "pear"
        elif 实体类型 == "SQUARE": 形状 = "square"
        else: 形状 = "marquise"
        if 形状 not in {"oval", "marquise", "pear", "heart", "square"}: return None

        # 与前端 IRREGULAR 偏移一致：RIGHT 外扩，LEFT 内缩。
        偏移量 = open_size if 开口方向 == "RIGHT" else -open_size
        外扩图形宽度 = max(1e-6, float(图形宽度) + 偏移量)
        外扩图形长度 = max(1e-6, float(图形长度) + 偏移量)
        原始图形采样点 = 采样不规则图形上的点(形状, 图形中心, float(图形宽度), float(图形长度), 图形旋转角度, OPEN_PATH_SAMPLE_SEGMENTS)
        偏移图形采样点 = 采样不规则图形上的点(形状, 图形中心, 外扩图形宽度, 外扩图形长度, 图形旋转角度, OPEN_PATH_SAMPLE_SEGMENTS)
        if len(原始图形采样点) < 2 or len(偏移图形采样点) < 2: return None
        return {
            "entity": entity,
            "original_start": 原始图形采样点[0],
            "original_end": 原始图形采样点[-1],
            "offset_points": 偏移图形采样点,
        }
    if 实体类型 == "BEZIER":
        贝塞尔控制点原始值 = entity.get("points")
        if not isinstance(贝塞尔控制点原始值, list): return None
        贝塞尔控制点 = [point for point in (安全转化点位(item) for item in 贝塞尔控制点原始值) if point]
        if len(贝塞尔控制点) < 2: return None
        原始贝塞尔采样点 = 采样贝塞尔上的点(贝塞尔控制点, OPEN_PATH_SAMPLE_SEGMENTS)
        偏移后的贝塞尔采样点 = 根据开口方向偏移开放折线(原始贝塞尔采样点, 开口方向, open_size)
        if len(原始贝塞尔采样点) < 2 or len(偏移后的贝塞尔采样点) < 2: return None
        return {"entity": entity,"original_start": 原始贝塞尔采样点[0],"original_end": 原始贝塞尔采样点[-1],"offset_points": 偏移后的贝塞尔采样点}

    return None


def 根据起点方向返回偏移点列(profile: EntityOffsetProfile, start_from_entity_start: bool) -> List[PointDict]:
    """
    作用：根据起点方向返回偏移点列。
    逻辑：
        如果 start_from_entity_start 为 True，则返回原始点列；
        否则返回反向点列。
    """
    if start_from_entity_start:
        return [dict(point) for point in profile["offset_points"]]
    return [dict(point) for point in reversed(profile["offset_points"])]

def 实体ID转化为字符串(entity: Dict[str, Any]) -> str:
    """
    作用：把实体 id 转成字符串。
    用途：作为哈希 key 建立“实体 id -> 实体索引”映射，用于连通性分析。
    """
    raw = entity.get("id")
    return str(raw) if raw is not None else ""


def 判断节点起点是否为空(profile: EntityOffsetProfile) -> bool:
    node = profile["entity"].get("node")
    if not isinstance(node, dict):
        return False
    return node.get("start") is None


def 判断节点终点是否为空(profile: EntityOffsetProfile) -> bool:
    node = profile["entity"].get("node")
    if not isinstance(node, dict):
        return False
    return node.get("end") is None


def 判断链起点是否为正向(entity: Dict[str, Any]) -> bool:
    """
    第一条实体是否与几何 start→end 同向输出偏移点列。
    - node.end 为 null 且 node.start 有邻接：几何末端开口，应从 end 走向 start（反转）。
    - node.start 为 null 且 node.end 有邻接：几何始端开口，正向走向 end。
    - 两侧均有邻接：正向，之后沿出口用 node.end 延续。
    """
    node = entity.get("node")
    if not isinstance(node, dict):
        return True
    has_start_ref = isinstance(node.get("start"), dict)
    has_end_ref = isinstance(node.get("end"), dict)
    if not has_end_ref and has_start_ref:
        return False
    return True


def 选择链起点(unused: Set[int], profiles: List[EntityOffsetProfile], id_to_idx: Dict[str, int]) -> int:
    """
    链起点：在 unused 子图上用 node.start / node.end 邻接算入度，优选无端「悬挂」的实体；
    若有入边则优先 node.end 为 null（几何末端开口），再优先 node.start 为 null；
    若皆有入边，则在全 unused 上按上述键取最小下标。
    """
    incoming: Set[int] = set()
    for i in unused:
        node = profiles[i]["entity"].get("node")
        if not isinstance(node, dict):
            continue
        for side in ("start", "end"):
            ref = node.get(side)
            if not isinstance(ref, dict):
                continue
            tid = ref.get("id")
            if tid is None:
                continue
            j = id_to_idx.get(str(tid))
            if j is not None and j in unused and j != i:
                incoming.add(j)

    heads = [i for i in unused if i not in incoming]
    pool = heads if heads else list(unused)
    return min(
        pool,
        key=lambda i: (
            not 判断节点终点是否为空(profiles[i]),
            not 判断节点起点是否为空(profiles[i]),
            i,
        ),
    )


def 判断两段轮廓是否共端点(a: EntityOffsetProfile, b: EntityOffsetProfile) -> bool:
    """
    判定两段轮廓在「原始几何」上是否共端点（与 openSize 无关），用于无 node 时的连通归档。
    """
    ends_a = (a["original_start"], a["original_end"])
    ends_b = (b["original_start"], b["original_end"])
    for pa in ends_a:
        for pb in ends_b:
            if 判断是否重复点(pa, pb):
                return True
    return False


class _DSU:
    """并查集：按几何共点 + node 邻接划分连通分量。"""
    def __init__(self, n: int) -> None:
        self._p = list(range(n))

    def find(self, x: int) -> int:
        if self._p[x] != x:
            self._p[x] = self.find(self._p[x])
        return self._p[x]

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self._p[rb] = ra


def 将实体索引划分为连通分量(original_profiles: List[EntityOffsetProfile],id_to_idx: Dict[str, int],) -> Tuple[List[Set[int]], List[bool]]:
    """
    将实体索引划分为若干连通分量：
    - 任意 src.start/end 与另一实体的原始端点在 POINT_EPS 内重合则同属一分量；
    - entity.node.start / node.end 指向的另一实体（按 id）亦合并。
    """
    n = len(original_profiles)
    if n == 0:
        return [], []
    dsu = _DSU(n)
    for i in range(n):
        node = original_profiles[i]["entity"].get("node")
        if not isinstance(node, dict):
            continue
        for side in ("start", "end"):
            ref = node.get(side)
            if not isinstance(ref, dict):
                continue
            tid = ref.get("id")
            if tid is None:
                continue
            j = id_to_idx.get(str(tid))
            if j is not None and j != i:
                dsu.union(i, j)
    for i in range(n):
        for j in range(i + 1, n):
            if 判断两段轮廓是否共端点(original_profiles[i], original_profiles[j]):
                dsu.union(i, j)
    buckets: Dict[int, Set[int]] = defaultdict(set)
    for i in range(n):
        buckets[dsu.find(i)].add(i)
    # 这个是分组的结果
    result = [buckets[r] for r in sorted(buckets.keys(), key=lambda r: min(buckets[r]))]


    is_closed_groups: List[bool] = []
    for comp in result:
        is_closed = True
        for i in comp:
            profile = original_profiles[i]
            node = profile["entity"].get("node")
            for side in ("start", "end"):
                endpoint_connected = False

                # 1) 优先用 node 邻接判断（若存在且指向组内实体，则视为已连接）
                if isinstance(node, dict):
                    ref = node.get(side)
                    if isinstance(ref, dict):
                        tid = ref.get("id")
                        if tid is not None:
                            j = id_to_idx.get(str(tid))
                            if j is not None and j in comp and j != i:
                                endpoint_connected = True

                # 2) 回退到几何共端点判断
                if not endpoint_connected:
                    joint = 根据侧边获取原始端点(profile, side)
                    for j in comp:
                        if j == i:
                            continue
                        other = original_profiles[j]
                        if 判断是否重复点(other["original_start"], joint) or 判断是否重复点(other["original_end"], joint):
                            endpoint_connected = True
                            break

                if not endpoint_connected:
                    is_closed = False
                    break
            if not is_closed:
                break
        is_closed_groups.append(is_closed)
    # 稳定顺序：分量按最小下标排序，便于测试结果与调试可复现
    return result, is_closed_groups


def 沿节点走完整链(first_idx: int,profiles: List[EntityOffsetProfile],id_to_idx: Dict[str, int],allowed_indices: Optional[Set[int]] = None,) -> Tuple[List[int], List[bool]]:
    """
    沿 entity.node 走完整链：出口在几何终点时用 node.end，在几何起点时用 node.start。
    ref.endpoint=='start' 则下一段不反转，'end' 则反转。
    若邻接指回 first_idx，视为闭合，不再重复加入第一条。
    """
    order: List[int] = [first_idx]
    forwards: List[bool] = [判断链起点是否为正向(profiles[first_idx]["entity"])]
    current_idx = first_idx
    visited: Set[int] = {first_idx}

    for _ in range(len(profiles) + 2):
        fwd = forwards[-1]
        node = profiles[current_idx]["entity"].get("node")
        if not isinstance(node, dict):
            break
        exit_at_geometric_end = fwd
        ref = node.get("end") if exit_at_geometric_end else node.get("start")
        if not isinstance(ref, dict):
            break
        next_id = ref.get("id")
        ep = ref.get("endpoint")
        if next_id is None or ep not in ("start", "end"):
            break
        next_i = id_to_idx.get(str(next_id))
        if next_i is None:
            break
        if allowed_indices is not None and next_i not in allowed_indices:
            break
        if next_i == first_idx:
            break
        if next_i in visited:
            break
        next_forward = ep == "start"
        order.append(next_i)
        forwards.append(next_forward)
        visited.add(next_i)
        current_idx = next_i

    return order, forwards


def 拼接偏移轮廓点列(originalProfiles: List[EntityOffsetProfile], profiles: List[EntityOffsetProfile]) -> List[List[PointDict]]:
    """
    作用：按「连通图形」分别拼接偏移轮廓点列。
    连通判定：原始几何共端点（POINT_EPS）或与 entity.node 邻接指向的实体同属一条图链；
    互不连通的实体组各自输出一条折线（一个内层 list），避免误把多幅图连成一条 polyline。
    """
    if not profiles:
        return []

    id_to_idx: Dict[str, int] = {}
    for i, p in enumerate(profiles):
        eid = 实体ID转化为字符串(p["entity"])
        if eid and eid not in id_to_idx:
            id_to_idx[eid] = i

    # 这一步就是将图像分成联通组别；is_closed_groups 与 components 下标一一对应
    components, is_closed_groups = 将实体索引划分为连通分量(originalProfiles, id_to_idx)
    all_polylines: List[List[PointDict]] = []

    for comp, _is_closed in zip(components, is_closed_groups):
        used: Set[int] = set()
        figure_points: List[PointDict] = []

        while len(used) < len(comp):
            unused = comp - used
            seed = 选择链起点(unused, profiles, id_to_idx)
            order, forwards = 沿节点走完整链(seed, profiles, id_to_idx, allowed_indices=comp)
            for idx in order:
                used.add(idx)

            chain_points: List[PointDict] = []
            for idx, start_from_entity_start in zip(order, forwards):
                seq = 根据起点方向返回偏移点列(profiles[idx], start_from_entity_start)
                if not chain_points:
                    chain_points.extend(seq)
                elif seq and 判断是否重复点(chain_points[-1], seq[0]):
                    chain_points.extend(seq[1:])
                else:
                    chain_points.extend(seq)

            deduped = 删除连续的重复点(chain_points)
            if figure_points and deduped and not 判断是否重复点(figure_points[-1], deduped[0]):
                figure_points.extend(deduped)
            elif figure_points and deduped:
                figure_points.extend(deduped[1:])
            else:
                figure_points.extend(deduped)

        all_polylines.append(删除连续的重复点(figure_points))

    return all_polylines


def 从LJS文件读取实体(path: Path) -> List[Dict[str, Any]]:
    """
    作用：读取 .ljs 文件中的实体。
    用途：用于读取 .ljs 文件中的实体。
    """
    payload = json.loads(path.read_text(encoding="utf-8"))
    data = payload.get("data", {})
    entities = data.get("entities", [])
    if not isinstance(entities, list):
        return []
    return [entity for entity in entities if isinstance(entity, dict)]


class OffsetEndpointCalculator:
    @staticmethod
    def 计算绕坐标轴旋转后的偏移点位(旋转后的点: list[dict[str,Any]], 偏移值: Optional[float] = None) -> List[Dict[str, Any]]:
        返回绕坐标轴旋转后的点位: List[Dict[str, Any]] = []
        for 选择实体索引 in range(len(旋转后的点)):
            当前实体 = 旋转后的点[选择实体索引]
            当前实体类型 = 当前实体.get('type')
            开口方向 = 当前实体.get('openDirection')
            开口偏移值 = 偏移值
            if 当前实体类型 == 'LINE':
                直线的点列表 = 当前实体.get('points')
                直线的起点 = 直线的点列表[0]
                直线的终点 = 直线的点列表[-1]
                if 开口方向 is not None and 开口偏移值 is not None:
                    偏移后的旋转坐标值 = 根据开口方向偏移线段(直线的起点, 直线的终点, 开口方向, 开口偏移值,是否需要Z轴位置=True)
            if 当前实体类型 == 'ARC':
                圆弧的点列表 = 当前实体.get('points')
                if 开口方向 is not None and 开口偏移值 is not None:
                    偏移后的旋转坐标值 = 根据开口方向偏移开放折线(圆弧的点列表, 开口方向, 开口偏移值,是否需要Z轴位置=True)
            
            实体点数据字典 = {'type': 当前实体类型,'points': 偏移后的旋转坐标值}
            返回绕坐标轴旋转后的点位.append(实体点数据字典)
        return 返回绕坐标轴旋转后的点位


    @staticmethod
    def calc_xy_points( entities_or_ljs_path: Any, offset: Optional[float] = None, invert_open_direction: bool = False, ) -> List[List[PointDict]]:
        """
        计算并按「连通图形」分组拼接偏移点位（LINE/ARC/CIRCLE/BEZIER/IRREGULAR 及 ELLIPSE/HEART/PEAR/MARQUISE 别名）：
        - 先按实体独立偏移；
        - 端点相接或通过 entity.node 相连的实体归为同一图形并拼接点序；
        - 与上一组无任何共点、也无 node 关联的实体进入新的子列表（新图形）。
        返回形如 [[{x,y},...], [{x,y},...], ...]，外层每个元素对应一幅独立图。
        invert_open_direction：为 True 时对每个实体 openDirection 做 RIGHT↔LEFT 后再计算（不写回文件）。
        """
        实体列表: List[Dict[str, Any]] = []
        if isinstance(entities_or_ljs_path, list):
            实体列表 = [单个实体 for 单个实体 in entities_or_ljs_path if isinstance(单个实体, dict)]
        elif isinstance(entities_or_ljs_path, (str, Path)):
            实体列表 = 从LJS文件读取实体(Path(entities_or_ljs_path).expanduser().resolve())
        else:
            return []
        # 开口方向反转
        if invert_open_direction:
            实体列表 = [反转开口方向(e) for e in 实体列表]

        开口大小 = DEFAULT_OPEN_SIZE if offset is None else max(0.0, float(offset))
        原始实体列表: List[EntityOffsetProfile] = []
        偏移实体列表: List[EntityOffsetProfile] = []
        for 单个实体 in 实体列表:
            单个原始实体=创建偏移实体(单个实体,0)
            单个偏移实体 = 创建偏移实体(单个实体, 开口大小)
            if 单个偏移实体 is not None and 单个原始实体 is not None:
                原始实体列表.append(单个原始实体)
                偏移实体列表.append(单个偏移实体)
        覆盖偏移相交端点(偏移实体列表, 开口大小)
        return 拼接偏移轮廓点列(原始实体列表, 偏移实体列表)

    @staticmethod
    def calc_xy_points_flat(
        entities_or_ljs_path: Any,
        offset: Optional[float] = None,
        invert_open_direction: bool = False,
    ) -> List[PointDict]:
        """将各连通图形的点列顺序拼成一条 list（兼容旧调用；图形之间无分隔点）。"""
        groups = OffsetEndpointCalculator.calc_xy_points(
            entities_or_ljs_path, offset, invert_open_direction=invert_open_direction
        )
        flat: List[PointDict] = []
        for g in groups:
            flat.extend(g)
        return flat

    @staticmethod
    def calc_xy_points_from_ljs_file(
        ljs_path: str,
        offset: Optional[float] = None,
        invert_open_direction: bool = False,
    ) -> List[List[PointDict]]:
        """
        从 .ljs 读取实体后计算偏移折线（等价于对路径调用 calc_xy_points）。
        invert_open_direction 为 True 时，在计算前对每个实体的 openDirection 做 RIGHT↔LEFT 反转
        （不改变磁盘文件，仅影响本次计算）。
        """
        return OffsetEndpointCalculator.calc_xy_points(
            ljs_path, offset, invert_open_direction=invert_open_direction
        )
