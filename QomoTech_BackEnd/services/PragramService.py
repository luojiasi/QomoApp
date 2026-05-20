"""程序执行服务单例编排层 —— 路由层的唯一依赖。

与 MotionService / CameraService / Rs232Service 结构对齐。

用法::

    svc = PragramService.获取实例()
    await svc.执行程序(配方数据=..., 实体数据=...)
    await svc.暂停()
    state = svc.获取运行状态()
    svc.订阅状态(queue)
"""

from __future__ import annotations

import asyncio
import threading
import time
from typing import Any

from services.program_control.runner import ProgramRunner
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序服务")


class PragramService:
    """程序执行服务单例编排器。

    持有当前 ``ProgramRunner`` 实例，管理 WebSocket 状态订阅与广播。
    """

    _实例: PragramService | None = None
    _实例锁 = threading.Lock()

    # ------------------------------------------------------------------
    # 单例
    # ------------------------------------------------------------------

    @classmethod
    def 获取实例(cls) -> PragramService:
        with cls._实例锁:
            if cls._实例 is None:
                cls._实例 = cls()
            return cls._实例

    @classmethod
    def 重置实例(cls) -> None:
        with cls._实例锁:
            cls._实例 = None

    def __init__(self) -> None:
        self._runner: ProgramRunner | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

        # WebSocket 订阅管理
        self._订阅者: set[asyncio.Queue[dict[str, Any]]] = set()
        self._订阅者锁 = threading.Lock()
        self._上次推送时间: float = 0.0
        self._推送间隔秒 = 0.02

    # ==================================================================
    # 生命周期
    # ==================================================================

    def 设置事件循环(self, loop: asyncio.AbstractEventLoop) -> None: self._loop = loop

    # ==================================================================
    # 运行状态
    # ==================================================================

    def 获取运行状态(self) -> dict[str, Any]:
        if self._runner is not None: return self._runner.获取运行状态()
        return {"running": False,"paused": False,"total_tasks": 0,"current_task_index": 0,"进度百分比": 0.0,}

    # ==================================================================
    # 程序执行
    # ==================================================================

    async def 执行程序(self,*,配方数据: dict[str, Any],实体数据: list[dict[str, Any]]) -> dict[str, Any]:
        """启动程序执行（创建新的 ProgramRunner 实例）。"""
        self._runner = ProgramRunner()
        # 注入广播回调：runner 更新进度时 → PragramService 广播到 WS
        self._runner._广播回调 = self._广播状态  # type: ignore[attr-defined]
        return await self._runner.执行程序(配方数据=配方数据, 实体数据=实体数据)

    # ==================================================================
    # 控制指令
    # ==================================================================

    async def 暂停(self) -> dict[str, Any]:
        if self._runner is None:
            return {"success": False, "message": "当前没有运行中的程序"}
        return await self._runner.暂停()

    async def 恢复(self) -> dict[str, Any]:
        if self._runner is None:
            return {"success": False, "message": "当前没有运行中的程序"}
        return await self._runner.恢复()

    async def 急停(self) -> dict[str, Any]:
        if self._runner is None:
            return {"success": False, "message": "当前没有运行中的程序"}
        return await self._runner.急停()

    async def 跳过任务(self) -> dict[str, Any]:
        if self._runner is None:
            return {"success": False, "message": "当前没有运行中的程序"}
        return await self._runner.跳过任务()

    async def 复位(self) -> dict[str, Any]:
        runner = self._runner or ProgramRunner()
        return await runner.复位()

    # ==================================================================
    # WebSocket 订阅 / 广播
    # ==================================================================

    def 订阅状态(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        with self._订阅者锁:
            self._订阅者.add(q)

    def 取消订阅(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        with self._订阅者锁:
            self._订阅者.discard(q)

    def _广播状态(self, *, force: bool = False) -> None:
        """从任意线程调用：将当前运行状态推送给所有 WebSocket 订阅者。"""
        now = time.monotonic()
        if not force and now - self._上次推送时间 < self._推送间隔秒:
            return
        self._上次推送时间 = now

        data = self.获取运行状态()
        loop = self._loop
        if loop is None or not loop.is_running(): return

        def _schedule() -> None:
            asyncio.create_task(self._异步广播(data))

        try:
            loop.call_soon_threadsafe(_schedule)
        except RuntimeError:
            日志.debug("广播程序状态失败（事件循环已关闭）")

    async def _异步广播(self, data: dict[str, Any]) -> None:
        with self._订阅者锁:
            qs = list(self._订阅者)
        for q in qs:
            try:
                while not q.empty():
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        break
                q.put_nowait(data)
            except Exception:
                with self._订阅者锁:
                    self._订阅者.discard(q)
