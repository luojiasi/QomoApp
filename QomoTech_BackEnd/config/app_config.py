import os
import sys
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


if getattr(sys, "frozen", False):
    # 打包后使用可执行文件所在目录作为基准目录。
    BASE_DIR = Path(sys.executable).resolve().parent
    # 避免 Program Files 等只读目录导致日志创建失败。
    DEFAULT_LOG_DIR = Path(os.getenv("LOCALAPPDATA", str(BASE_DIR))) / "QomoTech" / "logs"
else:
    BASE_DIR = Path(__file__).resolve().parent.parent
    DEFAULT_LOG_DIR = BASE_DIR / "logs"


class AppConfig(BaseSettings):
    app_name: str = "QomoTech Backend"
    version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 5000
    debug: bool = False
    allow_origins: list[str] = Field(default_factory=lambda: ["*"])
    log_dir: Path = DEFAULT_LOG_DIR
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="QOMO_",
    )


app_config = AppConfig()

