from __future__ import annotations

import logging
from pathlib import Path

from config.app_config import app_config


def setup_logger(name: str = "qomotech") -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    Path(app_config.log_dir).mkdir(parents=True, exist_ok=True)
    logger.setLevel(app_config.log_level.upper())

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    file_handler = logging.FileHandler(
        Path(app_config.log_dir) / "backend.log", encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger

