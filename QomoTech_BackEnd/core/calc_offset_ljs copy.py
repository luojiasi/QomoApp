import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, TypedDict


OPEN_PATH_SAMPLE_SEGMENTS = 96
DEFAULT_OPEN_SIZE = 0.5
POINT_EPS = 1e-6


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


def _is_same_point(a: PointDict, b: PointDict, eps: float = POINT_EPS) -> bool:
    """
    作用：用 POINT_EPS 判断两点是否视为相同，用于接缝去重。
    """
    return abs(a["x"] - b["x"]) <= eps and abs(a["y"] - b["y"]) <= eps


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


def _build_profile(entity: Dict[str, Any], open_size: float) -> Optional[EntityOffsetProfile]:
    """
    作用：把单个实体转成 EntityOffsetProfile(偏移实体)。
    分支：
        1.LINE：解析 start/end -> 偏移 2 点
        2.ARC：
            解析 center/radius/startAngle/endAngle -> 采样原弧与偏移弧
            original_start/end 优先用实体显式端点（startPoint/endPoint 或 start/end），避免角度反算与原数据细微不一致。
        3.其他类型返回 None。
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
        # TODO:了解到底该怎么区做这个圆偏移半径
        offset_radius = _compute_arc_offset_radius(entity, open_size)
        if (
            not center
            or not isinstance(radius, (int, float))
            or not isinstance(start_angle, (int, float))
            or not isinstance(end_angle, (int, float))
            or offset_radius is None
        ):
            return None

        original_points = _create_arc_points(
            center=center,
            radius=float(radius),
            start_angle=float(start_angle),
            end_angle=float(end_angle),
            segments=OPEN_PATH_SAMPLE_SEGMENTS,
        )
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


def _walk_chain_by_node(
    first_idx: int,
    profiles: List[EntityOffsetProfile],
    id_to_idx: Dict[str, int],
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
) -> List[PointDict]:
    """
    作用：把所有实体轮廓拼成最终点列（核心拼接器）。
    优先使用实体上的 node（id / start / end）定向拼接（含末端仅 node.start 有邻接的情形）；
    若全体均无可用 node 邻接，则回退为按共享端点建图的几何拼接。
    """
    _ = originalProfiles  # 与 profiles 同源 entity；偏移点列仅使用 profiles

    if not profiles:
        return []


    id_to_idx: Dict[str, int] = {}
    for i, p in enumerate(profiles):
        eid = _entity_id_str(p["entity"])
        if eid and eid not in id_to_idx:
            id_to_idx[eid] = i

    stitched: List[PointDict] = []
    used: Set[int] = set()

    while len(used) < len(profiles):
        unused = set(range(len(profiles))) - used
        seed = _pick_chain_seed(unused, profiles, id_to_idx)
        order, forwards = _walk_chain_by_node(seed, profiles, id_to_idx)
        for idx in order:
            used.add(idx)

        component_points: List[PointDict] = []
        for idx, start_from_entity_start in zip(order, forwards):
            seq = _orient_offset_points(profiles[idx], start_from_entity_start)
            if not component_points:
                component_points.extend(seq)
            elif seq and _is_same_point(component_points[-1], seq[0]):
                component_points.extend(seq[1:])
            else:
                component_points.extend(seq)

        stitched.extend(_dedupe_consecutive(component_points))

    return stitched


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
        entities_or_ljs_path: Any, offset: Optional[float] = None
    ) -> List[PointDict]:
        """
        计算并拼接偏移实体点位（LINE/ARC）：
        - 先按实体独立偏移
        - 再按“原始共享端点”自动拼接
        - 若共享发生在某实体 end（如 line.end 接 arc.end），会自动翻转该实体点序
        """
        # 1.获取实体
        entities: List[Dict[str, Any]] = []
        if isinstance(entities_or_ljs_path, list):
            entities = [entity for entity in entities_or_ljs_path if isinstance(entity, dict)]
        elif isinstance(entities_or_ljs_path, (str, Path)):
            entities = _load_ljs_entities(Path(entities_or_ljs_path).expanduser().resolve())
        else:
            return []

        open_size = DEFAULT_OPEN_SIZE if offset is None else max(0.0, float(offset))
        originalProfiles: List[EntityOffsetProfile] = []
        profiles: List[EntityOffsetProfile] = []
        for entity in entities:
            # 原始的entity
            originalProfile=_build_profile(entity,0)
            # 偏移后的所有entity
            profile = _build_profile(entity, open_size)
            if profile is not None:
                originalProfiles.append(originalProfile)
                profiles.append(profile)
        return _stitch_profiles(originalProfiles, profiles)

    @staticmethod
    def calc_xy_points_from_ljs_file(
        ljs_path: str, offset: Optional[float] = None
    ) -> List[PointDict]:
        return OffsetEndpointCalculator.calc_xy_points(ljs_path, offset)
