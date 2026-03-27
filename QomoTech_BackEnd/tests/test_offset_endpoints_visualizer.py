import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import matplotlib.pyplot as plt
from tkinter import Tk, filedialog, simpledialog

CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = CURRENT_DIR.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core.calc_offset_endpoints import OffsetEndpointCalculator


def _extract_entities(ljs_file: Path) -> List[Dict[str, Any]]:
    payload = json.loads(ljs_file.read_text(encoding="utf-8"))
    data = payload.get("data", {})
    entities = data.get("entities", [])
    return entities if isinstance(entities, list) else []


def _extract_original_points(entities: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    original: List[Dict[str, float]] = []
    for entity in entities:
        etype = str(entity.get("type", "")).upper()
        if etype == "LINE":
            s = entity.get("start")
            e = entity.get("end")
            if isinstance(s, dict) and isinstance(e, dict):
                if isinstance(s.get("x"), (int, float)) and isinstance(s.get("y"), (int, float)):
                    original.append({"x": float(s["x"]), "y": float(s["y"])})
                if isinstance(e.get("x"), (int, float)) and isinstance(e.get("y"), (int, float)):
                    original.append({"x": float(e["x"]), "y": float(e["y"])})
        elif etype == "ARC":
            sp = entity.get("startPoint")
            ep = entity.get("endPoint")
            if isinstance(sp, dict) and isinstance(sp.get("x"), (int, float)) and isinstance(
                sp.get("y"), (int, float)
            ):
                original.append({"x": float(sp["x"]), "y": float(sp["y"])})
            if isinstance(ep, dict) and isinstance(ep.get("x"), (int, float)) and isinstance(
                ep.get("y"), (int, float)
            ):
                original.append({"x": float(ep["x"]), "y": float(ep["y"])})
        elif etype == "BEZIER":
            pts = entity.get("points")
            if isinstance(pts, list):
                for p in pts:
                    if (
                        isinstance(p, dict)
                        and isinstance(p.get("x"), (int, float))
                        and isinstance(p.get("y"), (int, float))
                    ):
                        original.append({"x": float(p["x"]), "y": float(p["y"])})
    return original


def visualize_points(points: List[Dict[str, float]], original_points: List[Dict[str, float]]) -> None:
    fig, ax = plt.subplots(figsize=(10, 7))
    if original_points:
        ox = [p["x"] for p in original_points]
        oy = [p["y"] for p in original_points]
        ax.scatter(ox, oy, s=24, color="#60a5fa", alpha=0.8, label="original points")
        ax.plot(ox, oy, color="#60a5fa", linewidth=1.0, alpha=0.6, label="original polyline")
    if points:
        xs = [p["x"] for p in points]
        ys = [p["y"] for p in points]
        ax.scatter(xs, ys, s=30, color="#22c55e", label="offset points")
        ax.plot(xs, ys, color="#f472b6", linewidth=1.2, linestyle="--", label="polyline")
        for idx, p in enumerate(points):
            ax.text(p["x"], p["y"], f" {idx}", fontsize=8, color="#16a34a")
    ax.set_title("Offset Points Visualizer")
    ax.set_aspect("equal", adjustable="box")
    ax.grid(True, alpha=0.3)
    ax.legend(loc="best")
    plt.show()


def test_visualizer_window(offset: Optional[float] = None) -> None:
    """
    只做三件事：
    1) 选 .ljs 文件
    2) 调 core 静态方法拿 points
    3) 用 plt 画出来
    """
    root = Tk()
    root.withdraw()

    file_path = filedialog.askopenfilename(
        title="选择 QOMO .ljs 文件",
        filetypes=[("QOMO Project", "*.ljs"), ("JSON", "*.json"), ("All Files", "*.*")],
    )
    if not file_path:
        print("未选择文件，已取消。")
        return

    if offset is None:
        offset_input = simpledialog.askstring(
            "输入 offset",
            "请输入 offset 数值（留空则按前端 openAngle 公式）：",
            parent=root,
        )
        if offset_input and offset_input.strip() != "":
            offset = float(offset_input.strip())

    entities = _extract_entities(Path(file_path))
    original_points = _extract_original_points(entities)
    points = OffsetEndpointCalculator.calc_xy_points(entities, offset=offset)
    print(points)
    print(f"计算完成，返回点数量: {len(points)}")
    visualize_points(points, original_points)


if __name__ == "__main__":
    test_visualizer_window()

