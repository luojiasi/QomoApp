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

from configs.motion_config import MergeParams, MotionAxisConfig, MotionConfig, motion_config
from services.motion_control.config_persistence import 从文件加载
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("配置加载")

AXIS_ORDER = ["X", "Y", "Z", "U", "R"]


def _从文件数据构建配置(data: dict) -> MotionConfig:
    """将前端格式的控制器设置 dict 转换成 MotionConfig 实例。"""
    comm = data.get("communication", {})
    axes_data = data.get("axes", [])
    axis_by_no = {a.get("axis_no"): a for a in axes_data if a.get("axis_no") is not None}

    def _make_axis(no: int, name: str) -> MotionAxisConfig:
        a = axis_by_no.get(no, {})
        mp = a.get("merge_params", {}) or {}
        return MotionAxisConfig(
            axis_no=no,
            axis_name=a.get("axis_name", name),
            axis_type=a.get("axis_type", 1),
            units=a.get("units", 2000),
            speed=a.get("speed", 20),
            lspeed=a.get("lspeed", 20),
            accel=a.get("accel", 500000),
            decel=a.get("decel", 500000),
            sramp=a.get("sramp", 200),
            creep=a.get("creep", 10),
            merge=a.get("merge", 0),
            fwd_in=a.get("fwd_in", -1),
            rev_in=a.get("rev_in", -1),
            motor_type=a.get("motor_type", "servo"),
            pulses_per_rev=a.get("pulses_per_rev", 10000.0),
            electronic_gear_ratio=a.get("electronic_gear_ratio", 1.0),
            gear_ratio=a.get("gear_ratio", 1.0),
            step_angle=a.get("step_angle", 1.8),
            microsteps=a.get("microsteps", 32.0),
            merge_params=MergeParams(
                corner_mode=mp.get("corner_mode", 0),
                decel_angle=mp.get("decel_angle", 15.0),
                stop_angle=mp.get("stop_angle", 45.0),
                zxmooth=mp.get("zxmooth", 0.0),
            ),
        )

    return MotionConfig(
        controller_model=comm.get("controller_model", "QomoTech406V2"),
        transport=comm.get("transport", "ethernet"),
        controller_ip=comm.get("controller_ip", "192.168.0.11"),
        connect_timeout_s=comm.get("connect_timeout_s", 5.0),
        enable_axes=comm.get("enable_axes", ["X", "Y", "Z", "U", "R"]),
        axis_count=comm.get("axis_count", 5),
        x_axis=_make_axis(0, "X"),
        y_axis=_make_axis(1, "Y"),
        z_axis=_make_axis(2, "Z"),
        u_axis=_make_axis(3, "U"),
        r_axis=_make_axis(4, "R"),
    )


def 加载运动配置() -> MotionConfig:
    """优先从文件加载配置；文件不存在时回退硬编码默认值。"""
    data = 从文件加载()
    if data is not None:
        try:
            cfg = _从文件数据构建配置(data)
            日志.info("已从文件加载控制器配置")
            return cfg
        except Exception as exc:
            日志.warning(f"配置文件解析失败，使用默认配置: {exc}")
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
