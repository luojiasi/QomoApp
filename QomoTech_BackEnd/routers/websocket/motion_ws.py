"""运动控制 WebSocket 路由。

端点：``WS /ws/motion/status``

- 服务端推送：每 50ms 由 ``StatusMonitor`` 驱动的最新快照（``状态快照.to_dict()``）。
- 客户端发送：``{"cmd": "...", ...}`` —— 高频小指令；复杂指令请走 HTTP。

支持的客户端指令（cmd）：

| cmd          | 必填字段          | 说明                              |
|--------------|-------------------|----------------------------------|
| ``ping``     | -                 | 心跳，回 ``{"pong": true}``       |
| ``connect``  | -                 | 连接控制器（用配置默认 IP）        |
| ``disconnect``| -                | 断开控制器                        |
| ``home``     | -                 | 全轴回零（不指定具体轴）          |
| ``jog_start``| ``axis,direction``| 点动开始                          |
| ``jog_stop`` | ``axis``          | 点动停止                          |
| ``move_abs`` | ``axis,position`` | 单轴绝对运动                      |
| ``move_rel`` | ``axis,position`` | 单轴相对运动                      |
| ``pause``    | -                 | 暂停                              |
| ``resume``   | -                 | 继续                              |
| ``stop``     | -                 | 减速停止                          |
| ``estop``    | -                 | 紧急停止                          |
| ``reset``    | -                 | 复位                              |

错误回执：``{"error": "...", "cmd": "<原 cmd>"}``。
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.MotionService import MotionService
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("MotionWS")

路由 = APIRouter(prefix="/ws", tags=["运动控制 WebSocket"])


def _service() -> MotionService:
    return MotionService.获取实例()


# ==================================================================
# WebSocket 端点
# ==================================================================


@路由.websocket("/motion/status")
async def 运动状态(websocket: WebSocket):
    """双向 WebSocket：服务端 50ms 推送状态快照；客户端可下发高频小指令。"""
    await websocket.accept()
    svc = _service()
    queue = svc.订阅状态(maxsize=5)

    try:
        await websocket.send_text(json.dumps(svc.获取状态快照().to_dict()))

        push_task = asyncio.create_task(_推送循环(websocket, queue))
        recv_task = asyncio.create_task(_接收循环(websocket, svc))

        _, pending = await asyncio.wait(
            [push_task, recv_task], return_when=asyncio.FIRST_COMPLETED,
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
    while True:
        snap = await queue.get()
        if websocket.client_state == WebSocketState.DISCONNECTED:
            break
        try:
            await websocket.send_text(json.dumps(snap.to_dict()))
        except Exception:
            break


async def _接收循环(websocket: WebSocket, svc: MotionService) -> None:
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
            await _send_error(websocket, "JSON 格式错误", cmd=None)
            continue

        cmd = str(data.get("cmd") or "").strip()
        if not cmd:
            await _send_error(websocket, "缺少 cmd 字段", cmd=None)
            continue

        try:
            await _执行指令(cmd, data, svc, websocket)
        except Exception as exc:
            await _send_error(websocket, str(exc), cmd=cmd)


async def _执行指令(
    cmd: str, data: Dict[str, Any], svc: MotionService, websocket: WebSocket,
) -> None:
    if cmd == "ping":
        await websocket.send_text(json.dumps({"pong": True}))
        return

    if cmd == "connect":
        await svc.连接(data.get("ip"))
        return
    if cmd == "disconnect":
        await svc.断开()
        return
    if cmd == "reset":
        await svc.复位()
        return

    if cmd == "home":
        await svc.归位(data.get("axes"))
        return

    if cmd == "jog_start":
        axis = str(data.get("axis", "X"))
        direction = int(data.get("direction", 1))
        speed = data.get("speed")
        await svc.点动(axis, direction, speed)
        return
    if cmd == "jog_stop":
        await svc.停止点动(str(data.get("axis", "X")))
        return

    if cmd == "move_abs":
        await svc.绝对运动(
            str(data["axis"]), float(data["position"]), data.get("speed"),
        )
        return
    if cmd == "move_rel":
        await svc.相对运动(
            str(data["axis"]), float(data["position"]), data.get("speed"),
        )
        return

    if cmd == "pause":
        await svc.暂停()
        return
    if cmd == "resume":
        await svc.继续()
        return
    if cmd == "stop":
        await svc.停止运动()
        return
    if cmd == "estop":
        await svc.急停()
        return

    日志.warning(f"未知 WebSocket 指令: {cmd!r}")
    await _send_error(websocket, f"未知指令 {cmd!r}", cmd=cmd)


async def _send_error(websocket: WebSocket, msg: str, cmd: Any = None) -> None:
    if websocket.client_state == WebSocketState.DISCONNECTED:
        return
    try:
        await websocket.send_text(json.dumps({"error": msg, "cmd": cmd}))
    except Exception:
        pass
