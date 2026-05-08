"""运动控制 WebSocket 路由。

端点：WS /ws/motion/status
- 服务端每 50ms 推送一次最新快照（由 StatusMonitor 驱动）
- 客户端可发送控制指令：jog_start / jog_stop / pause / resume / estop
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.motion_control.motion_service import MotionService
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("MotionWS")

路由 = APIRouter(prefix="/ws", tags=["运动控制 WebSocket"])


def _service() -> MotionService:
    return MotionService.获取实例()


# ------------------------------------------------------------------
# WebSocket 端点
# ------------------------------------------------------------------


@路由.websocket("/motion/status")
async def 运动状态(websocket: WebSocket):
    """
    双向 WebSocket：
      服务端推送：{"state":"...", "position":{...}, "mposition":{...}, "idle":{...}}
      客户端发送：{"cmd": "jog_start", "axis":"X", "direction":1, "speed":500}
                  {"cmd": "jog_stop",  "axis":"X"}
                  {"cmd": "pause"}
                  {"cmd": "resume"}
                  {"cmd": "estop"}
    """
    await websocket.accept()
    svc = _service()
    queue = svc.订阅状态(maxsize=5)

    try:
        # 立即推送一次当前快照
        await websocket.send_text(json.dumps(svc.获取状态快照().to_dict()))

        # 同时运行：推送任务 + 接收任务
        push_task = asyncio.create_task(_推送循环(websocket, queue))
        recv_task = asyncio.create_task(_接收循环(websocket, svc))

        done, pending = await asyncio.wait(
            [push_task, recv_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        日志.error(f"WebSocket 异常: {exc}")
    finally:
        svc.取消订阅(queue)
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try:
                await websocket.close()
            except Exception:
                pass


async def _推送循环(websocket: WebSocket, queue: asyncio.Queue) -> None:
    """从状态队列取数据并推送给客户端。"""
    while True:
        snap = await queue.get()
        if websocket.client_state == WebSocketState.DISCONNECTED:
            break
        try:
            await websocket.send_text(json.dumps(snap.to_dict()))
        except Exception:
            break


async def _接收循环(websocket: WebSocket, svc: MotionService) -> None:
    """接收客户端指令并分发执行。"""
    while True:
        try:
            raw = await websocket.receive_text()
        except WebSocketDisconnect:
            break
        except Exception:
            break

        try:
            data: Dict[str, Any] = json.loads(raw)
        except json.JSONDecodeError:
            await _send_error(websocket, "JSON 格式错误")
            continue

        cmd = data.get("cmd", "")
        try:
            await _执行指令(cmd, data, svc)
        except Exception as exc:
            await _send_error(websocket, str(exc))


async def _执行指令(cmd: str, data: Dict[str, Any], svc: MotionService) -> None:
    if cmd == "jog_start":
        axis = data.get("axis", "X")
        direction = int(data.get("direction", 1))
        speed = data.get("speed")
        await svc.点动(axis, direction, speed)
    elif cmd == "jog_stop":
        axis = data.get("axis", "X")
        await svc.停止点动(axis)
    elif cmd == "pause":
        await svc.暂停()
    elif cmd == "resume":
        await svc.继续()
    elif cmd == "estop":
        await svc.急停()
    else:
        日志.warning(f"未知 WebSocket 指令: {cmd!r}")


async def _send_error(websocket: WebSocket, msg: str) -> None:
    try:
        await websocket.send_text(json.dumps({"error": msg}))
    except Exception:
        pass
