import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
import matplotlib.pyplot as plt
from tkinter import Tk, filedialog
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = CURRENT_DIR.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
from core.calc_offset_ljs import OffsetEndpointCalculator
def _select_ljs_file() -> str:
    root = Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="选择 .ljs 文件",
        filetypes=[("QOMO Project", "*.ljs"), ("JSON", "*.json"), ("All Files", "*.*")],
    )
    root.destroy()
    return file_path
def _extract_entities(ljs_file: Path) -> List[Dict[str, Any]]:
    payload = json.loads(ljs_file.read_text(encoding="utf-8"))
    data = payload.get("data", {})
    entities = data.get("entities", [])
    return entities if isinstance(entities, list) else []
def visualize_points(
    points: List[List[Dict[str, float]]],
    points_base: Optional[List[List[Dict[str, float]]]] = None,
    title: str = "Offset Points",
) -> None:
    fig, ax = plt.subplots(figsize=(10, 7))
    if points_base:
        for bi, poly in enumerate(points_base):
            if not poly:
                continue
            xs_base = [p["x"] for p in poly]
            ys_base = [p["y"] for p in poly]
            lbl = "offset=0" if bi == 0 else ""
            ax.scatter(xs_base, ys_base, s=30, color="#60a5fa", label=lbl, zorder=2)
            ax.plot(xs_base, ys_base, color="#60a5fa", linewidth=1.2, linestyle="-", zorder=1)
    if points:
        idx_global = 0
        for gi, poly in enumerate(points):
            if not poly:
                continue
            xs = [p["x"] for p in poly]
            ys = [p["y"] for p in poly]
            lbl = "offset polyline" if gi == 0 else ""
            ax.scatter(xs, ys, s=34, color="#22c55e", label=lbl, zorder=4)
            ax.plot(xs, ys, color="#f472b6", linewidth=1.2, linestyle="--", zorder=3)
            for p in poly:
                ax.text(p["x"], p["y"], f" {idx_global}", fontsize=8, color="#15803d")
                idx_global += 1
    ax.set_title(title)
    ax.set_aspect("equal", adjustable="box")
    ax.grid(True, alpha=0.3)
    ax.legend(loc="best")
    plt.show()
def test_visualize_points_from_ljs() -> None:
    """
    步骤：
    1) 选择 .ljs 文件
    2) 使用 core/calc_offset_ljs.py 的计算逻辑生成点位
    3) 可视化结果（default offset 与 offset=0 对比）
    """
    ljs_path = _select_ljs_file()
    if not ljs_path:
        print("未选择文件，已取消。")
        return
    entities = _extract_entities(Path(ljs_path))
    points_base = OffsetEndpointCalculator.calc_xy_points(entities, offset=0)
    points_default = OffsetEndpointCalculator.calc_xy_points_from_ljs_file(ljs_path,offset=0.1,invert_open_direction=True)

    print(points_default)
    print(f"连通分量数: {len(points_default)}")
    print(f"读取文件: {ljs_path}")
    visualize_points(points_default,points_base, title="Offset Points From LJS")
if __name__ == "__main__":
    test_visualize_points_from_ljs()
