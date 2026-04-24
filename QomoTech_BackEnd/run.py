
from __future__ import annotations

import asyncio
import faulthandler
import sys
import threading
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

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

# 进程被 C 扩展 / 驱动 DLL 直接弄崩时，普通 logging 与 excepthook 都来不及写；
# faulthandler 在致命信号或 watchdog 触发时会把各线程栈追加到该文件。
_fault_log_fp = open(Path(app_config.log_dir) / "backend-fault.log", "a", encoding="utf-8")
faulthandler.enable(file=_fault_log_fp, all_threads=True)


def 安装全局异常捕获钩子() -> None:
    """捕获所有未被 try/except 处理的异常，写入日志后再让程序退出。"""

    def 捕获主线程未处理异常(exc_type, exc_value, exc_tb):
        if issubclass(exc_type, KeyboardInterrupt):
            # Ctrl-C 正常退出，不算崩溃
            sys.__excepthook__(exc_type, exc_value, exc_tb)
            return
        logger.critical(
            "主线程未捕获异常（程序即将退出）:\n%s",
            "".join(traceback.format_exception(exc_type, exc_value, exc_tb)),
        )

    def 捕获子线程未处理异常(args: threading.ExceptHookArgs):
        if args.exc_type is SystemExit:
            return
        logger.critical(
            "子线程 [%s] 未捕获异常（线程即将终止）:\n%s",
            args.thread.name if args.thread else "unknown",
            "".join(traceback.format_exception(args.exc_type, args.exc_value, args.exc_traceback)),
        )

    sys.excepthook = 捕获主线程未处理异常
    threading.excepthook = 捕获子线程未处理异常


@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    """FastAPI 推荐：用 lifespan 替代已弃用的 on_event(startup/shutdown)。"""
    set_program_status_event_loop(asyncio.get_running_loop())
    hardware_status_poller.start()
    try:
        yield
    finally:
        hardware_status_poller.stop()
        camera_driver.shutdown()
        rs232_driver.close()


def create_app() -> FastAPI:
    app = FastAPI(
        title=app_config.app_name,
        version=app_config.version,
        lifespan=app_lifespan,
    )
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

    return app


app = create_app()


def main() -> None:
    安装全局异常捕获钩子()
    logger.info("正在启动科猛碳极激光切割机后台服务")
    reload_enabled = bool(app_config.debug) and not getattr(sys, "frozen", False)
    try:
        uvicorn.run(
            app,
            host=app_config.host,
            port=app_config.port,
            reload=reload_enabled,
        )
    except Exception:
        logger.critical("主进程发生未预期异常，程序即将退出:\n%s", traceback.format_exc())
        raise
    finally:
        logger.info("科猛碳极激光切割机后台服务已停止,line108")


if __name__ == "__main__":
    main()
