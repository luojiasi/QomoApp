from __future__ import annotations

import asyncio
import threading
import time
from typing import Any

import logging

_logger = logging.getLogger("qomotech.program_status_ws")

_main_loop: asyncio.AbstractEventLoop | None = None
_subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
_sub_lock = threading.Lock()

_last_notify_mono: float = 0.0
_THROTTLE_S = 0.02


def set_program_status_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _main_loop
    _main_loop = loop


def notify_program_status_changed(*, force: bool = False) -> None:
    """从任意线程调用：将当前 `get_program_status()` 快照推送给所有 WebSocket 订阅者。"""
    from core.startPragram import get_program_status

    global _last_notify_mono
    now = time.monotonic()
    if not force:
        if now - _last_notify_mono < _THROTTLE_S:
            return
    _last_notify_mono = now

    data = get_program_status()
    loop = _main_loop
    if loop is None or not loop.is_running():
        return

    def _schedule() -> None:
        asyncio.create_task(_broadcast_status(data))

    try:
        loop.call_soon_threadsafe(_schedule)
    except RuntimeError:
        _logger.debug("schedule program status broadcast failed (loop closing)")


async def _broadcast_status(data: dict[str, Any]) -> None:
    with _sub_lock:
        qs = list(_subscribers)
    for q in qs:
        try:
            while not q.empty():
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    break
            q.put_nowait(data)
        except Exception:
            with _sub_lock:
                _subscribers.discard(q)


def add_program_status_subscriber(q: asyncio.Queue[dict[str, Any]]) -> None:
    with _sub_lock:
        _subscribers.add(q)


def remove_program_status_subscriber(q: asyncio.Queue[dict[str, Any]]) -> None:
    with _sub_lock:
        _subscribers.discard(q)
