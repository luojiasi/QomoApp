"""4P 产品 REST API 路由。

前缀：``/api/product4p``

约定：
- 成功返回 ``{"success": True, "message": "...", "data": ...}``。
"""
from __future__ import annotations

from fastapi import APIRouter

from utils.logger import 获取日志记录器
from services.SystemSettingService import (
    中心旋转补偿请求模型,
    保存R轴旋转中心点,
    获取4P旋转中心的补偿值,
    保存4P旋转中心的补偿值,
    获取R轴旋转中心点,
    获取快速移动点,
    保存快速移动点,
)

from routers.apiresponse import ApiResponse

日志 = 获取日志记录器("SYSTEM SETTING HTTP")
路由 = APIRouter(prefix="/api/system-setting", tags=["系统设置"])






@路由.get("/center-rotation", response_model=ApiResponse)
def 获取中心旋转补偿() -> ApiResponse:
    data = 获取4P旋转中心的补偿值().model_dump()
    日志.info("读取 4P 中心旋转补偿: %s", data)
    return ApiResponse(success=True, message="读取 4P 中心旋转参数成功", data=data)


@路由.post("/center-rotation", response_model=ApiResponse)
def 保存中心旋转补偿(payload: 中心旋转补偿请求模型) -> ApiResponse:
    saved = 保存4P旋转中心的补偿值(中心旋转补偿请求模型(X=payload.X,Y=payload.Y,Z=payload.Z,))
    日志.info("保存 4P 中心旋转补偿: X=%.3f Y=%.3f Z=%.3f", payload.X, payload.Y, payload.Z)
    return ApiResponse(success=True, message="保存 4P 中心旋转参数成功", data=saved.model_dump())

@路由.get("/r_axis_position", response_model=ApiResponse)
def 获取R轴旋转中心点的位置() -> ApiResponse:
    data = 获取R轴旋转中心点().model_dump()
    日志.info("读取快速移动点位置: %s", data)
    return ApiResponse(success=True, message="读取快速移动点位置成功", data=data)


@路由.post("/r_axis_position", response_model=ApiResponse)
def 保存R轴旋转中心点的位置(payload: 中心旋转补偿请求模型) -> ApiResponse:
    saved = 保存R轴旋转中心点(中心旋转补偿请求模型(X=payload.X,Y=payload.Y,Z=payload.Z,))
    日志.info("保存R轴旋转中心点的位置: X=%.3f Y=%.3f Z=%.3f", payload.X, payload.Y, payload.Z)
    return ApiResponse(success=True, message="保存R轴旋转中心点的位置成功", data=saved.model_dump())


@路由.get("/quick-move-position", response_model=ApiResponse)
def 获取快速移动点位置() -> ApiResponse:
    data = 获取快速移动点().model_dump()
    日志.info("读取快速移动点位置: %s", data)
    return ApiResponse(success=True, message="读取快速移动点位置成功", data=data)


@路由.post("/quick-move-position", response_model=ApiResponse)
def 保存快速移动点位置(payload: 中心旋转补偿请求模型) -> ApiResponse:
    saved = 保存快速移动点(中心旋转补偿请求模型(X=payload.X,Y=payload.Y,Z=payload.Z,))
    日志.info("保存快速移动点位置: X=%.3f Y=%.3f Z=%.3f", payload.X, payload.Y, payload.Z)
    return ApiResponse(success=True, message="保存快速移动点位置成功", data=saved.model_dump())
