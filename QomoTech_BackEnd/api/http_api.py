from __future__ import annotations

import logging
import os
import signal
import threading
from pathlib import Path
from typing import Any

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from api.camera_api import router as camera_router
from api.driver_api import router as driver_router
from api.rs232_api import router as rs232_router
from api.dependencies import get_camera_driver, get_motion_driver, get_rs232_driver, get_state_manager
from api.schemas import (
    ApiResponse,
    LaserApplyRequest,
    Product4PCenterRotationRequest,
    Rs232SerialSessionRequest,
    StartProgramControlRequest,
)
from config.app_config import 应用配置实例
from config.motion_config import motion_config
from config.product4P_config import (
    Product4PCenterRotation,
    获取4P旋转中心的补偿值,
    保存4P旋转中心的补偿值,
)
from core.calc_offset_ljs import OffsetEndpointCalculator
from core.state_manager import StateManager
from drivers.camera_driver import CameraDriver
from core.startPragram import (
    execute_start_program,
    get_program_status,
    程序请求急停,
    程序请求暂停,
    程序请求复位,
    程序请求恢复运行,
    程序请求跳过任务,
)
from drivers.zmotion_driver import ZMotionDriver


logger = logging.getLogger("qomotech.http_api")

router = APIRouter()
router.include_router(driver_router)
router.include_router(rs232_router)
router.include_router(camera_router)


http_router = APIRouter(tags=["http"])


def _hardware_flags(motion_connected: bool) -> dict[str, bool]:
    return {
        "motion_connected": bool(motion_connected),
    }

@http_router.post("/api/startProgram", response_model=ApiResponse)
async def start_program(payload: dict[str, Any] | None = None,motion: ZMotionDriver = Depends(get_motion_driver),) -> ApiResponse:
    payload = payload or {}
    recipe_payload = payload.get("recipe_payload")
    entities = payload.get("entities")
    
    if recipe_payload is None or entities is None:
        return ApiResponse(success=False,message="startProgram 入参缺少 recipe_payload 或 entities",data=None,)

    if not isinstance(recipe_payload, dict):
        return ApiResponse(success=False, message="startProgram 入参不合法：recipe_payload 必须是对象", data=None)
    if not isinstance(entities, list):
        return ApiResponse(success=False, message="startProgram 入参不合法：entities 必须是数组", data=None)

    rs232_open_raw = payload.get("rs232_open")
    if rs232_open_raw is None:
        rs232_open_raw = recipe_payload.get("rs232Open")
    rs232_open: dict | None = None
    if rs232_open_raw is not None:
        try:
            rs232_open = Rs232SerialSessionRequest.model_validate(rs232_open_raw).model_dump()
        except Exception as exc:
            return ApiResponse(success=False,message=f"rs232_open 参数无效（需与 /api/rs232/open 一致）：{exc}",data=None,)

    tasks = OffsetEndpointCalculator.calc_xy_points(entities, 0)
    if not tasks:
        return ApiResponse(success=False,message="没有可执行的任务，请检查实体几何",data=None,)

    rs232 = get_rs232_driver()

    async def _run_program() -> None:
        try:
            await asyncio.to_thread(execute_start_program,motion=motion,recipe_payload=recipe_payload,entities=entities,rs232=rs232,rs232_open=rs232_open,)
        except Exception:
            logger.exception("startProgram 后台任务异常")

    asyncio.create_task(_run_program())
    return ApiResponse(success=True,message="程序已启动",data={"task_count": len(tasks)},)


@http_router.get("/api/startProgram/status", response_model=ApiResponse)
def start_program_status() -> ApiResponse:
    return ApiResponse(success=True,message="ok",data=get_program_status(),)


@http_router.post("/api/startProgram/control", response_model=ApiResponse)
def start_program_control(
    body: StartProgramControlRequest,
    motion: ZMotionDriver = Depends(get_motion_driver),
) -> ApiResponse:
    act = body.action
    if act == "pause":
        r = 程序请求暂停(motion)
    elif act == "resume":
        r = 程序请求恢复运行()
    elif act == "reset":
        r = 程序请求复位(motion)
    elif act == "estop":
        r = 程序请求急停(motion)
    elif act == "skip":
        r = 程序请求跳过任务(motion)
    else:
        return ApiResponse(success=False, message="未知操作", data=None)
    return ApiResponse(success=bool(r.get("success")),message=str(r.get("message", "")),data=None,)


@http_router.get("/api/health", response_model=ApiResponse)
def health_check() -> ApiResponse:
    return ApiResponse(success=True, message="服务正常")


@http_router.get("/api/hardware/status", response_model=ApiResponse)
def hardware_status(
    state: StateManager = Depends(get_state_manager),
    camera: CameraDriver = Depends(get_camera_driver),
) -> ApiResponse:
    snap = state.snapshot()
    driver_status = snap.get("motion_driver_status", {}) or {}
    cam_diag = camera.diagnostics()
    return ApiResponse(
        success=True,
        message="获取硬件状态成功",
        data={
            "state": snap,
            "motion_driver_status": driver_status,
            "camera_status": {
                "initialized": cam_diag.initialized,
                "connected": cam_diag.connected,
                "streaming": cam_diag.streaming,
                "selected_index": cam_diag.selected_index,
                "last_error": cam_diag.last_error,
            },
        },
    )

# 用来前端下发4P参数偏移的数据STR
@http_router.get("/api/product4p/center-rotation", response_model=ApiResponse)
def get_product4p_center_rotation_api() -> ApiResponse:
    data = 获取4P旋转中心的补偿值().model_dump()
    return ApiResponse(success=True, message="读取 4P 中心旋转参数成功", data=data)


@http_router.post("/api/product4p/center-rotation", response_model=ApiResponse)
def save_product4p_center_rotation_api(payload: Product4PCenterRotationRequest) -> ApiResponse:
    saved = 保存4P旋转中心的补偿值(Product4PCenterRotation(Xoffset=payload.Xoffset,Yoffset=payload.Yoffset,Zoffset=payload.Zoffset))
    return ApiResponse(success=True, message="保存 4P 中心旋转参数成功", data=saved.model_dump())
# 用来前端下发4P参数偏移的数据END

# 前端想知道“现在连接好了没有/当前运动位置，不是去问驱动器内部状态，而是问 StateManager 这份“汇总状态”
@http_router.post("/api/hardware/connect", response_model=ApiResponse)
def connect_hardware(
    motion: ZMotionDriver = Depends(get_motion_driver),
    state: StateManager = Depends(get_state_manager),
) -> ApiResponse:
    # ZMotionDriver.connect 需要控制器 IP（前端调用 /api/hardware/connect 时不传 body）
    motion_ok = motion.connect(motion_config.controller_ip)
    state.update(
        hardware_connected=bool(motion_ok),
        motion_connected=motion_ok,
    )
    message = "硬件连接完成"
    if motion.driver_mode != "zauxdll":
        message = "硬件连接完成（运动控制器已回退为模拟模式）"
    return ApiResponse(success=bool(motion_ok),message=message,data=_hardware_flags(motion_ok),)


@http_router.post("/api/hardware/disconnect", response_model=ApiResponse)
def disconnect_hardware(
    motion: ZMotionDriver = Depends(get_motion_driver),
    state: StateManager = Depends(get_state_manager),
) -> ApiResponse:
    motion_ok = motion.disconnect()
    state.update(
        hardware_connected=False,
        motion_connected=False,
    )
    return ApiResponse(
        success=bool(motion_ok),
        message="硬件断开完成",
        data=_hardware_flags(False),
    )


@http_router.post("/api/hardware/reconnect", response_model=ApiResponse)
def reconnect_hardware(
    motion: ZMotionDriver = Depends(get_motion_driver),
    state: StateManager = Depends(get_state_manager),
) -> ApiResponse:
    motion.disconnect()
    # 同样：需要 controller_ip
    motion_ok = motion.connect(motion_config.controller_ip)
    state.update(
        hardware_connected=bool(motion_ok),
        motion_connected=motion_ok,
    )
    return ApiResponse(success=bool(motion_ok),message="硬件单例重连完成" if motion_ok else "硬件单例重连失败",data=_hardware_flags(motion_ok),)

@http_router.post("/api/laser/apply", response_model=ApiResponse)
def laser_apply(payload: LaserApplyRequest) -> ApiResponse:
    # 仅接收并下发；接入真实激光驱动时在此转发 payload
    _ = payload.model_dump(exclude_none=True)
    return ApiResponse(success=True, message="激光参数已下发", data=None)


@http_router.get("/api/logs/download")
def download_logs() -> FileResponse:
    log_file = Path(应用配置实例.日志配置.日志目录) / "backend.log"
    if not log_file.exists():
        raise HTTPException(status_code=404, detail="日志文件不存在")
    return FileResponse(path=log_file, filename=log_file.name, media_type="text/plain")


@http_router.post("/api/shutdown", response_model=ApiResponse)
def shutdown() -> ApiResponse:
    """前端关闭时调用，记录日志后优雅退出，确保所有日志落盘。"""
    logger.info("收到前端关闭信号，准备优雅退出...")

    def 优雅退出() -> None:
        # 延迟 500ms，让 HTTP 响应先发回前端
        import time
        time.sleep(0.5)
        logging.shutdown()
        # Windows 下 SIGTERM 等同于 TerminateProcess 无法捕获，用 SIGBREAK 触发 KeyboardInterrupt
        # 在 uvicorn 进程内自发送 CTRL_BREAK_EVENT 可以让 uvicorn 走正常 shutdown 流程
        try:
            os.kill(os.getpid(), signal.SIGBREAK)
        except (AttributeError, OSError):
            # 非 Windows 或权限问题，回退到 SIGINT
            os.kill(os.getpid(), signal.SIGINT)

    threading.Thread(target=优雅退出, daemon=True).start()
    return ApiResponse(success=True, message="正在关闭后端服务")


router.include_router(http_router)

