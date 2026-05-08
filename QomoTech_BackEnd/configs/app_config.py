import os
import sys
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict



# 打包后使用可执行文件所在目录作为基准目录。
BASE_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent.parent



class 软件配置模型(BaseSettings):
    软件名字: str = "QomoTech Backend"
    软件版本: str = "1.0.0"
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", env_prefix="QOMO_")


class 服务配置模型(BaseSettings):
    主机地址: str = "0.0.0.0"
    端口号: int = 5000
    调试模式: bool = True
    允许跨域: list[str] = Field(default_factory=lambda: ["*"])
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", env_prefix="QOMO_")


class 日志配置模型(BaseSettings):
    是否开启: bool = True
    日志级别: str = "INFO"
    保留天数: int = 7
    日志文件基础名: str = "qomo_logs"
    崩溃日志文件名: str = "errlog"
    拦截print: bool = False
    日志目录: str = Field(
        default_factory=lambda: str(
            Path(os.getenv("LOCALAPPDATA", str(BASE_DIR))) / "QomoTech" / "logs"
            if getattr(sys, "frozen", False)
            else BASE_DIR / "logs"
        )
    )
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", env_prefix="QOMO_")

    def 日志初始化字典(self) -> dict:
        """与 utils.logger.初始化 的「日志配置」参数键名一致。"""
        return {
            "是否开启": self.是否开启,
            "级别": self.日志级别,
            "保留天数": self.保留天数,
            "日志文件基础名": self.日志文件基础名,
            "崩溃日志文件名": self.崩溃日志文件名,
            "拦截print": self.拦截print,
        }


class 应用配置(BaseSettings):
    # 嵌套类名不得与字段名相同：Python 3.13（PEP 649）下会与注解求值冲突，
    # Pydantic v2 报 unevaluable-type-annotation。
    软件配置: 软件配置模型 = Field(default_factory=软件配置模型)
    服务配置: 服务配置模型 = Field(default_factory=服务配置模型)
    日志配置: 日志配置模型 = Field(default_factory=日志配置模型)
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", env_prefix="QOMO_")


应用配置实例 = 应用配置()
