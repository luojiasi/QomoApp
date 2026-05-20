"""新编辑器实体格式的偏移计算模块。

与 calc_offset_ljs.py 对应，但适配新前端 entitiesEditor 的实体格式：
- kind 替代 type
- 坐标使用大写 X/Y
- openSide 替代 openDirection
- controlPoints 替代 points（贝塞尔）
- 新增 POLYLINE（含 bulge）、DIAMOND（含 contours）
"""
import math
from typing import Any, Dict, List, Optional, Set

OPEN_PATH_SAMPLE_SEGMENTS = 96


def 计算图形任务的数量(entities: List[Dict[str, Any]]) -> int:
    """按 node 连通关系统计图形任务数量。

    规则：
    1. 无 node 的实体 —— 每个算 1 个任务
    2. 有 node 且 start=null 的实体为链起点，沿 node 引用追踪直到出口为 null，整条链算 1 个任务（已访问的实体跳过）
    3. 追踪结束后，剩余未被访问的有 node 实体属于闭环，每个连通分量算 1 个任务
    """
    n = len(entities)
    if n == 0:
        return 0

    # id → index 映射
    id_to_idx: Dict[str, int] = {}
    for i, e in enumerate(entities):
        eid = e.get("id")
        if eid is not None:
            id_to_idx.setdefault(str(eid), i)

    已访问: Set[int] = set()
    任务数量 = 0

    # ── 1. 无 node → 每个实体独立算 1 个任务 ──
    for i, e in enumerate(entities):
        node = e.get("node")
        if not isinstance(node, dict):
            任务数量 += 1
            已访问.add(i)

    # ── 2. 从每个 start=null 的实体出发追踪链 ──
    for i, e in enumerate(entities):
        if i in 已访问:
            continue
        node = e.get("node")
        if not isinstance(node, dict):
            continue
        if node.get("start") is not None:
            continue

        # start=null → 入口在几何起点，出口在 node.end
        已访问.add(i)
        任务数量 += 1
        当前出口引用 = node.get("end")

        while isinstance(当前出口引用, dict):
            下一实体ID = 当前出口引用.get("id")
            接入端点 = 当前出口引用.get("endpoint")
            if 下一实体ID is None or 接入端点 not in ("start", "end"):
                break
            下一索引 = id_to_idx.get(str(下一实体ID))
            if 下一索引 is None or 下一索引 in 已访问:
                break

            已访问.add(下一索引)
            下一节点 = entities[下一索引].get("node", {})

            # 根据接入端点决定出口：接到 start → 出口在 end；接到 end → 出口在 start
            if 接入端点 == "start":
                当前出口引用 = 下一节点.get("end")
            else:
                当前出口引用 = 下一节点.get("start")

    # ── 3. 剩余未访问的有 node 实体 → 闭环，按连通分量各算 1 个任务 ──
    for i, e in enumerate(entities):
        if i in 已访问:
            continue
        node = e.get("node")
        if not isinstance(node, dict):
            continue

        # BFS 收集当前连通分量
        栈 = [i]
        while 栈:
            cur = 栈.pop()
            if cur in 已访问:
                continue
            已访问.add(cur)
            cur_node = entities[cur].get("node", {})
            for side in ("start", "end"):
                ref = cur_node.get(side)
                if isinstance(ref, dict):
                    rid = ref.get("id")
                    if rid is not None:
                        j = id_to_idx.get(str(rid))
                        if j is not None and j not in 已访问:
                            栈.append(j)

        任务数量 += 1

    return 任务数量

def _提取坐标(point: Dict[str, Any]) -> tuple[float, float]:
    """从新格式点位提取 (X, Y)，兼容旧格式小写 x/y。"""
    x = point.get("X")
    y = point.get("Y")
    if x is None:
        x = point.get("x", 0)
    if y is None:
        y = point.get("y", 0)
    return float(x), float(y)


def _构建点位(x: float, y: float) -> Dict[str, Any]:
    """构建新格式点位 {X, Y}。"""
    return {"X": x, "Y": y}


def 采样圆上的点(center: Dict[str, Any], radius: float, segments: int = 360) -> List[Dict[str, Any]]:
    """采样整圆上的点列（0°~360°）。"""
    return 采样圆弧上的点(center, radius, 0.0, 360.0, segments)


def 采样圆弧上的点(
    center: Dict[str, Any],
    radius: float,
    start_angle: float,
    end_angle: float,
    segments: int = OPEN_PATH_SAMPLE_SEGMENTS,
) -> List[Dict[str, Any]]:
    """按角度范围采样圆弧点列（新格式大写 X/Y）。

    与前端 createArcPoints 一致：归一化扫角后均匀步进采样 segments+1 个点。
    """
    cx, cy = _提取坐标(center)

    sweep = end_angle - start_angle
    while sweep > 360:
        sweep -= 360
    while sweep <= -360:
        sweep += 360
    if abs(sweep) < 1e-9:
        sweep = 360 if sweep >= 0 else -360

    step = sweep / max(segments, 1)
    points: List[Dict[str, Any]] = []
    for idx in range(segments + 1):
        angle = start_angle + step * idx
        rad = math.radians(angle)
        points.append(_构建点位(cx + radius * math.cos(rad), cy + radius * math.sin(rad)))
    return points


def 采样POLYLINE上的点(
    points: List[Dict[str, Any]],
    segments_per_arc: int = OPEN_PATH_SAMPLE_SEGMENTS,
) -> List[Dict[str, Any]]:
    """采样 POLYLINE 上的点列。

    每个顶点可带 bulge 属性，表示从该顶点到下一顶点的弧线：
    - bulge = 0 或不存在 → 直线段
    - bulge > 0 → 逆时针弧（CCW）
    - bulge < 0 → 顺时针弧（CW）

    bulge 与弧的数学关系：bulge = tan(θ/4)，θ 为弧的圆心角。
    """
    if len(points) < 2:
        return [_构建点位(*_提取坐标(p)) for p in points]

    result: List[Dict[str, Any]] = [_构建点位(*_提取坐标(points[0]))]

    for i in range(len(points) - 1):
        x1, y1 = _提取坐标(points[i])
        x2, y2 = _提取坐标(points[i + 1])
        bulge = float(points[i].get("bulge", 0) or 0)

        dx = x2 - x1
        dy = y2 - y1
        L = math.hypot(dx, dy)

        if L < 1e-9 or abs(bulge) < 1e-9:
            result.append(_构建点位(x2, y2))
            continue

        # bulged arc
        s = bulge * L / 2  # signed sagitta
        R = (L * L) / (8 * abs(s)) + abs(s) / 2
        d_perp = math.sqrt(max(0.0, R * R - (L / 2) * (L / 2)))

        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2
        nx = -dy / L  # unit normal to the left of P1→P2
        ny = dx / L
        side = 1 if bulge > 0 else -1
        cx = mx + nx * side * d_perp
        cy = my + ny * side * d_perp

        start_angle_rad = math.atan2(y1 - cy, x1 - cx)
        end_angle_rad = math.atan2(y2 - cy, x2 - cx)

        # determine sweep preserving bulge direction
        if bulge > 0:
            while end_angle_rad <= start_angle_rad:
                end_angle_rad += 2 * math.pi
        else:
            while end_angle_rad >= start_angle_rad:
                end_angle_rad -= 2 * math.pi

        sweep_rad = end_angle_rad - start_angle_rad
        segs = max(16, segments_per_arc)
        step = sweep_rad / segs
        for j in range(1, segs + 1):
            a = start_angle_rad + step * j
            result.append(_构建点位(cx + R * math.cos(a), cy + R * math.sin(a)))

    return result


def 采样贝塞尔曲线上的点(
    control_points: List[Dict[str, Any]],
    segments: int = OPEN_PATH_SAMPLE_SEGMENTS,
) -> List[Dict[str, Any]]:
    """将贝塞尔控制点离散采样为折线点列（De Casteljau 算法，新格式大写 X/Y）。

    与前端 createBezierPoints 一致，segments 至少为 2。
    """
    if len(control_points) == 0:
        return []
    if len(control_points) == 1:
        return [_构建点位(*_提取坐标(control_points[0]))]

    安全取点数 = max(2, segments)
    pts = [_提取坐标(p) for p in control_points]
    result: List[Dict[str, Any]] = []
    for idx in range(安全取点数 + 1):
        t = idx / 安全取点数
        working = [{"x": px, "y": py} for px, py in pts]
        while len(working) > 1:
            nxt = []
            for j in range(len(working) - 1):
                nxt.append({
                    "x": working[j]["x"] * (1 - t) + working[j + 1]["x"] * t,
                    "y": working[j]["y"] * (1 - t) + working[j + 1]["y"] * t,
                })
            working = nxt
        result.append(_构建点位(working[0]["x"], working[0]["y"]))
    return result

class OffsetEndpointCalculator:
    @staticmethod
    def 计算当前任务数量(entities: List[Dict[str, Any]]) -> int:
        return 计算图形任务的数量(entities)