from __future__ import annotations
from fastapi import APIRouter, Depends

from api.dependencies import get_motion_driver
from api.schemas import (
    ApiResponse,
    MotionAllAxesParamsRequest,
    MotionAxisLimitRequest,
    MotionAxisMoveAbsRequest,
    MotionAxisMoveRelRequest,
    MotionAxisNoRequest,
    MotionOnlineCommandRequest,
    MotionRAxisRotateRequest,
    MotionConnectRequest,
    MotionIoWriteRequest,
    MotionUAxisRotateRequest,
)
from drivers.zmotion_driver import ZMotionDriver


router = APIRouter(prefix="/api", tags=["driver"])


def _apply_axis_speed_if_present(motion: ZMotionDriver, axis_no: int, speed: float | None) -> bool:
    if speed is None:
        return True
    return motion.set_all_axes_params({int(axis_no): {"speed": float(speed)}})


@router.post("/motion/connect", response_model=ApiResponse)
def connect_motion(payload: MotionConnectRequest,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    axis_params_by_axis: dict[int, dict[str, float | bool]] = {}
    for axis in payload.axes:
        raw = axis.model_dump(exclude_none=True)
        axis_no = int(raw.pop("axisNo"))
        params: dict[str, float | bool] = {}
        for k, v in raw.items():
            if isinstance(v, bool):
                params[k] = v
            else:
                params[k] = float(v)
        axis_params_by_axis[axis_no] = params

    motion.disconnect()
    ok = motion.connect(payload.ipAddress)
    if ok:
        ok = motion.set_all_axes_params(axis_params_by_axis)

    return ApiResponse(
        success=ok,
        message="控制器连接成功" if ok else "控制器连接失败",
        data={"connected": ok},
    )

@router.post("/motion/disconnect", response_model=ApiResponse)
def disconnect_motion(motion: ZMotionDriver = Depends(get_motion_driver)) -> ApiResponse:
    ok = motion.disconnect()
    return ApiResponse(success=ok, message="控制器断开成功" if ok else "控制器断开失败", data={"connected": False})

@router.post("/motion/axes/params", response_model=ApiResponse)
def set_all_axes_params(payload: MotionAllAxesParamsRequest,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    ok = motion.set_all_axes_params(payload.to_driver_dict())
    return ApiResponse(success=ok, message="轴参数设置成功" if ok else "轴参数设置失败")

@router.post("/motion/axis/clear-error", response_model=ApiResponse)
def clear_axis_error(payload: MotionAxisNoRequest,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    ok = motion.clear_axis_error(payload.axis_no)
    return ApiResponse(success=ok, message="轴错误清除成功" if ok else "轴错误清除失败")


@router.post("/motion/axis/limit", response_model=ApiResponse)
def set_axis_limit(payload: MotionAxisLimitRequest,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    ok = motion.set_axis_limit(payload.axis_no, fs_limit=payload.fs_limit, rs_limit=payload.rs_limit)
    return ApiResponse(success=ok, message="轴限位设置成功" if ok else "轴限位设置失败")


@router.post("/motion/io/output", response_model=ApiResponse)
def set_output(payload: MotionIoWriteRequest,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    ok = motion.set_output(payload.io_no, payload.value)
    return ApiResponse(success=ok, message="输出设置成功" if ok else "输出设置失败")


@router.get("/motion/io/output/{io_no}", response_model=ApiResponse)
def get_output_state(io_no: int,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    if io_no < 0:
        return ApiResponse(success=False, message="io_no 必须 >= 0", data=None)
    value = motion.get_output(int(io_no))
    if motion.last_error:
        return ApiResponse(success=False, message=motion.last_error or "读取输出口失败", data=None)
    return ApiResponse(
        success=True,
        message="读取成功",
        data={"io_no": int(io_no), "value": bool(value)},
    )


@router.get("/motion/io/outputs", response_model=ApiResponse)
def get_outputs_status(io_start: int = 0,io_end: int = 8,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    if io_start < 0 or io_end < io_start:
        return ApiResponse(success=False, message="io_start/io_end 范围无效", data=None)
    result = motion.get_outputs_status(int(io_start), int(io_end))
    if motion.last_error:
        return ApiResponse(success=False, message=motion.last_error or "批量读取输出口失败", data=None)
    data = {str(k): bool(v) for k, v in result.items()}
    return ApiResponse(success=True, message="读取成功", data=data)


@router.get("/motion/io/input/{io_no}", response_model=ApiResponse)
def get_input_state(io_no: int,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    if io_no < 0:
        return ApiResponse(success=False, message="io_no 必须 >= 0", data=None)
    value = motion.get_input(int(io_no))
    if motion.last_error:
        return ApiResponse(success=False, message=motion.last_error or "读取输入口失败", data=None)
    return ApiResponse(
        success=True,
        message="读取成功",
        data={"io_no": int(io_no), "value": bool(value)},
    )


@router.get("/motion/io/inputs", response_model=ApiResponse)
def get_inputs_status(io_start: int = 0,io_end: int = 8,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    if io_start < 0 or io_end < io_start:
        return ApiResponse(success=False, message="io_start/io_end 范围无效", data=None)
    result = motion.get_inputs_status(int(io_start), int(io_end))
    if motion.last_error:
        return ApiResponse(success=False, message=motion.last_error or "批量读取输入口失败", data=None)
    data = {str(k): bool(v) for k, v in result.items()}
    return ApiResponse(success=True, message="读取成功", data=data)


@router.post("/motion/axis/zero", response_model=ApiResponse)
def zero_axis_position(payload: MotionAxisNoRequest,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    ok = motion.zero_axis_position(payload.axis_no)
    return ApiResponse(success=ok, message="轴位置清零成功" if ok else "轴位置清零失败")


@router.post("/motion/axis/move-abs", response_model=ApiResponse)
def move_abs(payload: MotionAxisMoveAbsRequest,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    if not _apply_axis_speed_if_present(motion, payload.axis_no, payload.speed):
        return ApiResponse(success=False, message="绝对运动失败（速度下发失败）")

    ok = motion.move_abs(payload.axis_no, payload.target_mm)
    return ApiResponse(success=ok, message="绝对运动成功" if ok else "绝对运动失败")

@router.post("/motion/axis/move-rel", response_model=ApiResponse)
def move_rel(payload: MotionAxisMoveRelRequest,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    if not _apply_axis_speed_if_present(motion, payload.axis_no, payload.speed):
        return ApiResponse(success=False, message="相对运动失败（速度下发失败）")

    ok = motion.move_rel(payload.axis_no, payload.delta_mm)
    return ApiResponse(success=ok, message="相对运动成功" if ok else "相对运动失败")

@router.post("/motion/emergency-stop", response_model=ApiResponse)
def emergency_stop(payload: MotionAxisNoRequest,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    ok = motion.emergency_stop_axis(payload.axis_no)
    return ApiResponse(
        success=ok,
        message="急停成功（已停止并清空该轴缓存）" if ok else "急停失败",
    )


@router.post("/motion/online-command", response_model=ApiResponse)
def online_command(payload: MotionOnlineCommandRequest,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    ok, result_text = motion.控制器执行缓存在线命令(payload.command)
    if ok:
        return ApiResponse(success=True, message="在线命令执行成功", data={"result": result_text})
    return ApiResponse(success=False,message=motion.last_error or "在线命令执行失败",data={"result": result_text},)



# 这是使用zmotion_adapter.py里面的方法
from core.zmotion_adapter import zmotion_adapter
@router.post("/motion/axis/U轴旋转的角度", response_model=ApiResponse)
def U轴旋转的角度(payload: MotionUAxisRotateRequest) -> ApiResponse:
    result = zmotion_adapter.U轴旋转的角度(payload.model_dump())
    if not result:
        return ApiResponse(success=False, message="U轴旋转失败", data=None)
    ok = bool(result.get("success"))
    return ApiResponse(success=ok,message=str(result.get("message") or ("U轴旋转成功" if ok else "U轴旋转失败")),data=result.get("data"),)

@router.post("/motion/axis/R轴旋转的圈数", response_model=ApiResponse)
def R轴旋转的圈数(payload: MotionRAxisRotateRequest) -> ApiResponse:
    result = zmotion_adapter.R轴旋转的圈数(payload.model_dump())
    if not result:
        return ApiResponse(success=False, message="R轴旋转失败", data=None)
    ok = bool(result.get("success"))
    return ApiResponse(success=ok,message=str(result.get("message") or ("R轴旋转成功" if ok else "R轴旋转失败")),data=result.get("data"),)

@router.post("/motion/axis/R轴一直进行旋转", response_model=ApiResponse)
def R轴一直进行旋转() -> ApiResponse:
    result = zmotion_adapter.R轴一直进行旋转()
    if not result:
        return ApiResponse(success=False, message="R轴一直进行旋转失败", data=None)
    ok = bool(result.get("success"))
    return ApiResponse(success=ok,message=str(result.get("message") or ("R轴一直进行旋转成功" if ok else "R轴一直进行旋转失败")),data=result.get("data"),)