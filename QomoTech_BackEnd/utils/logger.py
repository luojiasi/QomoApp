from __future__ import annotations

import atexit
import logging
import logging.handlers
from pathlib import Path

from config.app_config import app_config


def setup_logger(name: str = "qomotech") -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:return logger

    log_dir = Path(app_config.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    logger.setLevel(app_config.log_level.upper())

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    # 按天滚动，保留最近 7 份，防止单个日志文件无限增大
    file_handler = logging.handlers.TimedRotatingFileHandler(
        log_dir / "backend.log",
        when="midnight",
        backupCount=7,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # 程序退出时强制刷新并关闭所有 handler，确保崩溃日志落盘
    atexit.register(logging.shutdown)

    return logger

