from __future__ import annotations

import asyncio
import threading
from typing import Any

from services.program_control_freeparam.runner import ProgramRunnerFreeParam
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序服务")


class ProgramServiceFreeParam:

    _实例: ProgramServiceFreeParam | None = None
    _实例锁 = threading.Lock()

    @classmethod
    def 获取实例(cls) -> ProgramServiceFreeParam:
        with cls._实例锁:
            if cls._实例 is None:
                cls._实例 = cls()
            return cls._实例

    def __init__(self) -> None:
        self.程序执行器: ProgramRunnerFreeParam | None = None


    # ==================================================================
    # 生命周期
    # ==================================================================
    
    # ==================================================================
    # 运行状态
    # ==================================================================
    def 获取运行状态(self) -> dict[str, Any]:
        # if self._runner is not None: return self._runner.获取运行状态()
        return {"running": False,"paused": False,"total_tasks": 0,"current_task_index": 0,"进度百分比": 0.0,}
    # ==================================================================
    # 程序执行
    # ==================================================================
    async def 执行自由编辑参数(self,*,配方数据: dict[str, Any],实体数据: list[dict[str, Any]]) -> dict[str, Any]:
        """启动程序执行（创建新的 ProgramRunner 实例）。"""
        self.程序执行器 = ProgramRunnerFreeParam()
        return await self.程序执行器.执行自由编辑参数(配方数据=配方数据,实体数据=实体数据)
    # ==================================================================
    # 控制指令
    # ==================================================================

    # ==================================================================
    # WebSocket 订阅 / 广播
    # ==================================================================
        
