"""程序执行编排器 —— 从 ``core/startPragram.py`` 重构而来。

将原 1328 行模块级代码重构为 ``ProgramRunner`` 类：
- 全局变量 → 实例属性（可测试、可复用）
- 魔术数字 → ``ProgramStep`` 枚举
- 配方查找 → ``RecipeResolver``
- 运动操作 → ``MotionPrimitives``
- 几何计算 → ``geometry`` 模块
"""

from __future__ import annotations

import asyncio
import collections.abc
import math
from typing import Any

from services.SystemSettingService import 读取存储的4P旋转中心补偿值
from core.calc_offset_ljs import OffsetEndpointCalculator
from core.calc_rotation import 计算实体绕坐标轴旋转后的实体点
from services.MotionService import MotionService
from services.Rs232Service import Rs232Service
from services.program_control.geometry import (
    判断是否都是圆或者圆弧,
    判断当前图形是否闭合,
    更新V型开口偏移,
    更新平行型开口偏移,
    计算开口范围,
)
from services.program_control.motion_primitives import MotionPrimitives, ProgramContext
from services.program_control.recipe_resolver import (
    RecipeResolver,
    ProgramRecipeSet,
    在配方中查找ID的配方,
)
from services.program_control.step import ProgramStep
from services.communicate_control.laser_persistence import 从文件加载 as 读取激光设置文件
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序执行")

_ALARM_CLEAR_AXIS_NOS = (0, 1, 2, 3, 4)
_轴号映射: dict[int, str] = {0: "X", 1: "Y", 2: "Z", 3: "U", 4: "R"}


class ProgramRunner(ProgramContext):
    """程序执行编排器 —— 单次运行实例。

    实现 ``ProgramContext`` 协议，供 ``MotionPrimitives`` 回调状态检查。

    用法::

        runner = ProgramRunner()
        result = await runner.执行程序(配方数据=..., 实体数据=...)
    """

    def __init__(self) -> None:
        self._运动 = MotionService.获取实例()
        self._串口 = Rs232Service.获取实例()
        self._运动原语 = MotionPrimitives(self._运动, self)

        # ---- 运行状态（原模块级 global） ----
        self._是否运行中 = False
        self._是否已暂停 = False
        self._是否急停请求 = False
        self._是否跳过请求 = False
        self._需恢复激光 = False
        self._任务总数 = 0
        self._当前任务序号 = 0
        self._进度百分比 = 0.0

        self._控制锁 = asyncio.Lock()
        self._执行锁 = asyncio.Lock()

        # ---- 缓存 ----
        self._激光厂家: str | None = None

        # ---- 广播回调（由 PragramService 注入） ----
        self._广播回调: collections.abc.Callable[..., None] | None = None

    # ==================================================================
    # ProgramContext 协议实现
    # ==================================================================

    def 是否已急停(self) -> bool:
        return self._是否急停请求

    def 是否已请求跳过(self) -> bool:
        return self._是否跳过请求

    def 是否已暂停(self) -> bool:
        return self._是否已暂停

    def 清除跳过请求(self) -> None:
        self._是否跳过请求 = False

    # ==================================================================
    # 运行状态快照
    # ==================================================================

    def 获取运行状态(self) -> dict[str, Any]:
        进度 = max(0.0, min(100.0, float(self._进度百分比)))
        return {"running": bool(self._是否运行中),"paused": bool(self._是否已暂停),"total_tasks": int(self._任务总数),"current_task_index": int(self._当前任务序号),"进度百分比": 进度}

    def 更新进度(
        self,
        *,
        任务总数: int | None = None,
        当前任务序号: int | None = None,
        current_task_jindubaifenbi: float | None = None,
    ) -> None:
        if 任务总数 is not None:self._任务总数 = max(0, int(任务总数))
        if 当前任务序号 is not None:self._当前任务序号 = max(0, int(当前任务序号))
        if current_task_jindubaifenbi is not None:self._进度百分比 = max(0.0, min(100.0, float(current_task_jindubaifenbi)))
        self._广播状态变更()

    def _广播状态变更(self, *, force: bool = False) -> None:
        """通知外部订阅者（PragramService / 旧 program_status_ws）。"""
        if self._广播回调 is not None:self._广播回调(force=force)

    # ==================================================================
    # 控制指令
    # ==================================================================

    async def 暂停(self) -> dict[str, Any]:
        async with self._控制锁:
            if not self._是否运行中:
                return {"success": False, "message": "当前没有运行中的程序"}
            self._是否已暂停 = True
        if self._运动.适配器 and self._运动.适配器.已连接:
            激光之前开启 = await self._运动.读_输出(2)
            self._需恢复激光 = 激光之前开启
            if 激光之前开启:
                await self._运动.设置输出(2, False)
            await self._运动.暂停()
        self._广播状态变更(force=True)
        return {"success": True, "message": "已暂停"}

    async def 恢复(self) -> dict[str, Any]:
        async with self._控制锁:
            if not self._是否运行中:
                return {"success": False, "message": "当前没有运行中的程序"}
            self._是否已暂停 = False
        if self._运动.适配器 and self._运动.适配器.已连接:
            await self._运动.继续()
            if self._需恢复激光:
                await self._运动.设置输出(2, True)
                self._需恢复激光 = False
        self._广播状态变更(force=True)
        return {"success": True, "message": "已继续运行"}

    async def 急停(self) -> dict[str, Any]:
        async with self._控制锁:
            self._是否急停请求 = True
            self._是否已暂停 = False
            self._需恢复激光 = False
        if self._运动.适配器 and self._运动.适配器.已连接:
            await self._运动.设置输出(0, False)
            await self._运动.设置输出(2, False)
            await self._运动.急停()
        self._广播状态变更(force=True)
        return {"success": True, "message": "已急停"}

    async def 跳过任务(self) -> dict[str, Any]:
        async with self._控制锁:
            if not self._是否运行中:
                return {"success": False, "message": "当前没有运行中的程序"}
            self._是否跳过请求 = True
        if self._运动.适配器 and self._运动.适配器.已连接:
            await self._运动.急停()
        self._广播状态变更(force=True)
        return {"success": True, "message": "已请求跳过当前任务"}

    async def 复位(self) -> dict[str, Any]:
        try:
            运动服务 = MotionService.获取实例()
        except Exception:
            return {"success": False, "message": "MotionService 未启动"}
        if not 运动服务.适配器 or not 运动服务.适配器.已连接:
            return {"success": False, "message": "motion 控制器未连接"}
        失败列表: list[int] = []
        for 轴号 in _ALARM_CLEAR_AXIS_NOS:
            try:
                await 运动服务.清除轴错误(_轴号映射[int(轴号)])
            except Exception:
                失败列表.append(int(轴号))
        if 失败列表:
            return {"success": False, "message": f"部分轴清除报警失败: {失败列表}"}
        await 运动服务.复位()
        return {"success": True, "message": "报警已清除，状态机已复位"}

    # ==================================================================
    # 激光厂家
    # ==================================================================

    def _获取激光厂家(self) -> str:
        if self._激光厂家 is not None:return self._激光厂家
        try:
            data = 读取激光设置文件()
            if data and isinstance(data, dict):
                self._激光厂家 = str(data.get("manufacturer", "KMJGQ_XYT") or "KMJGQ_XYT")
        except Exception:
            self._激光厂家 = "KMJGQ_XYT"
        return self._激光厂家

    # ==================================================================
    # 主入口
    # ==================================================================

    async def 执行程序(
        self,
        *,
        配方数据: dict[str, Any],
        实体数据: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """程序执行主入口 —— 原 ``执行开始任务程序_最重要的``。"""
        if not self._运动.适配器 or not self._运动.适配器.已连接:return {"success": False, "message": "motion 控制器未连接", "data": {"connected": False}}
        if self._执行锁.locked():return {"success": False, "message": "程序正在执行中（重复触发被拒绝）", "data": None}

        async with self._执行锁:
            await self._运动.复位()
            try:
                self._运动.暂停状态采集()

                所有任务列表 = OffsetEndpointCalculator.calc_xy_points(实体数据, 0)
                if not 所有任务列表: return {"success": False, "message": "没有可执行的任务，请检查实体几何", "data": None}

                async with self._控制锁:
                    self._是否运行中 = True
                    self._是否已暂停 = False
                    self._是否急停请求 = False
                    self._是否跳过请求 = False
                    self._需恢复激光 = False
                
                self.更新进度(任务总数=len(所有任务列表), 当前任务序号=0, current_task_jindubaifenbi=0.0)

                for 当前任务索引 in range(len(所有任务列表)):
                    self.更新进度(当前任务序号=当前任务索引 + 1, current_task_jindubaifenbi=0.0)
                    if self._是否急停请求:
                        await self._运动原语.清除运行输出()
                        return {"success": False, "message": "程序已急停", "data": None}

                    resolver = RecipeResolver(配方数据)
                    配方集 = resolver.解析全部()
                    if 配方集 is None:
                        日志.warning("配方解析失败，跳过任务 %s", 当前任务索引)
                        continue

                    垂直公式 = 配方集.垂直公式
                    加工轴 = 垂直公式.get("cuttingAxis")
                    是否圆或圆弧 = 判断是否都是圆或者圆弧(实体数据=实体数据)

                    if 加工轴 == 'R' and 是否圆或圆弧:
                        结果 = await self._R轴切圆(原始任务序号=当前任务索引,配方数据=配方数据,实体数据=实体数据,配方集=配方集)
                    elif 加工轴 == 'XY':
                        结果 = await self._修面和切片(原始任务序号=当前任务索引,配方数据=配方数据,实体数据=实体数据,配方集=配方集)
                    else:
                        结果 = True  # 未知加工轴类型，跳过

                    if 结果 == "skip":
                        continue
                    if 结果 == "abort":
                        return {"success": False, "message": "程序已急停", "data": None}
                    if 结果 is False:
                        return {"success": False, "message": "运动失败", "data": None}

                if self._是否急停请求:
                    await self._运动原语.清除运行输出()
                    return {"success": False, "message": "程序已急停", "data": None}
                return {"success": True, "message": "程序执行完成", "data": None}
            except Exception as e:
                日志.exception(f"执行程序 失败: {e}")
                return {"success": False, "message": "程序执行异常", "data": {"error": "运行报错"}}
            finally:
                self._运动.恢复状态采集()
                async with self._控制锁:
                    self._是否运行中 = False
                    self._是否已暂停 = False
                    self._是否跳过请求 = False
                    self._是否急停请求 = False
                    self._需恢复激光 = False
                    self._任务总数 = 0
                    self._当前任务序号 = 0
                    self._进度百分比 = 0.0
                self._广播状态变更(force=True)

    # ==================================================================
    # 修面和切片（原 ``修面和切片的程序``）
    # ==================================================================

    async def _修面和切片(
        self,
        原始任务序号: int,
        配方数据: dict[str, Any],
        实体数据: list[dict[str, Any]],
        配方集: ProgramRecipeSet,
    ) -> bool | str:
        """XY 轴修面和切片程序。"""

        # ---- 参数提取 ----
        是否打开激光 = False
        是否打开扫黑功能 = 配方集.是否开启扫黑
        扫黑上台的高度 = 配方集.扫黑上台高度
        扫黑功率 = 配方集.扫黑功率
        扫黑频率 = 配方集.扫黑频率
        扫黑电流 = 配方集.扫黑电流
        工作功率 = 配方集.工作功率
        工作频率 = 配方集.工作频率
        工作电流 = 配方集.工作电流

        水平公式 = 配方集.水平公式
        垂直公式 = 配方集.垂直公式

        下开口K = float(水平公式.get('lowerOpeningFormula', {}).get('k', 0))
        下开口B = float(水平公式.get('lowerOpeningFormula', {}).get('b', 0))
        深度补偿K = float(水平公式.get('depthCompensationFormula', {}).get('k', 0))
        深度补偿B = float(水平公式.get('depthCompensationFormula', {}).get('b', 0))
        补偿角度K = float(水平公式.get('compensationAngleFormula', {}).get('k', 0))
        补偿角度B = float(水平公式.get('compensationAngleFormula', {}).get('b', 0))
        变化百分比 = float(垂直公式.get("changePercent", 10))
        角度K = float(水平公式.get('angleFormula', {}).get('k', 0))
        角度B = float(水平公式.get('angleFormula', {}).get('b', 0))

        高度 = 总下降量 = float(配方数据.get('extraHeight', 0))
        角度 = 角度K * 高度 + 角度B
        tana = math.tan(math.radians(角度))
        下开口值, 上开口值 = 计算开口范围(
            高度=高度, 下开口K=下开口K, 下开口B=下开口B,
            深度补偿K=深度补偿K, 深度补偿B=深度补偿B, 正切角度=tana,
        )

        当前步骤 = ProgramStep.CHECK_CONNECTION
        是否需要跳转计算下一层开口 = False
        进度百分比 = 0
        上层量 = 0
        累计下降量 = 0
        当前开口值 = 0
        是否是从小到大的开口偏移 = True
        每次开口的偏移量 = float(垂直公式.get("xFeed", 0))
        每次下降步长量 = float(垂直公式.get("descentCutting", {}).get("speed", 0))
        每次下降步长量减少量 = float(垂直公式.get("descentCutting", {}).get("zFeed", 0))
        当前切割次数 = 0
        是否在边缘位置 = True
        边缘切割次数 = float(垂直公式.get("edgeCutting", {}).get("cutTimes", 0))
        中间切割次数 = float(垂直公式.get("middleCutting", {}).get("cutTimes", 0))
        每段子区间速度数量 = int(垂直公式.get("edgeCutting", {}).get("cutSpeedNums", 1))
        切割速度 = float(垂直公式.get("xSpeed", 10))
        原始边缘切割速度百分比值 = float(垂直公式.get("edgeCutting", {}).get("speed", 100))
        原始中间切割速度百分比值 = float(垂直公式.get("middleCutting", {}).get("speed", 100))
        边缘切割速度百分比 = 原始边缘切割速度百分比值 / 100
        中间切割速度百分比 = 原始中间切割速度百分比值 / 100
        边缘切割速度的变化K = float(垂直公式.get("edgeCutting", {}).get("change", {}).get('k', 0))
        边缘切割速度的变化B = float(垂直公式.get("edgeCutting", {}).get("change", {}).get('b', 0))
        中间切割速度的变化K = float(垂直公式.get("middleCutting", {}).get("change", {}).get('k', 0))
        中间切割速度的变化B = float(垂直公式.get("middleCutting", {}).get("change", {}).get('b', 0))
        开口形状 = 水平公式.get('openingShape', '')
        焦距补偿 = 水平公式.get('focusCompensation', 0)
        当前Z轴的位置 = await self._运动.取_z_实际位置() + float(焦距补偿)
        首次目标Z轴位置 = float(当前Z轴的位置) - float(焦距补偿)
        最小的偏移 = 0
        最大的偏移 = 上开口值

        是否需要反转 = False
        当前没有偏移的点位 = OffsetEndpointCalculator.calc_xy_points(实体数据, 0)[原始任务序号]
        原始点数据_插补数据 = 当前没有偏移的点位.copy()
        上一轮是否需要闭合 = 判断当前图形是否闭合(原始点数据_插补数据)

        # ---- 状态机主循环 ----
        while 当前步骤 <= ProgramStep.CLEANUP:
            if self._是否跳过请求:
                return await self._运动原语.跳过任务并回Z轴(z轴目标=首次目标Z轴位置, 速度=切割速度)
            if self._是否急停请求:
                当前步骤 = ProgramStep.CLEANUP

            match 当前步骤:
                case ProgramStep.CHECK_CONNECTION:
                    是否连上 = self._运动.适配器.已连接 if self._运动.适配器 else False
                    if 是否连上:
                        await self._运动原语.开启红光()
                        当前步骤 = ProgramStep.MOVE_TO_START
                    else:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.MOVE_TO_START:
                    起始点X = 当前没有偏移的点位[0].get('x')
                    起始点Y = 当前没有偏移的点位[0].get('y')
                    当前没有偏移的点位 = [{'x': 起始点X, 'y': 起始点Y}]
                    try:
                        await self._运动.绝对运动并设速度("X", 起始点X, 切割速度)
                        await self._运动.绝对运动并设速度("Y", 起始点Y, 切割速度)
                        当前步骤 = ProgramStep.WAIT_XY_IDLE
                    except Exception:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.WAIT_XY_IDLE:
                    结果 = await self._运动原语.安全拉取xy轴是否空闲()
                    if 结果.get("skip"):
                        return await self._运动原语.跳过任务并回Z轴(z轴目标=首次目标Z轴位置, 速度=切割速度)
                    if 结果.get("abort"):
                        return "abort"
                    if 结果.get("success"):
                        当前步骤 = ProgramStep.SELECT_LASER_MODE
                    else:
                        return False

                case ProgramStep.SELECT_LASER_MODE:
                    if 是否打开扫黑功能:
                        当前步骤 = ProgramStep.SEND_BLACKENING_LASER
                        累计下降量 -= 扫黑上台的高度
                    else:
                        当前步骤 = ProgramStep.SEND_WORK_LASER

                case ProgramStep.SEND_BLACKENING_LASER:
                    厂家 = self._获取激光厂家()
                    if 厂家 == "KMJGQ_MM":
                        await self._串口.mm激光器操作(True)
                    else:
                        await self._串口.发送激光数据(str(扫黑功率), str(扫黑频率), str(扫黑电流), 厂家=厂家)
                    当前步骤 = ProgramStep.ENABLE_LASER_OUTPUT

                case ProgramStep.SEND_WORK_LASER:
                    厂家 = self._获取激光厂家()
                    if 厂家 == "KMJGQ_MM":
                        await self._串口.mm激光器操作(True)
                    else:
                        await self._串口.发送激光数据(str(工作功率), str(工作频率), str(工作电流), 厂家=厂家)
                    当前步骤 = ProgramStep.ENABLE_LASER_OUTPUT

                case ProgramStep.ENABLE_LASER_OUTPUT:
                    if not 是否打开激光:
                        await self._运动原语.开启激光输出()
                        是否打开激光 = True
                    当前步骤 = ProgramStep.CHECK_DESCENT_LIMIT

                case ProgramStep.CHECK_DESCENT_LIMIT:
                    当前步骤 = ProgramStep.DESCEND_Z if 累计下降量 <= 总下降量 else ProgramStep.CLEANUP

                case ProgramStep.DESCEND_Z:
                    目标高度 = -累计下降量 + 当前Z轴的位置
                    try:
                        await self._运动.绝对运动并设速度("Z", 目标高度, 切割速度)
                        当前步骤 = ProgramStep.WAIT_Z_IDLE
                    except Exception:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.WAIT_Z_IDLE:
                    结果 = await self._运动原语.安全拉取是否空闲(轴号=2)
                    if 结果.get("skip"):
                        return await self._运动原语.跳过任务并回Z轴(z轴目标=首次目标Z轴位置, 速度=切割速度)
                    if 结果.get("abort"):
                        return "abort"
                    if 结果.get("success"):
                        当前步骤 = ProgramStep.EXECUTE_XY_INTERPOLATION
                    else:
                        return False

                case ProgramStep.EXECUTE_XY_INTERPOLATION:
                    点位合集 = OffsetEndpointCalculator.calc_xy_points(实体数据, 当前开口值)
                    当前运行点位: list[dict[str, Any]] = list(点位合集[原始任务序号])
                    是否闭合 = 判断当前图形是否闭合(当前运行点位)
                    上一轮是否需要闭合 = 是否闭合
                    if 是否需要反转 and not 是否闭合:
                        当前运行点位 = list(reversed(当前运行点位))
                    原始点数据_插补数据 = list(当前运行点位)

                    当前速度百分比 = 边缘切割速度百分比 if 是否在边缘位置 else 中间切割速度百分比
                    目标运行速度 = 切割速度 * 当前速度百分比

                    try:
                        await self._运动.连续插补XY(路径点=原始点数据_插补数据, 速度=目标运行速度)
                        当前步骤 = ProgramStep.CHECK_REPEAT_CUT
                    except Exception:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.CHECK_REPEAT_CUT:
                    if 是否在边缘位置 and (当前切割次数 + 1) < 边缘切割次数:
                        当前切割次数 += 1
                        if not 上一轮是否需要闭合:
                            是否需要反转 = not 是否需要反转
                        当前步骤 = ProgramStep.EXECUTE_XY_INTERPOLATION
                    else:
                        当前切割次数 = 0
                        if 是否需要跳转计算下一层开口 and not 上一轮是否需要闭合:
                            是否需要反转 = not 是否需要反转
                        当前步骤 = ProgramStep.WAIT_XY_IDLE_POST_CUT if not 是否需要跳转计算下一层开口 else ProgramStep.CALCULATE_NEXT_LAYER

                case ProgramStep.WAIT_XY_IDLE_POST_CUT:
                    结果 = await self._运动原语.安全拉取xy轴是否空闲(休眠秒=0.01)
                    if 结果.get("skip"):
                        return await self._运动原语.跳过任务并回Z轴(z轴目标=首次目标Z轴位置, 速度=切割速度)
                    if 结果.get("abort"):
                        return "abort"
                    if 结果.get("success"):
                        当前步骤 = ProgramStep.UPDATE_OPENING_OFFSET if not 是否需要跳转计算下一层开口 else ProgramStep.CALCULATE_NEXT_LAYER
                    else:
                        return False

                case ProgramStep.UPDATE_OPENING_OFFSET:
                    当前开口值 = 当前开口值 + 每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前开口值 - 每次开口的偏移量
                    当前开口值是否在范围内 = (
                        round(当前开口值, 6) > round(最小的偏移 / 1000, 6)
                        and round(当前开口值, 6) < round(最大的偏移 / 1000, 6)
                    )
                    if 当前开口值是否在范围内:
                        是否在边缘位置 = False
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
                    if not 上一轮是否需要闭合:
                        是否需要反转 = not 是否需要反转
                    当前步骤 = ProgramStep.EXECUTE_XY_INTERPOLATION

                case ProgramStep.CALCULATE_NEXT_LAYER:
                    进度百分比 = (
                        累计下降量 / 高度 * 100
                        if not 是否打开扫黑功能
                        else (累计下降量 + 扫黑上台的高度) / 高度 * 100
                    )
                    当前量 = int(进度百分比 // 变化百分比)
                    每次下降步长量 -= (当前量 - 上层量) * 每次下降步长量减少量
                    上层量 = 当前量
                    累计下降量 += round(每次下降步长量, 6)

                    当前大区间索引 = int(进度百分比 // 变化百分比) if 变化百分比 > 0 else 0
                    段内进度 = (进度百分比 % 变化百分比) // (变化百分比 // 每段子区间速度数量) if 变化百分比 > 0 and 每段子区间速度数量 > 0 else 0
                    中间切割速度百分比 = min(1.1, max(0.3, round((原始中间切割速度百分比值 + 中间切割速度的变化B / 100 * (当前大区间索引 % (中间切割速度的变化K + 1))), 4)))
                    边缘切割速度百分比 = min(1.0, max(0.3, round((原始边缘切割速度百分比值 + 边缘切割速度的变化B / 100 * 段内进度 + 边缘切割速度的变化K / 100 * 当前大区间索引), 4)))

                    if 进度百分比 > (变化百分比) / 2 and 是否打开扫黑功能:
                        是否打开扫黑功能 = False
                        await self._运动原语.关闭激光输出()
                        是否打开激光 = False
                        累计下降量 = 0

                    if 开口形状 == "V型":
                        最小的偏移, 最大的偏移 = 更新V型开口偏移(
                            上开口值=上开口值, 正切角度=tana, 累计下降量=累计下降量,
                        )
                    if 开口形状 == "//型":
                        最小的偏移, 最大的偏移 = 更新平行型开口偏移(
                            上开口值=上开口值, 正切角度=tana, 累计下降量=累计下降量,
                        )

                    self.更新进度(current_task_jindubaifenbi=进度百分比)
                    是否需要跳转计算下一层开口 = False
                    当前步骤 = ProgramStep.SELECT_LASER_MODE if not 是否打开扫黑功能 and not 是否打开激光 else ProgramStep.CHECK_DESCENT_LIMIT

                case ProgramStep.STEP_110:
                    当前步骤 = ProgramStep.STEP_150

                case ProgramStep.STEP_150:
                    当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.CLEANUP:
                    返回最原始的Z轴焦距位置 = 当前Z轴的位置 - float(焦距补偿)
                    try:
                        await self._运动.绝对运动并设速度("Z", 返回最原始的Z轴焦距位置, 切割速度)
                        当前步骤 = ProgramStep.WAIT_Z_RETURN
                    except Exception:
                        pass

                case ProgramStep.WAIT_Z_RETURN:
                    跳转计数 = 0
                    目标位置 = 当前Z轴的位置 - float(焦距补偿)
                    while 跳转计数 < 2000:
                        try:
                            实际位置 = await self._运动.取_z_实际位置()
                            if abs(实际位置 - 目标位置) <= 0.001:
                                当前步骤 = ProgramStep.DONE
                                break
                        except Exception:
                            日志.exception("WAIT_Z_RETURN 轮询 Z 轴位置异常")
                        跳转计数 += 1
                        await asyncio.sleep(0.02)
                    else:
                        return False

                case ProgramStep.DONE:
                    await self._运动.停止运动()
                    await self._运动原语.关闭红光()
                    await self._运动原语.关闭激光输出()
                    await self._串口.mm激光器操作(False)
                    当前步骤 = ProgramStep.TERMINAL

        return True

    # ==================================================================
    # R 轴切圆（原 ``用旋转轴去切圆``）
    # ==================================================================

    async def _R轴切圆(
        self,
        原始任务序号: int,
        配方数据: dict[str, Any],
        实体数据: list[dict[str, Any]],
        配方集: ProgramRecipeSet,
    ) -> bool | str:
        """R 轴旋转切圆程序。"""
        实体列表 = 实体数据
        当前任务索引 = 原始任务序号

        # ---- 参数提取 ----
        是否打开激光 = False
        是否打开扫黑功能 = 配方集.是否开启扫黑
        扫黑上台的高度 = 配方集.扫黑上台高度
        扫黑功率 = 配方集.扫黑功率
        扫黑频率 = 配方集.扫黑频率
        扫黑电流 = 配方集.扫黑电流
        工作功率 = 配方集.工作功率
        工作频率 = 配方集.工作频率
        工作电流 = 配方集.工作电流

        水平公式 = 配方集.水平公式
        垂直公式 = 配方集.垂直公式

        下开口K = float(水平公式.get('lowerOpeningFormula', {}).get('k', 0))
        下开口B = float(水平公式.get('lowerOpeningFormula', {}).get('b', 0))
        深度补偿K = float(水平公式.get('depthCompensationFormula', {}).get('k', 0))
        深度补偿B = float(水平公式.get('depthCompensationFormula', {}).get('b', 0))
        补偿角度K = float(水平公式.get('compensationAngleFormula', {}).get('k', 0))
        补偿角度B = float(水平公式.get('compensationAngleFormula', {}).get('b', 0))
        变化百分比 = float(垂直公式.get("changePercent", 10))
        角度K = float(水平公式.get('angleFormula', {}).get('k', 0))
        角度B = float(水平公式.get('angleFormula', {}).get('b', 0))
        开口形状 = 水平公式.get('openingShape', '')

        高度 = 总下降量 = float(配方数据.get('extraHeight', 0))
        角度 = 角度K * 高度 + 角度B
        tan角度 = math.tan(math.radians(角度))
        下开口值, 上开口值 = 计算开口范围(
            高度=高度, 下开口K=下开口K, 下开口B=下开口B,
            深度补偿K=深度补偿K, 深度补偿B=深度补偿B, 正切角度=tan角度,
        )
        最小的偏移 = 0
        最大的偏移 = 上开口值

        当前步骤 = ProgramStep.CHECK_CONNECTION
        是否需要跳转计算下一层开口 = False
        进度百分比 = 0
        上层量 = 0
        累计下降量 = 0
        当前开口值 = 0
        是否是从小到大的开口偏移 = True
        当前开口值是否在范围内 = True
        每次开口的偏移量 = float(垂直公式.get("xFeed", 0))
        每次下降步长量 = float(垂直公式.get("descentCutting", {}).get("speed", 0))
        每次下降步长量减少量 = float(垂直公式.get("descentCutting", {}).get("zFeed", 0))
        当前切割次数 = 0
        是否在边缘位置 = True
        边缘切割次数 = float(垂直公式.get("edgeCutting", {}).get("cutTimes", 0))
        中间切割次数 = float(垂直公式.get("middleCutting", {}).get("cutTimes", 0))
        旋转切割的次数 = max(边缘切割次数, 中间切割次数)
        切割速度 = float(垂直公式.get("xSpeed", 10))
        边缘切割速度百分比 = float(垂直公式.get("edgeCutting", {}).get("speed", 100)) / 100
        中间切割速度百分比 = float(垂直公式.get("middleCutting", {}).get("speed", 100)) / 100
        焦距补偿 = 水平公式.get('focusCompensation', 0)
        当前Z轴的位置 = await self._运动.取_z_实际位置() + float(焦距补偿)
        首次目标Z轴位置 = float(当前Z轴的位置) - float(焦距补偿)

        R轴的圈数 = 0

        while 当前步骤 <= ProgramStep.CLEANUP:
            match 当前步骤:
                case ProgramStep.CHECK_CONNECTION:
                    是否连上 = self._运动.适配器.已连接 if self._运动.适配器 else False
                    if 是否连上:
                        await self._运动原语.开启红光()
                        当前步骤 = ProgramStep.MOVE_TO_START
                    else:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.MOVE_TO_START:
                    圆中心点X = 实体列表[当前任务索引].get('center').get('x') + 实体列表[当前任务索引].get('radius')
                    圆中心点Y = 实体列表[当前任务索引].get('center').get('y')
                    try:
                        await self._运动.绝对运动并设速度("X", 圆中心点X, 10)
                        await self._运动.绝对运动并设速度("Y", 圆中心点Y, 10)
                        当前步骤 = ProgramStep.WAIT_XY_IDLE
                    except Exception:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.WAIT_XY_IDLE:
                    结果 = await self._运动原语.安全拉取xy轴是否空闲()
                    if 结果.get("skip"):
                        return await self._运动原语.跳过任务并回Z轴(z轴目标=首次目标Z轴位置, 速度=切割速度)
                    if 结果.get("abort"):
                        return "abort"
                    if 结果.get("success"):
                        当前步骤 = ProgramStep.SELECT_LASER_MODE
                    else:
                        return False

                case ProgramStep.SELECT_LASER_MODE:
                    if 是否打开扫黑功能:
                        当前步骤 = ProgramStep.SEND_BLACKENING_LASER
                        累计下降量 -= 扫黑上台的高度
                    else:
                        当前步骤 = ProgramStep.SEND_WORK_LASER

                case ProgramStep.SEND_BLACKENING_LASER:
                    await self._串口.发送激光数据(str(扫黑功率), str(扫黑频率), str(扫黑电流), 厂家=self._获取激光厂家())
                    当前步骤 = ProgramStep.ENABLE_LASER_OUTPUT

                case ProgramStep.SEND_WORK_LASER:
                    await self._串口.发送激光数据(str(工作功率), str(工作频率), str(工作电流), 厂家=self._获取激光厂家())
                    当前步骤 = ProgramStep.ENABLE_LASER_OUTPUT

                case ProgramStep.ENABLE_LASER_OUTPUT:
                    if not 是否打开激光:
                        await self._运动原语.开启激光输出()
                        是否打开激光 = True
                    当前步骤 = ProgramStep.START_R_AXIS_ROTATION

                case ProgramStep.START_R_AXIS_ROTATION:
                    R轴旋转结果 = await self._运动.R轴一直进行旋转()
                    当前步骤 = ProgramStep.CHECK_DESCENT_LIMIT if R轴旋转结果.get('success') else ProgramStep.CLEANUP

                case ProgramStep.CHECK_DESCENT_LIMIT:
                    当前步骤 = ProgramStep.DESCEND_Z if 累计下降量 <= 总下降量 else ProgramStep.CLEANUP

                case ProgramStep.DESCEND_Z:
                    Z轴目标位置 = -累计下降量 + 当前Z轴的位置
                    try:
                        await self._运动.绝对运动并设速度("Z", Z轴目标位置, 切割速度)
                        当前步骤 = ProgramStep.WAIT_Z_IDLE
                    except Exception:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.WAIT_Z_IDLE:
                    结果 = await self._运动原语.安全拉取是否空闲(轴号=2)
                    if 结果.get("skip"):
                        return await self._运动原语.跳过任务并回Z轴(z轴目标=首次目标Z轴位置, 速度=切割速度)
                    if 结果.get("abort"):
                        return "abort"
                    if 结果.get("success"):
                        当前步骤 = ProgramStep.EXECUTE_XY_INTERPOLATION
                    else:
                        return False

                case ProgramStep.EXECUTE_XY_INTERPOLATION:
                    R轴的圈数 = await self._运动.获取R轴的当前位置()
                    当前步骤 = ProgramStep.UPDATE_OPENING_OFFSET if R轴的圈数 is not None else ProgramStep.CLEANUP

                case ProgramStep.UPDATE_OPENING_OFFSET:
                    目标圈数 = float(R轴的圈数) + 1.0
                    跳出计数 = 0
                    已见暂停 = False
                    while 跳出计数 < 5000:
                        if self._是否急停请求:
                            await self._运动原语.清除运行输出()
                            return "abort"
                        if self._是否跳过请求:
                            return await self._运动原语.跳过任务并回Z轴(z轴目标=首次目标Z轴位置, 速度=切割速度)
                        if self._是否已暂停:
                            已见暂停 = True
                            await asyncio.sleep(0.05)
                            continue
                        try:
                            R轴当前的圈数 = await self._运动.获取R轴的当前位置()
                        except Exception:
                            日志.exception("R轴切圆 获取R轴位置异常")
                            跳出计数 += 1
                            await asyncio.sleep(0.02)
                            continue
                        if 已见暂停:
                            try:
                                R轴恢复结果 = await self._运动.R轴一直进行旋转()
                                if not R轴恢复结果 or not R轴恢复结果.get("success"):
                                    return False
                            except Exception:
                                日志.exception("R轴切圆 R轴恢复旋转异常")
                                return False
                            if R轴当前的圈数 is None:
                                return False
                            R轴的圈数 = float(R轴当前的圈数)
                            目标圈数 = R轴的圈数 + float(旋转切割的次数)
                            已见暂停 = False
                            continue
                        if R轴当前的圈数 is not None and float(R轴当前的圈数) >= (目标圈数 - 0.001):
                            try:
                                当前X, _ = await self._运动.取_xy_实际位置()
                            except Exception:
                                日志.exception("R轴切圆 获取XY位置异常")
                                return False
                            当前开口值 = 当前开口值 + 每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前开口值 - 每次开口的偏移量
                            当前开口值是否在范围内 = (
                                round(当前开口值, 6) >= round(最小的偏移 / 1000, 6)
                                and round(当前开口值, 6) <= round(最大的偏移 / 1000, 6)
                            )
                            if not 当前开口值是否在范围内 and 是否是从小到大的开口偏移:
                                X的目标距离 = 当前X + round(round(最大的偏移 / 1000, 6) - (当前开口值 - 每次开口的偏移量), 6)
                                当前开口值 = round(最大的偏移 / 1000, 6)
                                是否需要跳转计算下一层开口 = True
                            elif not 当前开口值是否在范围内 and not 是否是从小到大的开口偏移:
                                X的目标距离 = 当前X - round(当前开口值 + 每次开口的偏移量 - round(最小的偏移 / 1000, 6), 6)
                                当前开口值 = round(最小的偏移 / 1000, 6)
                                是否需要跳转计算下一层开口 = True
                            else:
                                X的目标距离 = 当前X + 每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前X - 每次开口的偏移量

                            try:
                                await self._运动.绝对运动并设速度("X", X的目标距离, 切割速度)
                                当前步骤 = ProgramStep.CALCULATE_NEXT_LAYER
                            except Exception:
                                当前步骤 = ProgramStep.CLEANUP
                            break
                        跳出计数 += 1
                        await asyncio.sleep(0.02)
                    else:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.CALCULATE_NEXT_LAYER:
                    if 是否需要跳转计算下一层开口:
                        是否是从小到大的开口偏移 = not 是否是从小到大的开口偏移
                    当前步骤 = ProgramStep.EXECUTE_XY_INTERPOLATION if 当前开口值是否在范围内 and not 是否需要跳转计算下一层开口 else ProgramStep.STEP_110

                case ProgramStep.STEP_110:
                    是否需要跳转计算下一层开口 = False
                    进度百分比 = (
                        (累计下降量 + 扫黑上台的高度) / 高度 * 100 if 是否打开扫黑功能
                        else 累计下降量 / 高度 * 100
                    )
                    当层量 = int(进度百分比 // 变化百分比)
                    累计下降量 -= (当层量 - 上层量) * 每次下降步长量减少量
                    上层量 = 当层量
                    累计下降量 += round(每次下降步长量, 6)

                    if 进度百分比 > 变化百分比 / 2 and 是否打开扫黑功能:
                        是否打开扫黑功能 = False
                        await self._运动原语.关闭激光输出()
                        是否打开激光 = False
                        累计下降量 = 0

                    if 开口形状 == "V型":
                        最小的偏移, 最大的偏移 = 更新V型开口偏移(
                            上开口值=上开口值, 正切角度=tan角度, 累计下降量=累计下降量,
                        )
                    if 开口形状 in ("//型", "||型"):
                        最小的偏移, 最大的偏移 = 更新平行型开口偏移(
                            上开口值=上开口值, 正切角度=tan角度, 累计下降量=累计下降量,
                        )
                    self.更新进度(current_task_jindubaifenbi=进度百分比)
                    当前步骤 = ProgramStep.SELECT_LASER_MODE if not 是否打开扫黑功能 and not 是否打开激光 else ProgramStep.CHECK_DESCENT_LIMIT

                case ProgramStep.STEP_120:
                    当前步骤 = ProgramStep.STEP_130

                case ProgramStep.STEP_130:
                    当前步骤 = ProgramStep.STEP_140

                case ProgramStep.STEP_140:
                    当前步骤 = ProgramStep.STEP_150

                case ProgramStep.STEP_150:
                    当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.CLEANUP:
                    await self._运动.停止运动()
                    await self._运动原语.关闭红光()
                    await self._运动原语.关闭激光输出()
                    当前步骤 = ProgramStep.DONE

        return True

    # ==================================================================
    # 4P 切产品（原 ``进行4P切产品``）
    # ==================================================================

    async def _4P切产品(
        self,
        原始任务序号: int,
        配方数据: dict[str, Any],
        实体数据: list[dict[str, Any]],
        配方集: ProgramRecipeSet,
    ) -> bool | str:
        """4P 产品切割程序。"""
        旋转中心补偿值 = 读取存储的4P旋转中心补偿值()

        计算当前任务实体旋转后的点 = 计算实体绕坐标轴旋转后的实体点(所有实体数据=实体数据, 旋转轴="y")

        # ---- 参数提取 ----
        是否打开激光 = False
        是否打开扫黑功能 = 配方集.是否开启扫黑
        扫黑上台的高度 = 配方集.扫黑上台高度
        扫黑功率 = 配方集.扫黑功率
        扫黑频率 = 配方集.扫黑频率
        扫黑电流 = 配方集.扫黑电流
        工作功率 = 配方集.工作功率
        工作频率 = 配方集.工作频率
        工作电流 = 配方集.工作电流

        水平公式 = 配方集.水平公式
        垂直公式 = 配方集.垂直公式

        下开口K = float(水平公式.get('lowerOpeningFormula', {}).get('k', 0))
        下开口B = float(水平公式.get('lowerOpeningFormula', {}).get('b', 0))
        深度补偿K = float(水平公式.get('depthCompensationFormula', {}).get('k', 0))
        深度补偿B = float(水平公式.get('depthCompensationFormula', {}).get('b', 0))
        补偿角度K = float(水平公式.get('compensationAngleFormula', {}).get('k', 0))
        补偿角度B = float(水平公式.get('compensationAngleFormula', {}).get('b', 0))
        变化百分比 = float(垂直公式.get("changePercent", 10))
        角度K = float(水平公式.get('angleFormula', {}).get('k', 0))
        角度B = float(水平公式.get('angleFormula', {}).get('b', 0))
        开口形状 = 垂直公式.get('openingShape', '')

        高度 = 总下降量 = float(配方数据.get('extraHeight', 0))
        角度 = 角度K * 高度 + 角度B
        tan角度 = math.tan(math.radians(角度))
        下开口值, 上开口值 = 计算开口范围(
            高度=高度, 下开口K=下开口K, 下开口B=下开口B,
            深度补偿K=深度补偿K, 深度补偿B=深度补偿B, 正切角度=tan角度,
        )

        当前步骤 = ProgramStep.CHECK_CONNECTION
        是否需要跳转计算下一层开口 = False
        进度百分比 = 0
        上层量 = 0
        累计下降量 = 0
        当前开口值 = 0
        是否是从小到大的开口偏移 = True
        每次开口的偏移量 = float(垂直公式.get("xFeed", 0))
        每次下降步长量 = float(垂直公式.get("descentCutting", {}).get("speed", 0))
        每次下降步长量减少量 = float(垂直公式.get("descentCutting", {}).get("zFeed", 0))
        当前切割次数 = 0
        是否在边缘位置 = True
        边缘切割次数 = float(垂直公式.get("edgeCutting", {}).get("cutTimes", 0))
        中间切割次数 = float(垂直公式.get("middleCutting", {}).get("cutTimes", 0))
        切割速度 = float(垂直公式.get("xSpeed", 10))
        边缘切割速度百分比 = float(垂直公式.get("edgeCutting", {}).get("speed", 100)) / 100
        中间切割速度百分比 = float(垂直公式.get("middleCutting", {}).get("speed", 100)) / 100
        最小的偏移 = 0
        最大的偏移 = 上开口值

        计算当前任务实体旋转后的点 = 计算实体绕坐标轴旋转后的实体点(所有实体数据=实体数据, 旋转轴="y")
        计算当前任务实体旋转后偏移的点 = OffsetEndpointCalculator.计算绕坐标轴旋转后的偏移点位(计算当前任务实体旋转后的点, 1)
        下降的高度 = float(float(旋转中心补偿值.Zoffset) + float(计算当前任务实体旋转后的点[原始任务序号].get('points')[0].get('z')))

        焦距补偿 = 水平公式.get('focusCompensation', 0)
        Z轴原始初始位置 = await self._运动.取_z_实际位置()
        首次目标Z轴位置 = float(Z轴原始初始位置) + float(焦距补偿)
        下降直到可以切产品的高度 = 首次目标Z轴位置 + 下降的高度

        当前没有偏移的点位 = 计算当前任务实体旋转后的点[原始任务序号].get('points')
        原始点数据_插补数据 = 当前没有偏移的点位.copy()
        是否需要反转点位 = False

        while 当前步骤 <= ProgramStep.DONE:
            if self._是否跳过请求:
                return await self._运动原语.跳过任务并回Z轴(z轴目标=Z轴原始初始位置, 速度=切割速度)
            if self._是否急停请求:
                当前步骤 = ProgramStep.DONE

            match 当前步骤:
                case ProgramStep.CHECK_CONNECTION:
                    是否连上 = self._运动.适配器.已连接 if self._运动.适配器 else False
                    if 是否连上:
                        await self._运动原语.开启红光()
                        当前步骤 = ProgramStep.MOVE_TO_START
                    else:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.MOVE_TO_START:
                    起始点X = 当前没有偏移的点位[0].get('x')
                    起始点Y = 当前没有偏移的点位[0].get('y')
                    try:
                        await self._运动.绝对运动并设速度("X", 起始点X, 切割速度)
                        await self._运动.绝对运动并设速度("Y", 起始点Y, 切割速度)
                        当前步骤 = ProgramStep.ROTATE_U_AXIS
                    except Exception:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.ROTATE_U_AXIS:
                    旋转角度 = 实体数据[原始任务序号].get("surfaceAngle")
                    旋转结果 = await self._运动.U轴旋转角度(旋转角度=旋转角度)
                    if not 旋转结果.get('success'):
                        当前步骤 = ProgramStep.CLEANUP
                    当前步骤 = ProgramStep.WAIT_U_ROTATION

                case ProgramStep.WAIT_U_ROTATION:
                    跳出计数 = 0
                    已见暂停 = False
                    while True:
                        if self._是否急停请求:
                            await self._运动原语.清除运行输出()
                            return "abort"
                        if self._是否跳过请求:
                            return await self._运动原语.跳过任务并回Z轴(z轴目标=Z轴原始初始位置, 速度=切割速度)
                        if self._是否已暂停:
                            已见暂停 = True
                            await asyncio.sleep(0.05)
                            continue
                        await asyncio.sleep(0.02)
                        是否到达旋转角度 = await self._运动.U轴是否到达旋转角度(旋转角度=旋转角度)
                        if 已见暂停:
                            当前步骤 = ProgramStep.ROTATE_U_AXIS
                            break
                        if 是否到达旋转角度:
                            当前步骤 = ProgramStep.ROTATE_U_AXIS
                            break
                        if 跳出计数 >= 2000:
                            当前步骤 = ProgramStep.CLEANUP
                        跳出计数 += 1
                    当前步骤 = ProgramStep.SELECT_LASER_MODE

                case ProgramStep.SELECT_LASER_MODE:
                    if 是否打开扫黑功能:
                        当前步骤 = ProgramStep.SEND_BLACKENING_LASER
                        累计下降量 -= 扫黑上台的高度
                    else:
                        当前步骤 = ProgramStep.SEND_WORK_LASER

                case ProgramStep.SEND_BLACKENING_LASER:
                    await self._串口.发送激光数据(str(扫黑功率), str(扫黑频率), str(扫黑电流), 厂家=self._获取激光厂家())
                    当前步骤 = ProgramStep.ENABLE_LASER_OUTPUT

                case ProgramStep.SEND_WORK_LASER:
                    await self._串口.发送激光数据(str(工作功率), str(工作频率), str(工作电流), 厂家=self._获取激光厂家())
                    当前步骤 = ProgramStep.ENABLE_LASER_OUTPUT

                case ProgramStep.ENABLE_LASER_OUTPUT:
                    if not 是否打开激光:
                        await self._运动原语.开启激光输出()
                        是否打开激光 = True
                    当前步骤 = ProgramStep.CHECK_DESCENT_LIMIT

                case ProgramStep.CHECK_DESCENT_LIMIT:
                    当前步骤 = ProgramStep.DESCEND_Z if 累计下降量 <= 总下降量 else ProgramStep.CLEANUP

                case ProgramStep.DESCEND_Z:
                    Z轴目标位置 = -累计下降量 + 下降直到可以切产品的高度
                    try:
                        await self._运动.绝对运动并设速度("Z", Z轴目标位置, 切割速度)
                        当前步骤 = ProgramStep.WAIT_Z_IDLE
                    except Exception:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.WAIT_Z_IDLE:
                    结果 = await self._运动原语.安全拉取是否空闲(轴号=2)
                    if 结果.get("skip"):
                        return await self._运动原语.跳过任务并回Z轴(z轴目标=Z轴原始初始位置, 速度=切割速度)
                    if 结果.get("abort"):
                        return "abort"
                    if 结果.get("success"):
                        当前步骤 = ProgramStep.EXECUTE_XY_INTERPOLATION
                    else:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.EXECUTE_XY_INTERPOLATION:
                    计算所有实体旋转后偏移的点 = OffsetEndpointCalculator.计算绕坐标轴旋转后的偏移点位(计算当前任务实体旋转后的点, 当前开口值)
                    当前运行点位: list[dict[str, Any]] = list(计算所有实体旋转后偏移的点[原始任务序号].get("points"))
                    是否闭合 = (
                        abs(当前运行点位[0]['x'] - 当前运行点位[-1]['x']) <= 0.001
                        and abs(当前运行点位[0]['y'] - 当前运行点位[-1]['y']) <= 0.001
                    )
                    x, y = await self._运动.取_xy_实际位置()
                    是否需要反转点位 = abs(当前运行点位[0]['x'] - x) >= 0.06 or abs(当前运行点位[0]['y'] - y) >= 0.06
                    if 是否需要反转点位 and not 是否闭合:
                        当前运行点位 = list(reversed(当前运行点位))
                    原始点数据_插补数据 = list(当前运行点位)
                    目标速度 = 切割速度 * 边缘切割速度百分比 if 是否在边缘位置 else 切割速度 * 中间切割速度百分比
                    try:
                        await self._运动.连续插补XY(路径点=原始点数据_插补数据, 速度=目标速度)
                        当前步骤 = ProgramStep.CHECK_REPEAT_CUT
                    except Exception:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.CHECK_REPEAT_CUT:
                    if 是否在边缘位置 and (当前切割次数 + 1) < 边缘切割次数:
                        当前切割次数 += 1
                        当前步骤 = ProgramStep.EXECUTE_XY_INTERPOLATION
                    else:
                        当前切割次数 = 0
                        当前步骤 = ProgramStep.WAIT_XY_IDLE_POST_CUT if not 是否需要跳转计算下一层开口 else ProgramStep.CALCULATE_NEXT_LAYER

                case ProgramStep.WAIT_XY_IDLE_POST_CUT:
                    结果 = await self._运动原语.安全拉取xy轴是否空闲(休眠秒=0.01)
                    if 结果.get("skip"):
                        return await self._运动原语.跳过任务并回Z轴(z轴目标=Z轴原始初始位置, 速度=切割速度)
                    if 结果.get("abort"):
                        return "abort"
                    if 结果.get("success"):
                        当前步骤 = ProgramStep.UPDATE_OPENING_OFFSET if not 是否需要跳转计算下一层开口 else ProgramStep.CALCULATE_NEXT_LAYER
                    else:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.UPDATE_OPENING_OFFSET:
                    当前开口值 = 当前开口值 + 每次开口的偏移量 if 是否是从小到大的开口偏移 else 当前开口值 - 每次开口的偏移量
                    结果1 = 最小的偏移 / 1000 < 当前开口值
                    结果2 = 当前开口值 < 最大的偏移 / 1000
                    if 结果1 and 结果2:
                        是否在边缘位置 = False
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
                    当前步骤 = ProgramStep.EXECUTE_XY_INTERPOLATION

                case ProgramStep.CALCULATE_NEXT_LAYER:
                    进度百分比 = (
                        (累计下降量 + 扫黑上台的高度) / 高度 * 100 if 是否打开扫黑功能
                        else 累计下降量 / 高度 * 100
                    )
                    当前量 = int(进度百分比 // 变化百分比)
                    增量 = 当前量 - 上层量
                    每次下降步长量 -= 增量 * 每次下降步长量减少量
                    上层量 = 当前量
                    累计下降量 += round(每次下降步长量, 6)

                    if 进度百分比 > (变化百分比) / 2 and 是否打开扫黑功能:
                        是否打开扫黑功能 = False
                        await self._运动原语.关闭激光输出()
                        是否打开激光 = False
                        累计下降量 = 0
                    if 开口形状 == "V型":
                        最小的偏移, 最大的偏移 = 更新V型开口偏移(
                            上开口值=上开口值, 正切角度=tan角度, 累计下降量=累计下降量,
                        )
                    if 开口形状 == "//型":
                        最小的偏移, 最大的偏移 = 更新平行型开口偏移(
                            上开口值=上开口值, 正切角度=tan角度, 累计下降量=累计下降量,
                        )
                    self.更新进度(current_task_jindubaifenbi=进度百分比)
                    是否需要跳转计算下一层开口 = False
                    当前步骤 = ProgramStep.SELECT_LASER_MODE if not 是否打开扫黑功能 and not 是否打开激光 else ProgramStep.CHECK_DESCENT_LIMIT

                case ProgramStep.STEP_110:
                    当前步骤 = ProgramStep.STEP_150

                case ProgramStep.STEP_150:
                    当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.CLEANUP:
                    try:
                        await self._运动.绝对运动并设速度("Z", Z轴原始初始位置, 切割速度)
                        当前步骤 = ProgramStep.WAIT_Z_RETURN
                    except Exception:
                        pass

                case ProgramStep.WAIT_Z_RETURN:
                    跳转计数 = 0
                    while 跳转计数 < 2000:
                        try:
                            实际位置 = await self._运动.取_z_实际位置()
                            if abs(实际位置 - Z轴原始初始位置) <= 0.001:
                                当前步骤 = ProgramStep.DONE
                                break
                        except Exception:
                            日志.exception("4P WAIT_Z_RETURN 轮询 Z 轴位置异常")
                        跳转计数 += 1
                        await asyncio.sleep(0.02)
                    else:
                        当前步骤 = ProgramStep.CLEANUP

                case ProgramStep.DONE:
                    await self._运动.停止运动()
                    await self._运动原语.关闭红光()
                    await self._运动原语.关闭激光输出()
                    当前步骤 = ProgramStep.TERMINAL

        return True
