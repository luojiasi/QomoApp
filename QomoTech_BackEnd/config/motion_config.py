from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

class MotionAxisConfig(BaseModel):
    axis_no: int
    axis_name: str = ""
    axis_type: int = 1
    units: float = Field(default=2000.0, gt=0)
    speed: float = Field(default=20.0, gt=0)
    lspeed: float = Field(default=20.0, ge=0)
    creep: float = Field(default=10.0, ge=0)
    accel: float = Field(default=500000.0, gt=0)
    decel: float = Field(default=500000.0, gt=0)
    merge: int = 0
    sramp: float = Field(default=200.0, ge=0)
    fwd_in: int = -1
    rev_in: int = -1
    corner_mode: int = 0
    decel_angle: float = 15.0
    stop_angle: float = 45.0
    zxmooth: float = 0.0


class MotionConfig(BaseModel):
    # 对齐前端 communication
    controller_model: str = "QomoTech406V2"
    transport: Literal["ethernet", "rs232", "rs485", "can", "ethercat"] = "ethernet"
    controller_ip: str = "192.168.0.11"
    enable_axes: list[str] = ["X", "Y", "Z", "U", "R"]
    axis_count: Literal[3, 5] = 5

    # 对齐前端 axes（0=X,1=Y,2=Z,3=U,4=R）
    x_axis: MotionAxisConfig = MotionAxisConfig(axis_no=0, axis_name="X 轴")
    y_axis: MotionAxisConfig = MotionAxisConfig(axis_no=1, axis_name="Y 轴")
    z_axis: MotionAxisConfig = MotionAxisConfig(axis_no=2, axis_name="Z 轴")
    u_axis: MotionAxisConfig = MotionAxisConfig(axis_no=3, axis_name="U 轴")
    v_axis: MotionAxisConfig = MotionAxisConfig(axis_no=4, axis_name="R 轴")


motion_config = MotionConfig()

