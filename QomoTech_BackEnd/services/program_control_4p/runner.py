import math
from typing import Any

from services.SystemSettingService import 获取4P旋转中心的补偿值
from services.MotionService import MotionService
from services.program_control_4p.geometry import 计算钻石几何参数, 提取坐标
from services.PragramService import PragramService





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

async def _切台面(运动服务: MotionService, 台面配方数据: dict[str, Any], 实体序号: int, 实体总数: int, 台面位置: dict[str, Any],中心: tuple[float, float],长度:float,宽度:float) -> None:
    """步骤1：U轴→90°，通过 PragramService 直线切割台面。"""
    台面位置X = 台面位置.get("x", 0)
    台面位置Y = 台面位置.get("y", 0)
    台面位置Z = 台面位置.get("z", 0)
    print(f"[4P] ── 1. 切割台面 (钻石 {实体序号}/{实体总数}) ──")
    print(f"    台面位置: ({台面位置X:.3f}, {台面位置Y:.3f}, {台面位置Z:.3f})")
    print(f"    U轴 → 90°")
    await 运动服务.U轴旋转角度(90)
    # 构造旧格式 LINE 实体（小写 x/y，type 非 kind）
    起点Y = 台面位置Y - 长度/2
    终点Y = 台面位置Y + 长度/2
    台面实体 = {
        "type": "LINE",
        "start": {"x": 台面位置X, "y": 起点Y},
        "end": {"x": 台面位置X, "y": 终点Y},
        "surfaceAngle": 0,
        "openDirection": "LEFT",
    }
    print(f"    直线切割: ({台面位置X:.3f}, {起点Y:.3f}) → ({台面位置X:.3f}, {终点Y:.3f})")

    
    台面配方数据["extraHeight"] = 宽度
    result = await PragramService.获取实例().执行程序(配方数据=台面配方数据, 实体数据=[台面实体])
    print(f"    台面切割结果: {result}")

    # U轴归位
    await 运动服务.U轴旋转角度(0)


async def _切腰棱_R轴(运动服务: MotionService,配方数据: dict[str, Any],实体序号: int, 实体总数: int, 中心: tuple[float, float], 切割实体半径: float,切割高度: float) -> None:
    """步骤2-ROUND：R轴旋转切圆形腰棱。"""
    钻石中心点x坐标, 钻石中心点y坐标 = 中心
    print(f"[4P] ── 2. 切割腰棱(圆形) (钻石 {实体序号}/{实体总数}) ──")
    print(f"    圆心: ({钻石中心点x坐标:.3f}, {钻石中心点y坐标:.3f}), 半径: {切割实体半径:.3f} mm")
    print(f"    R轴旋转切割")

    切腰实体 = {
        "type": "CIRCLE",
        "center": {"x": 钻石中心点x坐标, "y": 钻石中心点y坐标},
        "radius": 切割实体半径,
        "surfaceAngle": 0,
        "openDirection": "RIGHT",
        "钻石半径的偏移方向":"DEFAULT",
    }

    # 把垂直公式的 cuttingAxis 改成 "R"，路由到 _R轴切圆
    for vf in 配方数据.get("selectedVertical", []):
        vf["cuttingAxis"] = "R"
    配方数据["extraHeight"] = 切割高度  #TODO 要去计算高度  
    切腰结果 = await PragramService.获取实例().执行程序(配方数据=配方数据, 实体数据=[切腰实体])
    print(f"    腰棱切割结果: {切腰结果}")


async def _切腰棱_异形(运动服务: MotionService, 实体序号: int, 实体总数: int, 中心: tuple[float, float], 异形钻石路径: list[dict[str, Any]]) -> None:
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


async def _切冠角_R轴(运动服务: MotionService, 配方数据: dict[str, Any], 实体序号: int, 实体总数: int,中心: tuple[float, float], 切割实体半径: float, 冠面参数几何: dict[str, Any]) -> None:
    """步骤3-ROUND：U轴→冠角°，R轴旋转从台面边缘切到腰棱。"""
    钻石中心点x坐标, 钻石中心点y坐标 = 中心
    print(f"[4P] ── 3. 切割冠角(圆形) (钻石 {实体序号}/{实体总数}) ──")
    print(f"    冠角: {冠面参数几何['冠角'] :.1f}°")
    print(f"    U轴 → {冠面参数几何['冠角'] :.1f}°")
    # TODO：冠角角度需要计算
    冠角角度 = 90 - 冠面参数几何['冠角']
    await 运动服务.U轴旋转角度(-冠角角度)

    print(f"    R轴旋转: 台面边缘(r={切割实体半径:.3f}) → 腰棱(r={冠面参数几何['冠高']:.3f})")
    # TODO：构造旧格式  CIRCLE 实体 中心是钻石中心点，半径是冠角['台面半径']
    切冠角实体 = {
        "type": "CIRCLE",
        "center": {"x": 钻石中心点x坐标, "y": 钻石中心点y坐标},
        "radius": 切割实体半径,
        "surfaceAngle": 0,
        "openDirection": "LEFT",
        "钻石半径的偏移方向":"LEFT",
    }
    for vf in 配方数据.get("selectedVertical", []):
        vf["cuttingAxis"] = "R"
    配方数据["extraHeight"] = 冠面参数几何['切割冠厚']
    切冠角结果 = await PragramService.获取实例().执行程序(配方数据=配方数据, 实体数据=[切冠角实体])

    print(f"    冠角切割结果: {切冠角结果}")
    await 运动服务.U轴旋转角度(0)



async def _切冠角_异形(运动服务: MotionService, 实体序号: int, 实体总数: int, 中心: tuple[float, float], 异形钻石路径: list[dict[str, Any]], 台面半径: float, 冠角: float) -> None:
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


async def _切亭角_R轴(运动服务: MotionService, 配方数据: dict[str, Any], 实体序号: int, 实体总数: int,中心: tuple[float, float], 切割实体半径: float, 亭面参数几何: dict[str, Any]) -> None:
    """步骤4-ROUND：U轴→亭角°，R轴旋转从腰棱切到底尖。"""
    钻石中心点x坐标, 钻石中心点y坐标 = 中心
    print(f"[4P] ── 4. 切割亭角(圆形) (钻石 {实体序号}/{实体总数}) ──")
    print(f"    亭角: {亭面参数几何['亭角'] :.1f}°")
    print(f"    U轴 → {亭面参数几何['亭角'] :.1f}°")
    print(f"    R轴旋转: 腰棱(r={亭面参数几何['亭高']:.3f}) → 底尖({钻石中心点x坐标:.3f}, {钻石中心点y坐标:.3f})")
    # TODO：冠角角度需要计算
    亭角角度 = 亭面参数几何['亭角']
    await 运动服务.U轴旋转角度(亭角角度)
    # TODO：构造旧格式  CIRCLE 实体
    切亭角实体 = {
        "type": "CIRCLE",
        "center": {"x": 钻石中心点x坐标, "y": 钻石中心点y坐标},
        "radius": 切割实体半径,
        "surfaceAngle": 0,
        "openDirection": "RIGHT",
        "钻石半径的偏移方向":"RIGHT",
    }
    for vf in 配方数据.get("selectedVertical", []):
        vf["cuttingAxis"] = "R"
    配方数据["extraHeight"] = 亭面参数几何['亭高']
    切亭角结果 = await PragramService.获取实例().执行程序(配方数据=配方数据, 实体数据=[切亭角实体])
    print(f"    亭角切割结果: {切亭角结果}")
    await 运动服务.U轴旋转角度(0)

async def _切亭角_异形(运动服务: MotionService, 实体序号: int, 实体总数: int, 中心: tuple[float, float], 异形钻石路径: list[dict[str, Any]], 亭角: float) -> None:
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


async def _回到起点(运动服务: MotionService, StartX: float, StartY: float, StartZ: float) -> bool:
    try:
        await 运动服务.绝对运动("X", StartX)
        await 运动服务.绝对运动("Y", StartY)
        await 运动服务.绝对运动("Z", StartZ)
        await 运动服务.等待静止("X")
        await 运动服务.等待静止("Y")
        await 运动服务.等待静止("Z")
        return True
    except Exception as e:
        print(f"    回到起点失败: {e}, 失败原因: {e}")
        return False

# ======================================================================
# Runner
# ======================================================================

class ProgramRunner4p:

    def __init__(self) -> None:
        self._运动 = MotionService.获取实例()

    async def 执行4P程序(self,*,配方数据: dict[str, Any],实体数据: list[dict[str, Any]],) -> dict[str, Any]:
        实体总数 = len(实体数据)
        print(f"[4P] ====== 开始执行，共 {实体总数} 颗钻石 ======")

        # 首先记录当前XYZ的坐标
        try:
            StartX, StartY= await self._运动.取_xy_实际位置()
            StartZ = await self._运动.取_z_实际位置()
        except:
            return {"success": False, "message": "记录当前XYZ的坐标失败"}
        
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
            print(f"    派生: 台面半径={钻石几何参数['台面半径']:.3f} 冠高={钻石几何参数['冠面几何参数']['冠高']:.3f} "
                  f"亭高={钻石几何参数['亭面几何参数']['亭高']:.3f} 腰厚={钻石几何参数['腰面几何参数']['腰厚']:.3f}")
            print(f"    角度: 冠角={钻石几何参数['冠面几何参数']['冠角']:.1f}° 亭角={钻石几何参数['亭面几何参数']['亭角']:.1f}°")

            # ── 1. 切割台面 ──
            # await _切台面(self._运动, 配方数据, 当前切割序号, 实体总数, 台面位置, (钻石中心点x坐标, 钻石中心点y坐标),钻石参数.get('L'),钻石参数.get('W'))
            # await _回到起点(self._运动, StartX, StartY, StartZ)


            # ── 2. 切割腰棱 ──
            旋转中心补偿值 = 获取4P旋转中心的补偿值()
            下降到台面的距离 = abs(旋转中心补偿值.Z)-abs(StartZ)-abs(abs(台面位置.get("x", 0))-abs(旋转中心补偿值.X))
            # await self._运动.绝对运动("Z", StartZ - 下降到台面的距离)
            # await self._运动.等待静止("Z") 
            # if 是否是圆钻 or 异形钻石路径 is None:
            #     await _切腰棱_R轴(self._运动, 配方数据, 当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 钻石半径 , 钻石几何参数['腰面几何参数']['切割腰厚'])
            # else:
            #     await _切腰棱_异形(self._运动, 当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 异形钻石路径)
            # await _回到起点(self._运动, StartX, StartY, StartZ)



            # ── 3. 切割冠角 ──
            # 紫色的边的长度 = math.hypot(abs(台面位置.get("x", 0))-abs(旋转中心补偿值.X),钻石几何参数['台面半径'])
            # 计算冠角差的弧度 = math.atan(钻石几何参数['台面半径']/紫色的边的长度) 
            # 计算冠角差的角度 =  math.degrees(计算冠角差的弧度)
            # 需要的计算冠角差的角度 = 钻石几何参数["冠面几何参数"]['冠角'] - 计算冠角差的角度
            # 目标到冠角的X的距离 = math.cos(math.radians(需要的计算冠角差的角度))*紫色的边的长度 
            # 目标到冠角的Z的距离 = math.sin(math.radians(需要的计算冠角差的角度))*紫色的边的长度
            # 从台面下降到冠角的距离 = abs(abs(台面位置.get("x", 0))-abs(旋转中心补偿值.X) - 目标到冠角的Z的距离)
            # 从台面点下降到冠角Z的位置 = StartZ - 下降到台面的距离 - 从台面下降到冠角的距离
            # 台面上的那部分X的距离 =abs(math.sin(math.radians(钻石几何参数["冠面几何参数"]['冠角'])) * 钻石几何参数['台面半径'])
            # 从中心点移动到冠角X的位置 = 钻石中心点x坐标 - (目标到冠角的X的距离-台面上的那部分X的距离)  # TODO 可能要做方向的改变
            # await self._运动.绝对运动("X", 从中心点移动到冠角X的位置)
            # await self._运动.绝对运动("Z", 从台面点下降到冠角Z的位置)
            # await self._运动.等待静止("X") 
            # await self._运动.等待静止("Z") 

            # if 是否是圆钻 or 异形钻石路径 is None:
            #     await _切冠角_R轴(self._运动, 配方数据, 当前切割序号, 实体总数, (从中心点移动到冠角X的位置, 钻石中心点y坐标),钻石几何参数['台面半径'], 钻石几何参数["冠面几何参数"])
            # else:
            #     await _切冠角_异形(self._运动, 当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 异形钻石路径, 钻石几何参数["台面半径"], 钻石几何参数["冠角"])
            # await _回到起点(self._运动, StartX, StartY, StartZ)




            # # ── 4. 切割亭角 ──
            # TODO:旋转中心的补偿值应该改为该钻石的中心点
            需要移动到亭角圆心的X距离 = abs(abs(台面位置.get("x", 0))-abs(旋转中心补偿值.X)*math.cos(math.radians(90 -钻石几何参数["亭面几何参数"]['亭角'])))
            需要移动到亭角圆心的Z距离 = abs(abs(台面位置.get("x", 0))-abs(旋转中心补偿值.X)*math.sin(math.radians(90 -钻石几何参数["亭面几何参数"]['亭角'])))
            需要移动到亭角圆心的Z的位置 = StartZ - 下降到台面的距离 - 需要移动到亭角圆心的Z距离
            需要移动到亭角圆心的X的位置 = abs(旋转中心补偿值.X) - 需要移动到亭角圆心的X距离 # TODO:旋转中心的补偿值应该改为该钻石的中心点
            # if 是否是圆钻 or 异形钻石路径 is None:
            #     await _切亭角_R轴(self._运动, 配方数据, 当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 钻石几何参数["亭面几何参数"])
            # else:
            #     await _切亭角_异形(self._运动, 当前切割序号, 实体总数, (钻石中心点x坐标, 钻石中心点y坐标), 异形钻石路径, 钻石几何参数["亭角"])
            await _回到起点(self._运动, StartX, StartY, StartZ)

        print(f"\n[4P] ====== 全部完成，共处理 {实体总数} 颗钻石 ======")
        return {"success": True, "task_count": 实体总数}
