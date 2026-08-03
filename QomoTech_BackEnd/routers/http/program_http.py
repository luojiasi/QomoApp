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
from services.ProgramServiceFreeParam import ProgramServiceFreeParam
from services.ProgramServiceTenParam import ProgramServiceTenPlus
from services.SystemSettingService import 保存配方状态到文件, 从文件加载配方状态
from routers.apiresponse import ApiResponse
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("程序HTTP")

路由 = APIRouter(prefix="/api", tags=["程序运行"])

# 应该委托给 self.程序执行器，而且 HTTP 路由里 program_http.py:87 调的 _svc() 是 PragramService，不是 ProgramService4p——4P 跑起来了状态也拿不到。
def _svc() -> PragramService: return PragramService.获取实例()
def _freeparam_svc() -> ProgramServiceFreeParam: return ProgramServiceFreeParam.获取实例()
def _tenplus_svc() -> ProgramServiceTenPlus: return ProgramServiceTenPlus.获取实例()

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
class 自由编辑参数请求模型(BaseModel):
    recipes: Dict[str, Any] = Field(
        ..., description="配方列表",
    )
    rows: List[Dict[str, Any]] = Field(
        ..., description="自由编辑参数列表（可含多目标展平行）",
    )
    targets: List[Dict[str, Any]] | None = Field(
        default=None,
        description="勾选下发的多个目标摘要列表",
    )
    target: Dict[str, Any] | None = Field(
        default=None,
        description="兼容旧字段：单目标摘要",
    )

# ==================================================================
# 1. 启动程序
# ==================================================================


@路由.post("/startProgram", summary="启动程序")
async def start_program(payload: 开始程序参数请求模型):
    """接收配方 + 实体，启动后台任务执行程序。"""
    旧在跑 = _svc().获取运行状态().get("running", False)
    新在跑 = _freeparam_svc().获取运行状态().get("running", False)
    if 旧在跑 or 新在跑:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已有程序正在运行，请停止后再启动")

    tasks = OffsetEndpointCalculator.calc_xy_points(payload.entities, 0)
    if not tasks: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="没有可执行的任务，请检查实体几何")
    async def _run_program() -> None:
        try:
            await _svc().执行程序(配方数据=payload.recipe_payload,实体数据=payload.entities,)
        except Exception:
            日志.exception("startProgram 后台任务异常")

    asyncio.ensure_future(_run_program())
    return ApiResponse(success=True, message="程序已启动", data={"task_count": len(tasks)})


# from services.ProgramService4p import ProgramService4p
# @路由.post("/startProgram/4PTest", summary="启动4P测试程序")
# async def start_program_4p_test(payload: 开始程序参数请求模型):
#     """启动后台任务执行4P测试程序。"""
#     try:
#         await ProgramService4p().执行程序4P(配方数据=payload.recipe_payload,实体数据=payload.entities)
#     except Exception:
#         日志.exception("startProgram/4PTest 后台任务异常")
#     return ApiResponse(success=True, message="QOMO4PN编辑器已启动")

# from services.ProgramService4p import ProgramService4p


@路由.post("/startProgram/entitiesEditFreeparam", summary="自由编辑参数切割")
async def send_free_params(payload: 自由编辑参数请求模型):
    """接收自由编辑参数，启动后台切割任务。"""
    旧在跑 = _svc().获取运行状态().get("running", False)
    新在跑 = _freeparam_svc().获取运行状态().get("running", False)
    if 旧在跑 or 新在跑:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已有程序正在运行，请停止后再启动")

    async def _run() -> None:
        try:
            await ProgramServiceFreeParam.获取实例().执行自由编辑参数(配方数据=payload.recipes,实体数据=payload.rows)
        except Exception:
            日志.exception("自由编辑参数执行异常")

    asyncio.ensure_future(_run())
    return ApiResponse(success=True, message="自由编辑参数已下发", data={"task_count": len(payload.rows)})

@路由.post("/startProgram/tenPlusEntitiesEditParams", summary="十工位自由编辑参数切割")
async def send_ten_plus_free_params(payload: 自由编辑参数请求模型):
    """接收勾选的一个或多个目标，启动十工位后台切割任务。"""
    旧在跑 = _svc().获取运行状态().get("running", False)
    新在跑 = _freeparam_svc().获取运行状态().get("running", False)
    tenplus_在跑 = _tenplus_svc().获取运行状态().get("running", False)
    if 旧在跑 or 新在跑 or tenplus_在跑:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已有程序正在运行，请停止后再启动")
    if not payload.rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="勾选目标没有可执行的任务行")

    目标列表 = payload.targets or ([payload.target] if payload.target else [])
    日志.info("十工位启动: targets=%s rows=%s", 目标列表, len(payload.rows))

    async def _run() -> None:
        try:
            await ProgramServiceTenPlus.获取实例().执行十工位自由编辑参数(配方数据=payload.recipes,实体数据=payload.rows)
        except Exception:
            日志.exception("十工位自由编辑参数执行异常")

    asyncio.ensure_future(_run())
    return ApiResponse(
        success=True,
        message="十工位自由编辑参数已下发",
        data={"task_count": len(payload.rows), "targets": 目标列表},
    )


# ==================================================================
# 2. 程序状态
# ==================================================================


@路由.get("/startProgram/status", summary="获取程序运行状态")
def program_status() -> ApiResponse:
    """返回 running / paused / total_tasks / current_task_index / 进度百分比（合并旧程序与 FreeParam）。"""
    旧状态是否在跑 = _svc().获取运行状态().get("running", False)
    自由编辑状态是否在跑 = _freeparam_svc().获取运行状态().get("running", False)
    # 任一正在运行则 running=True
    if 旧状态是否在跑:
        return ApiResponse(success=True, message="OK", data=_svc().获取运行状态())
    elif 自由编辑状态是否在跑:
        return ApiResponse(success=True, message="OK", data=_freeparam_svc().获取运行状态())
    else:
        return ApiResponse(success=True, message="OK", data=_freeparam_svc().获取运行状态())


# ==================================================================
# 3. 程序控制（暂停/继续/复位/急停/跳过）
# ==================================================================


async def _dispatch_program_control(action: str) -> Dict[str, Any]:
    svc = _svc()
    freeparam_svc = _freeparam_svc()
    if action == "reset":
        result = await svc.复位() or await freeparam_svc.复位()
        return result

    旧在跑 = svc.获取运行状态().get("running", False)
    新在跑 = freeparam_svc.获取运行状态().get("running", False)
    if 旧在跑:
        if action == "pause": return await svc.暂停()
        elif action == "resume": return await svc.恢复()
        elif action == "estop": return await svc.急停()
        elif action == "skip": return await svc.跳过任务()
        else: return {"success": False, "message": f"未知操作: {action}"}
    elif 新在跑:
        if action == "pause": return await freeparam_svc.暂停()
        elif action == "resume": return await freeparam_svc.恢复()
        elif action == "estop": return await freeparam_svc.急停()
        elif action == "skip": return await freeparam_svc.跳过任务()
        else: return {"success": False, "message": f"未知操作: {action}"}
    else:
        return {"success": False, "message": "没有正在运行的程序"}


@路由.post("/startProgram/control", summary="控制程序运行（暂停/继续/复位/急停/跳过）")
async def program_control(payload: 开始程序控制请求模型):
    result = await _dispatch_program_control(payload.action)
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail=str(result.get("message", "操作失败")),)
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
