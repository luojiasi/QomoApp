from __future__ import annotations

from config.motion_config import motion_config
from config.rs232_config import rs232_config
from core.status_poller import HardwareStatusPoller
from core.state_manager import state_manager

from drivers.camera_driver import CameraDriver
from drivers.rs232_driver import Rs232Driver
from drivers.zmotion_driver import ZMotionDriver

from drivers.driver_rs232 import 串口驱动
from config.rs232_config import 串口配置实例
串口实例 = 串口驱动(串口配置实例)
def 获取串口实例() -> 串口驱动: return 串口实例


rs232_driver = Rs232Driver(rs232_config)
camera_driver = CameraDriver()
motion_driver = ZMotionDriver(
    motion_config.controller_ip,
    axis_units={
        motion_config.x_axis.axis_no: motion_config.x_axis.units,
        motion_config.y_axis.axis_no: motion_config.y_axis.units,
        motion_config.z_axis.axis_no: motion_config.z_axis.units,
        motion_config.u_axis.axis_no: motion_config.u_axis.units,
        motion_config.v_axis.axis_no: motion_config.v_axis.units,
    },
)
hardware_status_poller = HardwareStatusPoller(
    motion_driver,
    state_manager,
    interval_s=0.2,
)


def get_state_manager():
    return state_manager


def get_motion_driver():
    return motion_driver


def get_rs232_driver():
    return rs232_driver


def get_camera_driver():
    return camera_driver





