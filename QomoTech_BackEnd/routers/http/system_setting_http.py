"""4P 产品 REST API 路由。

前缀：``/api/product4p``

约定：
- 成功返回 ``{"success": True, "message": "...", "data": ...}``。
"""
from __future__ import annotations

from fastapi import APIRouter, Path

from utils.logger import 获取日志记录器
from services.SystemSettingService import (
    中心旋转补偿请求模型,
    相机清晰误差请求模型,
    保存R轴旋转中心点,
    获取4P旋转中心的补偿值,
    保存4P旋转中心的补偿值,
    获取R轴旋转中心点,
    获取快速移动点,
    保存快速移动点,
    获取一拖五U轴旋转中心的补偿值,
    保存一拖五U轴旋转中心的补偿值,
    获取一拖五R轴旋转中心点的位置,
    保存一拖五R轴旋转中心点的位置,
    获取工位相机清晰误差,
    保存工位相机清晰误差,
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


@路由.get("/ten/center-rotation/{slot}", response_model=ApiResponse)
def 获取十工位U轴旋转中心(slot: int = Path(..., ge=1, le=10)) -> ApiResponse:
    try:
        data = 获取一拖五U轴旋转中心的补偿值(slot).model_dump()
    except ValueError as exc:
        return ApiResponse(success=False, message=str(exc), data=None)
    日志.info("读取十工位 U 轴旋转中心: slot=%s %s", slot, data)
    return ApiResponse(success=True, message=f"读取工位 {slot} U 轴旋转中心成功", data=data)


@路由.post("/ten/center-rotation/{slot}", response_model=ApiResponse)
def 保存十工位U轴旋转中心(
    payload: 中心旋转补偿请求模型,
    slot: int = Path(..., ge=1, le=10),
) -> ApiResponse:
    try:
        saved = 保存一拖五U轴旋转中心的补偿值(
            slot,
            中心旋转补偿请求模型(X=payload.X, Y=payload.Y, Z=payload.Z),
        )
    except ValueError as exc:
        return ApiResponse(success=False, message=str(exc), data=None)
    日志.info(
        "保存十工位 U 轴旋转中心: slot=%s X=%.3f Y=%.3f Z=%.3f",
        slot, payload.X, payload.Y, payload.Z,
    )
    return ApiResponse(success=True, message=f"保存工位 {slot} U 轴旋转中心成功", data=saved.model_dump())


@路由.get("/ten/r-axis-position/{slot}", response_model=ApiResponse)
def 获取十工位R轴旋转中心(slot: int = Path(..., ge=1, le=10)) -> ApiResponse:
    try:
        data = 获取一拖五R轴旋转中心点的位置(slot).model_dump()
    except ValueError as exc:
        return ApiResponse(success=False, message=str(exc), data=None)
    日志.info("读取十工位 R 轴旋转中心: slot=%s %s", slot, data)
    return ApiResponse(success=True, message=f"读取工位 {slot} R 轴旋转中心成功", data=data)


@路由.post("/ten/r-axis-position/{slot}", response_model=ApiResponse)
def 保存十工位R轴旋转中心(
    payload: 中心旋转补偿请求模型,
    slot: int = Path(..., ge=1, le=10),
) -> ApiResponse:
    try:
        saved = 保存一拖五R轴旋转中心点的位置(
            slot,
            中心旋转补偿请求模型(X=payload.X, Y=payload.Y, Z=payload.Z),
        )
    except ValueError as exc:
        return ApiResponse(success=False, message=str(exc), data=None)
    日志.info(
        "保存十工位 R 轴旋转中心: slot=%s X=%.3f Y=%.3f Z=%.3f",
        slot, payload.X, payload.Y, payload.Z,
    )
    return ApiResponse(success=True, message=f"保存工位 {slot} R 轴旋转中心成功", data=saved.model_dump())


@路由.get("/ten/camera-focus-error/{slot}", response_model=ApiResponse)
def 获取十工位相机清晰误差(slot: int = Path(..., ge=1, le=10)) -> ApiResponse:
    try:
        value = 获取工位相机清晰误差(slot)
    except ValueError as exc:
        return ApiResponse(success=False, message=str(exc), data=None)
    日志.info("读取十工位相机清晰误差: slot=%s value=%s", slot, value)
    return ApiResponse(success=True, message=f"读取工位 {slot} 相机清晰误差成功", data={"value": value})


@路由.post("/ten/camera-focus-error/{slot}", response_model=ApiResponse)
def 保存十工位相机清晰误差(
    payload: 相机清晰误差请求模型,
    slot: int = Path(..., ge=1, le=10),
) -> ApiResponse:
    try:
        saved = 保存工位相机清晰误差(slot, payload.value)
    except ValueError as exc:
        return ApiResponse(success=False, message=str(exc), data=None)
    日志.info("保存十工位相机清晰误差: slot=%s value=%s", slot, saved)
    return ApiResponse(success=True, message=f"保存工位 {slot} 相机清晰误差成功", data={"value": saved})
