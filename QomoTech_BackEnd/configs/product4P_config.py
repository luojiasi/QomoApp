from __future__ import annotations
import json
import threading
from pathlib import Path
from pydantic import BaseModel
from utils.path_utils import 路径工具


class Product4PCenterRotation(BaseModel):
    Xoffset: float = 0.0
    Yoffset: float = 0.0
    Zoffset: float = 0.0


_CONFIG_FILE = Path(路径工具.获取应用根目录()) / "product4p_center_rotation.json"

_WRITE_LOCK = threading.Lock()


def 读取存储的4P旋转中心补偿值() -> Product4PCenterRotation:
    try:
        data = json.loads(_CONFIG_FILE.read_text(encoding="utf-8"))
        return Product4PCenterRotation(
            Xoffset=float(data.get("Xoffset", 0)),
            Yoffset=float(data.get("Yoffset", 0)),
            Zoffset=float(data.get("Zoffset", 0)),
        )
    except Exception:
        return Product4PCenterRotation()


product4p_center_rotation = 读取存储的4P旋转中心补偿值()


def 获取4P旋转中心的补偿值() -> Product4PCenterRotation:
    return Product4PCenterRotation(**product4p_center_rotation.model_dump())


def 保存4P旋转中心的补偿值(payload: Product4PCenterRotation) -> Product4PCenterRotation:
    标准化补偿值参数 = Product4PCenterRotation(
        Xoffset=round(float(payload.Xoffset), 4),
        Yoffset=round(float(payload.Yoffset), 4),
        Zoffset=round(float(payload.Zoffset), 4),
    )
    with _WRITE_LOCK:
        _CONFIG_FILE.write_text(
            标准化补偿值参数.model_dump_json(indent=2),
            encoding="utf-8",
        )
        global product4p_center_rotation
        product4p_center_rotation = 标准化补偿值参数
    return 获取4P旋转中心的补偿值()
