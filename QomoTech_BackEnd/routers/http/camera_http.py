"""相机 REST API 路由。

前缀：``/api/camera``

按业务分组覆盖 ``CameraService`` 的全部公开方法：

1. 设备：``GET /devices`` / ``POST /connect`` / ``POST /disconnect`` / ``GET /status``
2. 引导参数：``POST /bootstrap-settings``
3. 取帧：``GET /frame``（直接返回 JPEG）
4. 参数：``POST /params/exposure`` / ``frame-speed`` / ``mirror`` / ``white-balance``

约定：
- 普通端点统一返回 ``{"success": True, "message": "...", "data": ...}``。
- ``/frame`` 直接返回 ``image/jpeg`` 字节流；失败返回 ``HTTP 503``。
- ``CameraError`` → ``HTTP 502``；其它非业务异常 → ``HTTP 500``。

为了和旧 ``api/camera_api.py`` 共存（路径相同），core 在迁移期需选择只挂一套；
本路由是新版，建议在 ``core/app.py`` 解注释 ``camera_http_路由`` 后停用旧的
``api/camera_api.py`` 注册行。
"""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, model_validator

from services.camera_control.CGcamera_adapter import CameraError
from services.camera_control import camera_persistence
from services.CameraService import CameraService
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("相机HTTP")

路由 = APIRouter(prefix="/api/camera", tags=["相机"])


# ==================================================================
# 请求模型
# ==================================================================


class 相机连接请求模型(BaseModel):
    index: int = Field(default=0, ge=0)


class 相机曝光请求模型(BaseModel):
    auto_exposure: Optional[bool] = None
    exposure_time: Optional[int] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check(self):
        if self.auto_exposure is None and self.exposure_time is None:
            raise ValueError("auto_exposure 和 exposure_time 不能同时为空")
        return self


class 相机帧率挡位请求模型(BaseModel):
    speed_level: Optional[Literal[0, 1, 2, 3]] = None
    auto_tune: bool = True
    tune: Optional[float] = Field(default=None, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _check(self):
        if self.speed_level is None and self.tune is None:
            raise ValueError("speed_level 和 tune 不能同时为空")
        return self


class 相机镜像请求模型(BaseModel):
    horizontal: Optional[bool] = None
    vertical: Optional[bool] = None

    @model_validator(mode="after")
    def _check(self):
        if self.horizontal is None and self.vertical is None:
            raise ValueError("horizontal 和 vertical 不能同时为空")
        return self


class 相机白平衡请求模型(BaseModel):
    auto_white_balance: Optional[bool] = None
    once: bool = False
    r_gain: Optional[int] = Field(default=None, ge=0)
    g_gain: Optional[int] = Field(default=None, ge=0)
    b_gain: Optional[int] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check(self):
        manual_gain = (self.r_gain, self.g_gain, self.b_gain)
        provided = [g is not None for g in manual_gain]
        if any(provided) and not all(provided):
            raise ValueError("手动白平衡增益必须同时提供 r_gain/g_gain/b_gain")
        if (
            self.auto_white_balance is None
            and not self.once
            and not any(provided)
        ):
            raise ValueError(
                "auto_white_balance / once / r-g-b 增益至少提供一组"
            )
        return self


class 相机首次连接引导参数请求模型(BaseModel):
    auto_exposure: Optional[bool] = None
    exposure_time: Optional[int] = Field(default=None, ge=0)
    speed_level: Optional[Literal[0, 1, 2, 3]] = None
    auto_tune: bool = True
    tune: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    mirror_horizontal: Optional[bool] = None
    mirror_vertical: Optional[bool] = None
    auto_white_balance: Optional[bool] = None
    r_gain: Optional[int] = Field(default=None, ge=0)
    g_gain: Optional[int] = Field(default=None, ge=0)
    b_gain: Optional[int] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check(self):
        manual_gain = (self.r_gain, self.g_gain, self.b_gain)
        provided = [g is not None for g in manual_gain]
        if any(provided) and not all(provided):
            raise ValueError("手动白平衡增益必须同时提供 r_gain/g_gain/b_gain")
        return self


# ==================================================================
# 辅助
# ==================================================================


def _service() -> CameraService:
    return CameraService.获取实例()


def _ok(message: str = "OK", data: Any = None) -> Dict[str, Any]:
    return {"success": True, "message": message, "data": data}


def _handle_exc(exc: Exception) -> HTTPException:
    if isinstance(exc, CameraError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc),
        )
    日志.exception(f"未分类异常: {exc}")
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc),
    )


def _diag_dict(svc: CameraService) -> Dict[str, Any]:
    diag = svc.获取诊断()
    if diag is None:
        return {
            "initialized": False,
            "connected": False,
            "streaming": False,
            "selected_index": None,
            "last_error": "CameraService 未启动",
        }
    return {
        "initialized": diag.initialized,
        "connected": diag.connected,
        "streaming": diag.streaming,
        "selected_index": diag.selected_index,
        "last_error": diag.last_error,
    }


# ==================================================================
# 1. 设备
# ==================================================================


@路由.get("/devices", summary="枚举相机设备")
async def 枚举设备():
    try:
        devices = await _service().枚举设备()
        return _ok(
            "设备枚举成功",
            {
                "devices": [
                    {"index": d.index, "name": d.name, "serial": d.serial}
                    for d in devices
                ],
            },
        )
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/connect", summary="连接相机")
async def 连接相机(req: 相机连接请求模型):
    svc = _service()
    try:
        info = await svc.连接(req.index)
        return _ok(
            "相机连接成功",
            {
                "selected_index": info.index,
                **_diag_dict(svc),
            },
        )
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/disconnect", summary="断开相机")
async def 断开相机():
    svc = _service()
    try:
        await svc.断开()
        return _ok("相机断开成功", {"connected": svc.获取诊断().connected})
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/status", summary="相机诊断状态")
async def 相机状态():
    svc = _service()
    return _ok(
        "OK",
        {
            **_diag_dict(svc),
            "speed_levels": svc.速度档位(),
            "ws_defaults": svc.取_推流默认值(),
        },
    )


# ==================================================================
# 2. 引导参数 / 持久化
# ==================================================================


@路由.post("/bootstrap-settings", summary="缓存首次连接的引导参数")
async def 设置引导参数(req: 相机首次连接引导参数请求模型):
    payload = req.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="bootstrap 至少提供一个字段",
        )
    try:
        await _service().设置引导参数(payload)
        return _ok("引导参数已缓存", payload)
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/settings", summary="读取相机设置文件")
async def 读取相机设置():
    data = camera_persistence.从文件加载()
    return _ok("OK" if data else "无已保存的设置文件", data)


@路由.post("/settings", summary="保存相机设置到文件并下发相机")
async def 保存相机设置(req: Request):
    body = await req.json()
    try:
        await _service().保存并下发设置(body)
        return _ok("相机设置已保存并下发到相机")
    except Exception:
        return _ok("相机设置已保存到文件，但下发失败（相机可能未连接）")


# ==================================================================
# 3. 参数
# ==================================================================


@路由.post("/params/exposure", summary="设置曝光参数")
async def 设置曝光(req: 相机曝光请求模型):
    try:
        await _service().设置曝光(
            auto_exposure=req.auto_exposure,
            exposure_time=req.exposure_time,
        )
        return _ok("曝光参数设置成功", req.model_dump(exclude_none=True))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/params/frame-speed", summary="设置帧率参数")
async def 设置帧率(req: 相机帧率挡位请求模型):
    try:
        await _service().设置帧率(
            speed_level=req.speed_level,
            auto_tune=req.auto_tune,
            tune=req.tune,
        )
        return _ok("帧率参数设置成功", req.model_dump(exclude_none=True))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/params/mirror", summary="设置镜像")
async def 设置镜像(req: 相机镜像请求模型):
    try:
        await _service().设置镜像(
            horizontal=req.horizontal, vertical=req.vertical,
        )
        return _ok("镜像参数设置成功", req.model_dump(exclude_none=True))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/params/white-balance", summary="设置白平衡")
async def 设置白平衡(req: 相机白平衡请求模型):
    try:
        await _service().设置白平衡(
            auto_white_balance=req.auto_white_balance,
            once=req.once,
            r_gain=req.r_gain,
            g_gain=req.g_gain,
            b_gain=req.b_gain,
        )
        return _ok("白平衡参数设置成功", req.model_dump(exclude_none=True))
    except Exception as exc:
        raise _handle_exc(exc) from exc
