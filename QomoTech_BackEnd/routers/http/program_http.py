"""程序运行 REST API 路由。

前缀：``/api``

迁移自 ``core/startPragram.py``，现由 ``services.PragramService`` 门面统一编排。
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from core.calc_offset_ljs import OffsetEndpointCalculator  # 旧的
# from core.calc_offset import OffsetEndpointCalculator  # 新的
from services.PragramService import PragramService
from services.SystemSettingService import 保存配方状态到文件, 从文件加载配方状态
from routers.apiresponse import ApiResponse
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序HTTP")

路由 = APIRouter(prefix="/api", tags=["程序运行"])

# 应该委托给 self.程序执行器，而且 HTTP 路由里 program_http.py:87 调的 _svc() 是 PragramService，不是 ProgramService4p——4P 跑起来了状态也拿不到。
def _svc() -> PragramService:
    return PragramService.获取实例()


class 开始程序参数请求模型(BaseModel):
    recipe_payload: Dict[str, Any] = Field(
        ..., description="主配方 + 子配方完整 payload",
    )
    entities: List[Dict[str, Any]] = Field(
        ..., description="实体图形列表",
    )
class 开始程序控制请求模型(BaseModel):
    action: str = Field(
        ..., pattern=r"^(pause|resume|reset|estop|skip)$",
        description="控制动作：pause / resume / reset / estop / skip",
    )


# ==================================================================
# 1. 启动程序
# ==================================================================


@路由.post("/startProgram", summary="启动程序")
async def start_program(payload: 开始程序参数请求模型):
    """接收配方 + 实体，启动后台任务执行程序。"""
    if payload.recipe_payload is None or payload.entities is None: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="startProgram 入参缺少 recipe_payload 或 entities",)
    tasks = OffsetEndpointCalculator.calc_xy_points(payload.entities, 0)
    if not tasks: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="没有可执行的任务，请检查实体几何",)

    async def _run_program() -> None:
        try:
            await _svc().执行程序(配方数据=payload.recipe_payload,实体数据=payload.entities,)
        except Exception:
            日志.exception("startProgram 后台任务异常")

    asyncio.ensure_future(_run_program())

    return ApiResponse(success=True, message="程序已启动", data={"task_count": len(tasks)})



from services.ProgramService4p import ProgramService4p
@路由.post("/startProgram/4PTest", summary="启动4P测试程序")
async def start_program_4p_test(payload: 开始程序参数请求模型):
    """启动后台任务执行4P测试程序。"""
    try:
        await ProgramService4p().执行程序4P(配方数据=payload.recipe_payload,实体数据=payload.entities)
    except Exception:
        日志.exception("startProgram/4PTest 后台任务异常")
    return ApiResponse(success=True, message="QOMO4PN编辑器已启动")

# ==================================================================
# 2. 程序状态
# ==================================================================


@路由.get("/startProgram/status", summary="获取程序运行状态")
def program_status() -> ApiResponse:
    """返回 running / paused / total_tasks / current_task_index / 进度百分比。"""
    return ApiResponse(success=True, message="OK", data=_svc().获取运行状态())


# ==================================================================
# 3. 程序控制（暂停/继续/复位/急停/跳过）
# ==================================================================


async def _dispatch_program_control(action: str) -> Dict[str, Any]:
    svc = _svc()
    if action == "pause":
        return await svc.暂停()
    elif action == "resume":
        return await svc.恢复()
    elif action == "reset":
        return await svc.复位()
    elif action == "estop":
        return await svc.急停()
    elif action == "skip":
        return await svc.跳过任务()
    else:
        return {"success": False, "message": f"未知操作: {action}"}


@路由.post("/startProgram/control", summary="控制程序运行（暂停/继续/复位/急停/跳过）")
async def program_control(payload: 开始程序控制请求模型):
    result = await _dispatch_program_control(payload.action)
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(result.get("message", "操作失败")),
        )
    return ApiResponse(success=True, message=str(result.get("message", "操作成功")))


# ==================================================================
# 4. 配方状态持久化
# ==================================================================


@路由.get("/recipe/state", summary="读取配方状态文件")
async def 读取配方状态():
    data = 从文件加载配方状态()
    return ApiResponse(success=True, message="OK" if data else "无已保存的配方数据", data=data)


@路由.post("/recipe/state", summary="保存配方状态到文件")
async def 保存配方状态(req: Request):
    body = await req.json()
    保存配方状态到文件(body)
    return ApiResponse(success=True, message="配方数据已保存", data=None)
