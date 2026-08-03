


import json
import os
from typing import Any, Optional

from configs import system_settings as 系统设置
from configs.system_settings import 中心旋转补偿请求模型
from utils.path_utils import 路径工具

# ── 配方状态 JSON 文件持久化 ──────────────────────────────
_配方配置目录 = "config"
_配方状态文件 = "recipe-state.json"


def _配方状态文件路径() -> str:
    return os.path.join(路径工具.获取应用根目录(), _配方配置目录, _配方状态文件)


def 保存配方状态到文件(data: dict[str, Any]) -> None:
    path = _配方状态文件路径()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def 从文件加载配方状态() -> Optional[dict[str, Any]]:
    path = _配方状态文件路径()
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# =====================================================
# 设备旋转中心补偿值字段
旋转中心补偿值字段 = "product4p_center_rotation"
def 读取存储的4P旋转中心补偿值() -> 中心旋转补偿请求模型:
    raw = 系统设置.读取系统设置字段(旋转中心补偿值字段)
    if raw is None:
        return 中心旋转补偿请求模型()
    try:
        return 中心旋转补偿请求模型(
            X=float(raw.get("X", 0)),
            Y=float(raw.get("Y", 0)),
            Z=float(raw.get("Z", 0)),
        )
    except (TypeError, ValueError):
        return 中心旋转补偿请求模型()
# ——————————————————————————————————————————————————————
product4p_center_rotation = 读取存储的4P旋转中心补偿值()
# ——————————————————————————————————————————————————————

def 保存4P旋转中心的补偿值(payload: 中心旋转补偿请求模型) -> 中心旋转补偿请求模型:
    标准化 = 中心旋转补偿请求模型(
        X=round(float(payload.X), 4),
        Y=round(float(payload.Y), 4),
        Z=round(float(payload.Z), 4),
    )
    系统设置.保存系统设置字段(旋转中心补偿值字段, 标准化.model_dump())
    global product4p_center_rotation
    product4p_center_rotation = 标准化
    return 获取4P旋转中心的补偿值()

def 获取4P旋转中心的补偿值() -> 中心旋转补偿请求模型:
    return 中心旋转补偿请求模型(**product4p_center_rotation.model_dump())
# =====================================================

# =====================================================
# 快速移动点位置字段
快速移动点位置字段 = "quick_move_position"
def 读取存储的快速移动点() -> 中心旋转补偿请求模型:
    raw = 系统设置.读取系统设置字段(快速移动点位置字段)
    if raw is None:
        return 中心旋转补偿请求模型()
    try:
        return 中心旋转补偿请求模型(
            X=float(raw.get("X", 0)),
            Y=float(raw.get("Y", 0)),
            Z=float(raw.get("Z", 0)),
        )
    except (TypeError, ValueError):
        return 中心旋转补偿请求模型()
# ——————————————————————————————————————————————————————
quick_move_position = 读取存储的快速移动点()
# ——————————————————————————————————————————————————————

def 保存快速移动点(payload: 中心旋转补偿请求模型) -> 中心旋转补偿请求模型:
    标准化 = 中心旋转补偿请求模型(
        X=round(float(payload.X), 4),
        Y=round(float(payload.Y), 4),
        Z=round(float(payload.Z), 4),
    )
    系统设置.保存系统设置字段(快速移动点位置字段, 标准化.model_dump())
    global quick_move_position
    quick_move_position = 标准化
    return 获取快速移动点()

def 获取快速移动点() -> 中心旋转补偿请求模型:
    return 中心旋转补偿请求模型(**quick_move_position.model_dump())
# =====================================================

# R轴旋转中心点的位置字段
R轴旋转中心点的位置字段 = "r_axis_position"
def 读取存储的R轴旋转中心点() -> 中心旋转补偿请求模型:
    raw = 系统设置.读取系统设置字段(R轴旋转中心点的位置字段)
    if raw is None:
        return 中心旋转补偿请求模型()
    try:
        return 中心旋转补偿请求模型(
            X=float(raw.get("X", 0)),
            Y=float(raw.get("Y", 0)),
            Z=float(raw.get("Z", 0)),
        )
    except (TypeError, ValueError):
        return 中心旋转补偿请求模型()
# ——————————————————————————————————————————————————————
r_axis_position = 读取存储的R轴旋转中心点()
# ——————————————————————————————————————————————————————

def 保存R轴旋转中心点(payload: 中心旋转补偿请求模型) -> 中心旋转补偿请求模型:
    标准化 = 中心旋转补偿请求模型(
        X=round(float(payload.X), 4),
        Y=round(float(payload.Y), 4),
        Z=round(float(payload.Z), 4),
    )
    系统设置.保存系统设置字段(R轴旋转中心点的位置字段, 标准化.model_dump())
    global r_axis_position
    r_axis_position = 标准化
    return 获取R轴旋转中心点()

def 获取R轴旋转中心点() -> 中心旋转补偿请求模型:
    return 中心旋转补偿请求模型(**r_axis_position.model_dump())
# =====================================================
