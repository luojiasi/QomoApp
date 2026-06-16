"""程序运行状态 WebSocket 路由。

端点：``WS /ws/program/status``

现由 ``services.PragramService`` 和 ``services.ProgramServiceFreeParam`` 管理订阅/广播。
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.PragramService import PragramService
from services.ProgramServiceFreeParam import ProgramServiceFreeParam
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序WS")
路由 = APIRouter(prefix="/ws", tags=["程序状态 WebSocket"])


def _svc() -> PragramService:
    return PragramService.获取实例()

def _freeparam_svc() -> ProgramServiceFreeParam:
    return ProgramServiceFreeParam.获取实例()


def _合并状态() -> dict[str, Any]:
    旧 = _svc().获取运行状态()
    新 = _freeparam_svc().获取运行状态()
    旧在跑 = 旧.get("running", False)
    新在跑 = 新.get("running", False)
    if 旧在跑:
        return 旧
    if 新在跑:
        return 新
    # 都不在跑，返回更完整的那个
    return 旧 if 旧在跑 else 新


@路由.websocket("/program/status")
async def 程序状态(websocket: WebSocket):
    await websocket.accept()
    q旧: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
    q新: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
    _svc().订阅状态(q旧)
    _freeparam_svc().订阅状态(q新)
    try:
        await websocket.send_json({"type": "start_program_status", "data": _合并状态()})
        while True:
            done, _ = await asyncio.wait(
                [asyncio.create_task(q旧.get()), asyncio.create_task(q新.get())],
                return_when=asyncio.FIRST_COMPLETED,
            )
            if websocket.client_state == WebSocketState.DISCONNECTED:
                break
            await websocket.send_json({"type": "start_program_status", "data": _合并状态()})
            # 清空另一个队列中可能积压的消息
            for task in done:
                task.result()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        日志.error(f"程序状态 WebSocket 异常: {exc}")
    finally:
        _svc().取消订阅(q旧)
        _freeparam_svc().取消订阅(q新)
        if (websocket.client_state != WebSocketState.DISCONNECTED
                and websocket.application_state != WebSocketState.DISCONNECTED):
            try:
                await websocket.close()
            except RuntimeError:
                pass
