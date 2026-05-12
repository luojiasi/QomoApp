"""程序运行状态 WebSocket 路由。

端点：``WS /ws/program/status``

服务端推送：``{"type": "start_program_status", "data": {...}}``
- 连接后立即发送当前快照
- 后续由 ``推送改变的程序运行状态`` 驱动推送
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from core.program_status_ws import 订阅程序运行状态, 取消订阅程序运行状态
from core.startPragram import 获取设备运行状态
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序WS")
路由 = APIRouter(prefix="/ws", tags=["程序状态 WebSocket"])


@路由.websocket("/program/status")
async def 程序状态(websocket: WebSocket):
    await websocket.accept()
    q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
    订阅程序运行状态(q)
    try:
        await websocket.send_json({"type": "start_program_status", "data": 获取设备运行状态()})
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
        取消订阅程序运行状态(q)
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try:
                await websocket.close()
            except Exception:
                pass
