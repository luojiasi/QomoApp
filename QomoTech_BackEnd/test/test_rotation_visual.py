"""
3D 点旋转可视化工具
输入一个点和旋转参数，用 ASCII 视图展示旋转前后的位置。
"""

import math
import sys
sys.path.insert(0, "D:/Qomo/QomoTech/QomoTech_BackEnd")

from core.calc_rotation import 计算点绕坐标轴旋转


def 验证输入(prompt: str, 类型=float, 允许空=False):
    while True:
        s = input(prompt).strip()
        if not s and 允许空:
            return None
        try:
            return 类型(s)
        except ValueError:
            print(f"  输入无效，请输入{'数字' if 类型 == float else '整数'}，或按 Ctrl+C 退出")


def 主程序():
    print("=" * 60)
    print("  3D 点旋转可视化")
    print("=" * 60)
    print()

    # 输入点坐标
    print("请输入点的三维坐标：")
    x = 验证输入("  X = ")
    y = 验证输入("  Y = ")
    z = 验证输入("  Z = ")

    # 输入旋转轴
    print()
    print("旋转轴：")
    print("  [1] X 轴  [2] Y 轴  [3] Z 轴")
    while True:
        轴选择 = 验证输入("  选择 (1/2/3): ", int)
        if 轴选择 == 1:
            轴 = "x"
            break
        elif 轴选择 == 2:
            轴 = "y"
            break
        elif 轴选择 == 3:
            轴 = "z"
            break
        else:
            print("  请输入 1、2 或 3")

    # 输入旋转角度
    print()
    角度 = 验证输入("旋转角度（度，正=逆时针，负=顺时针）: ")

    # 计算旋转
    原始点 = {"x": x, "y": y, "z": z}
    旋转后 = 计算点绕坐标轴旋转(原始点, 角度, 轴)

    # 输出结果
    print()
    print("=" * 60)
    print(f"  旋转结果：绕 {轴.upper()} 轴旋转 {角度:.1f}°")
    print("=" * 60)
    print(f"  旋转前:  (X={原始点['x']:.2f},  Y={原始点['y']:.2f},  Z={原始点['z']:.2f})")
    print(f"  旋转后:  (X={旋转后['x']:.2f},  Y={旋转后['y']:.2f},  Z={旋转后['z']:.2f})")
    print()

    # ── 选择一个最佳投影面画 ASCII ──
    if 轴 == "z":
        画XY投影(原始点, 旋转后, 轴, 角度)
    elif 轴 == "y":
        画XZ投影(原始点, 旋转后, 轴, 角度)
    else:
        画YZ投影(原始点, 旋转后, 轴, 角度)

    print()
    input("按 Enter 退出...")


def 画XY投影(原始点, 旋转后, 轴, 角度):
    """绕 Z 轴旋转，画 XY 平面"""
    print(f"  XY 平面投影（俯视图）")
    print(f"  绕 {轴.upper()} 轴 → 旋转在 XY 平面内")
    print()
    画二维散点(
        点1=(原始点['x'], 原始点['y']),
        点2=(旋转后['x'], 旋转后['y']),
        X标签="X", Y标签="Y",
        标签1="○ 原始", 标签2="● 旋转后"
    )


def 画XZ投影(原始点, 旋转后, 轴, 角度):
    """绕 Y 轴旋转，画 XZ 平面"""
    print(f"  XZ 平面投影（侧视图）")
    print(f"  绕 {轴.upper()} 轴 → 旋转在 XZ 平面内")
    print()
    画二维散点(
        点1=(原始点['x'], 原始点['z']),
        点2=(旋转后['x'], 旋转后['z']),
        X标签="X", Y标签="Z",
        标签1="○ 原始", 标签2="● 旋转后"
    )


def 画YZ投影(原始点, 旋转后, 轴, 角度):
    """绕 X 轴旋转，画 YZ 平面"""
    print(f"  YZ 平面投影（侧视图）")
    print(f"  绕 {轴.upper()} 轴 → 旋转在 YZ 平面内")
    print()
    画二维散点(
        点1=(原始点['y'], 原始点['z']),
        点2=(旋转后['y'], 旋转后['z']),
        X标签="Y", Y标签="Z",
        标签1="○ 原始", 标签2="● 旋转后"
    )


def 画二维散点(点1, 点2, X标签, Y标签, 标签1, 标签2):
    """在 ASCII 网格中画出两个点和坐标轴"""
    所有x = [点1[0], 点2[0], 0]
    所有y = [点1[1], 点2[1], 0]

    范围_x = max(abs(v) for v in 所有x) * 1.3 + 1
    范围_y = max(abs(v) for v in 所有y) * 1.3 + 1
    步长_x = 范围_x / 10
    步长_y = 范围_y / 10

    网格尺寸 = 20  # 行数
    比例_y = 范围_y / 网格尺寸 * 2
    # 保证 X 和 Y 比例一致：用同一个 缩放 因子
    缩放 = max(范围_x, 范围_y) / (网格尺寸 // 2)

    半格 = 网格尺寸 // 2
    总列 = 网格尺寸 * 2 + 1

    # 行从大到小（Y轴正向在上）
    for 行 in range(半格, -半格 - 1, -1):
        y绘制 = 行 * 缩放
        # 画 Y 轴标签
        if 行 % 5 == 0:
            line = f"{y绘制:>7.2f} "
        else:
            line = " " * 8

        for 列 in range(-半格, 半格 + 1):
            x绘制 = 列 * 缩放
            char = " "
            # 原点
            if abs(x绘制) < 缩放 * 0.4 and abs(y绘制) < 缩放 * 0.4:
                char = "+"
            # 坐标轴
            elif abs(y绘制) < 缩放 * 0.3:
                char = "─"
            elif abs(x绘制) < 缩放 * 0.3:
                char = "│"

            # 原始点
            if abs(点1[0] - x绘制) < 缩放 * 0.6 and abs(点1[1] - y绘制) < 缩放 * 0.6:
                char = "○"
            # 旋转后点
            if abs(点2[0] - x绘制) < 缩放 * 0.6 and abs(点2[1] - y绘制) < 缩放 * 0.6:
                char = "●"
            # 两点重合
            if abs(点1[0] - x绘制) < 缩放 * 0.6 and abs(点1[1] - y绘制) < 缩放 * 0.6 and \
               abs(点2[0] - x绘制) < 缩放 * 0.6 and abs(点2[1] - y绘制) < 缩放 * 0.6:
                char = "◎"

            line += f" {char} "

        print(line)

    # X 轴标签
    刻度行 = " " * 8
    for 列 in range(-半格, 半格 + 1, 4):
        x绘制 = 列 * 缩放
        刻度行 += f"{x绘制:<6.2f}    "
    print()
    print(刻度行)
    print()
    print(f"       {X标签} →          + = 原点")
    print(f"       {Y标签} ↑")
    print(f"       {标签1}     {标签2}")


if __name__ == "__main__":
    try:
        主程序()
    except (KeyboardInterrupt, EOFError):
        print("\n\n已退出。")
