"""4P 产品 REST API 路由。

前缀：``/api/product4p``

约定：
- 成功返回 ``{"success": True, "message": "...", "data": ...}``。
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from utils.logger import 获取日志记录器
from configs.product4P_config import (
    Product4PCenterRotation,
    获取4P旋转中心的补偿值,
    保存4P旋转中心的补偿值,
)
from routers.apiresponse import ApiResponse

日志 = 获取日志记录器("4P产品HTTP")

路由 = APIRouter(prefix="/api/product4p", tags=["4P 产品"])


class 中心旋转补偿请求模型(BaseModel):
    Xoffset: float = Field(default=0.0)
    Yoffset: float = Field(default=0.0)
    Zoffset: float = Field(default=0.0)


@路由.get("/center-rotation", response_model=ApiResponse)
def 获取中心旋转补偿() -> ApiResponse:
    data = 获取4P旋转中心的补偿值().model_dump()
    日志.info("读取 4P 中心旋转补偿: %s", data)
    return ApiResponse(success=True, message="读取 4P 中心旋转参数成功", data=data)


@路由.post("/center-rotation", response_model=ApiResponse)
def 保存中心旋转补偿(payload: 中心旋转补偿请求模型) -> ApiResponse:
    saved = 保存4P旋转中心的补偿值(
        Product4PCenterRotation(
            Xoffset=payload.Xoffset,
            Yoffset=payload.Yoffset,
            Zoffset=payload.Zoffset,
        )
    )
    日志.info("保存 4P 中心旋转补偿: X=%.3f Y=%.3f Z=%.3f", payload.Xoffset, payload.Yoffset, payload.Zoffset)
    return ApiResponse(success=True, message="保存 4P 中心旋转参数成功", data=saved.model_dump())
