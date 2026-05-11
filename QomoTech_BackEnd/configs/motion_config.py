"""运动控制配置 —— Pydantic 硬编码默认值。

设计约束：
  - 配置全部在代码里维护，不依赖 JSON / 环境变量；
  - service 层（MotionService/safe_controller/status_monitor）直接 import
    `motion_config` 实例使用，不再走 dataclass 适配层；
  - 所有数值带 Field 校验，构造时即抛错，避免运行期才暴露非法配置。

字段分组：
  - 主体字段：axis_no/axis_name/axis_type/units/speed/lspeed/accel/decel/sramp
              creep/merge/fwd_in/rev_in
  - merge_params 子模型：corner_mode/decel_angle/stop_angle/zxmooth
              （前端 MergeRequest 启用连续轨迹时使用）
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class MergeParams(BaseModel):
    """连续轨迹合并参数 —— 仅在 axis.merge=1 时生效。

    对应 ZMC SDK：
      corner_mode      → ZAux_Direct_SetCornerMode（拐角处理位标志，2=自动减速 / 8=小圆限速 / 32=ZSMOOTH 圆滑）
      decel_angle      → ZAux_Direct_SetDecelAngle（开始减速的拐角阈值，单位 rad）
      stop_angle       → ZAux_Direct_SetStopAngle（强制停止的拐角阈值，单位 rad）
      zxmooth          → ZAux_Direct_SetZsmooth（拐角圆滑半径，配合 corner_mode bit 32 生效）
      full_sp_radius   → ZAux_Direct_SetFullSpRadius（小圆限速参考半径，配合 corner_mode bit 8 生效）
    """

    corner_mode: int = 10               # 2(自动减速) + 8(小圆限速) —— 默认开启,保证连续插补速度连续
    decel_angle: float = 15.0           # 度,内部转弧度
    stop_angle: float = 45.0            # 度,内部转弧度
    zxmooth: float = Field(default=0.0, ge=0)
    full_sp_radius: float = Field(default=5.0, ge=0)


class MotionAxisConfig(BaseModel):
    """单轴参数。

    主体字段直接对应 ZMC Direct API 的 SetXxx 调用；merge_params 子模型仅在
    启用连续轨迹合并（merge=1）时下发。
    """

    axis_no: int
    axis_name: str = ""
    axis_type: int = 1                                              # ATYPE: 1=方向脉冲, 4=正交编码器, 65=EtherCAT
    units: float = Field(default=2000.0, gt=0)                      # 脉冲当量（每工程单位的脉冲数）
    speed: float = Field(default=20.0, gt=0)                        # 目标速度（工程单位/秒）
    lspeed: float = Field(default=1.0, ge=0)                        # 起跳速度（连续插补内部会临时改为 0,这里只影响单段 move 的启动平滑度）
    accel: float = Field(default=500000.0, gt=0)                    # 加速度
    decel: float = Field(default=500000.0, gt=0)                    # 减速度
    sramp: float = Field(default=200.0, ge=0)                       # S 曲线时间
    creep: float = Field(default=10.0, ge=0)                        # 爬行速度（回零用）
    merge: int = Field(default=1, ge=0, le=1)                       # 连续轨迹合并开关（默认开,配合 merge_params 实现段间速度连续）
    fwd_in: int = -1                                                # 正限位输入口（-1=禁用）
    rev_in: int = -1                                                # 负限位输入口（-1=禁用）

    merge_params: MergeParams = Field(default_factory=MergeParams)


class MotionConfig(BaseModel):
    """运动控制总配置。"""

    controller_model: str = "QomoTech406V2"
    transport: Literal["ethernet", "rs232", "rs485", "can", "ethercat"] = "ethernet"
    controller_ip: str = "192.168.0.11"
    connect_timeout_s: float = Field(default=5.0, gt=0, description="ZAux_OpenEth 连接超时秒数，超时后快速返回 502 避免前端卡死")
    enable_axes: list[str] = ["X", "Y", "Z", "U", "R"]
    axis_count: Literal[3, 5] = 5
    io_count: int = Field(default=9, ge=1, description="IO 点数（0 到 io_count-1），与前端 IO_MAP_GROUP_COUNT 对齐")

    x_axis: MotionAxisConfig = MotionAxisConfig(axis_no=0, axis_name="X")
    y_axis: MotionAxisConfig = MotionAxisConfig(axis_no=1, axis_name="Y")
    z_axis: MotionAxisConfig = MotionAxisConfig(axis_no=2, axis_name="Z")
    u_axis: MotionAxisConfig = MotionAxisConfig(axis_no=3, axis_name="U")
    r_axis: MotionAxisConfig = MotionAxisConfig(axis_no=4, axis_name="R")

    @property
    def axes(self) -> dict[str, MotionAxisConfig]:
        """轴名 → 配置。"""
        return {
            "X": self.x_axis,
            "Y": self.y_axis,
            "Z": self.z_axis,
            "U": self.u_axis,
            "R": self.r_axis,
        }

    @property
    def axis_map(self) -> dict[str, int]:
        """轴名 → 轴号。"""
        return {名: cfg.axis_no for 名, cfg in self.axes.items()}

    @property
    def axis_no_to_name(self) -> dict[int, str]:
        """轴号 → 轴名。"""
        return {cfg.axis_no: 名 for 名, cfg in self.axes.items()}


motion_config = MotionConfig()
