"""相机设置 -> JSON 文件持久化。

后端启动时优先从文件加载配置并下发相机。
文件路径：应用根目录/config/camera-settings.json
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

from utils.path_utils import 路径工具

_CONFIG_DIR = "config"
_FILE = "camera-settings.json"


def _config_path() -> str:
    return os.path.join(路径工具.获取应用根目录(), _CONFIG_DIR, _FILE)


def 保存到文件(data: dict[str, Any]) -> None:
    """将相机设置写入 JSON 文件（覆盖写入）。"""
    path = _config_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def 从文件加载() -> Optional[dict[str, Any]]:
    """从 JSON 文件读取相机设置，文件不存在时返回 None。"""
    path = _config_path()
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
