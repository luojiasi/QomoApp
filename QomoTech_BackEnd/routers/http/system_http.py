"""系统管理 REST API 路由（激光、关机等）。

前缀：``/api``

约定：
- 成功返回 ``{"success": True, "message": "...", "data": ...}``。
"""
from __future__ import annotations

import logging
import os
import signal
import threading

from fastapi import APIRouter
from pydantic import BaseModel

from utils.logger import 获取日志记录器
from routers.apiresponse import ApiResponse

日志 = 获取日志记录器("系统HTTP")

路由 = APIRouter(prefix="/api", tags=["系统管理"])


class 激光参数下发请求模型(BaseModel):
    laserManufacturer: str | None = None
    laserPower: float | None = None
    laserFrequency: float | None = None
    laserCurrent: float | None = None

@路由.get("/health", response_model=ApiResponse)
def 健康检查() -> ApiResponse:
    return ApiResponse(success=True, message="健康检查成功")


@路由.post("/laser/apply", response_model=ApiResponse)
def 激光参数下发(payload: 激光参数下发请求模型) -> ApiResponse:
    params = payload.model_dump(exclude_none=True)
    日志.info("激光参数下发: %s", params)
    return ApiResponse(success=True, message="激光参数已下发", data=None)


@路由.post("/shutdown", response_model=ApiResponse)
def 关机() -> ApiResponse:
    日志.info("收到前端关闭信号，准备优雅退出...")

    def 优雅退出() -> None:
        import time
        time.sleep(0.5)
        logging.shutdown()
        try:
            os.kill(os.getpid(), signal.SIGBREAK)
        except (AttributeError, OSError):
            os.kill(os.getpid(), signal.SIGINT)

    threading.Thread(target=优雅退出, daemon=True).start()
    return ApiResponse(success=True, message="正在关闭后端服务")
