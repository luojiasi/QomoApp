from __future__ import annotations

import asyncio
import json
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from services.motion_control.motion_service import MotionService
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("CGimagetechWS")

路由 = APIRouter(prefix="/ws", tags=["CGimagetech相机 WebSocket"])


# ------------------------------------------------------------------
# WebSocket 端点
# ------------------------------------------------------------------