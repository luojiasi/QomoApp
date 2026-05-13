"""程序运行状态 WebSocket 路由。

端点：``WS /ws/program/status``

现由 ``services.PragramService`` 管理订阅/广播。
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.PragramService import PragramService
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序WS")
路由 = APIRouter(prefix="/ws", tags=["程序状态 WebSocket"])


def _svc() -> PragramService:
    return PragramService.获取实例()


@路由.websocket("/program/status")
async def 程序状态(websocket: WebSocket):
    await websocket.accept()
    q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
    _svc().订阅状态(q)
    try:
        await websocket.send_json({"type": "start_program_status", "data": _svc().获取运行状态()})
        while True:
            data = await q.get()
            if websocket.client_state == WebSocketState.DISCONNECTED:
                break
            await websocket.send_json({"type": "start_program_status", "data": data})
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        日志.error(f"程序状态 WebSocket 异常: {exc}")
    finally:
        _svc().取消订阅(q)
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try:
                await websocket.close()
            except Exception:
                pass
