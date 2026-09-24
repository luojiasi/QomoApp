"""十轴切割参数试算：改顶部变量，走 geometry 同一条入口。

用法（在 QomoTech_BackEnd 目录）：
  python test/测试的文件.py

只改「编辑区」。字段名与前端 payload / 任务表一致。
流程：前端行 → 构建任务的数据 → 构建执行任务的参数
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.program_control_ten.geometry import (  # noqa: E402
    构建任务的数据,
    构建执行任务的参数,
)


# ======================================================================
# 编辑区 —— 只改这里
# 路径类型 pathType:
#   equalSegments   等分线段
#   unEqualSegments 非等分直线（切角矩形）
#   curve           曲线（curveKind: circle / superellipse）
# ======================================================================

pathType = "equalSegments"  # 路径类型：equalSegments 等分线段 / unEqualSegments 非等分直线 / curve 曲线

# --- 等分线段 ---
diameter = 5.6569  # 直径 (mm)。等分线段=圆直径；曲线 circle=半径（后端按直径字段当半径用）
divisions = 4  # 分割数。等分线段：N 条弦；0 或 ≥48 时改为 R 轴连续转。台面行锁定为 0
angle = 25.7  # 工艺倾角 (°)。0=台面行（须填 pointXyz）；>0 正切，<0 反向切
height = 1.0  # 本层高度 (mm)。台面行锁定为 0

# --- 非等分直线（祖母绿 / 雷迪恩）---
length = 4.0  # 外接长 (mm)。非等分直线轮廓长；超椭圆也用此外接长
width = 4.0  # 外接宽 (mm)。非等分直线轮廓宽；超椭圆也用此外接宽
cornerRatio = 14.0  # 切角比例 (%)。切角在宽度方向的投影占宽的百分比。祖母绿约 14，雷迪恩约 15

# --- 曲线 ---
curveKind = "circle"  # 曲线子类型：circle 中心圆（半径+偏心） / superellipse 超椭圆（长/宽/n）
superellipseN = 0.0  # 超椭圆指数 n。仅 superellipse 生效；2≈椭圆，4=垫型。旧档 n>0 仍按超椭圆
arcStart = 0  # 圆弧起始角 (°)。相对该段圆心，+X 为 0° 逆时针
arcEnd = 180  # 圆弧结束角 (°)。与起始角组成一段弧；一行一段
arcOffsetX = 0.0  # 圆心相对工位中心的 X 偏置 (mm)
arcOffsetY = 0.0  # 圆心相对工位中心的 Y 偏置 (mm)
sameLayer = False  # 与上一行同一切割高度平面，不叠层。仅曲线有效

# --- 百分比 / 补偿 / 开口 ---
diameterPercent = 100.0  # 直径/尺寸百分比。100=原尺寸；等分用直径，非等分/曲线缩放长宽
heightPercent = 100.0  # 高度百分比。100=原高度。台面行锁定为 100
cutStartPercent = 0.0  # 起始切割百分比 [0,100]。从产品高度的该比例处开始切
cutEndPercent = 100.0  # 结束切割百分比 [0,100]。进度到达该比例后结束本任务，须 ≥ 起始
chordRatio = 1.2  # 弦长倍率。放大切割长度 / 产品高度扫面范围
rTurns = 2.0  # 等分线段分割数为 0 时，R 轴持续旋转每趟等待的圈数。缺省 2
compAngle = 0.0  # 角度补偿 (°)，叠加工艺倾角后再算 U 轴旋转角
k = 0.0  # 下开口斜率 K。开口 = K×高度 + B（本试算入口暂不参与几何构建）
b = 0.0  # 下开口截距 B (mm)
x = 0.0  # 深度补偿相关 X。开口随切深变化时用

# --- 目标级（每行都会带上）---
oppositeCut = True  # 是否对切。台面行：对切则启用 R 轴旋转
pointXyz = ""  # 台面示教点 "(x,y,z)"。angle=0 的台面行必填，否则构建切割中点会报错
十轴切割R旋转圈数 = 0.0  # 每旋转 N 圈做一次 R 轴补偿
十轴切割R旋转补偿值 = 0.0  # 每次 R 轴补偿量 (mm)
recipeId = ""  # 主配方 ID。几何试算不用，正式运行才取激光/扫黑配方

# --- 工位示教坐标（与 TENPLUSCUTTING.json slots 同口径）---
slotIndex = 11  # 工位号 1–10。用来取该工位 U/R 旋转中心
工位X = 11  # 该工位示教 X (mm)
工位Y = -20  # 该工位示教 Y (mm)
工位Z = -50  # 该工位示教 Z (mm)
工位U = 0  # 该工位示教 U（工程位移，内部会转成角度）

# --- runner 调用 构建执行任务的参数 时的额外入参 ---
当前平面Z = 0.0  # 当前平面 Z。入口有此参数，等分/曲线构建主要仍用上面的工位 Z
累计高度 = 0.0  # 本行上方已切完的层高累加 (mm)。同层行不叠入
清晰点距离自动切台面的位置 = 0.0  # 相机清晰误差 (mm)，从工位 Z 里扣掉
是否存在台面 = False  # 目标里是否有 angle=0 的台面行。等分线段算 Z 距时走另一套
台面设置的位置X = 0.0  # 存在台面时，台面设置点的 X，用来算当前平面到旋转中心的距离

打印插补点 = True  # True=打印边参数里的全部插补点；False=只打印点数


# ======================================================================
# 下面不用改
# ======================================================================

def 组装前端行() -> dict:
    return {
        "taskNo": 1,
        "pathType": pathType,
        "diameter": diameter,
        "length": length,
        "width": width,
        "cornerRatio": cornerRatio,
        "arcStart": arcStart,
        "arcEnd": arcEnd,
        "arcOffsetX": arcOffsetX,
        "arcOffsetY": arcOffsetY,
        "curveKind": curveKind,
        "superellipseN": superellipseN,
        "sameLayer": sameLayer,
        "angle": angle,
        "height": height,
        "divisions": divisions,
        "recipeId": recipeId,
        "compAngle": compAngle,
        "diameterPercent": diameterPercent,
        "heightPercent": heightPercent,
        "cutStartPercent": cutStartPercent,
        "cutEndPercent": cutEndPercent,
        "chordRatio": chordRatio,
        "rTurns": rTurns,
        "k": k,
        "b": b,
        "x": x,
        "十轴切割R旋转圈数": 十轴切割R旋转圈数,
        "十轴切割R旋转补偿值": 十轴切割R旋转补偿值,
        "oppositeCut": oppositeCut,
        "pointXyz": pointXyz,
        "slotIndex": slotIndex,
    }


def 精简插补点(结果: dict) -> dict:
    if 打印插补点:
        return 结果
    副本 = dict(结果)
    边列表 = 副本.get("边参数列表")
    if not isinstance(边列表, list):
        return 副本
    精简边 = []
    for 边 in 边列表:
        if not isinstance(边, dict):
            精简边.append(边)
            continue
        边副本 = dict(边)
        点列 = 边副本.pop("插补路径点", None)
        if 点列 is not None:
            边副本["插补路径点数"] = len(点列)
        精简边.append(边副本)
    副本["边参数列表"] = 精简边
    return 副本


def main() -> None:
    行 = 组装前端行()
    任务数据 = 构建任务的数据(行,{"x": 工位X, "y": 工位Y, "z": 工位Z, "u": 工位U},slotIndex)
    print("===== 构建任务的数据 =====")
    print(json.dumps(任务数据, ensure_ascii=False, indent=2))
    执行参数 = 构建执行任务的参数(任务数据,当前平面Z,累计高度,清晰点距离自动切台面的位置,是否存在台面,台面设置的位置X)
    print("\n===== 构建执行任务的参数 =====")
    print(json.dumps(精简插补点(执行参数), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
