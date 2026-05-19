from __future__ import annotations

from typing import Any

from core.calc_offset import OffsetEndpointCalculator
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序服务")


class ProgramService4p:
    async def 执行程序4P(self,*,配方数据: dict[str, Any],实体数据: list[dict[str, Any]],) -> bool:
        """启动程序执行（创建新的 ProgramRunner 实例）。"""
        任务数量 = OffsetEndpointCalculator.计算当前任务数量(实体数据)
        if 任务数量 == 0: return False
        
        await 执行4P程序(配方数据=配方数据,实体数据=实体数据,)
        return True


async def 执行4P程序(配方数据: dict[str, Any],实体数据: list[dict[str, Any]],) -> bool:
    return True