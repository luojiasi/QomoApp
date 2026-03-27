#!/usr/bin/env python3
import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


POINT_EPS = 1e-6
LINE_PARALLEL_EPS = 1e-9
MITER_LIMIT = 8.0
OPEN_PATH_SAMPLE_SEGMENTS = 96


@dataclass
class Point:
    x: float
    y: float

    def to_dict(self) -> Dict[str, float]:
        return {"x": self.x, "y": self.y}


def to_point(obj: Any) -> Optional[Point]:
    if not isinstance(obj, dict):
        return None
    x = obj.get("x")
    y = obj.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return None
    if not math.isfinite(x) or not math.isfinite(y):
        return None
    return Point(float(x), float(y))


def is_same_point(a: Point, b: Point, eps: float = POINT_EPS) -> bool:
    return abs(a.x - b.x) <= eps and abs(a.y - b.y) <= eps


def create_arc_points(
    center: Point,
    radius: float,
    start_angle: float,
    end_angle: float,
    segments: int = 48,
) -> List[Point]:
    sweep = end_angle - start_angle
    while sweep > 360:
        sweep -= 360
    while sweep <= -360:
        sweep += 360
    if abs(sweep) < 1e-9:
        sweep = 360 if sweep >= 0 else -360

    step = sweep / max(segments, 1)
    pts: List[Point] = []
    for i in range(segments + 1):
        ang = start_angle + step * i
        rad = math.radians(ang)
        pts.append(Point(center.x + radius * math.cos(rad), center.y + radius * math.sin(rad)))
    return pts


def evaluate_bezier_point(points: List[Point], t: float) -> Point:
    if not points:
        return Point(0.0, 0.0)
    working = [Point(p.x, p.y) for p in points]
    while len(working) > 1:
        nxt: List[Point] = []
        for i in range(len(working) - 1):
            nxt.append(
                Point(
                    working[i].x * (1 - t) + working[i + 1].x * t,
                    working[i].y * (1 - t) + working[i + 1].y * t,
                )
            )
        working = nxt
    return working[0]


def create_bezier_points(control_points: List[Point], segments: int = 64) -> List[Point]:
    if len(control_points) == 0:
        return []
    if len(control_points) == 1:
        p = control_points[0]
        return [Point(p.x, p.y)]

    safe_segments = max(2, segments)
    sampled: List[Point] = []
    for i in range(safe_segments + 1):
        t = i / safe_segments
        sampled.append(evaluate_bezier_point(control_points, t))
    return sampled


def offset_segment_by_open_direction(
    start: Point, end: Point, open_direction: str, open_size: float
) -> Tuple[Point, Point]:
    dx = end.x - start.x
    dy = end.y - start.y
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return Point(start.x, start.y), Point(end.x, end.y)

    rx = dy / length
    ry = -dx / length
    sign = -1.0 if open_direction == "RIGHT" else 1.0
    ox = rx * open_size * sign
    oy = ry * open_size * sign
    return Point(start.x + ox, start.y + oy), Point(end.x + ox, end.y + oy)


def offset_open_polyline_by_open_direction(
    points: List[Point], open_direction: str, open_size: float
) -> List[Point]:
    if len(points) < 2 or open_size < 1e-9:
        return [Point(p.x, p.y) for p in points]

    sign = -1.0 if open_direction == "RIGHT" else 1.0
    segment_normals: List[Optional[Point]] = []
    for i in range(len(points) - 1):
        p = points[i]
        q = points[i + 1]
        dx = q.x - p.x
        dy = q.y - p.y
        length = math.hypot(dx, dy)
        if length < 1e-9:
            segment_normals.append(None)
            continue
        segment_normals.append(Point((dy / length) * sign, (-dx / length) * sign))

    out: List[Point] = []
    for i, point in enumerate(points):
        candidates: List[Point] = []
        if i > 0 and segment_normals[i - 1] is not None:
            candidates.append(segment_normals[i - 1])  # type: ignore[arg-type]
        if i < len(segment_normals) and segment_normals[i] is not None:
            candidates.append(segment_normals[i])  # type: ignore[arg-type]
        if not candidates:
            out.append(Point(point.x, point.y))
            continue

        nx = sum(c.x for c in candidates)
        ny = sum(c.y for c in candidates)
        nlen = math.hypot(nx, ny)
        if nlen < 1e-9:
            fallback = candidates[0]
            out.append(Point(point.x + fallback.x * open_size, point.y + fallback.y * open_size))
            continue
        out.append(Point(point.x + (nx / nlen) * open_size, point.y + (ny / nlen) * open_size))
    return out


def intersect_lines_2d(a0: Point, a1: Point, b0: Point, b1: Point) -> Optional[Point]:
    ax = a1.x - a0.x
    ay = a1.y - a0.y
    bx = b1.x - b0.x
    by = b1.y - b0.y
    det = ax * by - ay * bx
    if abs(det) < LINE_PARALLEL_EPS:
        return None
    dx = b0.x - a0.x
    dy = b0.y - a0.y
    t = (dx * by - dy * bx) / det
    return Point(a0.x + ax * t, a0.y + ay * t)


def compute_arc_offset_radius(entity: Dict[str, Any], open_size: float) -> float:
    sweep = float(entity["endAngle"]) - float(entity["startAngle"])
    if abs(sweep) < 1e-9:
        sweep = 360 if sweep >= 0 else -360
    orientation_sign = 1.0 if sweep >= 0 else -1.0
    open_direction = str(entity.get("openDirection", "RIGHT"))
    delta_radius = -((orientation_sign if open_direction == "RIGHT" else -orientation_sign) * open_size)
    return max(1e-6, float(entity["radius"]) + delta_radius)


def get_effective_open_size(entity: Dict[str, Any], forced_offset: Optional[float]) -> float:
    if forced_offset is not None:
        return max(0.0, forced_offset)

    height = abs(float(entity.get("extrudeHeight", 0.0)))
    welding = entity.get("welding", {}) if isinstance(entity.get("welding", {}), dict) else {}
    angle_deg = welding.get("openAngle")
    if not isinstance(angle_deg, (int, float)) or not math.isfinite(angle_deg):
        return 1.0
    tan_val = math.tan(math.radians(float(angle_deg)))
    if not math.isfinite(tan_val):
        return 1.0
    return ((height + 1) * 1000 * tan_val * 2 + (height + 1) * 5 + 40) / 1000


@dataclass
class OffsetProfile:
    entity_id: str
    entity: Dict[str, Any]
    open_size: float
    original_points: List[Point]
    offset_points: List[Point]


def build_open_entity_offset_profile(
    entity: Dict[str, Any], forced_offset: Optional[float]
) -> Optional[OffsetProfile]:
    etype = str(entity.get("type", "")).upper()
    if etype not in ("LINE", "ARC", "BEZIER"):
        return None
    open_size = get_effective_open_size(entity, forced_offset)
    if open_size < 1e-9:
        return None

    if etype == "LINE":
        start = to_point(entity.get("start"))
        end = to_point(entity.get("end"))
        if not start or not end:
            return None
        off_start, off_end = offset_segment_by_open_direction(
            start, end, str(entity.get("openDirection", "RIGHT")), open_size
        )
        return OffsetProfile(
            entity_id=str(entity["id"]),
            entity=entity,
            open_size=open_size,
            original_points=[start, end],
            offset_points=[off_start, off_end],
        )

    if etype == "ARC":
        center = to_point(entity.get("center"))
        radius = entity.get("radius")
        start_angle = entity.get("startAngle")
        end_angle = entity.get("endAngle")
        if (
            not center
            or not isinstance(radius, (int, float))
            or not isinstance(start_angle, (int, float))
            or not isinstance(end_angle, (int, float))
        ):
            return None
        original = create_arc_points(
            center, float(radius), float(start_angle), float(end_angle), OPEN_PATH_SAMPLE_SEGMENTS
        )
        offset_radius = compute_arc_offset_radius(entity, open_size)
        offset = create_arc_points(
            center, offset_radius, float(start_angle), float(end_angle), OPEN_PATH_SAMPLE_SEGMENTS
        )
        if len(original) < 2 or len(offset) < 2:
            return None
        return OffsetProfile(
            entity_id=str(entity["id"]),
            entity=entity,
            open_size=open_size,
            original_points=original,
            offset_points=offset,
        )

    bez_pts_raw = entity.get("points")
    if not isinstance(bez_pts_raw, list):
        return None
    bez_pts = [to_point(p) for p in bez_pts_raw]
    bez_points = [p for p in bez_pts if p is not None]
    if len(bez_points) < 2:
        return None
    original = create_bezier_points(bez_points, OPEN_PATH_SAMPLE_SEGMENTS)
    offset = offset_open_polyline_by_open_direction(
        original, str(entity.get("openDirection", "RIGHT")), open_size
    )
    if len(original) < 2 or len(offset) < 2:
        return None
    return OffsetProfile(
        entity_id=str(entity["id"]),
        entity=entity,
        open_size=open_size,
        original_points=original,
        offset_points=offset,
    )


def get_offset_endpoint_line(profile: OffsetProfile, side: str) -> Optional[Tuple[Point, Point, Point]]:
    pts = profile.offset_points
    if len(pts) < 2:
        return None
    if side == "start":
        return pts[0], pts[1], pts[0]
    return pts[-1], pts[-2], pts[-1]


def get_original_endpoint(profile: OffsetProfile, side: str) -> Point:
    if side == "start":
        return profile.original_points[0]
    return profile.original_points[-1]


def build_open_entity_offset_overrides(
    entities: List[Dict[str, Any]], forced_offset: Optional[float]
) -> Dict[str, Dict[str, Point]]:
    profiles = [
        p
        for p in (build_open_entity_offset_profile(e, forced_offset) for e in entities)
        if p is not None
    ]
    if len(profiles) < 2:
        return {}

    overrides: Dict[str, Dict[str, Point]] = {}
    for profile in profiles:
        for side in ("start", "end"):
            joint = get_original_endpoint(profile, side)
            current_line = get_offset_endpoint_line(profile, side)
            if current_line is None:
                continue
            cur_from, cur_to, base_endpoint = current_line

            candidates: List[Tuple[OffsetProfile, str]] = []
            for other in profiles:
                if other.entity_id == profile.entity_id:
                    continue
                if is_same_point(get_original_endpoint(other, "start"), joint):
                    candidates.append((other, "start"))
                elif is_same_point(get_original_endpoint(other, "end"), joint):
                    candidates.append((other, "end"))
            if not candidates:
                continue

            best_intersection: Optional[Point] = None
            best_score = float("inf")
            for other, other_side in candidates:
                other_line = get_offset_endpoint_line(other, other_side)
                if other_line is None:
                    continue
                oth_from, oth_to, _ = other_line
                inter = intersect_lines_2d(cur_from, cur_to, oth_from, oth_to)
                if inter is None:
                    continue

                miter_distance = math.hypot(inter.x - base_endpoint.x, inter.y - base_endpoint.y)
                if miter_distance > max(profile.open_size, other.open_size) * MITER_LIMIT:
                    continue
                if miter_distance < best_score:
                    best_score = miter_distance
                    best_intersection = inter

            if best_intersection is None:
                continue
            overrides.setdefault(profile.entity_id, {})[side] = best_intersection

    return overrides


def load_ljs_entities(path: Path) -> List[Dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    payload = json.loads(text)
    data = payload.get("data", {})
    entities = data.get("entities", [])
    if not isinstance(entities, list):
        return []
    return [e for e in entities if isinstance(e, dict)]


def _build_endpoint_rows(
    entities: List[Dict[str, Any]],
    overrides: Dict[str, Dict[str, Point]],
    forced_offset: Optional[float],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for entity in entities:
        etype = str(entity.get("type", "")).upper()
        if etype not in ("LINE", "ARC", "BEZIER"):
            continue

        profile = build_open_entity_offset_profile(entity, forced_offset)
        if profile is None:
            continue
        ov = overrides.get(profile.entity_id, {})

        start_pt = Point(profile.offset_points[0].x, profile.offset_points[0].y)
        end_pt = Point(profile.offset_points[-1].x, profile.offset_points[-1].y)
        if "start" in ov:
            start_pt = ov["start"]
        if "end" in ov:
            end_pt = ov["end"]

        rows.append(
            {
                "id": profile.entity_id,
                "type": etype,
                "openDirection": str(entity.get("openDirection", "RIGHT")),
                "openSizeUsed": profile.open_size,
                "offsetEndpointStart": start_pt.to_dict(),
                "offsetEndpointEnd": end_pt.to_dict(),
                "overrideApplied": {"start": "start" in ov, "end": "end" in ov},
            }
        )

    return rows


class OffsetEndpointCalculator:
    """
    静态计算工具（不做文件导出）：
    - 输入 entities（即 .ljs 里 data.entities）
    - 返回偏移端点结果
    """

    @staticmethod
    def calc_endpoint_rows(
        entities: List[Dict[str, Any]], offset: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        返回每个开放实体（LINE/ARC/BEZIER）的偏移端点信息。
        每一项包含：
        - id/type/openSizeUsed
        - offsetEndpointStart/offsetEndpointEnd
        """
        overrides = build_open_entity_offset_overrides(entities, offset)
        return _build_endpoint_rows(entities, overrides, offset)

    @staticmethod
    def calc_xy_points(
        entities: List[Dict[str, Any]], offset: Optional[float] = None
    ) -> List[Dict[str, float]]:
        """
        返回纯 xy 字典数组（你要的格式）。
        顺序：按实体遍历，依次 push start、end 两个点。
        例如：[{x,y}, {x,y}, {x,y}, ...]
        """
        rows = OffsetEndpointCalculator.calc_endpoint_rows(entities, offset)
        points: List[Dict[str, float]] = []
        for row in rows:
            start = row["offsetEndpointStart"]
            end = row["offsetEndpointEnd"]
            points.append({"x": float(start["x"]), "y": float(start["y"])})
            points.append({"x": float(end["x"]), "y": float(end["y"])})
        return points

    @staticmethod
    def calc_xy_points_from_ljs_file(
        ljs_path: str, offset: Optional[float] = None
    ) -> List[Dict[str, float]]:
        """
        便捷方法：直接传 .ljs 文件路径，返回 [{x,y}, ...]。
        """
        entities = load_ljs_entities(Path(ljs_path).expanduser().resolve())
        return OffsetEndpointCalculator.calc_xy_points(entities, offset)


def _demo_entities() -> List[Dict[str, Any]]:
    """内置测试数据：LINE -> ARC -> BEZIER 连续连接。"""
    return [
        {
            "id": "demo-line-1",
            "type": "LINE",
            "openDirection": "RIGHT",
            "start": {"x": 0.0, "y": 0.0},
            "end": {"x": 40.0, "y": 0.0},
            "extrudeHeight": 5,
            "welding": {"openAngle": 0.54},
        },
        {
            "id": "demo-arc-1",
            "type": "ARC",
            "openDirection": "RIGHT",
            "center": {"x": 40.0, "y": 20.0},
            "radius": 20.0,
            "startAngle": -90.0,
            "endAngle": -20.0,
            "extrudeHeight": 5,
            "welding": {"openAngle": 0.54},
        },
        {
            "id": "demo-bezier-1",
            "type": "BEZIER",
            "openDirection": "RIGHT",
            "points": [
                {"x": 58.793852, "y": 13.159598},  # 与 ARC 终点对接
                {"x": 75.0, "y": 25.0},
                {"x": 92.0, "y": 0.0},
                {"x": 110.0, "y": 10.0},
            ],
            "extrudeHeight": 5,
            "welding": {"openAngle": 0.54},
        },
    ]


def _profile_from_entity_for_plot(
    entity: Dict[str, Any], forced_offset: Optional[float]
) -> Optional[OffsetProfile]:
    return build_open_entity_offset_profile(entity, forced_offset)


def run_demo_test(
    offset: float = 1.2,
    show_plot: bool = True,
    save_fig: Optional[str] = None,
) -> Dict[str, Any]:
    """
    测试方法：返回结果并可视化。
    - 返回：xy 数组 + 详细 rows
    - 可选：弹窗展示图像 / 保存图片
    """
    entities = _demo_entities()
    overrides = build_open_entity_offset_overrides(entities, offset)
    rows = _build_endpoint_rows(entities, overrides, offset)
    xy = OffsetEndpointCalculator.calc_xy_points(entities, offset)

    if show_plot or save_fig:
        try:
            import matplotlib.pyplot as plt
        except Exception as exc:
            return {
                "rows": rows,
                "xy": xy,
                "plotError": f"matplotlib 不可用: {exc}",
            }

        fig, ax = plt.subplots(figsize=(9, 6))
        ax.set_title("Offset Endpoint Demo (LINE-ARC-BEZIER)")
        ax.set_aspect("equal", adjustable="box")
        ax.grid(True, alpha=0.3)

        # 画原始轮廓和偏移轮廓
        for entity in entities:
            profile = _profile_from_entity_for_plot(entity, offset)
            if profile is None:
                continue

            ox = [p.x for p in profile.original_points]
            oy = [p.y for p in profile.original_points]
            ax.plot(ox, oy, color="#7dd3fc", linewidth=2.0, label="original")

            px = [p.x for p in profile.offset_points]
            py = [p.y for p in profile.offset_points]
            ax.plot(px, py, color="#f9a8d4", linewidth=1.8, linestyle="--", label="offset raw")

            ov = overrides.get(profile.entity_id, {})
            start_p = ov.get("start", profile.offset_points[0])
            end_p = ov.get("end", profile.offset_points[-1])
            ax.scatter(
                [start_p.x, end_p.x],
                [start_p.y, end_p.y],
                s=50,
                color="#22c55e",
                zorder=5,
            )
            ax.text(start_p.x, start_p.y, f" {profile.entity_id}:S", fontsize=8, color="#16a34a")
            ax.text(end_p.x, end_p.y, f" {profile.entity_id}:E", fontsize=8, color="#16a34a")

        # 去重图例
        handles, labels = ax.get_legend_handles_labels()
        uniq = {}
        for h, l in zip(handles, labels):
            if l not in uniq:
                uniq[l] = h
        ax.legend(uniq.values(), uniq.keys(), loc="best")

        if save_fig:
            out = Path(save_fig).expanduser().resolve()
            out.parent.mkdir(parents=True, exist_ok=True)
            fig.savefig(out, dpi=160, bbox_inches="tight")

        if show_plot:
            plt.show()
        else:
            plt.close(fig)

    return {"rows": rows, "xy": xy}


def run_ljs_test(
    ljs_path: str,
    offset: Optional[float] = None,
    show_plot: bool = True,
    save_fig: Optional[str] = None,
) -> Dict[str, Any]:
    """
    真实文件测试：读取 .ljs，计算并可视化原始/偏移/修正端点。
    """
    entities = load_ljs_entities(Path(ljs_path).expanduser().resolve())
    overrides = build_open_entity_offset_overrides(entities, offset)
    rows = _build_endpoint_rows(entities, overrides, offset)
    xy = OffsetEndpointCalculator.calc_xy_points(entities, offset)

    if show_plot or save_fig:
        try:
            import matplotlib.pyplot as plt
        except Exception as exc:
            return {"rows": rows, "xy": xy, "plotError": f"matplotlib 不可用: {exc}"}

        fig, ax = plt.subplots(figsize=(10, 7))
        ax.set_title("Offset Endpoint Test From LJS")
        ax.set_aspect("equal", adjustable="box")
        ax.grid(True, alpha=0.3)

        plotted_label = {"original": False, "offset_raw": False, "override_point": False}

        for entity in entities:
            profile = _profile_from_entity_for_plot(entity, offset)
            if profile is None:
                continue

            # 原始轮廓
            ox = [p.x for p in profile.original_points]
            oy = [p.y for p in profile.original_points]
            ax.plot(
                ox,
                oy,
                color="#60a5fa",
                linewidth=1.6,
                label="original" if not plotted_label["original"] else "",
            )
            plotted_label["original"] = True

            # 原始偏移轮廓
            px = [p.x for p in profile.offset_points]
            py = [p.y for p in profile.offset_points]
            ax.plot(
                px,
                py,
                color="#f472b6",
                linewidth=1.3,
                linestyle="--",
                label="offset raw" if not plotted_label["offset_raw"] else "",
            )
            plotted_label["offset_raw"] = True

            # 修正端点（有 override 才高亮）
            ov = overrides.get(profile.entity_id, {})
            for side in ("start", "end"):
                if side not in ov:
                    continue
                p = ov[side]
                ax.scatter(
                    [p.x],
                    [p.y],
                    s=32,
                    color="#22c55e",
                    zorder=6,
                    label="override endpoint" if not plotted_label["override_point"] else "",
                )
                plotted_label["override_point"] = True

        handles, labels = ax.get_legend_handles_labels()
        pairs = [(h, l) for h, l in zip(handles, labels) if l]
        if pairs:
            ax.legend([p[0] for p in pairs], [p[1] for p in pairs], loc="best")

        if save_fig:
            out = Path(save_fig).expanduser().resolve()
            out.parent.mkdir(parents=True, exist_ok=True)
            fig.savefig(out, dpi=160, bbox_inches="tight")

        if show_plot:
            plt.show()
        else:
            plt.close(fig)

    return {"rows": rows, "xy": xy}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compute offset endpoints for LINE/ARC/BEZIER from QOMO .ljs."
    )
    parser.add_argument("input_ljs", nargs="?", help="Path to .ljs file")
    parser.add_argument(
        "--offset",
        type=float,
        default=None,
        help="Force all open entities use this offset value. If omitted, use frontend openAngle formula.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path. Default: <input>.offset-endpoints.json",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Run built-in LINE-ARC-BEZIER demo test",
    )
    parser.add_argument(
        "--plot",
        action="store_true",
        help="Show matplotlib figure (works with --demo)",
    )
    parser.add_argument(
        "--save-fig",
        default=None,
        help="Save figure image path (works with --demo)",
    )
    parser.add_argument(
        "--plot-ljs",
        action="store_true",
        help="Plot using real input_ljs data (not demo)",
    )
    args = parser.parse_args()

    if args.demo:
        result = run_demo_test(
            offset=args.offset if args.offset is not None else 1.2,
            show_plot=args.plot,
            save_fig=args.save_fig,
        )
        # demo 模式仅打印结果，不写文件
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    if not args.input_ljs:
        raise ValueError("input_ljs is required unless --demo is used")

    if args.plot_ljs:
        result = run_ljs_test(
            ljs_path=args.input_ljs,
            offset=args.offset,
            show_plot=args.plot,
            save_fig=args.save_fig,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    input_path = Path(args.input_ljs).expanduser().resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    entities = load_ljs_entities(input_path)
    rows = OffsetEndpointCalculator.calc_endpoint_rows(entities, args.offset)
    result = {"count": len(rows), "rows": rows}

    output_path = (
        Path(args.output).expanduser().resolve()
        if args.output
        else input_path.with_suffix(".offset-endpoints.json")
    )
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Done. Wrote: {output_path}")
    print(f"Computed rows: {result['count']}")


if __name__ == "__main__":
    main()

