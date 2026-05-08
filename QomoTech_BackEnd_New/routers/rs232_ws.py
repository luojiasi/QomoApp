"""RS232 串口 WebSocket 路由。

端点：WS /ws/rs232/stream
- 服务端实时推送后台读线程收到的每一行数据
- 客户端可发送控制指令：open / close / send / clear_buffer
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.communicate_control.rs232.rs232_service import Rs232Service
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("Rs232WS")

路由 = APIRouter(prefix="/ws", tags=["RS232 WebSocket"])


def _service() -> Rs232Service:
    return Rs232Service.获取实例()


# ------------------------------------------------------------------
# WebSocket 端点
# ------------------------------------------------------------------


@路由.websocket("/rs232/stream")
async def rs232流(websocket: WebSocket):
    """
    双向 WebSocket：
      服务端推送：{"type": "line",   "data": "<接收到的文本行>"}
                  {"type": "status", "data": {"connected": bool, "portName": str|null}}
      客户端发送：{"cmd": "open",   "port": {...}, "receive": {...}}
                  {"cmd": "close"}
                  {"cmd": "send",   "port": {...}, "send": {...}}
                  {"cmd": "buffer", "clear": true}
                  {"cmd": "status"}
    """
    await websocket.accept()
    svc = _service()
    queue = svc.订阅接收(maxsize=100)

    try:
        # 立即推送当前连接状态
        await _推送状态(websocket, svc)

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
        日志.error(f"Rs232 WebSocket 异常: {exc}")
    finally:
        svc.取消订阅(queue)
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try:
                await websocket.close()
            except Exception:
                pass


async def _推送循环(websocket: WebSocket, queue: asyncio.Queue) -> None:
    """从接收队列取行并推送给客户端。"""
    while True:
        line: str = await queue.get()
        if websocket.client_state == WebSocketState.DISCONNECTED:
            break
        try:
            await websocket.send_text(json.dumps({"type": "line", "data": line}, ensure_ascii=False))
        except Exception:
            break


async def _接收循环(websocket: WebSocket, svc: Rs232Service) -> None:
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
            await _发送错误(websocket, "JSON 格式错误")
            continue

        cmd = data.get("cmd", "")
        try:
            await _执行指令(cmd, data, svc, websocket)
        except Exception as exc:
            await _发送错误(websocket, str(exc))


async def _执行指令(
    cmd: str,
    data: Dict[str, Any],
    svc: Rs232Service,
    websocket: WebSocket,
) -> None:
    if cmd == "open":
        port_cfg = data.get("port", {})
        receive_cfg = data.get("receive", {"mode": "ascii"})
        ok, msg = svc.打开会话(port_cfg, receive_cfg)
        await websocket.send_text(
            json.dumps({"type": "open_result", "success": ok, "message": msg}, ensure_ascii=False)
        )
        await _推送状态(websocket, svc)

    elif cmd == "close":
        svc.关闭()
        await websocket.send_text(
            json.dumps({"type": "close_result", "success": True, "message": "串口已关闭"}, ensure_ascii=False)
        )
        await _推送状态(websocket, svc)

    elif cmd == "send":
        send_cfg = data.get("send", {})
        port_name = data.get("port", {}).get("portName")
        if not svc.已连接():
            await _发送错误(websocket, "串口未打开")
        elif port_name and svc.当前端口() != port_name:
            await _发送错误(websocket, f"请求端口 {port_name} 与已打开端口 {svc.当前端口()} 不一致")
        else:
            ok, msg = svc.发送(send_cfg)
            await websocket.send_text(
                json.dumps({"type": "send_result", "success": ok, "message": msg}, ensure_ascii=False)
            )

    elif cmd == "buffer":
        clear = bool(data.get("clear", False))
        text = svc.获取缓冲区(清空=clear)
        await websocket.send_text(
            json.dumps({"type": "buffer", "data": text}, ensure_ascii=False)
        )

    elif cmd == "status":
        await _推送状态(websocket, svc)

    else:
        日志.warning(f"未知 WebSocket 指令: {cmd!r}")
        await _发送错误(websocket, f"未知指令: {cmd!r}")


async def _推送状态(websocket: WebSocket, svc: Rs232Service) -> None:
    try:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "status",
                    "data": {
                        "connected": svc.已连接(),
                        "portName": svc.当前端口(),
                        "pyserial": svc.pyserial可用(),
                    },
                },
                ensure_ascii=False,
            )
        )
    except Exception:
        pass


async def _发送错误(websocket: WebSocket, msg: str) -> None:
    try:
        await websocket.send_text(json.dumps({"type": "error", "message": msg}, ensure_ascii=False))
    except Exception:
        pass
