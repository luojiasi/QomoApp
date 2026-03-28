
from __future__ import annotations

import asyncio
import sys
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from api.http_api import router as http_router
from api.websocket_api import router as ws_router
from api.dependencies import camera_driver, hardware_status_poller, rs232_driver
from config.app_config import app_config
from core.program_status_ws import set_program_status_event_loop
from utils.logger import setup_logger


logger = setup_logger()


def create_app() -> FastAPI:
    app = FastAPI(title=app_config.app_name, version=app_config.version)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_config.allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(http_router)
    app.include_router(ws_router)

    @app.exception_handler(RequestValidationError)
    async def _request_validation_error_handler(request, exc: RequestValidationError):
        # 422 参数校验失败时，把具体字段/类型问题打到后端日志里，便于定位前端实际发了什么。
        logger.warning("Request validation failed: %s %s", request.method, request.url)
        try:
            body = await request.body()
            logger.warning("Request body: %s", body.decode("utf-8", errors="replace"))
        except Exception as e:  # noqa: BLE001
            logger.warning("Failed to read request body: %s", e)
        logger.warning("Validation errors: %s", exc.errors())
        return JSONResponse(status_code=422, content={"detail": exc.errors()})

    @app.on_event("startup")
    async def _startup() -> None:
        set_program_status_event_loop(asyncio.get_running_loop())
        # 单独状态采集线程：持续写入 state_manager，前端只读缓存。
        hardware_status_poller.start()

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        hardware_status_poller.stop()
        camera_driver.shutdown()
        rs232_driver.close()

    return app


app = create_app()


def main() -> None:
    logger.info("Starting QomoTech backend")
    reload_enabled = bool(app_config.debug) and not getattr(sys, "frozen", False)
    uvicorn.run(
        app,
        host=app_config.host,
        port=app_config.port,
        reload=reload_enabled,
    )


if __name__ == "__main__":
    main()
