"""输入 XY 坐标并在浏览器中展示点位（测试用）。

用法：
  python QomoTech_BackEnd/test/plot_xy_points.py

每行一个点，空行结束。也可整段粘贴 Python 元组列表。支持格式：
  1.2 3.4
  1.2, 3.4
  (1.2, 3.4)
  [(1.0, 0.0), (0.995974, 0.089639), ...]
  [{'X': 110.1284, 'Y': -139.317, 'Z': -38.2809}, ...]  （忽略 Z）

也可直接传入点列：
  python QomoTech_BackEnd/test/plot_xy_points.py --points "1,2; 3,4; 5,6"
"""

from __future__ import annotations

import argparse
import ast
import json
import math
import re
import webbrowser
from pathlib import Path

数字 = r"[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?"
行解析 = re.compile(
    r"^\s*[\(\[\{]?\s*"
    + f"({数字})"
    + r"\s*[,，\s]\s*"
    + f"({数字})"
    + r"\s*[\)\]\}]?\s*$"
)
逗号对 = re.compile(f"({数字})" + r"\s*[,，]\s*" + f"({数字})")


def 提取全部坐标(文本: str) -> list[tuple[float, float]]:
    return [(float(x), float(y)) for x, y in 逗号对.findall(文本)]


def 从项取XY(项: object) -> tuple[float, float] | None:
    if isinstance(项, dict):
        x = 项.get("X", 项.get("x"))
        y = 项.get("Y", 项.get("y"))
        if x is None or y is None:
            return None
        return float(x), float(y)
    if isinstance(项, (list, tuple)) and len(项) >= 2:
        return float(项[0]), float(项[1])
    return None


def 解析字面量点列(文本: str) -> list[tuple[float, float]] | None:
    待解析 = 文本.strip()
    起 = 待解析.find("[")
    止 = 待解析.rfind("]")
    if 起 < 0 or 止 <= 起:
        return None
    try:
        值 = ast.literal_eval(待解析[起 : 止 + 1])
    except (ValueError, SyntaxError):
        return None
    if not isinstance(值, (list, tuple)):
        return None
    点列: list[tuple[float, float]] = []
    for 项 in 值:
        xy = 从项取XY(项)
        if xy is not None:
            点列.append(xy)
    return 点列 or None


def 解析一行(行: str) -> tuple[float, float] | None:
    文本 = 行.strip()
    if not 文本 or 文本.startswith("#"):
        return None
    m = 行解析.match(文本)
    if not m:
        raise ValueError(
            f"无法解析坐标：{行!r}（期望  x y  /  (x, y)  /  [(x, y), ...]  /  [{{'X':..,'Y':..}}, ...]）"
        )
    return float(m.group(1)), float(m.group(2))


def 解析点串(文本: str) -> list[tuple[float, float]]:
    字面量 = 解析字面量点列(文本)
    if 字面量:
        return 字面量
    点列 = 提取全部坐标(文本)
    if 点列 and ("X" not in 文本 and "x" not in 文本):
        return 点列
    点列 = []
    for 块 in re.split(r"[;\n]+", 文本):
        try:
            点 = 解析一行(块)
        except ValueError:
            再试 = 解析字面量点列(块) or 解析字面量点列(文本)
            if 再试:
                return 再试
            raise
        if 点 is not None:
            点列.append(点)
    return 点列


def 从终端读取() -> list[tuple[float, float]]:
    print("请输入 XY 坐标，每行一个点，空行结束。")
    print("也可整段粘贴：[(1.0, 0.0), ...]  或  [{'X': 1, 'Y': 2, 'Z': 3}, ...]（忽略 Z）")
    print()
    点列: list[tuple[float, float]] = []
    列表缓冲: list[str] = []
    while True:
        提示 = "  ... " if 列表缓冲 else f"  [{len(点列) + 1}] "
        try:
            行 = input(提示).strip()
        except EOFError:
            print()
            break
        if 列表缓冲:
            列表缓冲.append(行)
            if "]" in 行 or not 行:
                点列 = 解析点串("\n".join(列表缓冲))
                print(f"      -> 解析 {len(点列)} 个点")
                break
            continue
        if not 行:
            break
        if 行.startswith("[") and "]" not in 行:
            列表缓冲 = [行]
            continue
        多点 = 解析点串(行) if 行.startswith("[") or 行.startswith("{") else 提取全部坐标(行)
        if 行.startswith("[") or 行.startswith("{") or len(多点) >= 2:
            点列 = 多点
            print(f"      -> 解析 {len(点列)} 个点")
            break
        try:
            点 = 解析一行(行)
        except ValueError as e:
            print(f"  {e}")
            continue
        if 点 is not None:
            点列.append(点)
            print(f"      -> ({点[0]:.6g}, {点[1]:.6g})")
    return 点列


def 包围盒(点列: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in 点列]
    ys = [p[1] for p in 点列]
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    宽 = max(xmax - xmin, 1e-9)
    高 = max(ymax - ymin, 1e-9)
    边 = max(宽, 高)
    边距 = 边 * 0.12 if 边 > 1e-6 else 1.0
    if 边 <= 1e-6:
        边 = 2.0
        边距 = 0.4
        cx = xmin
        cy = ymin
        return cx - 边 / 2 - 边距, cy - 边 / 2 - 边距, 边 + 2 * 边距, 边 + 2 * 边距
    cx = (xmin + xmax) / 2
    cy = (ymin + ymax) / 2
    边 = 边 + 2 * 边距
    return cx - 边 / 2, cy - 边 / 2, 边, 边


HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>XY 点位</title>
<style>
  :root { --bg:#0f1115; --panel:#181b22; --text:#e7eaf0; --muted:#8b93a5; --border:#2a2f3a; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
    background:var(--bg); color:var(--text); height:100vh; display:flex; flex-direction:column; }
  header { padding:12px 16px; border-bottom:1px solid var(--border); display:flex; gap:16px; flex-wrap:wrap; align-items:center; }
  h1 { font-size:16px; margin:0; }
  .sub { color:var(--muted); font-size:12px; margin:4px 0 0; }
  .ctrl { display:flex; gap:12px; flex-wrap:wrap; align-items:center; font-size:12px; color:var(--muted); }
  .ctrl label { display:flex; align-items:center; gap:4px; }
  .main { flex:1; min-height:0; display:grid; grid-template-columns:1fr 280px; }
  svg { width:100%; height:100%; background:#0a0c10; }
  .dot { cursor:pointer; }
  .tip { position:fixed; z-index:10; pointer-events:none; display:none;
    background:#1e293b; color:#e7eaf0; border:1px solid #334155; border-radius:6px;
    padding:6px 8px; font-size:12px; font-variant-numeric:tabular-nums;
    font-family:ui-monospace,monospace; white-space:nowrap; }
  aside { border-left:1px solid var(--border); overflow:auto; padding:12px; font-size:12px; background:var(--panel); }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:3px 4px; border-bottom:1px solid var(--border); font-variant-numeric:tabular-nums; }
  th { color:var(--muted); font-weight:600; position:sticky; top:0; background:var(--panel); }
  tr.active { background:#1e3a5f; }
  tr { cursor:pointer; }
  .stat { margin:0 0 10px; line-height:1.55; color:var(--muted); }
  .stat b { color:var(--text); }
</style>
</head>
<body>
<header>
  <div>
    <h1>XY 点位</h1>
    <p class="sub">Y 向上 · 绿点=起点 · 粉点=终点 · 点击点或表格行可高亮</p>
  </div>
  <div class="ctrl">
    <label><input type="checkbox" id="showLine" checked /> 连线</label>
    <label><input type="checkbox" id="showIndex" checked /> 点号</label>
    <label><input type="checkbox" id="showAxes" checked /> 坐标轴</label>
  </div>
</header>
<div class="main">
  <svg id="svg" viewBox="__VIEWBOX__"></svg>
  <div class="tip" id="tip"></div>
  <aside>
    <p class="stat" id="stats"></p>
    <table>
      <thead><tr><th>#</th><th>X</th><th>Y</th></tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </aside>
</div>
<script>
const POINTS = __DATA__;
const svg = document.getElementById("svg");
const tip = document.getElementById("tip");
const NS = "http://www.w3.org/2000/svg";
let active = -1;

function showTip(ev, p) {
  tip.style.display = "block";
  tip.textContent = `X=${p.x}  Y=${p.y}`;
  tip.style.left = (ev.clientX + 12) + "px";
  tip.style.top = (ev.clientY + 12) + "px";
}
function hideTip() {
  tip.style.display = "none";
}

function el(name, attrs) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
function strokeW() {
  const vb = svg.viewBox.baseVal;
  return Math.max(vb.width, vb.height) * 0.004;
}
function render() {
  const w = strokeW();
  svg.replaceChildren();
  const vb = svg.viewBox.baseVal;
  if (document.getElementById("showAxes").checked) {
    svg.appendChild(el("line", { x1: String(vb.x), y1:"0", x2: String(vb.x + vb.width), y2:"0", stroke:"#2a2f3a", "stroke-width": String(w) }));
    svg.appendChild(el("line", { x1:"0", y1: String(-vb.y - vb.height), x2:"0", y2: String(-vb.y), stroke:"#2a2f3a", "stroke-width": String(w) }));
    svg.appendChild(el("circle", { cx:"0", cy:"0", r: String(w * 1.6), fill:"#e7eaf0" }));
  }
  if (document.getElementById("showLine").checked && POINTS.length >= 2) {
    const pts = POINTS.map((p) => `${p.x},${-p.y}`).join(" ");
    svg.appendChild(el("polyline", { points: pts, fill:"none", stroke:"#3b82f6", "stroke-width": String(w * 1.6) }));
  }
  const showIndex = document.getElementById("showIndex").checked;
  const tbody = document.getElementById("tbody");
  tbody.replaceChildren();
  POINTS.forEach((p, i) => {
    const fill = i === 0 ? "#4dd8a8" : i === POINTS.length - 1 ? "#f472b6" : "#3b82f6";
    const c = el("circle", {
      class: "dot" + (i === active ? " active" : ""),
      cx: String(p.x), cy: String(-p.y),
      r: String(w * (i === 0 || i === POINTS.length - 1 ? 2.8 : 2.0)),
      fill
    });
    c.addEventListener("click", () => { active = i; render(); });
    c.addEventListener("mousemove", (ev) => showTip(ev, p));
    c.addEventListener("mouseenter", (ev) => showTip(ev, p));
    c.addEventListener("mouseleave", hideTip);
    svg.appendChild(c);
    if (showIndex) {
      svg.appendChild(el("text", {
        x: String(p.x + w * 3), y: String(-p.y - w * 3),
        fill: "#cbd5e1", "font-size": String(w * 5), "font-family":"ui-monospace,monospace"
      })).textContent = String(i);
    }
    const tr = document.createElement("tr");
    if (i === active) tr.className = "active";
    tr.innerHTML = `<td>${i}</td><td>${p.x}</td><td>${p.y}</td>`;
    tr.addEventListener("click", () => { active = i; render(); });
    tbody.appendChild(tr);
  });
  const xs = POINTS.map((p) => p.x);
  const ys = POINTS.map((p) => p.y);
  let path = 0;
  for (let i = 1; i < POINTS.length; i++) {
    const dx = POINTS[i].x - POINTS[i-1].x;
    const dy = POINTS[i].y - POINTS[i-1].y;
    path += Math.hypot(dx, dy);
  }
  document.getElementById("stats").innerHTML =
    `点数 <b>${POINTS.length}</b><br>` +
    `X [${Math.min(...xs).toFixed(4)}, ${Math.max(...xs).toFixed(4)}]<br>` +
    `Y [${Math.min(...ys).toFixed(4)}, ${Math.max(...ys).toFixed(4)}]<br>` +
    (POINTS.length >= 2 ? `折线长 <b>${path.toFixed(4)}</b>` : "");
}
["showLine","showIndex","showAxes"].forEach((id) => {
  document.getElementById(id).addEventListener("change", render);
});
render();
</script>
</body>
</html>
"""


def 写出并打开(点列: list[tuple[float, float]]) -> Path:
    xmin, ymin, 宽, 高 = 包围盒(点列)
    # SVG Y 向下，点绘制时取 -y，viewBox 用翻转后的范围
    viewbox = f"{xmin:.6g} {-ymin - 高:.6g} {宽:.6g} {高:.6g}"
    data = [{"x": x, "y": y} for x, y in 点列]
    html = HTML.replace("__VIEWBOX__", viewbox).replace(
        "__DATA__", json.dumps(data, ensure_ascii=False)
    )
    html_path = Path(__file__).with_name("plot_xy_points.html")
    html_path.write_text(html, encoding="utf-8")
    webbrowser.open(html_path.as_uri())
    return html_path


def 打印摘要(点列: list[tuple[float, float]]) -> None:
    print()
    print(f"共 {len(点列)} 个点：")
    for i, (x, y) in enumerate(点列):
        print(f"  [{i}]  X={x:.6g}  Y={y:.6g}")
    if len(点列) >= 2:
        长 = sum(
            math.hypot(点列[i][0] - 点列[i - 1][0], 点列[i][1] - 点列[i - 1][1])
            for i in range(1, len(点列))
        )
        print(f"折线长 = {长:.6g}")


def main() -> None:
    parser = argparse.ArgumentParser(description="输入 XY 坐标并展示点位")
    parser.add_argument(
        "--points",
        help='点列，例如 "1,2; 3,4; 5,6"',
    )
    args = parser.parse_args()

    if args.points:
        点列 = 解析点串(args.points)
    else:
        点列 = 从终端读取()

    if not 点列:
        print("没有有效点，退出。")
        return

    打印摘要(点列)
    html_path = 写出并打开(点列)
    print(f"已写出 {html_path}")


if __name__ == "__main__":
    main()
