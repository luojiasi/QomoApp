"""十工位切割点位 -> JSON 文件持久化。

文件路径：应用根目录/config/TENPLUSCUTTING.json
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

from utils.path_utils import 路径工具

_CONFIG_DIR = "config"
_FILE = "TENPLUSCUTTING.json"
_VERSION = "1.0.0"
_SLOT_COUNT = 10


def _config_path() -> str:
    return os.path.join(路径工具.获取应用根目录(), _CONFIG_DIR, _FILE)


def _empty_slot(index: int) -> Dict[str, Any]:
    return {
        "index": index,
        "x": 0.0,
        "y": 0.0,
        "z": 0.0,
        "u": 0.0,
        "taught": False,
    }


def 默认数据() -> Dict[str, Any]:
    return {
        "version": _VERSION,
        "slots": [_empty_slot(i) for i in range(1, _SLOT_COUNT + 1)],
    }


def _normalize(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    base = 默认数据()
    if not data or not isinstance(data, dict):
        return base

    version = data.get("version")
    if isinstance(version, str) and version.strip():
        base["version"] = version.strip()

    raw_slots = data.get("slots")
    if not isinstance(raw_slots, list):
        return base

    by_index: Dict[int, Dict[str, Any]] = {}
    for item in raw_slots:
        if not isinstance(item, dict):
            continue
        try:
            idx = int(item.get("index"))
        except (TypeError, ValueError):
            continue
        if idx < 1 or idx > _SLOT_COUNT:
            continue
        by_index[idx] = {
            "index": idx,
            "x": float(item.get("x", 0.0) or 0.0),
            "y": float(item.get("y", 0.0) or 0.0),
            "z": float(item.get("z", 0.0) or 0.0),
            "u": float(item.get("u", 0.0) or 0.0),
            "taught": bool(item.get("taught", False)),
        }

    base["slots"] = [by_index.get(i, _empty_slot(i)) for i in range(1, _SLOT_COUNT + 1)]
    return base


def 保存到文件(data: Dict[str, Any]) -> Dict[str, Any]:
    """归一化后写入 JSON（覆盖）。返回归一化结果。"""
    normalized = _normalize(data)
    path = _config_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(normalized, f, indent=2, ensure_ascii=False)
    return normalized


def 从文件加载() -> Dict[str, Any]:
    """读取文件；不存在则返回默认空表（不落盘）。"""
    path = _config_path()
    if not os.path.exists(path):
        return 默认数据()
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return _normalize(raw if isinstance(raw, dict) else None)


def 按工位号取点位(index: int) -> Optional[Dict[str, Any]]:
    """按工位号(1-10)取示教点位；不存在或未示教返回 None。"""
    try:
        idx = int(index)
    except (TypeError, ValueError):
        return None
    if idx < 1 or idx > _SLOT_COUNT:
        return None
    for slot in 从文件加载().get("slots") or []:
        if int(slot.get("index", -1)) == idx:
            if not bool(slot.get("taught", False)):
                return None
            return slot
    return None
