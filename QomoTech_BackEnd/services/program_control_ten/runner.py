import math
from typing import Any
import asyncio

from services.program_control_ten.motion_primitives import 十工位的额外运动控制
from services.program_control_ten.step import ProgramFreeParamsStep
from services.program_control_ten.ten_plus_cutting_persistence import 按工位号取点位
from services.MotionService import MotionService
from services.program_control_ten.geometry import (
    构建R轴的补偿,
    构建任务的数据,
    构建总任务目标,
    构建执行任务的参数,
    构建配方数据,
    计算开口范围,
    更新V型开口偏移,
    更新平行型开口偏移,
)
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("自由参数切割程序")



# ======================================================================
# Runner
# ======================================================================

class ProgramRunnerTenPlus:

    def __init__(self) -> None:
        self._运动 = MotionService.获取实例()
        self._十工位的运动 = 十工位的额外运动控制(self._运动)

        # ── 运行状态标志 ──
        self._是否运行中 = False
        self._是否已暂停 = False
        self._是否急停请求 = False
        self._是否跳过请求 = False

        self._控制锁 = asyncio.Lock()
        self._执行锁 = asyncio.Lock()

        # ── 广播回调（由 ProgramServiceFreeParam 注入） ──
        self._广播回调 = None

        # ── 进度追踪 ──
        self._任务总数: int = 0
        self._当前任务序号: int = 0
        self._进度百分比: float = 0.0

    # ==================================================================
    # 运行状态快照
    # ==================================================================

    def 获取运行状态(self) -> dict[str, Any]:
        return {
            "running": self._是否运行中,
            "paused": self._是否已暂停,
            "total_tasks": self._任务总数,
            "current_task_index": self._当前任务序号,
            "进度百分比": self._进度百分比,
        }

    def 更新进度(self, *, total_tasks: int | None = None, current_task_index: int | None = None,
                  current_task_jindubaifenbi: float | None = None) -> None:
        if total_tasks is not None: self._任务总数 = max(0, int(total_tasks))
        if current_task_index is not None: self._当前任务序号 = max(0, int(current_task_index))
        if current_task_jindubaifenbi is not None: self._进度百分比 = max(0.0, min(100.0, float(current_task_jindubaifenbi)))
        self._广播状态变更()

    def _广播状态变更(self, *, force: bool = False) -> None:
        if self._广播回调 is not None:
            self._广播回调(force=force)

    # ==================================================================
    # 控制指令（参照 ProgramRunner）
    # ==================================================================

    async def 暂停(self) -> dict[str, Any]:
        async with self._控制锁:
            if not self._是否运行中:
                return {"success": False, "message": "当前没有运行中的程序"}
            self._是否已暂停 = True
        self._广播状态变更(force=True)
        if self._运动.适配器 and self._运动.适配器.已连接:
            try:
                await self._运动.设置输出(2, False)
                await self._运动.暂停()
            except Exception:
                pass
        return {"success": True, "message": "已暂停"}

    async def 恢复(self) -> dict[str, Any]:
        async with self._控制锁:
            if not self._是否运行中:return {"success": False, "message": "当前没有运行中的程序"}
            self._是否已暂停 = False
        self._广播状态变更(force=True)
        if self._运动.适配器 and self._运动.适配器.已连接:
            try:
                await self._运动.继续()
                await self._运动.设置输出(2, True)
            except Exception:
                pass
        return {"success": True, "message": "已继续运行"}

    async def 急停(self) -> dict[str, Any]:
        async with self._控制锁:
            self._是否急停请求 = True
            self._是否已暂停 = False
        # 先广播状态让前端感知，再执行耗时操作
        self._广播状态变更(force=True)
        if self._运动.适配器 and self._运动.适配器.已连接:
            await self._运动.急停()
            try:
                await self._运动.设置输出(0, False)
                await self._运动.设置输出(2, False)
            except Exception:
                pass
        return {"success": True, "message": "已急停"}

    async def 跳过任务(self) -> dict[str, Any]:
        async with self._控制锁:
            if not self._是否运行中:
                return {"success": False, "message": "当前没有运行中的程序"}
            self._是否跳过请求 = True
        self._广播状态变更(force=True)
        return {"success": True, "message": "已请求跳过当前任务"}

    async def 复位(self) -> dict[str, Any]:
        if not self._运动.适配器 or not self._运动.适配器.已连接: return {"success": False, "message": "motion 控制器未连接"}
        _ALARM_CLEAR_AXIS_NOS = (0, 1, 2, 3, 4)
        _轴号映射 = {0: "X", 1: "Y", 2: "Z", 3: "U", 4: "R"}
        失败列表: list[int] = []
        for 轴号 in _ALARM_CLEAR_AXIS_NOS:
            try:
                await self._运动.清除轴错误(_轴号映射[int(轴号)])
            except Exception:
                失败列表.append(int(轴号))
        if 失败列表: return {"success": False, "message": f"部分轴清除报警失败: {失败列表}"}
        await self._运动.复位()
        return {"success": True, "message": "报警已清除，状态机已复位"}

    # ==================================================================
    # 主入口
    # ==================================================================

    async def 执行十工位自由编辑参数(self, *, 配方数据: dict[str, Any], 实体数据: list[dict[str, Any]]) -> dict[str, Any]:
        if self._执行锁.locked():return {"success": False, "message": "程序正在执行中（重复触发被拒绝）"}
        if not self._运动.适配器 or not self._运动.适配器.已连接:return {"success": False, "message": "motion 控制器未连接"}
        
        async with self._执行锁:
            async with self._控制锁:
                self._是否运行中 = True
                self._是否已暂停 = False
                self._是否急停请求 = False
                self._是否跳过请求 = False
            try:
                目标列表 = 构建总任务目标(实体数据)
                目标总数 = len(目标列表)
                行总数 = sum(len(t.get("rows") or []) for t in 目标列表)
                self.更新进度(total_tasks=行总数, current_task_index=0, current_task_jindubaifenbi=0)
                日志.info(f"[TenPlus] ====== 开始执行，共 {目标总数} 个目标、{行总数} 行 ======")

                全局已完成行 = 0
                首个工位Z: float | None = None

                for 目标序号, 目标 in enumerate(目标列表):
                    行列表 = list(目标.get("rows") or [])
                    目标名 = str(目标.get("name") or 目标.get("id") or 目标序号 + 1)
                    日志.info(f"\n[TenPlus] -------- 目标 {目标序号 + 1}/{目标总数}: {目标名} " + f"（{len(行列表)} 行）--------")
                    if not 行列表:
                        日志.warning(f"[TenPlus] 目标 {目标名} 无任务行，跳过")
                        continue

                    try:
                        工位号 = int(行列表[0].get("slotIndex"))
                    except (TypeError, ValueError):
                        return {"success": False,"message": f"目标 {目标名} 缺少有效 slotIndex，无法从 TENPLUSCUTTING 取点"}
                    工位点 = 按工位号取点位(工位号)
                    if 工位点 is None:
                        return {"success": False,"message": f"目标 {目标名} 工位 {工位号} 未示教或不存在（TENPLUSCUTTING）",}

                    当前X = float(工位点["x"])
                    当前Y = float(工位点["y"])
                    当前Z = float(工位点["z"])
                    当前U = float(工位点["u"])
                    if 首个工位Z is None:
                        首个工位Z = 当前Z
                    日志.info(f"[TenPlus] 目标 {目标名} 工位#{工位号} → " + f"XYZU=({当前X}, {当前Y}, {当前Z}, {当前U})")
                    await self._运动到示教工位(当前X, 当前Y, 当前Z, 当前U)
                    工位的轴位置 = {"x": 当前X, "y": 当前Y, "z": 当前Z, "u": 当前U}
                
                    for 序号, 行数据 in enumerate(行列表):
                        全局已完成行 += 1
                        当前序号 = 全局已完成行
                        日志.info(f"\n[TenPlus] ======== 目标 {目标序号 + 1}/{目标总数} " + f"行 {序号 + 1}/{len(行列表)}（总进度 {当前序号}/{行总数}）========")
                        该序号R轴的补偿 = 构建R轴的补偿(行数据)
                        该序号的参数 = 构建任务的数据(行数据,工位的轴位置)
                        该序号的配方 = 构建配方数据(配方数据, 该序号的参数.get("配方ID"))
                        累计高度 = sum(float(行列表[k].get("height", 0)) for k in range(序号))
                        所有高度总和 = sum(float(行列表[k].get("height", 0)) for k in range(len(行列表)))
                        执行任务的参数 = 构建执行任务的参数(该序号的参数, 当前Z, 所有高度总和, 累计高度)
                        self.更新进度(current_task_index=当前序号, current_task_jindubaifenbi=0)
                        try:
                            await self._切割(
                                配方数据=该序号的配方,
                                执行任务的参数=执行任务的参数,
                                该序号R轴的补偿=该序号R轴的补偿,
                                起始点的位置={"x": 当前X, "y": 当前Y, "z": 当前Z, "u": 当前U},
                            )
                        except Exception as e:
                            日志.error(f"目标 {目标名} 行 {序号 + 1} 执行失败: {e}")
                            return {"success": False,"message": f"目标 {目标名} 行 {序号 + 1} 执行失败: {e}"}

                        if self._是否急停请求:
                            await self._十工位的运动.关闭吹风()
                            await self._十工位的运动.关闭激光()
                            return {"success": False, "message": "程序已急停"}
                        if self._是否跳过请求:
                            continue

                if 首个工位Z is not None:
                    await self._运动.绝对运动("Z", 首个工位Z)
                    await self._运动.等待静止("Z")

                日志.info(f"\n[TenPlus] ====== 全部完成，共 {目标总数} 个目标、{行总数} 行 ======")
                return {"success": True, "task_count": 行总数, "target_count": 目标总数}
            finally:
                async with self._控制锁:
                    self._是否运行中 = False
                    self._是否已暂停 = False
                    self._是否急停请求 = False
                    self._是否跳过请求 = False
                self._广播状态变更(force=True)

    async def _运动到示教工位(self, x: float, y: float, z: float, u: float) -> None:
        """按 TENPLUSCUTTING 示教坐标做 XYZU 绝对定位（与前端 moveToTenPlusSlot 一致）。"""
        for 轴名, 位置 in (("X", x), ("Y", y), ("Z", z), ("U", u)):
            await self._运动.绝对运动(轴名, 位置)
            await self._运动.等待静止(轴名)

    async def _检查是否应中止(self) -> bool:
        """检查急停/跳过/暂停状态。急停或跳过时返回 True，暂停时阻塞等待恢复。"""
        if self._是否急停请求:
            return True
        if self._是否跳过请求:
            return True
        while self._是否已暂停:
            await asyncio.sleep(0.05)
            if self._是否急停请求:
                return True
        return False

    async def _切割(self,配方数据:dict[str, Any],执行任务的参数:dict[str, Any],该序号R轴的补偿:dict[str, Any],起始点的位置:dict[str, Any])->bool:
        是否完成切割 = False
        当前步骤 = ProgramFreeParamsStep.准备开始

        任务选择的扫黑配方 = dict(配方数据.get("selectedBlackeningRecipe")[0])
        任务选择的扫黑激光参数 = dict(配方数据.get("selectedBlackeningLaser")[0])
        任务选择的加工激光参数 = dict(配方数据.get("selectedMachiningLaser")[0])
        任务选择的水平配方参数 = dict(配方数据.get("selectedHorizontal")[0])
        任务选择的垂直配方参数 = dict(配方数据.get("selectedVertical")[0])

        是否打开扫黑 = bool(任务选择的扫黑配方.get("enabled",False))
        扫黑下降步长 = float(任务选择的扫黑配方.get("descentStep",0))
        扫黑的速度 = float(任务选择的扫黑配方.get("blackeningSpeed",0))
        扫黑的焦距补偿 = float(任务选择的扫黑配方.get("jiaojubuchang",0))
        扫黑的步进 = float(任务选择的扫黑配方.get("blackeningStep",0))
        扫黑的开口K = float(任务选择的扫黑配方.get("saoheikaikou",{}).get("k",0))
        扫黑的开口B = float(任务选择的扫黑配方.get("saoheikaikou",{}).get("b",0))

        扫黑功率 = float(任务选择的扫黑激光参数.get("laserPower"))
        扫黑频率 = float(任务选择的扫黑激光参数.get("laserFrequency"))
        扫黑电流 = float(任务选择的扫黑激光参数.get("laserCurrent"))

        加工功率 = float(任务选择的加工激光参数.get("laserPower"))
        加工频率 = float(任务选择的加工激光参数.get("laserFrequency"))
        加工电流 = float(任务选择的加工激光参数.get("laserCurrent"))

        水平的开口形状 = str(任务选择的水平配方参数.get("openingShape", ""))
        水平的焦距补偿 = float(任务选择的水平配方参数.get("focusCompensation", 0))
        水平的角度K = float(任务选择的水平配方参数.get("angleFormula",{}).get("k",0))
        水平的角度B = float(任务选择的水平配方参数.get("angleFormula",{}).get("b",0))
        水平的下开口K = float(任务选择的水平配方参数.get("lowerOpeningFormula",{}).get("k",0))
        水平的下开口B = float(任务选择的水平配方参数.get("lowerOpeningFormula",{}).get("b",0))
        水平的深度补偿K = float(任务选择的水平配方参数.get("depthCompensationFormula",{}).get("k",0))
        水平的深度补偿B = float(任务选择的水平配方参数.get("depthCompensationFormula",{}).get("b",0))
        水平的补偿角度K = float(任务选择的水平配方参数.get("compensationAngleFormula",{}).get("k",0))
        水平的补偿角度B = float(任务选择的水平配方参数.get("compensationAngleFormula",{}).get("b",0))

        当前开口值 = 0
        X轴的偏移量 = float(任务选择的垂直配方参数.get("xFeed",0))
        插补的运行速度 = float(任务选择的垂直配方参数.get("xSpeed",0))
        切割轴 = str(任务选择的垂直配方参数.get("cuttingAxis", ""))

        垂直的变化百分比 = float(任务选择的垂直配方参数.get("changePercent",10))
        垂直的每次下降步长量 = float(任务选择的垂直配方参数.get("descentCutting",{}).get("speed",0.075))
        垂直的每次下降步长量减少量 = float(任务选择的垂直配方参数.get("descentCutting",{}).get("zFeed",0))

        当前切割次数 = 0
        是否在边缘位置 = True
        垂直的边缘切割速度百分比 = float(任务选择的垂直配方参数.get("edgeCutting",{}).get("speed",50))
        边缘切割速度百分比 = 垂直的边缘切割速度百分比/100
        垂直的边缘切割次数 = float(任务选择的垂直配方参数.get("edgeCutting",{}).get("cutTimes",1))
        垂直的边缘切割速量 = float(任务选择的垂直配方参数.get("edgeCutting",{}).get("cutSpeedNums",1))
        垂直的边缘切割变化率K = float(任务选择的垂直配方参数.get("edgeCutting",{}).get("change",{}).get("k",0))
        垂直的边缘切割变化率B = float(任务选择的垂直配方参数.get("edgeCutting",{}).get("change",{}).get("b",0))

        垂直的中间切割速度百分比 = float(任务选择的垂直配方参数.get("middleCutting",{}).get("speed",100))
        中间切割速度百分比 = 垂直的中间切割速度百分比/100
        垂直的中间切割次数 = float(任务选择的垂直配方参数.get("middleCutting",{}).get("cutTimes",1))
        垂直的中间切割变化率K = float(任务选择的垂直配方参数.get("middleCutting",{}).get("change",{}).get("k",0))
        垂直的中间切割变化率B = float(任务选择的垂直配方参数.get("middleCutting",{}).get("change",{}).get("b",0))

        累计下降量 = 0 
        产品的高度 = float(执行任务的参数.get("切割产品的高度"))
        上层量 = 0
        
        角度 = 水平的角度K* 产品的高度 + 水平的角度B
        tana = math.tan(math.radians(角度))

        下开口值, 上开口值 = 计算开口范围(高度=产品的高度, 下开口K=水平的下开口K, 下开口B=水平的下开口B,深度补偿K=水平的深度补偿K, 深度补偿B=水平的深度补偿B, 正切角度=tana)
        最小的偏移 = 0
        最大的偏移 = 上开口值
        是否是从小到大的开口偏移 = True
        R轴是否进行持续旋转打开 = False

        旋转任务的的分割数 = 执行任务的参数.get("R轴旋转的分割数")
        当前R轴旋转分割数 = 1 
        准备开始切割下一次的第一次 = False

        多少圈进行补偿值 = float(该序号R轴的补偿.get("多少圈进行一次补偿", 0))
        补偿值 = float(该序号R轴的补偿.get("补偿值", 0))

        是否完全旋转完毕 = False



        while 当前步骤< ProgramFreeParamsStep.结束当前任务:
            # 每步开始时检查急停/暂停
            if await self._检查是否应中止():
                当前步骤 = ProgramFreeParamsStep.清理所有状态


            match 当前步骤:

                case ProgramFreeParamsStep.准备开始:
                    是否连上 = self._运动.适配器.已连接 if self._运动.适配器 else False
                    if 是否连上:
                        await self._十工位的运动.开启吹风()
                        当前步骤 = ProgramFreeParamsStep.U轴进行角度旋转


                case ProgramFreeParamsStep.U轴进行角度旋转:
                    旋转角度 = 执行任务的参数.get("U轴的旋转角度")
                    旋转结果 = await self._运动.U轴旋转角度(旋转角度)
                    if not 旋转结果.get('success'): 当前步骤 = ProgramFreeParamsStep.清理所有状态
                    当前步骤 = ProgramFreeParamsStep.判断是否到达旋转角度

                case ProgramFreeParamsStep.判断是否到达旋转角度:
                    是否到达旋转角度 = await self._运动.U轴是否到达旋转角度(旋转角度)
                    if 是否到达旋转角度:
                        当前步骤 = ProgramFreeParamsStep.移动到最开始的位置
                    else:
                        日志.error(f"U轴旋转未到达目标角度（{旋转角度}°），进入清理")
                        当前步骤 = ProgramFreeParamsStep.清理所有状态

                case ProgramFreeParamsStep.移动到最开始的位置:
                    起点X = 执行任务的参数.get("切割中点的坐标").get("X")
                    起点Y = 执行任务的参数.get("切割中点的坐标").get("Y")
                    起点Z = 执行任务的参数.get("切割中点的坐标").get("Z")
                    try:
                        await self._运动.绝对运动("Z", 起点Z)

                        插补运行的路径点 = [{"x": 起点X, "y": 起点Y}]
                        切割直线的结果 = await self._运动.连续插补XY(路径点=插补运行的路径点,速度=20)
                        await asyncio.sleep(0.1)

                        等待X轴静止结果 = await self._运动.等待静止("X")
                        等待Y轴静止结果 = await self._运动.等待静止("Y")
                        if 等待X轴静止结果 and 等待Y轴静止结果:
                            当前步骤 = ProgramFreeParamsStep.打开激光设备
                    except Exception:
                        日志.info("移动到最开始的位置失败")
                        当前步骤 = ProgramFreeParamsStep.清理所有状态

                case ProgramFreeParamsStep.打开激光设备:
                    await self._十工位的运动.开启激光()
                    当前步骤 = ProgramFreeParamsStep.Z轴下降

                case ProgramFreeParamsStep.Z轴下降:
                    # TODO:还有什么东西要去做
                    目标Z轴的位置 = -累计下降量 + 执行任务的参数.get("切割中点的坐标").get("Z")
                    await self._运动.绝对运动("Z", 目标Z轴的位置)
                    等到轴停止结果 =  await self._运动.等待轴到位(轴名与位置=[("Z",目标Z轴的位置)],容差=0.01)
                    await asyncio.sleep(0.1)
                    if 等到轴停止结果:
                        当前步骤 = ProgramFreeParamsStep.判断高度是否满足
                    else:
                        日志.info("Z轴下降等到轴停止结果")
                        当前步骤 = ProgramFreeParamsStep.清理所有状态

                case ProgramFreeParamsStep.判断高度是否满足:
                    if 累计下降量 <= 产品的高度 or not 是否完全旋转完毕:
                        if 执行任务的参数.get("是否启用R轴旋转"):
                            日志.info("判断高度切割R轴")
                            if not R轴是否进行持续旋转打开:
                                await self._运动.R轴一直进行旋转()
                                R轴是否进行持续旋转打开 = True
                            当前步骤 = ProgramFreeParamsStep.切割R轴
                            await self._十工位的运动.开启激光()
                        else:   
                            日志.info("判断高度切割直线")
                            当前步骤 = ProgramFreeParamsStep.切割直线
                    else:
                        日志.info("判断高度是否满足")
                        当前步骤 = ProgramFreeParamsStep.清理所有状态

                case ProgramFreeParamsStep.切割R轴:

                    构建切割直线的坐标X = 执行任务的参数.get("切割中点的坐标").get("X") + 当前开口值
                    构建切割直线的坐标Y起点 = float(执行任务的参数.get("切割中点的坐标").get("Y"))
                    插补运行的路径点= [{"x": 构建切割直线的坐标X, "y": 构建切割直线的坐标Y起点}]
                    当前速度百分比 = 边缘切割速度百分比 if 是否在边缘位置 else 中间切割速度百分比
                    目标运行速度 = 插补的运行速度 * 当前速度百分比
                    切割直线的结果 = await self._运动.连续插补XY(路径点=插补运行的路径点,速度=目标运行速度)

                    if 切割直线的结果:
                        当前步骤 = ProgramFreeParamsStep.等待R轴旋转一圈

                    else:
                        日志.info("切割R轴切割直线的结果")
                        当前步骤 = ProgramFreeParamsStep.清理所有状态

                case ProgramFreeParamsStep.切割直线:

                    构建切割直线的坐标X = 执行任务的参数.get("切割中点的坐标").get("X") + 当前开口值
                    构建切割直线的坐标Y起点 = float(执行任务的参数.get("切割中点的坐标").get("Y") + float((执行任务的参数.get("最长的那条边的切割长度")/2)))
                    构建切割直线的坐标Y终点 = float(执行任务的参数.get("切割中点的坐标").get("Y") - float((执行任务的参数.get("最长的那条边的切割长度")/2)))
                    插补运行的路径点 = [{"x": 构建切割直线的坐标X, "y": 构建切割直线的坐标Y起点}, {"x": 构建切割直线的坐标X, "y": 构建切割直线的坐标Y终点}]

                    当前速度百分比 = 边缘切割速度百分比 if 是否在边缘位置 else 中间切割速度百分比
                    目标运行速度 = 插补的运行速度 * 当前速度百分比

                    切割直线的结果 = await self._运动.连续插补XY(路径点=插补运行的路径点,速度=目标运行速度)

                    if 切割直线的结果:
                        当前步骤 = ProgramFreeParamsStep.等待X轴和Y轴插补结束
                    else:
                        日志.info("切割直线切割直线的结果")
                        当前步骤 = ProgramFreeParamsStep.清理所有状态

                case ProgramFreeParamsStep.等待R轴旋转一圈:
                    旋转结果 = await self._运动.R轴旋转圈数是否到达指定圈数(2.0)
                    if 旋转结果:
                        当前步骤 = ProgramFreeParamsStep.更新开口偏移值

                case ProgramFreeParamsStep.等待X轴和Y轴插补结束:
                    try:
                        等待X轴静止结果 = await self._运动.等待静止("X")
                        等待Y轴静止结果 = await self._运动.等待静止("Y")
                        if 等待X轴静止结果 and 等待Y轴静止结果:
                            当前步骤 = ProgramFreeParamsStep.更新开口偏移值
                        else:
                            当前步骤 = ProgramFreeParamsStep.清理所有状态
                    except Exception:
                        日志.info("等待X轴和Y轴插补结束失败")
                        当前步骤 = ProgramFreeParamsStep.清理所有状态


                case ProgramFreeParamsStep.更新开口偏移值:
                    # TODO:这里就是会出现我到边缘切割之后要不要下降但是已经出现计算新的开口的然后开口值还变小了
                    切割完成之后去跳转 = False
                    if not 准备开始切割下一次的第一次:
                        当前开口值 = 当前开口值 + X轴的偏移量 if 是否是从小到大的开口偏移 else 当前开口值 - X轴的偏移量
                    else:
                        切割完成之后去跳转 = True
                    
                    当前开口值是否在范围内 = (当前开口值> 最小的偏移 / 1000 and 当前开口值 < 最大的偏移 / 1000)

                    if (最大的偏移 / 1000 < 当前开口值 and 是否是从小到大的开口偏移):
                        当前开口值 = 最大的偏移 / 1000
                        是否是从小到大的开口偏移 = not 是否是从小到大的开口偏移
                        是否在边缘位置 = True
                        准备开始切割下一次的第一次 = True


                    if (最小的偏移 / 1000 > 当前开口值 and not 是否是从小到大的开口偏移):
                        当前开口值 = 最小的偏移 / 1000
                        是否是从小到大的开口偏移 = not 是否是从小到大的开口偏移
                        是否在边缘位置 = True
                        准备开始切割下一次的第一次 = True

                    if not 执行任务的参数.get("是否启用R轴旋转"):
                        if 当前开口值是否在范围内 or (是否在边缘位置 and 准备开始切割下一次的第一次 and not 切割完成之后去跳转):
                            当前步骤 = ProgramFreeParamsStep.切割直线
                        else:
                            当前步骤 = ProgramFreeParamsStep.计算下一层开口
                    else:
                        if 当前开口值是否在范围内  or (是否在边缘位置 and 准备开始切割下一次的第一次 and not 切割完成之后去跳转):
                            当前步骤 = ProgramFreeParamsStep.切割R轴
                        else:
                            准备开始切割下一次的第一次 = False
                            当前步骤 = ProgramFreeParamsStep.计算下一层开口

                case ProgramFreeParamsStep.计算下一层开口:
                    进度百分比 = (累计下降量 / 产品的高度 * 100)
                    当前量 = int(进度百分比 // 垂直的变化百分比)
                    垂直的每次下降步长量 -= (当前量 - 上层量) * 垂直的每次下降步长量减少量
                    上层量 = 当前量
                    累计下降量 += round(垂直的每次下降步长量, 6)
                    
                    print("最大的偏移1",最大的偏移)
                    if 水平的开口形状 == "V型":
                        最小的偏移, 最大的偏移 = 更新V型开口偏移(上开口值=上开口值, 正切角度=tana, 累计下降量=累计下降量)
                        print("最大的偏移2",最大的偏移)
                    if 水平的开口形状 == "//型":
                        最小的偏移, 最大的偏移 = 更新平行型开口偏移(上开口值=上开口值, 正切角度=tana, 累计下降量=累计下降量)



                    总进度百分比 = float(((当前R轴旋转分割数 - 1) * 100 + 进度百分比) / 旋转任务的的分割数) if 旋转任务的的分割数 > 0 else 进度百分比
                    self.更新进度(current_task_jindubaifenbi=总进度百分比)
                    print("总进度百分比",总进度百分比)
                    准备开始切割下一次的第一次 = False


                    # 当前大区间索引 = int(进度百分比 // 垂直的变化百分比) if 垂直的变化百分比 > 0 else 0
                    # 段内进度 = (进度百分比 % 垂直的变化百分比) // (垂直的变化百分比 // 垂直的每次下降步长量减少量) if 垂直的变化百分比 > 0 and 垂直的每次下降步长量减少量 > 0 else 0
                    # 垂直的每次下降步长量 = min(1.1, max(0.3, round((原始垂直的每次下降步长量 + 垂直的每次下降步长量减少量 / 100 * (当前大区间索引 % (垂直的每次下降步长量减少量 + 1))), 4)))
                    # 垂直的每次下降步长量 = min(1.0, max(0.3, round((原始垂直的每次下降步长量 + 垂直的每次下降步长量减少量 / 100 * 段内进度 + 垂直的每次下降步长量减少量 / 100 * 当前大区间索引), 4)))
                    print("进度百分比",进度百分比<100)
                    if 进度百分比 < 100:
                        if 执行任务的参数.get("是否启用R轴旋转"):
                            当前步骤 = ProgramFreeParamsStep.Z轴下降
                            是否完全旋转完毕 = True
                        else:
                            当前步骤 = ProgramFreeParamsStep.Z轴下降
                    else:
                        当前步骤 = ProgramFreeParamsStep.旋转时关闭激光


                case ProgramFreeParamsStep.旋转时关闭激光:

                    await self._十工位的运动.关闭激光()
                    当前步骤 = ProgramFreeParamsStep.判断R轴是否转动一圈

                case ProgramFreeParamsStep.判断R轴是否转动一圈:
                    if 当前R轴旋转分割数 > (旋转任务的的分割数-1):
                        是否完全旋转完毕 = True
                        当前R轴旋转分割数 = 1
                        当前步骤 = ProgramFreeParamsStep.清理所有状态
                    else:
                        当前R轴旋转分割数 += 1
                        准备开始切割下一次的第一次 = False
                        R轴旋转圈数 = float(1 / 旋转任务的的分割数) if 旋转任务的的分割数 > 0 else 0.0
                        await self._运动.R轴旋转的圈数(R轴旋转圈数)

                        if 多少圈进行补偿值 > 0 and 当前R轴旋转分割数 % int(多少圈进行补偿值) == 0:
                            await self._运动.相对运动("R",补偿值)




                        # 这里目的是将所有的值回到最初的位置
                        当前开口值 = 0
                        X轴的偏移量 = float(任务选择的垂直配方参数.get("xFeed",0))
                        插补的运行速度 = float(任务选择的垂直配方参数.get("xSpeed",0))
                        切割轴 = str(任务选择的垂直配方参数.get("cuttingAxis", ""))

                        垂直的变化百分比 = float(任务选择的垂直配方参数.get("changePercent",10))
                        垂直的每次下降步长量 = float(任务选择的垂直配方参数.get("descentCutting",{}).get("speed",0.075))
                        垂直的每次下降步长量减少量 = float(任务选择的垂直配方参数.get("descentCutting",{}).get("zFeed",0))

                        当前切割次数 = 0
                        是否在边缘位置 = True
                        垂直的边缘切割速度百分比 = float(任务选择的垂直配方参数.get("edgeCutting",{}).get("speed",50))
                        边缘切割速度百分比 = 垂直的边缘切割速度百分比/100
                        垂直的边缘切割次数 = float(任务选择的垂直配方参数.get("edgeCutting",{}).get("cutTimes",1))
                        垂直的边缘切割速量 = float(任务选择的垂直配方参数.get("edgeCutting",{}).get("cutSpeedNums",1))
                        垂直的边缘切割变化率K = float(任务选择的垂直配方参数.get("edgeCutting",{}).get("change",{}).get("k",0))
                        垂直的边缘切割变化率B = float(任务选择的垂直配方参数.get("edgeCutting",{}).get("change",{}).get("b",0))

                        垂直的中间切割速度百分比 = float(任务选择的垂直配方参数.get("middleCutting",{}).get("speed",100))
                        中间切割速度百分比 = 垂直的中间切割速度百分比/100
                        垂直的中间切割次数 = float(任务选择的垂直配方参数.get("middleCutting",{}).get("cutTimes",1))
                        垂直的中间切割变化率K = float(任务选择的垂直配方参数.get("middleCutting",{}).get("change",{}).get("k",0))
                        垂直的中间切割变化率B = float(任务选择的垂直配方参数.get("middleCutting",{}).get("change",{}).get("b",0))

                        累计下降量 = 0 
                        产品的高度 = float(执行任务的参数.get("切割产品的高度"))
                        上层量 = 0

                        角度 = 水平的角度K* 产品的高度 + 水平的角度B
                        tana = math.tan(math.radians(角度))

                        下开口值, 上开口值 = 计算开口范围(高度=产品的高度, 下开口K=水平的下开口K, 下开口B=水平的下开口B,深度补偿K=水平的深度补偿K, 深度补偿B=水平的深度补偿B, 正切角度=tana)
                        最小的偏移 = 0
                        最大的偏移 = 上开口值
                        是否是从小到大的开口偏移 = True
                        当前一层是否切割完整 = False

                        旋转任务的的分割数 = 执行任务的参数.get("R轴旋转的分割数")
                        准备开始切割下一次的第一次 = False
                        适当延长 = 1

                        当前步骤 = ProgramFreeParamsStep.移动到最开始的位置

                    await self._十工位的运动.开启激光()
                case ProgramFreeParamsStep.清理所有状态:
                    self._是否跳过请求 = False
                    await self._十工位的运动.关闭吹风()
                    await self._十工位的运动.关闭激光()
                    await self._运动.停止轴运动("R")
                    # 不重复调急停——急停已在外部控制指令中触发
                    # TODO:回到台面的位置
                    # await self._运动.绝对运动("Z", 起始点的位置.get("z"))
                    # 其实坐标的路径点 = [{"x": 起始点的位置.get("x"), "y": 起始点的位置.get("y")}]
                    # await self._运动.连续插补XY(路径点=其实坐标的路径点,速度=10)
                    # await self._运动.U轴旋转角度(0)
                    当前步骤 = ProgramFreeParamsStep.结束当前任务


                case ProgramFreeParamsStep.结束当前任务:
                    return True

        print("执行任务的参数",执行任务的参数)
        return 是否完成切割


    async def _切割直线(self,配方数据:dict[str, Any],执行任务的参数:dict[str, Any])->bool:
        return True
