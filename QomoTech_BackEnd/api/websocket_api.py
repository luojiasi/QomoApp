from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.dependencies import camera_driver
from core.program_status_ws import add_program_status_subscriber, remove_program_status_subscriber
from core.startPragram import get_program_status


router = APIRouter()


@router.websocket("/api/camera/ws")
async def camera_stream_ws(
    websocket: WebSocket,
    timeout_ms: int = 1000,
    quality: int = 85,
) -> None:
    await websocket.accept()
    safe_timeout = max(1, min(int(timeout_ms), 10_000))
    safe_quality = max(1, min(int(quality), 100))

    try:
        while True:
            try:
                jpeg = await asyncio.to_thread(
                    camera_driver.get_jpeg_bytes,
                    timeout_ms=safe_timeout,
                    quality=safe_quality,
                )
            except Exception as exc:  # noqa: BLE001
                await websocket.send_json({"type": "error", "message": str(exc)})
                await asyncio.sleep(0.05)
                continue

            await websocket.send_bytes(jpeg)
            await asyncio.sleep(0)
    except WebSocketDisconnect:
        return


@router.websocket("/api/startProgram/ws")
async def start_program_status_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
    add_program_status_subscriber(q)
    try:
        await websocket.send_json({"type": "start_program_status", "data": get_program_status()})
        while True:
            data = await q.get()
            await websocket.send_json({"type": "start_program_status", "data": data})
    except WebSocketDisconnect:
        return
    finally:
        remove_program_status_subscriber(q)
