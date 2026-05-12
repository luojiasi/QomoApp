from __future__ import annotations

import asyncio
import threading
import time
from typing import Any

from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序状态WS")

_主要循环: asyncio.AbstractEventLoop | None = None
_订阅者: set[asyncio.Queue[dict[str, Any]]] = set()
_订阅者锁 = threading.Lock()

_上次推送时间: float = 0.0
_推送间隔时间 = 0.02


def 设置程序运行循环事件(loop: asyncio.AbstractEventLoop) -> None:
    global _主要循环
    _主要循环 = loop


def 推送改变的程序运行状态(*, force: bool = False) -> None:
    """从任意线程调用：将当前 `获取设备运行状态()` 快照推送给所有 WebSocket 订阅者。"""
    from core.startPragram import 获取设备运行状态

    global _上次推送时间
    now = time.monotonic()
    if not force:
        if now - _上次推送时间 < _推送间隔时间:
            return
    _上次推送时间 = now

    data = 获取设备运行状态()
    loop = _主要循环
    if loop is None or not loop.is_running():return

    def _schedule() -> None:
        asyncio.create_task(_广播运行状态(data))

    try:
        loop.call_soon_threadsafe(_schedule)
    except RuntimeError:
        日志.debug("schedule program status broadcast failed (loop closing)")


async def _广播运行状态(data: dict[str, Any]) -> None:
    with _订阅者锁:
        qs = list(_订阅者)
    for q in qs:
        try:
            while not q.empty():
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    break
            q.put_nowait(data)
        except Exception:
            with _订阅者锁:
                _订阅者.discard(q)


def 订阅程序运行状态(q: asyncio.Queue[dict[str, Any]]) -> None:
    with _订阅者锁:
        _订阅者.add(q)


def 取消订阅程序运行状态(q: asyncio.Queue[dict[str, Any]]) -> None:
    with _订阅者锁:
        _订阅者.discard(q)
