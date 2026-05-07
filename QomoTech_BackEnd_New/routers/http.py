"""HTTP REST 接口路由。"""

from fastapi import APIRouter

路由 = APIRouter(prefix="/api")


@路由.get("/health")
async def 健康检查():
    return {"status": "ok"}
