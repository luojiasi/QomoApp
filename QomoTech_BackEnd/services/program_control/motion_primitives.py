"""运动原子操作 —— 从 ``core/startPragram.py`` 提取的硬件操作封装。

所有方法都会在执行过程中持续检查急停 / 跳过 / 暂停状态，
由调用方通过 ``ProgramContext`` 协议注入。
"""

from __future__ import annotations

import asyncio
from typing import Any, Protocol

from services.MotionService import MotionService
from services.motion_control.safe_controller import SafetyViolation
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("运动原子操作")

# 轴号 → 轴名映射
_轴号映射: dict[int, str] = {0: "X", 1: "Y", 2: "Z", 3: "U", 4: "R"}


class ProgramContext(Protocol):
    """程序执行上下文 —— 由 ProgramRunner 实现，注入到 MotionPrimitives。"""

    def 是否已急停(self) -> bool: ...
    def 是否已请求跳过(self) -> bool: ...
    def 是否已暂停(self) -> bool: ...
    def 清除跳过请求(self) -> None: ...


class MotionPrimitives:
    """封装运动原子操作，所有方法均为 async。

    用法::

        ctx: ProgramContext = runner  # runner 实现了 ProgramContext
        mp = MotionPrimitives(MotionService.获取实例(), ctx)
        result = await mp.安全拉取是否空闲(轴号=2)
    """

    def __init__(self, 运动服务: MotionService, 上下文: ProgramContext) -> None:
        self._运动 = 运动服务
        self._上下文 = 上下文

    # ------------------------------------------------------------------
    # 状态检查 helper
    # ------------------------------------------------------------------

    async def _检查急停或跳过(self) -> str | None:
        """检查急停/跳过标志，返回 "abort" / "skip" / None。"""
        if self._上下文.是否已急停():
            return "abort"
        if self._上下文.是否已请求跳过():
            return "skip"
        return None

    async def _等待暂停恢复(self) -> None:
        """如果处于暂停状态，则循环等待直到恢复。"""
        while self._上下文.是否已暂停():
            await asyncio.sleep(0.05)

    # ------------------------------------------------------------------
    # 轴空闲轮询
    # ------------------------------------------------------------------

    async def 安全拉取是否空闲(
        self,
        轴号: int,
        超时次数: int = 2000,
        休眠秒: float = 0.02,
    ) -> dict[str, Any]:
        """安全轮询轴静止状态。

        Returns:
            {"success": bool, "notMoving": bool, "skip": bool, "abort": bool}
        """
        轴名 = _轴号映射.get(int(轴号))
        if 轴名 is None:
            return {"success": False, "notMoving": False, "message": f"未知轴号: {轴号}"}

        for _ in range(超时次数):
            if self._上下文.是否已急停():
                return {"success": False, "notMoving": False, "abort": True}
            if self._上下文.是否已请求跳过():
                return {"success": False, "notMoving": False, "skip": True}
            if self._上下文.是否已暂停():
                await asyncio.sleep(0.05)
                continue
            try:
                是否空闲 = await self._运动.读_idle(轴名)
                if 是否空闲:
                    return {"success": True, "notMoving": True}
            except Exception:
                日志.exception("安全拉取是否空闲 axis=%s 失败", 轴号)
            await asyncio.sleep(休眠秒)
        return {"success": False, "notMoving": False, "message": "等待轴静止超时"}

    async def 安全拉取xy轴是否空闲(self,超时次数: int = 2000,休眠秒: float = 0.02) -> dict[str, Any]:
        """安全轮询 XY 双轴静止状态。"""
        for _ in range(超时次数):
            if self._上下文.是否已急停():
                return {"success": False, "abort": True}
            if self._上下文.是否已请求跳过():
                return {"success": False, "skip": True}
            if self._上下文.是否已暂停():
                await asyncio.sleep(0.05)
                continue
            try:
                rx = await self._运动.读_idle("X")
                ry = await self._运动.读_idle("Y")
                if rx and ry:
                    return {"success": True}
            except Exception:
                日志.exception("安全拉取xy轴是否空闲 失败")
            await asyncio.sleep(休眠秒)
        日志.error("等待 XY 轴静止超时（次数=%s 间隔=%ss）", 超时次数, 休眠秒)
        return {"success": False, "message": "等待 XY 轴静止超时"}

    # ------------------------------------------------------------------
    # 输出清理
    # ------------------------------------------------------------------

    async def 清除运行输出(self) -> None:
        """停止运动并关闭输出 0 和 2。"""
        try:
            await self._运动.停止运动()
        except Exception:
            日志.exception("清除运行输出 停止运动失败")
        try:
            await self._运动.设置输出(0, False)
            await self._运动.设置输出(2, False)
        except Exception:
            日志.exception("清除运行输出 关闭输出失败")

    # ------------------------------------------------------------------
    # 跳过任务 → 回到目标 Z 轴
    # ------------------------------------------------------------------

    async def 跳过任务并回Z轴(
        self,
        *,
        z轴目标: float | None,
        速度: float,
    ) -> str:
        """统一处理"跳过任务"：停机 + 关输出 + 可选 Z 轴定位 + 清除跳过标记。

        Returns:
            "skip" —— 调用方应直接 return 该值。
        """
        await self.清除运行输出()
        if z轴目标 is not None:
            try:
                安全速度 = float(速度) if float(速度) > 0 else 10.0
            except Exception:
                安全速度 = 10.0
            try:
                await self._运动.绝对运动并设速度("Z", float(z轴目标), 安全速度)
                等待计数 = 0
                while 等待计数 < 2000:
                    if await self._运动.读_idle("Z"):
                        break
                    等待计数 += 1
                    await asyncio.sleep(0.01)
            except SafetyViolation:
                日志.warning("跳过任务 → Z轴回位被安全闸拒绝（可能处于ESTOP），跳过Z轴移动")
            except Exception:
                日志.exception("跳过任务 → Z轴复位 失败")
        self._上下文.清除跳过请求()
        return "skip"

    # ------------------------------------------------------------------
    # 常用组合操作
    # ------------------------------------------------------------------

    async def 运动到位并等待(
        self,
        轴名: str,
        目标位置: float,
        速度: float,
        *,
        超时次数: int = 2000,
    ) -> dict[str, Any]:
        """绝对运动到目标位置，然后轮询等待该轴静止。"""
        try:
            await self._运动.绝对运动并设速度(轴名, 目标位置, 速度)
        except Exception:
            return {"success": False, "message": f"{轴名} 轴运动指令发送失败"}

        轴号 = {"X": 0, "Y": 1, "Z": 2, "U": 3, "R": 4}.get(轴名.upper())
        if 轴号 is None:
            return {"success": False, "message": f"未知轴名: {轴名}"}
        return await self.安全拉取是否空闲(轴号=轴号, 超时次数=超时次数)

    async def 开启激光输出(self) -> None:
        """打开激光输出 IO（输出 2）。"""
        await self._运动.设置输出(2, True)

    async def 关闭激光输出(self) -> None:
        """关闭激光输出 IO（输出 2）。"""
        await self._运动.设置输出(2, False)

    async def 开启吹风(self) -> None:
        """打开红光 IO（输出 0）。"""
        await self._运动.设置输出(0, True)

    async def 关闭红光(self) -> None:
        """关闭红光 IO（输出 0）。"""
        await self._运动.设置输出(0, False)

    async def Z轴归位并等待(
        self,
        目标Z: float,
        速度: float,
        *,
        超时次数: int = 2000,
    ) -> bool:
        """将 Z 轴移动到目标位置并轮询到位。"""
        try:
            await self._运动.绝对运动并设速度("Z", 目标Z, 速度)
        except Exception:
            return False
        for _ in range(超时次数):
            if self._上下文.是否已急停():
                return False
            if self._上下文.是否已请求跳过():
                return False
            try:
                实际位置 = await self._运动.取_z_实际位置()
                if abs(实际位置 - 目标Z) <= 0.001:
                    return True
            except Exception:
                日志.exception("Z轴归位 轮询异常")
            await asyncio.sleep(0.02)
        return False
