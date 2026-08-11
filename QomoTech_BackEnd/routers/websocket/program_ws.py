"""程序运行状态 WebSocket 路由。

端点：``WS /ws/program/status``

现由 ``services.PragramService``、``services.ProgramServiceFreeParam``
与 ``services.ProgramServiceTenParam`` 管理订阅/广播。
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.PragramService import PragramService
from services.ProgramServiceFreeParam import ProgramServiceFreeParam
from services.ProgramServiceTenParam import ProgramServiceTenPlus
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序WS")
路由 = APIRouter(prefix="/ws", tags=["程序状态 WebSocket"])


def _svc() -> PragramService:
    return PragramService.获取实例()

def _freeparam_svc() -> ProgramServiceFreeParam:
    return ProgramServiceFreeParam.获取实例()

def _tenplus_svc() -> ProgramServiceTenPlus:
    return ProgramServiceTenPlus.获取实例()


def _合并状态() -> dict[str, Any]:
    旧 = _svc().获取运行状态()
    新 = _freeparam_svc().获取运行状态()
    ten = _tenplus_svc().获取运行状态()
    if 旧.get("running", False):
        return 旧
    if 新.get("running", False):
        return 新
    if ten.get("running", False):
        return ten
    return 新


@路由.websocket("/program/status")
async def 程序状态(websocket: WebSocket):
    await websocket.accept()
    q旧: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
    q新: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
    q十: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
    _svc().订阅状态(q旧)
    _freeparam_svc().订阅状态(q新)
    _tenplus_svc().订阅状态(q十)
    try:
        await websocket.send_json({"type": "start_program_status", "data": _合并状态()})
        while True:
            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(q旧.get()),
                    asyncio.create_task(q新.get()),
                    asyncio.create_task(q十.get()),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            if websocket.client_state == WebSocketState.DISCONNECTED:
                break
            await websocket.send_json({"type": "start_program_status", "data": _合并状态()})
            for task in done:
                task.result()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        日志.error(f"程序状态 WebSocket 异常: {exc}")
    finally:
        _svc().取消订阅(q旧)
        _freeparam_svc().取消订阅(q新)
        _tenplus_svc().取消订阅(q十)
        if (websocket.client_state != WebSocketState.DISCONNECTED
                and websocket.application_state != WebSocketState.DISCONNECTED):
            try:
                await websocket.close()
            except RuntimeError:
                pass
