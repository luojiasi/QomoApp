"""程序运行 REST API 路由。

前缀：``/api/startProgram``

迁移自旧版 ``api/http_api.py``，业务逻辑仍由 ``core.startPragram`` 负责，
路由层改为 async + Pydantic 模式，与 ``routers/http/motion_http.py`` 风格对齐。

约定：
- 成功返回 ``{"success": True, "message": "...", "data": ...}``。
- 参数校验失败 → ``HTTP 400``；内部错误 → ``HTTP 500``。
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from core.startPragram import execute_start_program, get_program_status
from core.startPragram import 程序请求急停, 程序请求暂停, 程序请求恢复运行
from core.startPragram import 程序请求复位, 程序请求跳过任务
from core.calc_offset_ljs import OffsetEndpointCalculator
from routers.http.rs232_http import 串口发送接收请求响应模型 as Rs232SerialSessionRequest
from services.Rs232Service import Rs232Service
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("ProgramHTTP")

路由 = APIRouter(prefix="/api", tags=["程序运行"])


class 开始程序参数请求模型(BaseModel):
    recipe_payload: Dict[str, Any] = Field(
        ..., description="主配方 + 子配方完整 payload",
    )
    entities: List[Dict[str, Any]] = Field(
        ..., description="实体图形列表",
    )
    rs232_open: Optional[Dict[str, Any]] = Field(
        default=None, description="RS232 串口配置；不填则复用已有连接",
    )


class 开始程序控制请求模型(BaseModel):
    action: str = Field(
        ..., pattern=r"^(pause|resume|reset|estop|skip)$",
        description="控制动作：pause / resume / reset / estop / skip",
    )


def _ok(message: str = "OK", data: Any = None) -> Dict[str, Any]:
    return {"success": True, "message": message, "data": data}


# ==================================================================
# 1. 启动程序
# ==================================================================


@路由.post("/startProgram", summary="启动程序")
async def start_program(
    payload: 开始程序参数请求模型,
):
    """接收配方 + 实体，启动后台任务执行程序。"""
    if payload.recipe_payload is None or payload.entities is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="startProgram 入参缺少 recipe_payload 或 entities",)

    tasks = OffsetEndpointCalculator.calc_xy_points(payload.entities, 0)
    if not tasks:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="没有可执行的任务，请检查实体几何",)

    # 验证 rs232_open（若提供）；支持从 payload 顶层或 recipe_payload.rs232Open 取
    rs232_open_raw = payload.rs232_open
    if rs232_open_raw is None: rs232_open_raw = payload.recipe_payload.get("rs232Open")
    rs232_open_dict: Optional[Dict[str, Any]] = None
    if rs232_open_raw is not None:
        try:
            rs232_open_dict = Rs232SerialSessionRequest.model_validate(rs232_open_raw,).model_dump()
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail=f"rs232_open 参数无效: {exc}",) from exc

    rs232 = Rs232Service.获取实例()

    async def _run_program() -> None:
        try:
            await execute_start_program(
                recipe_payload=payload.recipe_payload,
                entities=payload.entities,
                rs232=rs232,
                rs232_open=rs232_open_dict,
            )
        except Exception:
            日志.exception("startProgram 后台任务异常")

    asyncio.ensure_future(_run_program())

    return _ok("程序已启动", {"task_count": len(tasks)})


# ==================================================================
# 2. 程序状态
# ==================================================================


@路由.get("/startProgram/status", summary="获取程序运行状态")
async def program_status():
    """返回 running / paused / total_tasks / current_task_index / 进度百分比。"""
    return _ok("OK", get_program_status())


# ==================================================================
# 3. 程序控制（暂停/继续/复位/急停/跳过）
# ==================================================================


async def _dispatch_program_control(
    action: str,
) -> Dict[str, Any]:
    if action == "pause":
        return await 程序请求暂停()
    elif action == "resume":
        return await 程序请求恢复运行()
    elif action == "reset":
        return await 程序请求复位()
    elif action == "estop":
        return await 程序请求急停()
    elif action == "skip":
        return await 程序请求跳过任务()
    else:
        return {"success": False, "message": f"未知操作: {action}"}


@路由.post("/startProgram/control", summary="控制程序运行（暂停/继续/复位/急停/跳过）")
async def program_control(
    payload: 开始程序控制请求模型,
):
    result = await _dispatch_program_control(payload.action)
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(result.get("message", "操作失败")),
        )
    return _ok(str(result.get("message", "操作成功")))
