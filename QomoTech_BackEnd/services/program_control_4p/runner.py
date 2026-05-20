import math
from typing import Any

from services import MotionService
from services.program_control_4p.geometry import 计算钻石几何参数, 提取坐标





def _径向投影(钻石中心点x坐标: float, 钻石中心点y坐标: float, px: float, py: float, 目标距离: float) -> tuple[float, float]:
    """将点沿径向投影到距中心 目标距离 处。"""
    dx = px - 钻石中心点x坐标
    dy = py - 钻石中心点y坐标
    dist = math.hypot(dx, dy)
    if dist < 1e-9:
        return px, py
    scale = 目标距离 / dist
    return 钻石中心点x坐标 + dx * scale, 钻石中心点y坐标 + dy * scale

# ======================================================================
# 切割步骤
# ======================================================================

async def _切台面(实体序号: int, 实体总数: int, 中心: tuple[float, float], 台面半径: float, 台面位置: dict[str, Any]) -> None:
    """步骤1：U轴→90°，直线切割台面。"""
    钻石中心点x坐标, 钻石中心点y坐标 = 中心
    台面位置X = 台面位置.get("x", 0)
    台面位置Y = 台面位置.get("y", 0)
    台面位置Z = 台面位置.get("z", 0)
    print(f"[4P] ── 1. 切割台面 (钻石 {实体序号}/{实体总数}) ──")
    print(f"    台面位置: ({台面位置X:.3f}, {台面位置Y:.3f}, {台面位置Z:.3f})")
    print(f"    台面半径: {台面半径:.3f} mm")
    print(f"    U轴 → 90°")
    # 先调用MotionService的U轴旋转角度
    await MotionService.获取实例().U轴旋转角度(90)
    print(f"    直线切割: ({钻石中心点x坐标 - 台面半径:.3f}, {钻石中心点y坐标:.3f}) → ({钻石中心点x坐标 + 台面半径:.3f}, {钻石中心点y坐标:.3f})")


async def _切腰棱_R轴(实体序号: int, 实体总数: int, 中心: tuple[float, float], 钻石半径: float) -> None:
    """步骤2-ROUND：R轴旋转切圆形腰棱。"""
    钻石中心点x坐标, 钻石中心点y坐标 = 中心
    print(f"[4P] ── 2. 切割腰棱(圆形) (钻石 {实体序号}/{实体总数}) ──")
    print(f"    R轴旋转切割")
    print(f"    圆心: ({钻石中心点x坐标:.3f}, {钻石中心点y坐标:.3f}), 半径: {钻石半径:.3f} mm")


async def _切腰棱_异形(实体序号: int, 实体总数: int, 中心: tuple[float, float], 异形钻石路径: list[dict[str, Any]]) -> None:
    """步骤2-异形：沿 异形钻石路径 逐段切割腰棱。"""
    钻石中心点x坐标, 钻石中心点y坐标 = 中心
    print(f"[4P] ── 2. 切割腰棱(异形) (钻石 {实体序号}/{实体总数}) ──")
    print(f"    异形钻石路径 共 {len(异形钻石路径)} 段")

    for seg_idx, seg in enumerate(异形钻石路径):
        kind = seg.get("kind", "LINE")
        if kind == "LINE":
            sx, sy = 提取坐标(seg.get("start"))
            ex, ey = 提取坐标(seg.get("end"))
            print(f"    段{seg_idx + 1} LINE: ({sx:.3f}, {sy:.3f}) → ({ex:.3f}, {ey:.3f})")
        elif kind == "ARC":
            sx, sy = 提取坐标(seg.get("start"))
            ex, ey = 提取坐标(seg.get("end"))
            ax, ay = 提取坐标(seg.get("center"))
            sa = seg.get("startAngle", 0)
            ea = seg.get("endAngle", 0)
            print(f"    段{seg_idx + 1} ARC: ({sx:.3f}, {sy:.3f}) → ({ex:.3f}, {ey:.3f})")
            print(f"              圆心: ({ax:.3f}, {ay:.3f}), 角度: {sa:.1f}° → {ea:.1f}°")
        else:
            print(f"    段{seg_idx + 1} [{kind}]: 未知类型，跳过")


async def _切冠角_R轴(实体序号: int, 实体总数: int, 中心: tuple[float, float], 台面半径: float, 钻石半径: float, 冠角: float) -> None:
    """步骤3-ROUND：U轴→冠角°，R轴旋转从台面边缘切到腰棱。"""
    钻石中心点x坐标, 钻石中心点y坐标 = 中心
    print(f"[4P] ── 3. 切割冠角(圆形) (钻石 {实体序号}/{实体总数}) ──")
    print(f"    冠角: {冠角:.1f}°")
    print(f"    U轴 → {冠角:.1f}°")
    print(f"    R轴旋转: 台面边缘(r={台面半径:.3f}) → 腰棱(r={钻石半径:.3f})")


async def _切冠角_异形(实体序号: int, 实体总数: int, 中心: tuple[float, float], 异形钻石路径: list[dict[str, Any]], 台面半径: float, 冠角: float) -> None:
    """步骤3-异形：U轴→冠角°，沿 contours 逐段切割冠面（径向投影到台面边缘）。"""
    钻石中心点x坐标, 钻石中心点y坐标 = 中心
    print(f"[4P] ── 3. 切割冠角(异形) (钻石 {实体序号}/{实体总数}) ──")
    print(f"    冠角: {冠角:.1f}°")
    print(f"    U轴 → {冠角:.1f}°")
    print(f"    台面半径: {台面半径:.3f} mm")
    print(f"    异形钻石路径 共 {len(异形钻石路径)} 段")

    for seg_idx, seg in enumerate(异形钻石路径):
        kind = seg.get("kind", "LINE")
        sx, sy = 提取坐标(seg.get("start"))
        ex, ey = 提取坐标(seg.get("end"))

        # 径向投影到台面边缘
        tsx, tsy = _径向投影(钻石中心点x坐标, 钻石中心点y坐标, sx, sy, 台面半径)
        tex, tey = _径向投影(钻石中心点x坐标, 钻石中心点y坐标, ex, ey, 台面半径)

        if kind == "LINE":
            print(f"    段{seg_idx + 1} LINE 冠面:")
            print(f"      台面边缘({tsx:.3f}, {tsy:.3f}) → 台面边缘({tex:.3f}, {tey:.3f})")
            print(f"      腰棱     ({sx:.3f}, {sy:.3f}) → 腰棱     ({ex:.3f}, {ey:.3f})")
        elif kind == "ARC":
            ax, ay = 提取坐标(seg.get("center"))
            sa = seg.get("startAngle", 0)
            ea = seg.get("endAngle", 0)
            print(f"    段{seg_idx + 1} ARC 冠面:")
            print(f"      台面边缘: 弧(圆心({ax:.3f}, {ay:.3f}), r_台面, {sa:.1f}°→{ea:.1f}°)")
            print(f"      腰棱:     弧(圆心({ax:.3f}, {ay:.3f}), r_原始, {sa:.1f}°→{ea:.1f}°)")
        else:
            print(f"    段{seg_idx + 1} [{kind}]: 未知类型，跳过")


async def _切亭角_R轴(实体序号: int, 实体总数: int, 中心: tuple[float, float], 钻石半径: float, 亭角: float) -> None:
    """步骤4-ROUND：U轴→亭角°，R轴旋转从腰棱切到底尖。"""
    钻石中心点x坐标, 钻石中心点y坐标 = 中心
    print(f"[4P] ── 4. 切割亭角(圆形) (钻石 {实体序号}/{实体总数}) ──")
    print(f"    亭角: {亭角:.1f}°")
    print(f"    U轴 → {亭角:.1f}°")
    print(f"    R轴旋转: 腰棱(r={钻石半径:.3f}) → 底尖({钻石中心点x坐标:.3f}, {钻石中心点y坐标:.3f})")


async def _切亭角_异形(实体序号: int, 实体总数: int, 中心: tuple[float, float], 异形钻石路径: list[dict[str, Any]], 亭角: float) -> None:
    """步骤4-异形：U轴→亭角°，沿 异形钻石路径 逐段切割亭面到底尖。"""
    钻石中心点x坐标, 钻石中心点y坐标 = 中心
    print(f"[4P] ── 4. 切割亭角(异形) (钻石 {实体序号}/{实体总数}) ──")
    print(f"    亭角: {亭角:.1f}°")
    print(f"    U轴 → {亭角:.1f}°")
    print(f"    异形钻石路径 共 {len(异形钻石路径)} 段")

    for seg_idx, seg in enumerate(异形钻石路径):
        kind = seg.get("kind", "LINE")
        sx, sy = 提取坐标(seg.get("start"))
        ex, ey = 提取坐标(seg.get("end"))

        if kind == "LINE":
            print(f"    段{seg_idx + 1} LINE 亭面:")
            print(f"      腰棱({sx:.3f}, {sy:.3f}) → 腰棱({ex:.3f}, {ey:.3f})  ↘ 底尖({钻石中心点x坐标:.3f}, {钻石中心点y坐标:.3f})")
        elif kind == "ARC":
            ax, ay = 提取坐标(seg.get("center"))
            sa = seg.get("startAngle", 0)
            ea = seg.get("endAngle", 0)
            print(f"    段{seg_idx + 1} ARC 亭面:")
            print(f"      腰棱: 弧(圆心({ax:.3f}, {ay:.3f}), {sa:.1f}°→{ea:.1f}°)  ↘ 底尖({钻石中心点x坐标:.3f}, {钻石中心点y坐标:.3f})")
        else:
            print(f"    段{seg_idx + 1} [{kind}]: 未知类型，跳过")


# ======================================================================
# Runner
# ======================================================================

class ProgramRunner4p:

    def __init__(self) -> None:
        pass

    async def 执行4P程序(self,*,配方数据: dict[str, Any],实体数据: list[dict[str, Any]],) -> dict[str, Any]:
        实体总数 = len(实体数据)
        print(f"[4P] ====== 开始执行，共 {实体总数} 颗钻石 ======")
        
        for 序号, 实体 in enumerate(实体数据):
            当前切割序号 = 序号 + 1
            钻石参数 = 实体.get("diamondParams", {})
            钻石形状 = 钻石参数.get("shape", "ROUND")
            是否是圆钻 = (钻石形状 == "ROUND")

            钻石中心点 = 实体.get("center", {})
            钻石中心点x坐标, 钻石中心点y坐标 = 提取坐标(钻石中心点)
            钻石半径 = float(实体.get("radius", 0))
            台面位置 = 实体.get("table_position", {})
            异形钻石路径 = 实体.get("contours")  # None for ROUND, list for 异形

            钻石几何参数 = 计算钻石几何参数(钻石参数, 钻石半径)

            # ── 打印参数 ──
            print(f"\n[4P] ======== 钻石 {当前切割序号}/{实体总数} [{钻石形状}] ========")
            print(f"    台面位置: x={台面位置.get('x')}, y={台面位置.get('y')}, z={台面位置.get('z')}")
            print(f"    中心: ({钻石中心点x坐标:.3f}, {钻石中心点y坐标:.3f}), 半径: {钻石半径} mm")
            print(f"    参数: L={钻石参数.get('L')} W={钻石参数.get('W')} "
                  f"Table={钻石参数.get('Table')}% Crown={钻石参数.get('Crown')}% "
                  f"Pavilion={钻石参数.get('Pavilion')}% Girdle={钻石参数.get('Girdle')}%")
            print(f"    派生: 台面半径={钻石几何参数['台面半径']:.3f} 冠高={钻石几何参数['冠高']:.3f} "
                  f"亭高={钻石几何参数['亭高']:.3f} 腰厚={钻石几何参数['腰厚']:.3f}")
            print(f"    角度: 冠角={钻石几何参数['冠角']:.1f}° 亭角={钻石几何参数['亭角']:.1f}°")

            # ── 1. 切割台面 ──
            await _切台面(当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 钻石几何参数["台面半径"], 台面位置)

            # ── 2. 切割腰棱 ──
            if 是否是圆钻 or 异形钻石路径 is None:
                await _切腰棱_R轴(当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 钻石半径)
            else:
                await _切腰棱_异形(当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 异形钻石路径)

            # ── 3. 切割冠角 ──
            if 是否是圆钻 or 异形钻石路径 is None:
                await _切冠角_R轴(当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 钻石几何参数["台面半径"], 钻石半径, 钻石几何参数["冠角"])
            else:
                await _切冠角_异形(当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 异形钻石路径, 钻石几何参数["台面半径"], 钻石几何参数["冠角"])

            # ── 4. 切割亭角 ──
            if 是否是圆钻 or 异形钻石路径 is None:
                await _切亭角_R轴(当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 钻石半径, 钻石几何参数["亭角"])
            else:
                await _切亭角_异形(当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 异形钻石路径, 钻石几何参数["亭角"])

        print(f"\n[4P] ====== 全部完成，共处理 {实体总数} 颗钻石 ======")
        return {"success": True, "task_count": 实体总数}
