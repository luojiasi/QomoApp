from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.dependencies import camera_driver


router = APIRouter(tags=["camera-ws"])


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
