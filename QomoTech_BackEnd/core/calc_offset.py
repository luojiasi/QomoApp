"""新编辑器实体格式的偏移计算模块。

与 calc_offset_ljs.py 对应，但适配新前端 entitiesEditor 的实体格式：
- kind 替代 type
- 坐标使用大写 X/Y
- openSide 替代 openDirection
- controlPoints 替代 points（贝塞尔）
- 新增 POLYLINE（含 bulge）、DIAMOND（含 contours）
"""
from typing import Any, Dict, List, Optional, Set


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



class OffsetEndpointCalculator:
    @staticmethod
    def 计算当前任务数量(entities: List[Dict[str, Any]]) -> int:
        return 计算图形任务的数量(entities)
