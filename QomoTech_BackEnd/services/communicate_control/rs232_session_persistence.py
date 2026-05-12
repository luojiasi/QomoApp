"""RS232 会话配置 -> JSON 文件持久化。
文件路径：应用根目录/config/rs232-session.json
"""
from __future__ import annotations

import json
import os
from typing import Any

from utils.path_utils import 路径工具

_CONFIG_DIR = "config"
_FILE = "rs232-session.json"

# 默认配置（与前端 defaultRs232WorkbenchState 对齐）
_default = {
    "port": {
        "portName": "COM4",
        "baudRate": 9600,
        "dataBits": 8,
        "parity": "none",
        "stopBits": 1,
        "flowControl": "none",
        "timeoutMs": 200,
        "encoding": "utf-8"
    },
    "send": {
        "mode": "ascii",
        "appendCr": True,
        "appendLf": True,
    },
    "receive": {
        "mode": "ascii",
    }
}


def _config_path() -> str:
    return os.path.join(路径工具.获取应用根目录(), _CONFIG_DIR, _FILE)


def 保存会话(data: dict[str, Any]) -> None:
    """将 RS232 会话配置写入 JSON 文件（覆盖写入）。"""
    path = _config_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def 加载会话() -> dict[str, Any]:
    """从 JSON 文件读取会话配置；文件不存在时返回默认配置。"""
    path = _config_path()
    if not os.path.exists(path):
        return dict(_default)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
