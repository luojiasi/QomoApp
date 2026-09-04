"""SYSTEM_SETTING.JSON 共享读写模块。

提供字段级操作：读取/保存指定字段，不覆盖其他字段。
文件路径：应用根目录/config/SYSTEM_SETTING.JSON
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from utils.path_utils import 路径工具
_READ_WRITE_LOCK = threading.Lock()


_CONFIG_DIR = "config"
_FILE = "SYSTEM_SETTING.JSON"
def _config_path() -> Path:
    return Path(路径工具.获取应用根目录()) / _CONFIG_DIR / _FILE

class 中心旋转补偿请求模型(BaseModel):
    X: float = Field(default=0.0)
    Y: float = Field(default=0.0)
    Z: float = Field(default=0.0)


class 相机清晰误差请求模型(BaseModel):
    value: float = Field(default=0.0)

def _读取完整文件() -> dict[str, Any]:
    """读取整个 JSON 文件，文件不存在时返回空字典。"""
    path = _config_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def 读取系统设置字段(字段名: str, 默认值: Any = None) -> Any:
    """从 SYSTEM_SETTING.JSON 读取指定字段，不存在则返回默认值。"""
    data = _读取完整文件()
    return data.get(字段名, 默认值)


def 保存系统设置字段(字段名: str, 值: Any) -> None:
    """保存指定字段到 SYSTEM_SETTING.JSON，不影响其他字段。"""
    path = _config_path()
    os.makedirs(os.path.dirname(str(path)), exist_ok=True)

    with _READ_WRITE_LOCK:
        data = _读取完整文件()
        data[字段名] = 值
        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
