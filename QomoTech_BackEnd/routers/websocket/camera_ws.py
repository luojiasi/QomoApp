"""相机视频流 WebSocket 路由。

端点：``WS /ws/camera/stream``

- 服务端循环：抓帧 → 直接 ``send_bytes`` 推送 JPEG 字节给客户端。
- 客户端可发送 JSON 控制指令调整推流参数：

  | cmd          | 字段                            | 说明                       |
  |--------------|---------------------------------|--------------------------|
  | ``ping``     | -                               | 心跳，回 ``{"pong": true}`` |
  | ``set_quality`` | ``quality: int (1-100)``     | 调整 JPEG 质量              |
  | ``set_timeout`` | ``timeout_ms: int (1-10000)``| 调整单帧超时                |
  | ``pause``    | -                               | 暂停推流                   |
  | ``resume``   | -                               | 恢复推流                   |

错误回执：``{"error": "...", "cmd": "<原 cmd>"}``。
取帧失败：``{"type": "error", "message": "..."}``，会自动 50ms 后重试。

兼容：旧 ``/api/camera/ws`` 端点位于 ``api/websocket_api.py``，二者可在迁移期共存；
新端点只走 ``services.CameraService``，不依赖 ``api.dependencies`` 注入。
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.camera_control.CGcamera_adapter import CameraError
from services.CameraService import CameraService
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("相机WS")

路由 = APIRouter(prefix="/ws", tags=["相机 WebSocket"])


def _service() -> CameraService:
    return CameraService.获取实例()


# ==================================================================
# WebSocket 端点
# ==================================================================


@路由.websocket("/camera/stream")
async def 视频流(websocket: WebSocket):
    """JPEG 推流 + 客户端控制指令双向通道。"""
    await websocket.accept()
    svc = _service()
    defaults = svc.取_推流默认值()
    state = _推流状态(
        quality=int(defaults["quality"]),
        timeout_ms=int(defaults["timeout_ms"]),
    )

    try:
        push_task = asyncio.create_task(_推送循环(websocket, svc, state))
        recv_task = asyncio.create_task(_接收循环(websocket, state))

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
        日志.error(f"视频流 WebSocket 异常: {exc}")
    finally:
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try:
                await websocket.close()
            except Exception:
                pass


# ==================================================================
# 内部
# ==================================================================


class _推流状态:
    __slots__ = ("quality", "timeout_ms", "paused")

    def __init__(self, *, quality: int, timeout_ms: int) -> None:
        self.quality: int = quality
        self.timeout_ms: int = timeout_ms
        self.paused: bool = False


async def _推送循环(
    websocket: WebSocket, svc: CameraService, state: _推流状态,
) -> None:
    """循环抓帧并推送字节流；失败时短暂退避后重试。"""
    while True:
        if websocket.client_state == WebSocketState.DISCONNECTED:
            break

        if state.paused:
            await asyncio.sleep(0.05)
            continue

        try:
            jpeg = await svc.取_jpeg(
                timeout_ms=state.timeout_ms, quality=state.quality,
            )
        except CameraError as exc:
            await _send_json_safe(
                websocket, {"type": "error", "message": str(exc)},
            )
            await asyncio.sleep(0.05)
            continue
        except Exception as exc:
            日志.exception(f"取帧异常: {exc}")
            await _send_json_safe(
                websocket, {"type": "error", "message": str(exc)},
            )
            await asyncio.sleep(0.1)
            continue

        if websocket.client_state == WebSocketState.DISCONNECTED:
            break
        try:
            await websocket.send_bytes(jpeg)
        except Exception:
            break


async def _接收循环(websocket: WebSocket, state: _推流状态) -> None:
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
            await _执行指令(cmd, data, state, websocket)
        except Exception as exc:
            await _send_error(websocket, str(exc), cmd=cmd)


async def _执行指令(
    cmd: str, data: Dict[str, Any], state: _推流状态, websocket: WebSocket,
) -> None:
    if cmd == "ping":
        await _send_json_safe(websocket, {"pong": True})
        return

    if cmd == "set_quality":
        q = int(data.get("quality", state.quality))
        if not 1 <= q <= 100:
            raise ValueError("quality 必须在 1~100")
        state.quality = q
        await _send_json_safe(websocket, {"type": "ack", "quality": q})
        return

    if cmd == "set_timeout":
        t = int(data.get("timeout_ms", state.timeout_ms))
        if not 1 <= t <= 10_000:
            raise ValueError("timeout_ms 必须在 1~10000")
        state.timeout_ms = t
        await _send_json_safe(websocket, {"type": "ack", "timeout_ms": t})
        return

    if cmd == "pause":
        state.paused = True
        await _send_json_safe(websocket, {"type": "ack", "paused": True})
        return

    if cmd == "resume":
        state.paused = False
        await _send_json_safe(websocket, {"type": "ack", "paused": False})
        return

    日志.warning(f"未知 WebSocket 指令: {cmd!r}")
    await _send_error(websocket, f"未知指令 {cmd!r}", cmd=cmd)


async def _send_json_safe(websocket: WebSocket, obj: Dict[str, Any]) -> None:
    if websocket.client_state == WebSocketState.DISCONNECTED:
        return
    try:
        await websocket.send_text(json.dumps(obj))
    except Exception:
        pass


async def _send_error(websocket: WebSocket, msg: str, cmd: Any = None) -> None:
    await _send_json_safe(websocket, {"error": msg, "cmd": cmd})
