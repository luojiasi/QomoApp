"""运动控制配置访问入口。

为什么要这一层？
  组件层（state_machine / safe_controller / status_monitor / zmc_adapter）
  统一从这里取配置，而不是各自 `from configs.motion_config import motion_config`。
  这样以后若：
    - 切到 JSON / 远程配置；
    - 增加运行时热更新；
    - 单元测试需要注入 mock 配置；
  都只改本文件一个点。

使用方式：
    from services.motion_control.config_loader import 加载运动配置, 取配置

    # 启动时加载一次（建议）
    cfg = 加载运动配置()
    print(cfg.controller_ip, cfg.axis_map)

    # 也可以直接用全局单例
    cfg = 取配置()
"""
from __future__ import annotations

from typing import Iterable

from configs.motion_config import MotionAxisConfig, MotionConfig, motion_config


def 加载运动配置() -> MotionConfig:
    """返回运动配置单例。

    PR-1 阶段固定返回 configs.motion_config.motion_config；后续若改 JSON / 热更新
    在此处替换实现，组件层无感知。
    """
    return motion_config


def 取配置() -> MotionConfig:
    """加载运动配置 的别名 —— 给业务代码更短的调用名。"""
    return motion_config


# ------------------------------------------------------------------
# 便捷查询 helpers —— 让组件层避免重复写"按名取轴号"这种样板代码
# ------------------------------------------------------------------


def 轴名列表(cfg: MotionConfig | None = None) -> list[str]:
    """返回启用轴名列表，顺序保持 X/Y/Z/U/R。"""
    cfg = cfg or motion_config
    return list(cfg.axes.keys())


def 轴号列表(cfg: MotionConfig | None = None) -> list[int]:
    return [cfg_ax.axis_no for cfg_ax in (cfg or motion_config).axes.values()]


def 取轴(轴名: str, cfg: MotionConfig | None = None) -> MotionAxisConfig:
    """按轴名取轴配置；轴名非法时抛 KeyError（由调用方决定是否升级为 SafetyViolation）。"""
    cfg = cfg or motion_config
    if 轴名 not in cfg.axes:
        raise KeyError(f"未配置的轴: {轴名!r}，可选: {list(cfg.axes.keys())}")
    return cfg.axes[轴名]


def 取轴号(轴名: str, cfg: MotionConfig | None = None) -> int:
    return 取轴(轴名, cfg).axis_no


def 取轴名(轴号: int, cfg: MotionConfig | None = None) -> str:
    """按轴号反查轴名；找不到时抛 KeyError。"""
    cfg = cfg or motion_config
    映射 = cfg.axis_no_to_name
    if 轴号 not in 映射:
        raise KeyError(f"未配置的轴号: {轴号}，可选: {list(映射.keys())}")
    return 映射[轴号]


def 校验轴名集合(轴名集合: Iterable[str], cfg: MotionConfig | None = None) -> list[MotionAxisConfig]:
    """批量校验一组轴名 —— 全部合法返回对应配置列表，任一非法抛 KeyError。

    供多轴插补 / 回零 / 多轴停止前的统一前置校验使用。
    """
    cfg = cfg or motion_config
    结果: list[MotionAxisConfig] = []
    for 名 in 轴名集合:
        结果.append(取轴(名, cfg))
    return 结果
