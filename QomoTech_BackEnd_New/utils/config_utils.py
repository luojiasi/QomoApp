"""配置工具 —— 读取、写入 configs/ 目录下的 JSON 配置数据。

配置数据结构：
    configs/app_config.json
    ├── 软件
    │   ├── 名称
    │   └── 版本
    ├── 日志
    │   ├── 是否开启
    │   ├── 级别
    │   └── 保留天数
    └── 路径          ← 运行时自动注入
        ├── 应用根目录
        └── 日志目录

用法：
    配置 = 加载配置()
    print(配置.软件.名称)          # QomoTech
    print(配置.日志.是否开启)       # True
    print(配置.路径.日志目录)       # /项目根目录/logs

    配置.日志.级别 = "INFO"
    保存配置()                     # 持久化到 configs/app_config.json
"""

import json
import os
import sys

from utils.path_utils import 路径工具

默认配置目录 = "configs"
默认配置文件名 = "app_config.json"

_全局配置: "ConfigDict | None" = None


class ConfigDict:
    """嵌套字典的包装器，支持属性访问。

    所有叶子值都可读可写。
    """

    def __init__(self, 数据: dict):
        object.__setattr__(self, "_数据", 数据)

    def __getattr__(self, 键: str):
        数据 = object.__getattribute__(self, "_数据")
        if 键 in 数据:
            值 = 数据[键]
            if isinstance(值, dict):
                return ConfigDict(值)
            return 值
        raise AttributeError(f"配置项不存在: {键}")

    def __setattr__(self, 键: str, 值):
        数据 = object.__getattribute__(self, "_数据")
        if 键 in 数据:
            数据[键] = 值
        else:
            raise AttributeError(f"配置项不存在: {键}")

    def get(self, 键: str, 默认值=None):
        """仿 dict.get()，键不存在时返回默认值。"""
        数据 = object.__getattribute__(self, "_数据")
        return 数据.get(键, 默认值)

    def __contains__(self, 键: str) -> bool:
        return 键 in object.__getattribute__(self, "_数据")

    def 转为字典(self) -> dict:
        """递归转换回普通字典（用于序列化）。"""
        return _转为普通字典(object.__getattribute__(self, "_数据"))

    def __repr__(self):
        数据 = object.__getattribute__(self, "_数据")
        return f"ConfigDict({数据!r})"


def _转为普通字典(数据: dict) -> dict:
    """递归将 ConfigDict 转回普通 dict。"""
    结果 = {}
    for 键, 值 in 数据.items():
        if isinstance(值, ConfigDict):
            结果[键] = 值.转为字典()
        elif isinstance(值, dict):
            结果[键] = _转为普通字典(值)
        else:
            结果[键] = 值
    return 结果


def _解析配置文件路径(配置文件路径: str | None = None) -> str:
    """解析配置文件的绝对路径。

    PyInstaller 打包后，configs/ 被打包进 EXE 内部，运行时提取到 sys._MEIPASS。
    此时优先从 _MEIPASS 读取，回退到应用根目录（兼容开发模式）。
    """
    路径 = 配置文件路径 or os.path.join(默认配置目录, 默认配置文件名)
    if not os.path.isabs(路径):
        if getattr(sys, 'frozen', False):
            _meipass路径 = os.path.join(sys._MEIPASS, 路径)
            if os.path.exists(_meipass路径):
                return _meipass路径
        路径 = os.path.join(路径工具.获取应用根目录(), 路径)
    return 路径


def 加载配置(配置文件路径: str | None = None) -> ConfigDict:
    """从 configs/ 目录加载 JSON 配置文件，返回可属性访问的 ConfigDict。

    路径字段（应用根目录、日志目录）由运行时自动注入，无需在 JSON 中配置。
    JSON 解析失败时返回空配置并注入路径。
    """
    global _全局配置

    路径 = _解析配置文件路径(配置文件路径)

    数据: dict = {}
    if os.path.exists(路径):
        try:
            with open(路径, "r", encoding="utf-8") as f:
                数据 = json.load(f)
        except Exception:
            pass

    # 运行时注入路径
    数据["路径"] = {
        "应用根目录": 路径工具.获取应用根目录(),
        "日志目录": os.path.join(路径工具.获取应用根目录(), "logs"),
    }

    _全局配置 = ConfigDict(数据)
    return _全局配置


def 保存配置(配置文件路径: str | None = None) -> None:
    """将当前全局配置持久化到 configs/ 目录的 JSON 文件。

    路径字段不会被写入 JSON（它们由运行时自动生成）。
    """
    global _全局配置

    if _全局配置 is None:
        return

    路径 = _解析配置文件路径(配置文件路径)
    os.makedirs(os.path.dirname(路径), exist_ok=True)

    数据 = _全局配置.转为字典()
    # 路径是运行时注入的，不持久化
    数据.pop("路径", None)

    with open(路径, "w", encoding="utf-8") as f:
        json.dump(数据, f, ensure_ascii=False, indent=4)


def 获取配置() -> ConfigDict:
    """获取当前全局配置，未加载时自动初始化。"""
    global _全局配置
    if _全局配置 is None:
        return 加载配置()
    return _全局配置
