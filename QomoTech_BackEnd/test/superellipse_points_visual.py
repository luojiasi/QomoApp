"""垫型超椭圆点位可视化（测试用）。

调用 geometry 现有函数：
  采样超椭圆弧 / 转到右侧切割面 / 按开口等距偏移插补点 / 圆弧采样点数

四分一起止角与前端 TEN_PLUS_CUSHION_QUARTERS 一致。
运行后写出同目录 HTML 并尝试打开浏览器。

  python QomoTech_BackEnd/test/superellipse_points_visual.py
"""

from __future__ import annotations

import json
import math
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.program_control_ten.geometry import (  # noqa: E402
    圆弧采样点数,
    按开口等距偏移插补点,
    采样超椭圆弧,
    转到右侧切割面,
)

# 与前端 constants/shapePreset.ts 的 TEN_PLUS_CUSHION_QUARTERS 一致
四分之一弧 = (
    (-45.0, 45.0),
    (45.0, 135.0),
    (135.0, 225.0),
    (225.0, 315.0),
)
段颜色 = ("#3b82f6", "#f97316", "#f97316", "#f97316")
闭合误差 = 0.001

# 与前端快捷形状默认值一致
默认半长 = 2.0  # length 4 / 2
默认半宽 = 2.0
默认指数 = 1.5
默认开口 = 0.38


def 点列转列表(点列: list[tuple[float, float]]) -> list[dict[str, float]]:
    return [{"x": round(x, 6), "y": round(y, 6)} for x, y in 点列]


def 是否闭合(点列: list[tuple[float, float]]) -> bool:
    if len(点列) < 2:
        return False
    x0, y0 = 点列[0]
    x1, y1 = 点列[-1]
    return abs(x0 - x1) <= 闭合误差 and abs(y0 - y1) <= 闭合误差


def 首尾距离(点列: list[tuple[float, float]]) -> float:
    if len(点列) < 2:
        return 0.0
    return math.hypot(点列[0][0] - 点列[-1][0], 点列[0][1] - 点列[-1][1])


def 采集(半长: float, 半宽: float, 指数: float, 开口: float) -> dict:
    轮廓 = 采样超椭圆弧(半长, 半宽, 指数, 0.0, 360.0, 360)
    段列表 = []
    for i, (起, 止) in enumerate(四分之一弧):
        工件 = 采样超椭圆弧(半长, 半宽, 指数, 起, 止, 圆弧采样点数)
        法线 = (起 + 止) / 2.0
        右侧 = 转到右侧切割面(工件, 法线)
        插补 = [{"X": x, "Y": y} for x, y in 右侧]
        偏移 = 按开口等距偏移插补点(插补, 开口值=开口, 是否反向=False)
        段列表.append(
            {
                "index": i,
                "start": 起,
                "end": 止,
                "normal": 法线,
                "color": 段颜色[i],
                "work": 点列转列表(工件),
                "right": 点列转列表(右侧),
                "offset": [{"x": p["x"], "y": p["y"]} for p in 偏移],
                "closedWork": 是否闭合(工件),
                "gapWork": round(首尾距离(工件), 6),
                "closedRight": 是否闭合(右侧),
                "gapRight": round(首尾距离(右侧), 6),
            }
        )

    拼接 = [p for 段 in 段列表 for p in [(q["x"], q["y"]) for q in 段["work"]]]
    q0s, q3e = 段列表[0]["work"][0], 段列表[-1]["work"][-1]
    角点缝 = math.hypot(q0s["x"] - q3e["x"], q0s["y"] - q3e["y"])

    return {
        "a": 半长,
        "b": 半宽,
        "n": 指数,
        "openSize": 开口,
        "sampleCount": 圆弧采样点数,
        "closeEps": 闭合误差,
        "outline": 点列转列表(轮廓),
        "outlineClosed": 是否闭合(轮廓),
        "outlineGap": round(首尾距离(轮廓), 6),
        "quarters": 段列表,
        "concatClosed": 是否闭合(拼接),
        "concatGap": round(首尾距离(拼接), 6),
        "cornerJoin": round(角点缝, 6),
    }


HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>超椭圆采样点（后端 geometry）</title>
<style>
  :root { --bg:#0f1115; --panel:#181b22; --text:#e7eaf0; --muted:#8b93a5; --border:#2a2f3a; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
    background:var(--bg); color:var(--text); height:100vh; display:flex; flex-direction:column; }
  header { padding:12px 16px; border-bottom:1px solid var(--border); display:flex; gap:16px; flex-wrap:wrap; align-items:center; }
  h1 { font-size:16px; margin:0; }
  .sub { color:var(--muted); font-size:12px; }
  .ctrl { display:flex; gap:12px; flex-wrap:wrap; align-items:center; font-size:12px; color:var(--muted); }
  .ctrl label { display:flex; align-items:center; gap:4px; }
  .main { flex:1; min-height:0; display:grid; grid-template-columns:1fr 340px; }
  svg { width:100%; height:100%; background:#0a0c10; }
  .dot { cursor:pointer; }
  .dot:hover, .dot.active { stroke:#fff; stroke-width:1.5; }
  aside { border-left:1px solid var(--border); overflow:auto; padding:12px; font-size:12px; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:3px 4px; border-bottom:1px solid var(--border); font-variant-numeric:tabular-nums; }
  th { color:var(--muted); font-weight:600; position:sticky; top:0; background:var(--panel); }
  tr.active { background:#1e3a5f; }
  .stat { margin:0 0 10px; line-height:1.55; color:var(--muted); }
  .stat b { color:var(--text); }
  .ok { color:#4dd8a8; } .bad { color:#ff7a59; }
</style>
</head>
<body>
<header>
  <div>
    <h1>后端 采样超椭圆弧 点位</h1>
    <p class="sub">灰线=0°→360°轮廓（预览用，不下发）· 蓝/橙=四段任务行 · 点号=该段采样序号</p>
  </div>
  <div class="ctrl">
    <label><input type="checkbox" id="showOutline" checked /> 完整轮廓</label>
    <label><input type="checkbox" id="showWork" checked /> 四段工件坐标</label>
    <label><input type="checkbox" id="showRight" /> 转到右侧</label>
    <label><input type="checkbox" id="showOffset" /> 开口偏移</label>
    <label><input type="checkbox" id="showIndex" checked /> 点号</label>
  </div>
</header>
<div class="main">
  <svg id="svg" viewBox="-3.2 -3.2 6.4 6.4"></svg>
  <aside>
    <p class="stat" id="stats"></p>
    <table>
      <thead><tr><th>段</th><th>#</th><th>x</th><th>y</th></tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </aside>
</div>
<script>
const DATA = __DATA__;
const svg = document.getElementById("svg");
const NS = "http://www.w3.org/2000/svg";
let activeKey = "";

function el(name, attrs) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
function pts(list) {
  return list.map((p) => `${p.x},${-p.y}`).join(" ");
}
function currentPoints(q) {
  if (document.getElementById("showOffset").checked) return q.offset;
  if (document.getElementById("showRight").checked) return q.right;
  return q.work;
}
function render() {
  svg.replaceChildren();
  svg.appendChild(el("line", { x1:"-4", y1:"0", x2:"4", y2:"0", stroke:"#2a2f3a", "stroke-width":"0.02" }));
  svg.appendChild(el("line", { x1:"0", y1:"-4", x2:"0", y2:"4", stroke:"#2a2f3a", "stroke-width":"0.02" }));
  svg.appendChild(el("circle", { cx:"0", cy:"0", r:"0.04", fill:"#e7eaf0" }));

  if (document.getElementById("showOutline").checked) {
    svg.appendChild(el("polyline", {
      points: pts(DATA.outline), fill:"none", stroke:"#64748b",
      "stroke-width":"0.025", "stroke-dasharray":"0.08 0.05"
    }));
  }
  const showWork = document.getElementById("showWork").checked
    || document.getElementById("showRight").checked
    || document.getElementById("showOffset").checked;
  const showIndex = document.getElementById("showIndex").checked;
  const tbody = document.getElementById("tbody");
  tbody.replaceChildren();

  DATA.quarters.forEach((q) => {
    const list = currentPoints(q);
    if (showWork) {
      svg.appendChild(el("polyline", {
        points: pts(list), fill:"none", stroke:q.color, "stroke-width":"0.04"
      }));
      list.forEach((p, i) => {
        const key = `${q.index}-${i}`;
        const c = el("circle", {
          class: "dot" + (key === activeKey ? " active" : ""),
          cx: String(p.x), cy: String(-p.y), r: i === 0 || i === list.length - 1 ? "0.07" : "0.045",
          fill: i === 0 ? "#4dd8a8" : i === list.length - 1 ? "#f472b6" : q.color,
          "data-key": key
        });
        c.addEventListener("click", () => { activeKey = key; render(); });
        svg.appendChild(c);
        if (showIndex) {
          svg.appendChild(el("text", {
            x: String(p.x + 0.06), y: String(-p.y - 0.06),
            fill: "#cbd5e1", "font-size":"0.11", "font-family":"ui-monospace,monospace"
          })).textContent = `${q.index + 1}.${i}`;
        }
        const tr = document.createElement("tr");
        if (key === activeKey) tr.className = "active";
        tr.innerHTML = `<td>${q.index + 1} ${q.start}→${q.end}</td><td>${i}</td><td>${p.x.toFixed(4)}</td><td>${p.y.toFixed(4)}</td>`;
        tr.addEventListener("click", () => { activeKey = key; render(); });
        tbody.appendChild(tr);
      });
    }
  });

  const cls = (ok) => ok ? "ok" : "bad";
  document.getElementById("stats").innerHTML =
    `a=${DATA.a} b=${DATA.b} n=${DATA.n} 每段${DATA.sampleCount}点 开口=${DATA.openSize}<br>` +
    `轮廓 0°→360° 闭合=<b class="${cls(DATA.outlineClosed)}">${DATA.outlineClosed}</b> 首尾距=${DATA.outlineGap}<br>` +
    `四段首尾相接（第1起点 vs 第4终点）距=<b class="${cls(DATA.cornerJoin<=DATA.closeEps)}">${DATA.cornerJoin}</b><br>` +
    `四段拼成一条（含角点重复）闭合=<b class="${cls(DATA.concatClosed)}">${DATA.concatClosed}</b> 首尾距=${DATA.concatGap}<br>` +
    DATA.quarters.map((q) =>
      `第${q.index+1}行 ${q.start}°→${q.end}° 闭合=${q.closedWork} 首尾距=${q.gapWork}`
    ).join("<br>") +
    `<br>绿点=段起点 粉点=段终点。闭合判定误差 ${DATA.closeEps} mm`;
}
["showOutline","showWork","showRight","showOffset","showIndex"].forEach((id) => {
  document.getElementById(id).addEventListener("change", render);
});
render();
</script>
</body>
</html>
"""


def main() -> None:
    data = 采集(默认半长, 默认半宽, 默认指数, 默认开口)
    html_path = Path(__file__).with_suffix(".html")
    html_path.write_text(HTML.replace("__DATA__", json.dumps(data, ensure_ascii=False)), encoding="utf-8")
    print(f"已写出 {html_path}")
    print(
        f"轮廓闭合={data['outlineClosed']} 距={data['outlineGap']} | "
        f"四段拼接闭合={data['concatClosed']} 距={data['concatGap']} | "
        f"第1起点-第4终点={data['cornerJoin']}"
    )
    for q in data["quarters"]:
        print(
            f"  第{q['index']+1}行 {q['start']}→{q['end']} "
            f"闭合={q['closedWork']} 首尾距={q['gapWork']} 点数={len(q['work'])}"
        )
    webbrowser.open(html_path.as_uri())


if __name__ == "__main__":
    main()
