"""FastAPI 应用实例与路由注册。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from utils.logger import 获取日志记录器
from config.app_config import 应用配置实例


#TODO：这肯定要去删的
from core.program_status_ws import set_program_status_event_loop
import asyncio
from api.dependencies import camera_driver, hardware_status_poller, rs232_driver
from api.http_api import router as http_router
from api.websocket_api import router as ws_router

日志 = 获取日志记录器("App")


@asynccontextmanager
async def 应用生命周期(app: FastAPI):
    """应用启动/关闭时的生命周期管理。"""
    set_program_status_event_loop(asyncio.get_running_loop())
    hardware_status_poller.start()

    日志.info("QomoTech 服务启动中...")

    from services.MotionService import MotionService
    运动服务 = MotionService.获取实例()
    try:
        日志.info(f'启动运动服务')
        await 运动服务.启动()
    except Exception as exc:
        日志.warning(f"运动服务启动失败（可在连接后重试）: {exc}")

    # from services.communicate_control.rs232.rs232_service import Rs232Service
    # rs232服务 = Rs232Service.获取实例()
    # try:
    #     日志.info(f'启动RS232服务')
    #     await rs232服务.启动()
    # except Exception as exc:
    #     日志.warning(f"RS232 服务启动失败: {exc}")

    yield
    try:
        hardware_status_poller.stop()
    except Exception as exc:
        日志.warning(f"硬件状态轮询器停止异常: {exc}")
    try:
        camera_driver.shutdown()
    except Exception as exc:
        日志.warning(f"相机驱动关闭异常: {exc}")
    try:
        rs232_driver.close()
    except Exception as exc:
        日志.warning(f"RS232 驱动关闭异常: {exc}")
    # try:
    #     await 运动服务.停止()
    # except Exception as exc:
    #     日志.warning(f"运动服务停止异常: {exc}")

    # try:
    #     await rs232服务.停止()
    # except Exception as exc:
    #     日志.warning(f"RS232 服务停止异常: {exc}")
    日志.info("QomoTech 服务已关闭")


def 创建应用() -> FastAPI:

    app = FastAPI(
        title=应用配置实例.软件配置.软件名字,
        version=应用配置实例.软件配置.软件版本,
        lifespan=应用生命周期,
    )

    app.add_middleware(
        CORSMiddleware,                                     # FastAPI 内置的 CORS 中间件
        allow_origins=应用配置实例.服务配置.允许跨域,          # 允许跨域的来源列表，* = 所有
        allow_credentials=True,                             # 允许前端请求携带 cookie/认证头
        allow_methods=["*"],                                # 允许的 HTTP 方法，* = GET/POST/PUT/DELETE 全放行
        allow_headers=["*"],                                # 允许的请求头，* = 不限制
    )
    日志.info('拉起服务成功')
    print('查看接口文档http://127.0.0.1:5000/docs#/')
    print('查看接口文档http://127.0.0.1:5000/redoc#/')
    # 注册路由
    # from routers import (
    #     motion_http_路由, motion_ws_路由,
    #     camera_ws_路由, camera_http_路由,
    #     rs232_http_路由, rs232_ws_路由,
    # )
    from routers.http.motion_http import 路由 as motion_http_路由
    from routers.websocket.motion_ws import 路由 as motion_ws_路由
    from routers.http.rs232_http import 路由 as rs232_http_路由
    app.include_router(motion_http_路由)
    app.include_router(motion_ws_路由)
    # app.include_router(camera_ws_路由)
    # app.include_router(camera_http_路由)
    app.include_router(rs232_http_路由)
    # app.include_router(rs232_ws_路由)
    app.include_router(http_router)
    app.include_router(ws_router)
    日志.info('注册路由成功')

    return app
app = 创建应用()

