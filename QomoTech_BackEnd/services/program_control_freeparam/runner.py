import math
from typing import Any
import asyncio

from services.program_control_freeparam.motion_primitives import 自由编辑参数的额外运动控制
from services.program_control_freeparam.step import ProgramFreeParamsStep
from services.MotionService import MotionService
from services.program_control_freeparam.geometry import 构建任务的数据, 构建执行任务的参数, 构建配方数据, 计算开口范围, 更新V型开口偏移, 更新平行型开口偏移
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("自由参数切割程序")



# ======================================================================
# Runner
# ======================================================================

class ProgramRunnerFreeParam:

    def __init__(self) -> None:
        self._运动 = MotionService.获取实例()
        self._自由编辑参数的运动 = 自由编辑参数的额外运动控制(self._运动)

        # ── 运行状态标志 ──
        self._是否运行中 = False
        self._是否已暂停 = False
        self._是否急停请求 = False

        self._控制锁 = asyncio.Lock()
        self._执行锁 = asyncio.Lock()

        # ── 广播回调（由 ProgramServiceFreeParam 注入） ──
        self._广播回调 = None

    # ==================================================================
    # 运行状态快照
    # ==================================================================

    def 获取运行状态(self) -> dict[str, Any]:
        return {
            "running": self._是否运行中,
            "paused": self._是否已暂停,
            "total_tasks": 0,
            "current_task_index": 0,
            "进度百分比": 0.0,
        }

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
        if self._运动.适配器 and self._运动.适配器.已连接:
            try:
                await self._运动.设置输出(2, False)
                await self._运动.暂停()
            except Exception:
                pass
        self._广播状态变更(force=True)
        return {"success": True, "message": "已暂停"}

    async def 恢复(self) -> dict[str, Any]:
        async with self._控制锁:
            if not self._是否运行中:return {"success": False, "message": "当前没有运行中的程序"}
            self._是否已暂停 = False
        if self._运动.适配器 and self._运动.适配器.已连接:
            try:
                await self._运动.继续()
                await self._运动.设置输出(2, True)
            except Exception:
                pass
        self._广播状态变更(force=True)
        return {"success": True, "message": "已继续运行"}

    async def 急停(self) -> dict[str, Any]:
        async with self._控制锁:
            self._是否急停请求 = True
            self._是否已暂停 = False
        if self._运动.适配器 and self._运动.适配器.已连接:
            await self._运动.设置输出(0, False)
            await self._运动.设置输出(2, False)
            await self._运动.急停()
        self._广播状态变更(force=True)
        return {"success": True, "message": "已急停"}

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

    async def 执行自由编辑参数(self, *, 配方数据: dict[str, Any], 实体数据: list[dict[str, Any]]) -> dict[str, Any]:
        if self._执行锁.locked():return {"success": False, "message": "程序正在执行中（重复触发被拒绝）"}
        if not self._运动.适配器 or not self._运动.适配器.已连接:return {"success": False, "message": "motion 控制器未连接"}
        async with self._执行锁:
            async with self._控制锁:
                self._是否运行中 = True
                self._是否已暂停 = False
                self._是否急停请求 = False
            try:
                任务总数 = len(实体数据)
                日志.info(f"[FreeParam] ====== 开始执行，共 {任务总数} 个任务 ======")

                # 循环前获取当前 XYZ 轴位置
                当前X, 当前Y = await self._运动.取_xy_实际位置()
                当前Z = await self._运动.取_z_实际位置()

                for 序号, 行数据 in enumerate(实体数据):
                    当前序号 = 序号 + 1
                    日志.info(f"\n[FreeParam] ======== 任务 {当前序号}/{任务总数} ========")
                    该序号的参数 = 构建任务的数据(行数据)
                    该序号的配方 = 构建配方数据(配方数据,该序号的参数.get("配方ID"))
                    # 当前平面的Z轴位置：往上逐个累加前面任务的高度
                    累计高度 = sum(float(实体数据[k].get("height", 0)) for k in range(序号))
                    直径所在平面的Z高度 = abs(当前Z) + 累计高度
                    执行任务的参数 = 构建执行任务的参数(该序号的参数, 直径所在平面的Z高度)
                    try:
                        await self._切割(配方数据=该序号的配方,执行任务的参数=执行任务的参数)
                    except Exception as e:
                        日志.error(f"任务 {当前序号} 执行失败: {e}")
                        return {"success": False, "message": f"任务 {当前序号} 执行失败: {e}"}

                日志.info(f"\n[FreeParam] ====== 全部完成，共处理 {任务总数} 个任务 =====")
                return {"success": True, "task_count": 任务总数}
            finally:
                async with self._控制锁:
                    self._是否运行中 = False
                    self._是否已暂停 = False
                    self._是否急停请求 = False
                self._广播状态变更(force=True)

    async def _切割(self,配方数据:dict[str, Any],执行任务的参数:dict[str, Any])->bool:
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
        

        
        角度 = 水平的角度K* 产品的高度 + 水平的角度B
        tana = math.tan(math.radians(角度))

        下开口值, 上开口值 = 计算开口范围(高度=产品的高度, 下开口K=水平的下开口K, 下开口B=水平的下开口B,深度补偿K=水平的深度补偿K, 深度补偿B=水平的深度补偿B, 正切角度=tana)
        最小的偏移 = 0
        最大的偏移 = 上开口值
        是否是从小到大的开口偏移 = True

        旋转任务的的分割数 = 执行任务的参数.get("R轴旋转的分割数")
        当前R轴旋转分割数 = 0 



        while 当前步骤< ProgramFreeParamsStep.结束当前任务:
            match 当前步骤: 

                case ProgramFreeParamsStep.准备开始:
                    是否连上 = self._运动.适配器.已连接 if self._运动.适配器 else False
                    if 是否连上:
                        await self._自由编辑参数的运动.开启吹风()
                        当前步骤 = ProgramFreeParamsStep.U轴进行角度旋转


                case ProgramFreeParamsStep.U轴进行角度旋转:
                    旋转角度 = 执行任务的参数.get("U轴的旋转角度")
                    旋转结果 = await self._运动.U轴旋转角度(旋转角度)
                    if not 旋转结果.get('success'): 当前步骤 = ProgramFreeParamsStep.清理所有状态
                    当前步骤 = ProgramFreeParamsStep.判断是否到达旋转角度



                case ProgramFreeParamsStep.判断是否到达旋转角度:
                    跳出计数 = 0
                    while True:
                        if self._是否急停请求:
                            当前步骤 = ProgramFreeParamsStep.清理所有状态
                            break
                        if self._是否已暂停:
                            await asyncio.sleep(0.05)
                            continue
                        await asyncio.sleep(0.02)
                        是否到达 = await self._运动.U轴是否到达旋转角度(旋转角度)
                        if 是否到达:
                            当前步骤 = ProgramFreeParamsStep.移动到最开始的位置
                            break
                        跳出计数 += 1
                        if 跳出计数 >= 2000:
                            日志.error(f"U轴旋转超时（目标角度={旋转角度}°）")
                            当前步骤 = ProgramFreeParamsStep.清理所有状态
                            break

                case ProgramFreeParamsStep.移动到最开始的位置:
                    起点X = 执行任务的参数.get("切割中点的坐标").get("x")
                    起点Y = 执行任务的参数.get("切割中点的坐标").get("y")
                    起点Z = 执行任务的参数.get("切割中点的坐标").get("z")
                    try:
                        await self._运动.绝对运动并设速度("X", 起点X)
                        await self._运动.绝对运动并设速度("Y", 起点Y)
                        await self._运动.绝对运动并设速度("Z", 起点Z)

                        等到轴停止结果 =  await self._运动.等待轴到位(轴名与位置=[("X",起点X),("Y",起点Y),("Z",起点Z)],容差=0.01)
                        if 等到轴停止结果:
                            当前步骤 = ProgramFreeParamsStep.判断高度是否满足 
                        else:
                            当前步骤 = ProgramFreeParamsStep.清理所有状态
                    except Exception:
                        当前步骤 = ProgramFreeParamsStep.清理所有状态
                    

                case ProgramFreeParamsStep.判断高度是否满足:
                    if 累计下降量 <= 产品的高度:
                        当前步骤 = ProgramFreeParamsStep.切割直线
                    else:
                        当前步骤 = ProgramFreeParamsStep.清理所有状态

                
                case ProgramFreeParamsStep.切割直线:
                    # TODO:这个就需要起点和终点的两个坐标
                    插补运行的路径点 = [{"x": 0, "y": 0}, {"x": 10, "y": 0}]
                    当前速度百分比 = 边缘切割速度百分比 if 是否在边缘位置 else 中间切割速度百分比
                    目标运行速度 = 插补的运行速度 * 当前速度百分比
                    切割直线的结果 = await self._运动.连续插补XY(路径点=插补运行的路径点,速度=目标运行速度)
                    if 切割直线的结果:
                        当前步骤 = ProgramFreeParamsStep.更新开口偏移值


                case ProgramFreeParamsStep.更新开口偏移值:
                    当前开口值 = 当前开口值 + X轴的偏移量 if 是否是从小到大的开口偏移 else 当前开口值 - X轴的偏移量
                    当前开口值是否在范围内 = (当前开口值> 最小的偏移 / 1000 and 当前开口值 < 最大的偏移 / 1000)

                    if 最大的偏移 / 1000 < 当前开口值 and 是否是从小到大的开口偏移 and not 是否需要跳转计算下一层开口:
                        当前开口值 = 最大的偏移 / 1000
                        是否在边缘位置 = True
                        是否是从小到大的开口偏移 = not 是否是从小到大的开口偏移
                        是否需要跳转计算下一层开口 = True
                    if 最小的偏移 / 1000 > 当前开口值 and not 是否是从小到大的开口偏移 and not 是否需要跳转计算下一层开口:
                        当前开口值 = 最小的偏移 / 1000
                        是否在边缘位置 = True
                        是否是从小到大的开口偏移 = not 是否是从小到大的开口偏移
                        是否需要跳转计算下一层开口 = True



                case ProgramFreeParamsStep.判断R轴是否转动一圈:
                    if 当前R轴旋转分割数 >= 旋转任务的的分割数:
                        当前R轴旋转的分割数 = 0
                        当前步骤 = ProgramFreeParamsStep.更新开口偏移值
                    else:
                        当前R轴旋转的分割数 += 1
                        R轴旋转圈数 = float(当前R轴旋转分割数 / 旋转任务的的分割数) 
                        await self._运动.R轴旋转的圈数(R轴旋转圈数)
                        当前步骤 = ProgramFreeParamsStep.切割直线



                case ProgramFreeParamsStep.计算下一层开口:
                    if 水平的开口形状 == "V型":
                        最小的偏移, 最大的偏移 = 更新V型开口偏移(上开口值=上开口值, 正切角度=tana, 累计下降量=累计下降量,)
                    if 水平的开口形状 == "//型":
                        最小的偏移, 最大的偏移 = 更新平行型开口偏移(上开口值=上开口值, 正切角度=tana, 累计下降量=累计下降量,)



                case ProgramFreeParamsStep.清理所有状态:
                    await self._自由编辑参数的运动.关闭吹风()
                    await self._自由编辑参数的运动.关闭激光()
                    await self._运动.急停()
                    # TODO:回到台面的位置

                    当前步骤 = ProgramFreeParamsStep.结束当前任务


                case ProgramFreeParamsStep.结束当前任务:
                    return True

        print("执行任务的参数",执行任务的参数)
        return 是否完成切割
