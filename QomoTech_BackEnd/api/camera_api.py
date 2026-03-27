from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from api.dependencies import get_camera_driver
from api.schemas import (
    ApiResponse,
    CameraConnectRequest,
    CameraExposureRequest,
    CameraFrameSpeedRequest,
    CameraMirrorRequest,
    CameraWhiteBalanceRequest,
)
from drivers.camera_driver import CAMERA_SPEED_LEVELS, CameraDriver


router = APIRouter(prefix="/api/camera", tags=["camera"])


@router.get("/devices", response_model=ApiResponse)
def camera_devices(camera: CameraDriver = Depends(get_camera_driver)) -> ApiResponse:
    devices = camera.enum_devices()
    diag = camera.diagnostics()
    if diag.last_error:
        return ApiResponse(success=False, message=diag.last_error, data={"devices": devices})
    return ApiResponse(success=True, message="设备枚举成功", data={"devices": devices})


@router.post("/connect", response_model=ApiResponse)
def camera_connect(
    payload: CameraConnectRequest,
    camera: CameraDriver = Depends(get_camera_driver),
) -> ApiResponse:
    ok = camera.connect(payload.index)
    diag = camera.diagnostics()
    msg = "相机连接成功" if ok else (diag.last_error or "相机连接失败")
    return ApiResponse(
        success=ok,
        message=msg,
        data={"connected": bool(diag.connected), "selected_index": diag.selected_index},
    )


@router.post("/disconnect", response_model=ApiResponse)
def camera_disconnect(camera: CameraDriver = Depends(get_camera_driver)) -> ApiResponse:
    ok = camera.disconnect()
    diag = camera.diagnostics()
    msg = "相机断开成功" if ok else (diag.last_error or "相机断开失败")
    return ApiResponse(success=ok, message=msg, data={"connected": bool(diag.connected)})


@router.get("/status", response_model=ApiResponse)
def camera_status(camera: CameraDriver = Depends(get_camera_driver)) -> ApiResponse:
    diag = camera.diagnostics()
    return ApiResponse(
        success=True,
        message="ok",
        data={
            "initialized": diag.initialized,
            "connected": diag.connected,
            "streaming": diag.streaming,
            "selected_index": diag.selected_index,
            "last_error": diag.last_error,
            "speed_levels": CAMERA_SPEED_LEVELS,
        },
    )


@router.get("/frame")
def camera_frame(
    timeout_ms: int = Query(default=1000, ge=1, le=10_000),
    quality: int = Query(default=90, ge=1, le=100),
    camera: CameraDriver = Depends(get_camera_driver),
) -> Response:
    try:
        jpeg = camera.get_jpeg_bytes(timeout_ms=timeout_ms, quality=quality)
    except Exception as exc:  # noqa: BLE001
        return Response(content=str(exc), status_code=503, media_type="text/plain; charset=utf-8")
    return Response(content=jpeg, media_type="image/jpeg")


@router.post("/params/exposure", response_model=ApiResponse)
def camera_set_exposure(
    payload: CameraExposureRequest,
    camera: CameraDriver = Depends(get_camera_driver),
) -> ApiResponse:
    ok = camera.set_exposure(
        auto_exposure=payload.auto_exposure,
        exposure_time=payload.exposure_time,
    )
    diag = camera.diagnostics()
    return ApiResponse(success=ok, message="曝光参数设置成功" if ok else (diag.last_error or "曝光参数设置失败"))


@router.post("/params/frame-speed", response_model=ApiResponse)
def camera_set_frame_speed(
    payload: CameraFrameSpeedRequest,
    camera: CameraDriver = Depends(get_camera_driver),
) -> ApiResponse:
    ok = camera.set_frame_speed(
        speed_level=payload.speed_level,
        auto_tune=payload.auto_tune,
        tune=payload.tune,
    )
    diag = camera.diagnostics()
    return ApiResponse(success=ok, message="帧率参数设置成功" if ok else (diag.last_error or "帧率参数设置失败"))


@router.post("/params/mirror", response_model=ApiResponse)
def camera_set_mirror(
    payload: CameraMirrorRequest,
    camera: CameraDriver = Depends(get_camera_driver),
) -> ApiResponse:
    ok = camera.set_mirror(horizontal=payload.horizontal, vertical=payload.vertical)
    diag = camera.diagnostics()
    return ApiResponse(success=ok, message="镜像参数设置成功" if ok else (diag.last_error or "镜像参数设置失败"))


@router.post("/params/white-balance", response_model=ApiResponse)
def camera_set_white_balance(
    payload: CameraWhiteBalanceRequest,
    camera: CameraDriver = Depends(get_camera_driver),
) -> ApiResponse:
    ok = camera.set_white_balance(
        auto_white_balance=payload.auto_white_balance,
        once=payload.once,
        r_gain=payload.r_gain,
        g_gain=payload.g_gain,
        b_gain=payload.b_gain,
    )
    diag = camera.diagnostics()
    return ApiResponse(success=ok, message="白平衡参数设置成功" if ok else (diag.last_error or "白平衡参数设置失败"))
