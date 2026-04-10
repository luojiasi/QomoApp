import json
import math
from pathlib import Path
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple, TypedDict


OPEN_PATH_SAMPLE_SEGMENTS = 96
DEFAULT_OPEN_SIZE = 0.5
POINT_EPS = 1e-6
LINE_PARALLEL_EPS = 1e-9
# 与 QomoTech_FrontEnd threeGeometry.ts 一致
MITER_LIMIT = 8


class PointDict(TypedDict):
    x: float
    y: float


class EntityOffsetProfile(TypedDict):
    entity: Dict[str, Any]
    original_start: PointDict
    original_end: PointDict
    offset_points: List[PointDict]


def _to_point(obj: Any) -> Optional[PointDict]:
    """
    作用：把任意对象安全转换为 PointDict。
    逻辑：
        必须是 dict，且有 x/y，且为数值且有限（非 NaN/Inf）。
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
    return {"x": float(x), "y": float(y)}


def _normalize_open_direction(value: Any) -> str:
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


def _entity_with_flipped_open_direction(entity: Dict[str, Any]) -> Dict[str, Any]:
    """浅拷贝实体并将 openDirection 取反（RIGHT↔LEFT），供从 LJS 读取后整体反转开口侧。"""
    out = dict(entity)
    od = _normalize_open_direction(out.get("openDirection"))
    out["openDirection"] = "LEFT" if od == "RIGHT" else "RIGHT"
    return out


def _is_same_point(a: PointDict, b: PointDict, eps: float = POINT_EPS) -> bool:
    """
    作用：用 POINT_EPS 判断两点是否视为相同，用于接缝去重。
    """
    return abs(a["x"] - b["x"]) <= eps and abs(a["y"] - b["y"]) <= eps

# =========================================================共享端点的优化========================================================
def _intersect_lines_2d(
    a0: PointDict, a1: PointDict, b0: PointDict, b1: PointDict
) -> Optional[PointDict]:
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


def _get_offset_endpoint_line(
    offset_points: List[PointDict], side: str
) -> Optional[Tuple[PointDict, PointDict, PointDict]]:
    """
    偏移轮廓在 start/end 侧的切线（from→to）及原始偏移端点 base（用于 miter 距离）。
    side: 'start' | 'end'。与 getOffsetEndpointLine 一致。
    """
    if len(offset_points) < 2:
        return None
    if side == "start":
        return (offset_points[0], offset_points[1], offset_points[0])
    return (offset_points[-1], offset_points[-2], offset_points[-1])


def _original_endpoint_by_side(profile: EntityOffsetProfile, side: str) -> PointDict:
    return profile["original_start"] if side == "start" else profile["original_end"]


def _profile_stable_key(profile: EntityOffsetProfile, index: int) -> str:
    eid = _entity_id_str(profile["entity"])
    return eid if eid else f"__idx_{index}"


def _apply_open_entity_endpoint_overrides(
    profiles: List[EntityOffsetProfile], open_size: float
) -> None:
    """
    共享原始端点处，对两侧「偏移端点切线」求交，通过 miter 限制则覆盖首尾偏移点。
    仅修改 offset_points 的首/末坐标；与 line-offset-join-diagram.md / buildOpenEntityOffsetOverrides 一致。
    """
    if len(profiles) < 2:
        return
    keys = [_profile_stable_key(p, i) for i, p in enumerate(profiles)]
    overrides: Dict[str, Dict[str, PointDict]] = {}

    for i, profile in enumerate(profiles):
        kid = keys[i]
        pts = profile["offset_points"]
        for side in ("start", "end"):
            joint = _original_endpoint_by_side(profile, side)
            line_a = _get_offset_endpoint_line(pts, side)
            if line_a is None:
                continue
            a0, a1, base_a = line_a

            candidates: List[Tuple[int, str]] = []
            for j, other in enumerate(profiles):
                if j == i:
                    continue
                if _is_same_point(other["original_start"], joint):
                    candidates.append((j, "start"))
                elif _is_same_point(other["original_end"], joint):
                    candidates.append((j, "end"))
            if not candidates:
                continue

            best_intersection: Optional[PointDict] = None
            best_score = float("inf")
            for j, oside in candidates:
                other_pts = profiles[j]["offset_points"]
                line_b = _get_offset_endpoint_line(other_pts, oside)
                if line_b is None:
                    continue
                b0, b1, _base_b = line_b
                intersection = _intersect_lines_2d(a0, a1, b0, b1)
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

def _dedupe_consecutive(points: List[PointDict]) -> List[PointDict]:
    """
    作用：删除连续的重复点（粗粒度清理），然后本链结果并入 stitched
    """
    if not points:
        return []
    out: List[PointDict] = [points[0]]
    for point in points[1:]:
        if not _is_same_point(out[-1], point):
            out.append(point)
    return out


def _create_arc_points(
    center: PointDict,
    radius: float,
    start_angle: float,
    end_angle: float,
    segments: int = 48,
) -> List[PointDict]:
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


def _offset_segment_by_open_direction(
    start: PointDict, end: PointDict, open_direction: str, open_size: float
) -> List[PointDict]:
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
    return [
        {"x": start["x"] + ox, "y": start["y"] + oy},
        {"x": end["x"] + ox, "y": end["y"] + oy},
    ]


def _compute_arc_offset_radius(entity: Dict[str, Any], open_size: float) -> Optional[float]:
    """
    作用：计算圆弧偏移后的半径。
    关键逻辑：
        1.根据 startAngle/endAngle 的扫角正负判断方向（CCW/CW）；
        2.结合 openDirection 决定半径是增还是减；
        3.半径下限夹到 1e-6，避免非正半径。
    用途：弧实体偏移核心。
    """
    radius = entity.get("radius")
    start_angle = entity.get("startAngle")
    end_angle = entity.get("endAngle")
    if not isinstance(radius, (int, float)):
        return None
    if not isinstance(start_angle, (int, float)) or not isinstance(end_angle, (int, float)):
        return None
    # TODO:任然要思考怎么才能作为逆时针和顺时针的区别
    sweep = float(end_angle) - float(start_angle)
    if abs(sweep) < 1e-9:
        sweep = 360 if sweep >= 0 else -360
    orientation_sign = 1.0 if sweep >= 0 else -1.0
    open_direction = _normalize_open_direction(entity.get("openDirection"))
    delta_radius = -((orientation_sign if open_direction == "RIGHT" else -orientation_sign) * open_size)
    return max(1e-6, float(radius) + delta_radius)


def _compute_circle_offset_radius(entity: Dict[str, Any], open_size: float) -> Optional[float]:
    """
    作用：计算圆偏移后的半径（与前端 threeGeometry.ts 保持一致）。
    规则：
        - RIGHT：向外偏移，半径增大；
        - LEFT：向内偏移，半径减小（最小夹到 1e-6）。
    """
    radius = entity.get("radius")
    if not isinstance(radius, (int, float)):
        return None
    open_direction = _normalize_open_direction(entity.get("openDirection"))
    if open_direction == "RIGHT":
        return float(radius) + open_size
    return max(1e-6, float(radius) - open_size)


def _build_profile(entity: Dict[str, Any], open_size: float) -> Optional[EntityOffsetProfile]:
    """
    作用：把单个实体转成 EntityOffsetProfile(偏移实体)。
    分支：
        1.LINE：解析 start/end -> 偏移 2 点
        2.ARC：
            解析 center/radius/startAngle/endAngle -> 采样原弧与偏移弧
            original_start/end 优先用实体显式端点（startPoint/endPoint 或 start/end），避免角度反算与原数据细微不一致。
        3.CIRCLE：
            解析 center/radius -> 采样原圆与偏移圆（0~360）。
        4.其他类型返回 None。
    用途：统一各实体为可拼接格式。
    """
    entity_type = str(entity.get("type", "")).upper()
    open_direction = _normalize_open_direction(entity.get("openDirection"))

    if entity_type == "LINE":
        start = _to_point(entity.get("start"))
        end = _to_point(entity.get("end"))
        if not start or not end:
            return None
        offset_points = _offset_segment_by_open_direction(start, end, open_direction, open_size)
        return {
            "entity": entity,
            "original_start": start,
            "original_end": end,
            "offset_points": offset_points,
        }

    if entity_type == "ARC":
        center = _to_point(entity.get("center"))
        radius = entity.get("radius")
        start_angle = entity.get("startAngle")
        end_angle = entity.get("endAngle")
        # TODO:了解到底该怎么去做这个圆偏移半径
        offset_radius = _compute_arc_offset_radius(entity, open_size)
        if (
            not center
            or not isinstance(radius, (int, float))
            or not isinstance(start_angle, (int, float))
            or not isinstance(end_angle, (int, float))
            or offset_radius is None
        ):
            return None

        original_points = _create_arc_points(center=center,radius=float(radius),start_angle=float(start_angle),end_angle=float(end_angle),segments=OPEN_PATH_SAMPLE_SEGMENTS,)
        if len(original_points) < 2:
            return None

        # 优先使用实体自带端点用于连通判定，避免角度反算端点与实际端点存在微小不一致。
        explicit_start = _to_point(entity.get("startPoint")) or _to_point(entity.get("start"))
        explicit_end = _to_point(entity.get("endPoint")) or _to_point(entity.get("end"))
        original_start = explicit_start if explicit_start else original_points[0]
        original_end = explicit_end if explicit_end else original_points[-1]
        offset_points = _create_arc_points(
            center=center,
            radius=offset_radius,
            start_angle=float(start_angle),
            end_angle=float(end_angle),
            segments=OPEN_PATH_SAMPLE_SEGMENTS,
        )
        return {
            "entity": entity,
            "original_start": original_start,
            "original_end": original_end,
            "offset_points": offset_points,
        }
    if entity_type == "CIRCLE":
        center = _to_point(entity.get("center"))
        radius = entity.get("radius")
        offset_radius = _compute_circle_offset_radius(entity, open_size)
        if (
            not center
            or not isinstance(radius, (int, float))
            or offset_radius is None
        ):
            return None

        original_points = _create_arc_points(
            center=center,
            radius=float(radius),
            start_angle=0.0,
            end_angle=360.0,
            segments=360,
        )
        if len(original_points) < 2:
            return None

        offset_points = _create_arc_points(
            center=center,
            radius=offset_radius,
            start_angle=0.0,
            end_angle=360.0,
            segments=360,
        )
        return {
            "entity": entity,
            "original_start": original_points[0],
            "original_end": original_points[-1],
            "offset_points": offset_points,
        }

    return None


def _orient_offset_points(profile: EntityOffsetProfile, start_from_entity_start: bool) -> List[PointDict]:
    """
    作用：根据起点方向返回偏移点列。
    逻辑：
        如果 start_from_entity_start 为 True，则返回原始点列；
        否则返回反向点列。
    """
    if start_from_entity_start:
        return [dict(point) for point in profile["offset_points"]]
    return [dict(point) for point in reversed(profile["offset_points"])]

def _entity_id_str(entity: Dict[str, Any]) -> str:
    """
    作用：把实体 id 转成字符串。
    用途：作为哈希 key 建立“实体 id -> 实体索引”映射，用于连通性分析。
    """
    raw = entity.get("id")
    return str(raw) if raw is not None else ""


def _node_start_is_none(profile: EntityOffsetProfile) -> bool:
    node = profile["entity"].get("node")
    if not isinstance(node, dict):
        return False
    return node.get("start") is None


def _node_end_is_none(profile: EntityOffsetProfile) -> bool:
    node = profile["entity"].get("node")
    if not isinstance(node, dict):
        return False
    return node.get("end") is None


def _first_forward_for_chain_start(entity: Dict[str, Any]) -> bool:
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


def _pick_chain_seed(unused: Set[int], profiles: List[EntityOffsetProfile], id_to_idx: Dict[str, int]) -> int:
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
            not _node_end_is_none(profiles[i]),
            not _node_start_is_none(profiles[i]),
            i,
        ),
    )


def _share_original_endpoint(a: EntityOffsetProfile, b: EntityOffsetProfile) -> bool:
    """
    判定两段轮廓在「原始几何」上是否共端点（与 openSize 无关），用于无 node 时的连通归档。
    """
    ends_a = (a["original_start"], a["original_end"])
    ends_b = (b["original_start"], b["original_end"])
    for pa in ends_a:
        for pb in ends_b:
            if _is_same_point(pa, pb):
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


def _entity_index_components(
    original_profiles: List[EntityOffsetProfile],
    id_to_idx: Dict[str, int],
) -> List[Set[int]]:
    """
    将实体索引划分为若干连通分量：
    - 任意 src.start/end 与另一实体的原始端点在 POINT_EPS 内重合则同属一分量；
    - entity.node.start / node.end 指向的另一实体（按 id）亦合并。
    """
    n = len(original_profiles)
    if n == 0:
        return []
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
            if _share_original_endpoint(original_profiles[i], original_profiles[j]):
                dsu.union(i, j)
    buckets: Dict[int, Set[int]] = defaultdict(set)
    for i in range(n):
        buckets[dsu.find(i)].add(i)
    # 稳定顺序：分量按最小下标排序，便于测试结果与调试可复现
    return [buckets[r] for r in sorted(buckets.keys(), key=lambda r: min(buckets[r]))]


def _walk_chain_by_node(
    first_idx: int,
    profiles: List[EntityOffsetProfile],
    id_to_idx: Dict[str, int],
    allowed_indices: Optional[Set[int]] = None,
) -> Tuple[List[int], List[bool]]:
    """
    沿 entity.node 走完整链：出口在几何终点时用 node.end，在几何起点时用 node.start。
    ref.endpoint=='start' 则下一段不反转，'end' 则反转。
    若邻接指回 first_idx，视为闭合，不再重复加入第一条。
    """
    order: List[int] = [first_idx]
    forwards: List[bool] = [_first_forward_for_chain_start(profiles[first_idx]["entity"])]
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


def _stitch_profiles(
    originalProfiles: List[EntityOffsetProfile], profiles: List[EntityOffsetProfile]
) -> List[List[PointDict]]:
    """
    作用：按「连通图形」分别拼接偏移轮廓点列。
    连通判定：原始几何共端点（POINT_EPS）或与 entity.node 邻接指向的实体同属一条图链；
    互不连通的实体组各自输出一条折线（一个内层 list），避免误把多幅图连成一条 polyline。
    """
    if not profiles:
        return []

    id_to_idx: Dict[str, int] = {}
    for i, p in enumerate(profiles):
        eid = _entity_id_str(p["entity"])
        if eid and eid not in id_to_idx:
            id_to_idx[eid] = i

    components = _entity_index_components(originalProfiles, id_to_idx)
    all_polylines: List[List[PointDict]] = []

    for comp in components:
        used: Set[int] = set()
        figure_points: List[PointDict] = []

        while len(used) < len(comp):
            unused = comp - used
            seed = _pick_chain_seed(unused, profiles, id_to_idx)
            order, forwards = _walk_chain_by_node(
                seed, profiles, id_to_idx, allowed_indices=comp
            )
            for idx in order:
                used.add(idx)

            chain_points: List[PointDict] = []
            for idx, start_from_entity_start in zip(order, forwards):
                seq = _orient_offset_points(profiles[idx], start_from_entity_start)
                if not chain_points:
                    chain_points.extend(seq)
                elif seq and _is_same_point(chain_points[-1], seq[0]):
                    chain_points.extend(seq[1:])
                else:
                    chain_points.extend(seq)

            deduped = _dedupe_consecutive(chain_points)
            if figure_points and deduped and not _is_same_point(figure_points[-1], deduped[0]):
                figure_points.extend(deduped)
            elif figure_points and deduped:
                figure_points.extend(deduped[1:])
            else:
                figure_points.extend(deduped)

        all_polylines.append(_dedupe_consecutive(figure_points))

    return all_polylines


def _load_ljs_entities(path: Path) -> List[Dict[str, Any]]:
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
    def calc_xy_points(
        entities_or_ljs_path: Any,
        offset: Optional[float] = None,
        invert_open_direction: bool = False,
    ) -> List[List[PointDict]]:
        """
        计算并按「连通图形」分组拼接偏移点位（LINE/ARC/CIRCLE）：
        - 先按实体独立偏移；
        - 端点相接或通过 entity.node 相连的实体归为同一图形并拼接点序；
        - 与上一组无任何共点、也无 node 关联的实体进入新的子列表（新图形）。
        返回形如 [[{x,y},...], [{x,y},...], ...]，外层每个元素对应一幅独立图。
        invert_open_direction：为 True 时对每个实体 openDirection 做 RIGHT↔LEFT 后再计算（不写回文件）。
        """
        # 1.获取实体
        entities: List[Dict[str, Any]] = []
        if isinstance(entities_or_ljs_path, list):
            entities = [entity for entity in entities_or_ljs_path if isinstance(entity, dict)]
        elif isinstance(entities_or_ljs_path, (str, Path)):
            entities = _load_ljs_entities(Path(entities_or_ljs_path).expanduser().resolve())
        else:
            return []

        # 开口方向反转
        if invert_open_direction:
            entities = [_entity_with_flipped_open_direction(e) for e in entities]

        open_size = DEFAULT_OPEN_SIZE if offset is None else max(0.0, float(offset))
        originalProfiles: List[EntityOffsetProfile] = []
        profiles: List[EntityOffsetProfile] = []
        for entity in entities:
            # 原始的entity
            originalProfile=_build_profile(entity,0)
            # 偏移后的所有entity
            profile = _build_profile(entity, open_size)
            if profile is not None and originalProfile is not None:
                originalProfiles.append(originalProfile)
                profiles.append(profile)
        _apply_open_entity_endpoint_overrides(profiles, open_size)
        return _stitch_profiles(originalProfiles, profiles)

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
