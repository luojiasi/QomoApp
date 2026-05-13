"""几何辅助函数 —— 从 ``core/startPragram.py`` 提取的纯计算逻辑。

无副作用，不依赖任何 service 或硬件。
"""

from __future__ import annotations

import math
from typing import Any


def 判断是否都是圆或者圆弧(*, 实体数据: Any) -> bool:
    """校验 实体数据 中每个实体的 type 是否都属于「圆 / 圆弧」。"""
    if not isinstance(实体数据, (list, tuple)) or len(实体数据) == 0:
        return False

    allowed_types = {"CIRCLE", "ARC", "圆", "圆弧"}
    for entity in 实体数据:
        if not isinstance(entity, dict):
            return False
        实体类型 = str(entity.get("type", "")).strip()
        if not 实体类型:
            return False
        if 实体类型.upper() not in {"CIRCLE", "ARC"} and 实体类型 not in allowed_types:
            return False
    return True


def 判断当前图形是否闭合(点位: list[dict[str, Any]], *, 误差: float = 0.001) -> bool:
    """判断点位序列的起点和终点是否在误差范围内重合。"""
    if not 点位:
        return False
    起始点, 结束点 = 点位[0], 点位[-1]
    return (
        abs(float(起始点["x"]) - float(结束点["x"])) <= 误差
        and abs(float(起始点["y"]) - float(结束点["y"])) <= 误差
    )


def 重建从当前位置的XY路径(
    *,
    原始运行点位: list[dict[str, Any]],
    当前X: float,
    当前Y: float,
) -> list[dict[str, Any]]:
    """根据当前实际 XY 位置，找到原始路径上最近的点，返回从该点之后的路径。

    原函数名：``_rebuild_xy_path_from_current``
    """
    转换点: list[tuple[float, float]] = []
    for p in 原始运行点位:
        if isinstance(p, dict):
            转换点.append((float(p["x"]), float(p["y"])))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            转换点.append((float(p[0]), float(p[1])))
        else:
            continue
    if not 转换点:
        return [{"x": 当前X, "y": 当前Y}, {"x": 当前X, "y": 当前Y}]

    最佳索引 = 0
    最小距离 = float("inf")
    for i, (x, y) in enumerate(转换点):
        d = math.hypot(x - 当前X, y - 当前Y)
        if d < 最小距离:
            最小距离 = d
            最佳索引 = i

    剩余点 = [{"x": x, "y": y} for x, y in 转换点[最佳索引 + 1:]]
    头部点 = [{"x": 当前X, "y": 当前Y}]
    if not 剩余点:
        return 头部点 + [{"x": 转换点[最佳索引][0], "y": 转换点[最佳索引][1]}]
    return 头部点 + 剩余点


def 计算开口范围(
    *,
    高度: float,
    下开口K: float,
    下开口B: float,
    深度补偿K: float,
    深度补偿B: float,
    正切角度: float,
) -> tuple[float, float]:
    """计算下开口值和上开口值（单位：mm）。"""
    下开口值 = 下开口K * 高度 + 下开口B
    上开口值 = 深度补偿K * 1000 * (高度 + 深度补偿B) * 正切角度 + 下开口值
    return 下开口值, 上开口值


def 更新V型开口偏移(
    *,
    上开口值: float,
    正切角度: float,
    累计下降量: float,
) -> tuple[float, float]:
    """V 型开口：根据累计下降量重新计算最小/最大偏移。"""
    新扫描长度 = 上开口值 - 正切角度 * 累计下降量 * 2 * 1000
    扫描长度差值 = (上开口值 - 新扫描长度) / 2
    return round(扫描长度差值, 6), round(上开口值 - 扫描长度差值, 6)


def 更新平行型开口偏移(
    *,
    上开口值: float,
    正切角度: float,
    累计下降量: float,
) -> tuple[float, float]:
    """平行型（// 或 ||）开口：最小偏移随深度增加，最大偏移 = 最小 + 上开口值。"""
    最小偏移 = 正切角度 * 累计下降量 * 2 * 1000
    最大偏移 = 最小偏移 + 上开口值
    return 最小偏移, 最大偏移
