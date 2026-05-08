"""运动控制配置加载与校验。

读取 configs/motion_config.json，转为强类型 dataclass。
缺失字段使用合理默认值；axis_map 与 axes 不一致时抛 ValueError。

兼容 PyInstaller：通过 路径工具 / sys._MEIPASS 解析。
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from utils.path_utils import 路径工具


@dataclass(frozen=True)
class 控制器配置:
    ip: str = "192.168.0.11"
    timeout_ms: int = 3000
    heartbeat_interval_s: float = 5.0
    watchdog_timeout_s: float = 5.0


@dataclass(frozen=True)
class 轴配置:
    """单轴参数。

    脉冲当量：每工程单位的脉冲数（ZAux_Direct_SetUnits）。
    轴类型 (ATYPE)：1=方向脉冲(CW/CCW)，4=正交编码器，65=EtherCAT 等。
    """

    名称: str
    轴号: int
    最大速度: float = 5000.0
    加速度: float = 500.0
    减速度: float = 500.0
    软限位正: float = 1.0e9         # 设置为大值视为禁用（ZMC SDK 约定）
    软限位负: float = -1.0e9
    回零速度: float = 500.0
    回零方向: int = -1
    回零模式: int = 0               # ZAux_Direct_Single_Datum 的 mode
    脉冲当量: float = 1.0
    轴类型: int = 1
    使能: bool = True


@dataclass(frozen=True)
class 安全配置:
    紧急停止指令: str = "CANCEL(0,2)"
    要求先回零: bool = False
    最大进给倍率: float = 200.0
    最小进给倍率: float = 0.0


@dataclass(frozen=True)
class 监控配置:
    """状态采集与订阅参数。"""

    状态轮询毫秒: int = 50
    最大订阅数: int = 16
    队列上限: int = 5


@dataclass(frozen=True)
class 运动配置:
    控制器: 控制器配置
    轴映射: Dict[str, int]              # 名称 -> 轴号
    轴: Dict[str, 轴配置]               # 名称 -> 轴配置
    安全: 安全配置
    监控: 监控配置
    源文件: Optional[str] = None        # 解析出的实际文件路径，便于诊断

    @property
    def 轴名列表(self) -> List[str]:
        return list(self.轴.keys())

    @property
    def 轴号列表(self) -> List[int]:
        return [self.轴[名].轴号 for 名 in self.轴名列表]

    def 取轴(self, 轴名: str) -> 轴配置:
        if 轴名 not in self.轴:
            raise KeyError(f"未配置的轴: {轴名!r}，可选: {self.轴名列表}")
        return self.轴[轴名]

    def 取轴号(self, 轴名: str) -> int:
        return self.取轴(轴名).轴号


_默认相对路径 = os.path.join("configs", "motion_config.json")


def _解析路径(路径: Optional[str]) -> str:
    路径 = 路径 or _默认相对路径
    if os.path.isabs(路径):
        return 路径
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", "")
        if meipass:
            候选 = os.path.join(meipass, 路径)
            if os.path.exists(候选):
                return 候选
    return os.path.join(路径工具.获取应用根目录(), 路径)


def 加载运动配置(路径: Optional[str] = None) -> 运动配置:
    """从 motion_config.json 加载并校验。"""
    实际路径 = _解析路径(路径)
    if not os.path.exists(实际路径):
        raise FileNotFoundError(f"运动控制配置文件不存在: {实际路径}")

    with open(实际路径, "r", encoding="utf-8") as f:
        原始 = json.load(f)

    控制器 = _构造控制器(原始.get("controller", {}))

    轴映射_原始 = 原始.get("axis_map", {})
    if not 轴映射_原始:
        raise ValueError(f"motion_config.json 缺少 axis_map: {实际路径}")
    轴映射: Dict[str, int] = {名: int(号) for 名, 号 in 轴映射_原始.items()}

    if len(set(轴映射.values())) != len(轴映射):
        raise ValueError(f"axis_map 中存在重复轴号: {轴映射}")

    轴定义 = 原始.get("axes", {})
    轴: Dict[str, 轴配置] = {}
    for 名, 轴号 in 轴映射.items():
        轴[名] = _构造轴(名, 轴号, 轴定义.get(名, {}))

    安全 = _构造安全(原始.get("safety", {}))
    监控 = _构造监控(原始.get("monitor", {}))

    return 运动配置(
        控制器=控制器,
        轴映射=轴映射,
        轴=轴,
        安全=安全,
        监控=监控,
        源文件=实际路径,
    )


# ------------------------------------------------------------------
# 构造辅助
# ------------------------------------------------------------------


def _构造控制器(数据: dict) -> 控制器配置:
    return 控制器配置(
        ip=str(数据.get("ip", "192.168.0.11")),
        timeout_ms=int(数据.get("timeout_ms", 3000)),
        heartbeat_interval_s=float(数据.get("heartbeat_interval_s", 5.0)),
        watchdog_timeout_s=float(数据.get("watchdog_timeout_s", 5.0)),
    )


def _构造轴(名称: str, 轴号: int, 数据: dict) -> 轴配置:
    return 轴配置(
        名称=名称,
        轴号=轴号,
        最大速度=float(数据.get("max_speed", 5000.0)),
        加速度=float(数据.get("accel", 500.0)),
        减速度=float(数据.get("decel", 500.0)),
        软限位正=float(数据.get("soft_limit_pos", 1.0e9)),
        软限位负=float(数据.get("soft_limit_neg", -1.0e9)),
        回零速度=float(数据.get("home_speed", 500.0)),
        回零方向=int(数据.get("home_direction", -1)),
        回零模式=int(数据.get("home_mode", 0)),
        脉冲当量=float(数据.get("pulse_per_unit", 1.0)),
        轴类型=int(数据.get("atype", 1)),
        使能=bool(数据.get("enabled", True)),
    )


def _构造安全(数据: dict) -> 安全配置:
    return 安全配置(
        紧急停止指令=str(数据.get("estop_command", "CANCEL(0,2)")),
        要求先回零=bool(数据.get("require_home_before_run", False)),
        最大进给倍率=float(数据.get("max_feed_override", 200.0)),
        最小进给倍率=float(数据.get("min_feed_override", 0.0)),
    )


def _构造监控(数据: dict) -> 监控配置:
    return 监控配置(
        状态轮询毫秒=max(10, int(数据.get("status_poll_ms", 50))),
        最大订阅数=max(1, int(数据.get("max_subscribers", 16))),
        队列上限=max(1, int(数据.get("queue_size", 5))),
    )
