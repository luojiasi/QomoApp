from typing import Any
import asyncio

from services.MotionService import MotionService
from services.program_control_freeparam.geometry import 构建任务的数据
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("自由参数切割程序")



# ======================================================================
# Runner
# ======================================================================

class ProgramRunnerFreeParam:

    def __init__(self) -> None:
        self._运动 = MotionService.获取实例()

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

                for 序号, 行数据 in enumerate(实体数据):
                    当前序号 = 序号 + 1
                    日志.info(f"\n[FreeParam] ======== 任务 {当前序号}/{任务总数} ========")
                    该序号的参数 = 构建任务的数据(行数据)
                    try:
                        await self._切割(配方数据=配方数据,执行任务的参数=该序号的参数)
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
        print(执行任务的参数)
        print("================================================")
        print(配方数据)
        print("================================================")
        return 是否完成切割

