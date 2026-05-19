"""新编辑器实体格式的偏移计算模块。

与 calc_offset_ljs.py 对应，但适配新前端 entitiesEditor 的实体格式：
- kind 替代 type
- 坐标使用大写 X/Y
- openSide 替代 openDirection
- controlPoints 替代 points（贝塞尔）
- 新增 POLYLINE（含 bulge）、DIAMOND（含 contours）
"""

import json
import math
from pathlib import Path
from collections import defaultdict
from typing import Any, Dict, List, NotRequired, Optional, Set, Tuple, TypedDict


OPEN_PATH_SAMPLE_SEGMENTS = 96
DEFAULT_OPEN_SIZE = 0.5
POINT_EPS = 1e-6
LINE_PARALLEL_EPS = 1e-9
MITER_LIMIT = 8


class PointDict(TypedDict):
    X: float
    Y: float
    Z: NotRequired[float]


class EntityOffsetProfile(TypedDict):
    entity: Dict[str, Any]
    original_start: PointDict
    original_end: PointDict
    offset_points: List[PointDict]


# ═══════════════════════════════════════════════════════════════
# 基础几何工具
# ═══════════════════════════════════════════════════════════════

def 安全转化点位(obj: Any) -> Optional[PointDict]:
    if not isinstance(obj, dict):
        return None
    x = obj.get("X")
    y = obj.get("Y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return None
    if not math.isfinite(float(x)) or not math.isfinite(float(y)):
        return None
    point: PointDict = {"X": float(x), "Y": float(y)}
    if "Z" in obj:
        z = obj.get("Z")
        if not isinstance(z, (int, float)) or not math.isfinite(float(z)):
            return None
        point["Z"] = float(z)
    return point


def 规范开口方向(value: Any) -> str:
    if isinstance(value, str) and value.upper() in {"RIGHT", "LEFT"}:
        return value.upper()
    return "RIGHT"


def 反转开口方向(entity: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(entity)
    od = 规范开口方向(out.get("openSide"))
    out["openSide"] = "LEFT" if od == "RIGHT" else "RIGHT"
    return out


def 判断是否重复点(a: PointDict, b: PointDict, eps: float = POINT_EPS) -> bool:
    return abs(a["X"] - b["X"]) <= eps and abs(a["Y"] - b["Y"]) <= eps


# ═══════════════════════════════════════════════════════════════
# 共享端点优化
# ═══════════════════════════════════════════════════════════════

def 求两条直线的交点(a0: PointDict, a1: PointDict, b0: PointDict, b1: PointDict) -> Optional[PointDict]:
    ax = a1["X"] - a0["X"]
    ay = a1["Y"] - a0["Y"]
    bx = b1["X"] - b0["X"]
    by_ = b1["Y"] - b0["Y"]
    det = ax * by_ - ay * bx
    if abs(det) < LINE_PARALLEL_EPS:
        return None
    dx = b0["X"] - a0["X"]
    dy = b0["Y"] - a0["Y"]
    t = (dx * by_ - dy * bx) / det
    return {"X": a0["X"] + ax * t, "Y": a0["Y"] + ay * t}


def 获取偏移端点切线(offset_points: List[PointDict], side: str) -> Optional[Tuple[PointDict, PointDict, PointDict]]:
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
                    intersection["X"] - base_a["X"],
                    intersection["Y"] - base_a["Y"],
                )
                other_open = open_size
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


# ═══════════════════════════════════════════════════════════════
# 点列后处理
# ═══════════════════════════════════════════════════════════════

def 删除连续的重复点(points: List[PointDict]) -> List[PointDict]:
    if not points:
        return []
    out: List[PointDict] = [points[0]]
    for point in points[1:]:
        if not 判断是否重复点(out[-1], point):
            out.append(point)
    return out


# ═══════════════════════════════════════════════════════════════
# 几何采样函数
# ═══════════════════════════════════════════════════════════════

def 采样圆弧上的点(
    center: PointDict,
    radius: float,
    start_angle: float,
    end_angle: float,
    segments: int = 48,
) -> List[PointDict]:
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
        points.append({
            "X": center["X"] + radius * math.cos(rad),
            "Y": center["Y"] + radius * math.sin(rad),
        })
    return points


def 从局部坐标转换到世界坐标(
    center: PointDict,
    rotation_deg: float,
    local_x: float,
    local_y: float,
) -> PointDict:
    rot = math.radians(rotation_deg)
    ux = math.cos(rot)
    uy = math.sin(rot)
    vx = -uy
    vy = ux
    return {
        "X": center["X"] + local_x * ux + local_y * vx,
        "Y": center["Y"] + local_x * uy + local_y * vy,
    }


def 采样椭圆上的点(
    center: PointDict,
    rx: float,
    ry: float,
    rotation_deg: float,
    start_angle_deg: float = 0.0,
    end_angle_deg: float = 360.0,
    segments: int = 96,
) -> List[PointDict]:
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
        local_x = rx * math.cos(t)
        local_y = ry * math.sin(t)
        points.append(从局部坐标转换到世界坐标(center, rotation_deg, local_x, local_y))
    return points


def 解析椭圆参数(entity: Dict[str, Any]) -> Optional[Tuple[PointDict, float, float, float, float, float]]:
    """从新格式 ELLIPSE 实体中提取采样参数：center, rx, ry, rotationDeg, startParamDeg, endParamDeg。"""
    center = 安全转化点位(entity.get("center"))
    if not center:
        return None
    major_end = entity.get("majorAxisEnd")
    if not isinstance(major_end, dict):
        return None
    mex = major_end.get("X")
    mey = major_end.get("Y")
    if not isinstance(mex, (int, float)) or not isinstance(mey, (int, float)):
        return None
    rx = math.hypot(float(mex), float(mey))
    if rx < 1e-9:
        return None
    rotation_deg = math.degrees(math.atan2(float(mey), float(mex)))
    ratio = entity.get("minorAxisRatio")
    if not isinstance(ratio, (int, float)):
        return None
    ry = rx * float(ratio)
    start_deg = float(entity.get("startParamDeg", 0.0))
    end_deg = float(entity.get("endParamDeg", 360.0))
    return center, rx, ry, rotation_deg, start_deg, end_deg


# ═══════════════════════════════════════════════════════════════
# 贝塞尔采样
# ═══════════════════════════════════════════════════════════════

def 计算贝塞尔曲线上的点(points: List[PointDict], t: float) -> PointDict:
    if not points:
        return {"X": 0.0, "Y": 0.0}
    working = [dict(point) for point in points]
    while len(working) > 1:
        next_points: List[PointDict] = []
        for idx in range(len(working) - 1):
            next_points.append({
                "X": working[idx]["X"] * (1 - t) + working[idx + 1]["X"] * t,
                "Y": working[idx]["Y"] * (1 - t) + working[idx + 1]["Y"] * t,
            })
        working = next_points
    return working[0]


def 采样贝塞尔上的点(control_points: List[PointDict], segments: int = 64) -> List[PointDict]:
    if len(control_points) == 0:
        return []
    if len(control_points) == 1:
        return [dict(control_points[0])]
    safe_segments = max(2, segments)
    sampled: List[PointDict] = []
    for idx in range(safe_segments + 1):
        t = idx / safe_segments
        sampled.append(计算贝塞尔曲线上的点(control_points, t))
    return sampled


# ═══════════════════════════════════════════════════════════════
# POLYLINE 采样（含 bulge 弧段）
# ═══════════════════════════════════════════════════════════════

def 根据端点与凸度采样弧上的点(
    start: PointDict,
    end: PointDict,
    bulge: float,
    segments: int = 48,
) -> List[PointDict]:
    """bulge = tan(弧角/4)。bulge>0 逆时针，bulge<0 顺时针。"""
    dx = end["X"] - start["X"]
    dy = end["Y"] - start["Y"]
    chord = math.hypot(dx, dy)
    if chord < 1e-9:
        return [dict(start), dict(end)]

    theta = 4.0 * math.atan(abs(bulge))
    if abs(theta) < 1e-9:
        return [dict(start), dict(end)]

    r = chord / (2.0 * math.sin(theta / 2.0))
    mid_x = (start["X"] + end["X"]) / 2.0
    mid_y = (start["Y"] + end["Y"]) / 2.0

    perp_x = -dy / chord
    perp_y = dx / chord

    dist_mid_to_center = math.sqrt(max(0.0, r * r - (chord / 2.0) * (chord / 2.0)))
    sign_bulge = 1.0 if bulge > 0 else -1.0
    center_x = mid_x + perp_x * dist_mid_to_center * sign_bulge
    center_y = mid_y + perp_y * dist_mid_to_center * sign_bulge

    start_angle = math.degrees(math.atan2(start["Y"] - center_y, start["X"] - center_x))
    end_angle = math.degrees(math.atan2(end["Y"] - center_y, end["X"] - center_x))

    # 确保扫角方向与 bulge 一致
    sweep = end_angle - start_angle
    if bulge > 0 and sweep < 0:
        sweep += 360
    elif bulge < 0 and sweep > 0:
        sweep -= 360
    end_angle = start_angle + sweep

    return 采样圆弧上的点(
        center={"X": center_x, "Y": center_y},
        radius=r,
        start_angle=start_angle,
        end_angle=end_angle,
        segments=segments,
    )


def 采样POLYLINE上的点(
    vertices: List[Dict[str, Any]],
    closed: bool,
    segments: int = 48,
) -> List[PointDict]:
    """遍历 POLYLINE 顶点，bulge=0 走直线，bulge≠0 走弧段。"""
    if len(vertices) < 2:
        return []

    all_points: List[PointDict] = []
    limit = len(vertices) if closed else len(vertices) - 1

    for i in range(limit):
        v = vertices[i]
        v_next = vertices[(i + 1) % len(vertices)]
        p1 = 安全转化点位(v.get("point"))
        p2 = 安全转化点位(v_next.get("point"))
        if not p1 or not p2:
            continue
        bulge = v.get("bulge")
        if isinstance(bulge, (int, float)) and abs(float(bulge)) > 1e-9:
            arc_pts = 根据端点与凸度采样弧上的点(p1, p2, float(bulge), segments)
            if all_points and 判断是否重复点(all_points[-1], arc_pts[0]):
                all_points.extend(arc_pts[1:])
            else:
                all_points.extend(arc_pts)
        else:
            if all_points and 判断是否重复点(all_points[-1], p1):
                all_points.append(p2)
            else:
                all_points.extend([p1, p2])

    return all_points


# ═══════════════════════════════════════════════════════════════
# DIAMOND 采样
# ═══════════════════════════════════════════════════════════════

def 采样DIAMOND上的点(entity: Dict[str, Any], segments: int = 96) -> List[PointDict]:
    """优先用 contours 多段线，无 contours 时用 center+radius 采样圆。"""
    contours = entity.get("contours")
    if isinstance(contours, list) and len(contours) > 0:
        all_points: List[PointDict] = []
        for ring in contours:
            if not isinstance(ring, list):
                continue
            ring_pts: List[PointDict] = []
            for v in ring:
                pt = 安全转化点位(v.get("point") if isinstance(v, dict) else v)
                if pt:
                    ring_pts.append(pt)
            if len(ring_pts) >= 2:
                if all_points:
                    all_points.extend(ring_pts)
                else:
                    all_points.extend(ring_pts)
        if len(all_points) >= 2:
            return all_points

    center = 安全转化点位(entity.get("center"))
    radius = entity.get("radius")
    if center and isinstance(radius, (int, float)):
        return 采样圆弧上的点(center, float(radius), 0.0, 360.0, segments)

    return []


# ═══════════════════════════════════════════════════════════════
# 偏移函数
# ═══════════════════════════════════════════════════════════════

def 根据开口方向偏移开放折线(
    points: List[PointDict],
    open_direction: str,
    open_size: float,
    是否需要Z轴位置: bool = False,
) -> List[PointDict]:
    if len(points) < 2 or open_size < 1e-9:
        return [dict(point) for point in points]

    方向符号 = -1.0 if open_direction == "RIGHT" else 1.0
    分段法向: List[Optional[PointDict]] = []
    for idx in range(len(points) - 1):
        p = points[idx]
        q = points[idx + 1]
        dx = q["X"] - p["X"]
        dy = q["Y"] - p["Y"]
        length = math.hypot(dx, dy)
        if length < 1e-9:
            分段法向.append(None)
            continue
        分段法向.append({"X": (dy / length) * 方向符号, "Y": (-dx / length) * 方向符号})

    最终输出值: List[PointDict] = []
    for idx, point in enumerate(points):
        候选法向: List[PointDict] = []
        if idx > 0 and 分段法向[idx - 1] is not None:
            候选法向.append(分段法向[idx - 1])  # type: ignore[arg-type]
        if idx < len(分段法向) and 分段法向[idx] is not None:
            候选法向.append(分段法向[idx])  # type: ignore[arg-type]
        if not 候选法向:
            最终输出值.append(dict(point))
            continue

        nx = sum(item["X"] for item in 候选法向)
        ny = sum(item["Y"] for item in 候选法向)
        nlen = math.hypot(nx, ny)
        if nlen < 1e-9:
            兜底法向 = 候选法向[0]
            if 是否需要Z轴位置:
                最终输出值.append({
                    "X": point["X"] + 兜底法向["X"] * open_size,
                    "Y": point["Y"] + 兜底法向["Y"] * open_size,
                    "Z": point.get("Z", 0.0),
                })
            else:
                最终输出值.append({
                    "X": point["X"] + 兜底法向["X"] * open_size,
                    "Y": point["Y"] + 兜底法向["Y"] * open_size,
                })
            continue

        if 是否需要Z轴位置:
            最终输出值.append({
                "X": point["X"] + (nx / nlen) * open_size,
                "Y": point["Y"] + (ny / nlen) * open_size,
                "Z": point.get("Z", 0.0),
            })
        else:
            最终输出值.append({
                "X": point["X"] + (nx / nlen) * open_size,
                "Y": point["Y"] + (ny / nlen) * open_size,
            })
    return 最终输出值


def 根据开口方向偏移线段(
    start: PointDict,
    end: PointDict,
    open_direction: str,
    open_size: float,
    是否需要Z轴位置: bool = False,
) -> List[PointDict]:
    dx = end["X"] - start["X"]
    dy = end["Y"] - start["Y"]
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return [dict(start), dict(end)]

    rx = dy / length
    ry = -dx / length
    sign = -1.0 if open_direction == "RIGHT" else 1.0
    ox = rx * open_size * sign
    oy = ry * open_size * sign
    if 是否需要Z轴位置:
        return [
            {"X": start["X"] + ox, "Y": start["Y"] + oy, "Z": start.get("Z", 0.0)},
            {"X": end["X"] + ox, "Y": end["Y"] + oy, "Z": end.get("Z", 0.0)},
        ]
    return [
        {"X": start["X"] + ox, "Y": start["Y"] + oy},
        {"X": end["X"] + ox, "Y": end["Y"] + oy},
    ]


def 计算圆弧偏移后半径(entity: Dict[str, Any], open_size: float) -> Optional[float]:
    圆弧半径 = entity.get("radius")
    圆弧起点角度 = entity.get("startAngle")
    圆弧终点角度 = entity.get("endAngle")
    if not isinstance(圆弧半径, (int, float)):
        return None
    if not isinstance(圆弧起点角度, (int, float)) or not isinstance(圆弧终点角度, (int, float)):
        return None

    sweep = float(圆弧终点角度) - float(圆弧起点角度)
    if abs(sweep) < 1e-9:
        sweep = 360 if sweep >= 0 else -360
    方向符号 = 1.0 if sweep >= 0 else -1.0
    开口方向 = 规范开口方向(entity.get("openSide"))
    偏移半径 = -((方向符号 if 开口方向 == "RIGHT" else -方向符号) * open_size)
    return max(1e-6, float(圆弧半径) + 偏移半径)


def 计算圆偏移后半径(entity: Dict[str, Any], open_size: float) -> Optional[float]:
    圆半径 = entity.get("radius")
    if not isinstance(圆半径, (int, float)):
        return None
    开口方向 = 规范开口方向(entity.get("openSide"))
    if 开口方向 == "RIGHT":
        return float(圆半径) + open_size
    return max(1e-6, float(圆半径) - open_size)


# ═══════════════════════════════════════════════════════════════
# 实体偏移编排
# ═══════════════════════════════════════════════════════════════

def 创建偏移实体(entity: Dict[str, Any], open_size: float) -> Optional[EntityOffsetProfile]:
    """按 kind 分派偏移逻辑，生成 EntityOffsetProfile。"""
    实体类型 = str(entity.get("kind", "")).upper()
    开口方向 = 规范开口方向(entity.get("openSide"))

    if 实体类型 == "LINE":
        直线的起点 = 安全转化点位(entity.get("start"))
        直线的终点 = 安全转化点位(entity.get("end"))
        if not 直线的起点 or not 直线的终点:
            return None
        偏移后的点 = 根据开口方向偏移线段(直线的起点, 直线的终点, 开口方向, open_size)
        return {
            "entity": entity,
            "original_start": 直线的起点,
            "original_end": 直线的终点,
            "offset_points": 偏移后的点,
        }

    if 实体类型 == "ARC":
        圆弧中心点 = 安全转化点位(entity.get("center"))
        圆弧半径 = entity.get("radius")
        圆弧起点角度 = entity.get("startAngle")
        圆弧终点角度 = entity.get("endAngle")
        偏移后的圆弧半径 = 计算圆弧偏移后半径(entity, open_size)
        if (
            not 圆弧中心点
            or not isinstance(圆弧半径, (int, float))
            or not isinstance(圆弧起点角度, (int, float))
            or not isinstance(圆弧终点角度, (int, float))
            or 偏移后的圆弧半径 is None
        ):
            return None
        原始圆弧采样点 = 采样圆弧上的点(
            center=圆弧中心点,
            radius=float(圆弧半径),
            start_angle=float(圆弧起点角度),
            end_angle=float(圆弧终点角度),
            segments=OPEN_PATH_SAMPLE_SEGMENTS,
        )
        if len(原始圆弧采样点) < 2:
            return None
        显式起点 = 安全转化点位(entity.get("startPoint")) or 安全转化点位(entity.get("start"))
        显式终点 = 安全转化点位(entity.get("endPoint")) or 安全转化点位(entity.get("end"))
        原始起点 = 显式起点 if 显式起点 else 原始圆弧采样点[0]
        原始终点 = 显式终点 if 显式终点 else 原始圆弧采样点[-1]
        偏移后的圆弧采样点 = 采样圆弧上的点(
            center=圆弧中心点,
            radius=偏移后的圆弧半径,
            start_angle=float(圆弧起点角度),
            end_angle=float(圆弧终点角度),
            segments=OPEN_PATH_SAMPLE_SEGMENTS,
        )
        return {
            "entity": entity,
            "original_start": 原始起点,
            "original_end": 原始终点,
            "offset_points": 偏移后的圆弧采样点,
        }

    if 实体类型 == "CIRCLE":
        圆心 = 安全转化点位(entity.get("center"))
        圆半径 = entity.get("radius")
        偏移后的圆半径 = 计算圆偏移后半径(entity, open_size)
        if not 圆心 or not isinstance(圆半径, (int, float)) or 偏移后的圆半径 is None:
            return None
        原始圆采样点 = 采样圆弧上的点(
            center=圆心, radius=float(圆半径),
            start_angle=0.0, end_angle=360.0, segments=360,
        )
        if len(原始圆采样点) < 2:
            return None
        偏移后的圆采样点 = 采样圆弧上的点(
            center=圆心, radius=偏移后的圆半径,
            start_angle=0.0, end_angle=360.0, segments=360,
        )
        return {
            "entity": entity,
            "original_start": 原始圆采样点[0],
            "original_end": 原始圆采样点[-1],
            "offset_points": 偏移后的圆采样点,
        }

    if 实体类型 == "ELLIPSE":
        椭圆参数 = 解析椭圆参数(entity)
        if not 椭圆参数:
            return None
        center, rx, ry, rotation_deg, start_deg, end_deg = 椭圆参数

        偏移量 = open_size if 开口方向 == "RIGHT" else -open_size
        偏移rx = max(1e-6, rx + 偏移量)
        偏移ry = max(1e-6, ry + 偏移量)

        原始椭圆采样点 = 采样椭圆上的点(center, rx, ry, rotation_deg, start_deg, end_deg, OPEN_PATH_SAMPLE_SEGMENTS)
        偏移椭圆采样点 = 采样椭圆上的点(center, 偏移rx, 偏移ry, rotation_deg, start_deg, end_deg, OPEN_PATH_SAMPLE_SEGMENTS)
        if len(原始椭圆采样点) < 2 or len(偏移椭圆采样点) < 2:
            return None
        return {
            "entity": entity,
            "original_start": 原始椭圆采样点[0],
            "original_end": 原始椭圆采样点[-1],
            "offset_points": 偏移椭圆采样点,
        }

    if 实体类型 == "BEZIER":
        贝塞尔控制点原始值 = entity.get("controlPoints")
        if not isinstance(贝塞尔控制点原始值, list):
            return None
        贝塞尔控制点 = [point for point in (安全转化点位(item) for item in 贝塞尔控制点原始值) if point]
        if len(贝塞尔控制点) < 2:
            return None
        原始贝塞尔采样点 = 采样贝塞尔上的点(贝塞尔控制点, OPEN_PATH_SAMPLE_SEGMENTS)
        偏移后的贝塞尔采样点 = 根据开口方向偏移开放折线(原始贝塞尔采样点, 开口方向, open_size)
        if len(原始贝塞尔采样点) < 2 or len(偏移后的贝塞尔采样点) < 2:
            return None
        return {
            "entity": entity,
            "original_start": 原始贝塞尔采样点[0],
            "original_end": 原始贝塞尔采样点[-1],
            "offset_points": 偏移后的贝塞尔采样点,
        }

    if 实体类型 == "POLYLINE":
        vertices = entity.get("vertices")
        if not isinstance(vertices, list) or len(vertices) < 2:
            return None
        closed = bool(entity.get("closed", False))
        原始多段线采样点 = 采样POLYLINE上的点(vertices, closed, OPEN_PATH_SAMPLE_SEGMENTS)
        偏移后的多段线采样点 = 根据开口方向偏移开放折线(原始多段线采样点, 开口方向, open_size)
        if len(原始多段线采样点) < 2 or len(偏移后的多段线采样点) < 2:
            return None
        return {
            "entity": entity,
            "original_start": 原始多段线采样点[0],
            "original_end": 原始多段线采样点[-1],
            "offset_points": 偏移后的多段线采样点,
        }

    if 实体类型 == "DIAMOND":
        原始钻石采样点 = 采样DIAMOND上的点(entity, OPEN_PATH_SAMPLE_SEGMENTS)
        偏移后的钻石采样点 = 根据开口方向偏移开放折线(原始钻石采样点, 开口方向, open_size)
        if len(原始钻石采样点) < 2 or len(偏移后的钻石采样点) < 2:
            return None
        return {
            "entity": entity,
            "original_start": 原始钻石采样点[0],
            "original_end": 原始钻石采样点[-1],
            "offset_points": 偏移后的钻石采样点,
        }

    return None


# ═══════════════════════════════════════════════════════════════
# 连通分量 & 链拼接
# ═══════════════════════════════════════════════════════════════

def 根据起点方向返回偏移点列(profile: EntityOffsetProfile, start_from_entity_start: bool) -> List[PointDict]:
    if start_from_entity_start:
        return [dict(point) for point in profile["offset_points"]]
    return [dict(point) for point in reversed(profile["offset_points"])]


def 实体ID转化为字符串(entity: Dict[str, Any]) -> str:
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
    node = entity.get("node")
    if not isinstance(node, dict):
        return True
    has_start_ref = isinstance(node.get("start"), dict)
    has_end_ref = isinstance(node.get("end"), dict)
    if not has_end_ref and has_start_ref:
        return False
    return True


def 选择链起点(unused: Set[int], profiles: List[EntityOffsetProfile], id_to_idx: Dict[str, int]) -> int:
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
    ends_a = (a["original_start"], a["original_end"])
    ends_b = (b["original_start"], b["original_end"])
    for pa in ends_a:
        for pb in ends_b:
            if 判断是否重复点(pa, pb):
                return True
    return False


class _DSU:
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


def 将实体索引划分为连通分量(
    original_profiles: List[EntityOffsetProfile],
    id_to_idx: Dict[str, int],
) -> Tuple[List[Set[int]], List[bool]]:
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
    result = [buckets[r] for r in sorted(buckets.keys(), key=lambda r: min(buckets[r]))]

    is_closed_groups: List[bool] = []
    for comp in result:
        is_closed = True
        for i in comp:
            profile = original_profiles[i]
            node = profile["entity"].get("node")
            for side in ("start", "end"):
                endpoint_connected = False
                if isinstance(node, dict):
                    ref = node.get(side)
                    if isinstance(ref, dict):
                        tid = ref.get("id")
                        if tid is not None:
                            j = id_to_idx.get(str(tid))
                            if j is not None and j in comp and j != i:
                                endpoint_connected = True
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
    return result, is_closed_groups


def 沿节点走完整链(
    first_idx: int,
    profiles: List[EntityOffsetProfile],
    id_to_idx: Dict[str, int],
    allowed_indices: Optional[Set[int]] = None,
) -> Tuple[List[int], List[bool]]:
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


def 拼接偏移轮廓点列(
    originalProfiles: List[EntityOffsetProfile],
    profiles: List[EntityOffsetProfile],
) -> List[List[PointDict]]:
    if not profiles:
        return []

    id_to_idx: Dict[str, int] = {}
    for i, p in enumerate(profiles):
        eid = 实体ID转化为字符串(p["entity"])
        if eid and eid not in id_to_idx:
            id_to_idx[eid] = i

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


# ═══════════════════════════════════════════════════════════════
# LJS 文件读取（兼容旧格式文件，仍用 calc_offset_ljs）
# ═══════════════════════════════════════════════════════════════

def 从LJS文件读取实体(path: Path) -> List[Dict[str, Any]]:
    """读取 .ljs 文件中的实体。旧格式文件请使用 calc_offset_ljs。"""
    payload = json.loads(path.read_text(encoding="utf-8"))
    data = payload.get("data", {})
    entities = data.get("entities", [])
    if not isinstance(entities, list):
        return []
    return [entity for entity in entities if isinstance(entity, dict)]


# ═══════════════════════════════════════════════════════════════
# OffsetEndpointCalculator
# ═══════════════════════════════════════════════════════════════

class OffsetEndpointCalculator:
    @staticmethod
    def 计算绕坐标轴旋转后的偏移点位(
        旋转后的点: list[dict[str, Any]],
        偏移值: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """对旋转后的实体点列按开口方向偏移。输入来自 calc_rotation 的输出。"""
        返回绕坐标轴旋转后的点位: List[Dict[str, Any]] = []
        for 选择实体索引 in range(len(旋转后的点)):
            当前实体 = 旋转后的点[选择实体索引]
            当前实体类型 = 当前实体.get("kind")
            开口方向 = 当前实体.get("openSide")
            开口偏移值 = 偏移值
            偏移后的旋转坐标值: List[Dict[str, Any]] = []

            if 当前实体类型 == "LINE":
                直线的点列表 = 当前实体.get("points")
                if 直线的点列表 and len(直线的点列表) >= 2:
                    直线的起点 = 直线的点列表[0]
                    直线的终点 = 直线的点列表[-1]
                    if 开口方向 is not None and 开口偏移值 is not None:
                        偏移后的旋转坐标值 = 根据开口方向偏移线段(
                            直线的起点, 直线的终点, 开口方向, 开口偏移值, 是否需要Z轴位置=True
                        )
            elif 当前实体类型 in ("ARC", "CIRCLE", "ELLIPSE", "BEZIER", "POLYLINE", "DIAMOND"):
                点列表 = 当前实体.get("points")
                if 点列表 and 开口方向 is not None and 开口偏移值 is not None:
                    偏移后的旋转坐标值 = 根据开口方向偏移开放折线(
                        点列表, 开口方向, 开口偏移值, 是否需要Z轴位置=True
                    )
            else:
                偏移后的旋转坐标值 = list(当前实体.get("points") or [])

            实体点数据字典 = {"kind": 当前实体类型, "points": 偏移后的旋转坐标值}
            返回绕坐标轴旋转后的点位.append(实体点数据字典)
        return 返回绕坐标轴旋转后的点位

    @staticmethod
    def calc_xy_points(
        entities_or_ljs_path: Any,
        offset: Optional[float] = None,
        invert_open_direction: bool = False,
    ) -> List[List[PointDict]]:
        """计算并按连通图形分组拼接偏移点位。"""
        实体列表: List[Dict[str, Any]] = []
        if isinstance(entities_or_ljs_path, list):
            实体列表 = [e for e in entities_or_ljs_path if isinstance(e, dict)]
        elif isinstance(entities_or_ljs_path, (str, Path)):
            实体列表 = 从LJS文件读取实体(Path(entities_or_ljs_path).expanduser().resolve())
        else:
            return []

        if invert_open_direction:
            实体列表 = [反转开口方向(e) for e in 实体列表]

        开口大小 = DEFAULT_OPEN_SIZE if offset is None else max(0.0, float(offset))
        原始实体列表: List[EntityOffsetProfile] = []
        偏移实体列表: List[EntityOffsetProfile] = []
        for 单个实体 in 实体列表:
            单个原始实体 = 创建偏移实体(单个实体, 0)
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
        return OffsetEndpointCalculator.calc_xy_points(
            ljs_path, offset, invert_open_direction=invert_open_direction
        )
