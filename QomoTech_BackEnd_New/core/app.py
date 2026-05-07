"""FastAPI 应用实例与路由注册。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from utils.config_utils import 获取配置
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("App")


@asynccontextmanager
async def 应用生命周期(app: FastAPI):
    """应用启动/关闭时的生命周期管理。"""
    日志.info("QomoTech 服务启动中...")
    yield
    日志.info("QomoTech 服务已关闭")


def 创建应用() -> FastAPI:
    配置 = 获取配置()
    服务配置 = 配置.get("服务", {})

    app = FastAPI(
        title=配置.软件.名称,
        version=配置.软件.版本,
        lifespan=应用生命周期,
    )

    app.add_middleware(
        CORSMiddleware,                                     # FastAPI 内置的 CORS 中间件
        allow_origins=服务配置.get("allow_origins", ["*"]),  # 允许跨域的来源列表，* = 所有
        allow_credentials=True,                             # 允许前端请求携带 cookie/认证头
        allow_methods=["*"],                                # 允许的 HTTP 方法，* = GET/POST/PUT/DELETE 全放行
        allow_headers=["*"],                                # 允许的请求头，* = 不限制
    )

    # 注册路由
    from routers import http_路由, ws_路由
    app.include_router(http_路由)
    app.include_router(ws_路由)

    return app
app = 创建应用()
