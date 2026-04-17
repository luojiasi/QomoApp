from __future__ import annotations

import ctypes
from dataclasses import dataclass
import logging
from threading import Lock
import time
from typing import Any

from drivers.base_driver import BaseDriver


@dataclass
class _AxisState:
    dpos_mm: float = 0.0
    mpos_mm: float = 0.0
    units: float = 1000.0
    lspeed: float = 20.0
    speed: float = 20.0
    accel: float = 500000.0
    decel: float = 500000.0
    sramp: float = 20.0
    fs_limit: int = 0
    rs_limit: int = 0
    moving: bool = False
    axis_status: int = 0
    last_error: str | None = None


class ZMotionDriver(BaseDriver):
    """极简版 ZMotion 驱动，仅保留 10 个核心方法。"""

    MAX_AXES = 6
    _AXIS_FLOAT_FIELDS = ("units", "lspeed", "speed", "accel", "decel", "sramp")
    _AXIS_NAME_BY_NO = {0: "x", 1: "y", 2: "z", 3: "r", 4: "u"}

    def __init__(self, controller_ip: str, axis_units: dict[int, float] | None = None) -> None:
        self.instance_id = id(self)
        self.controller_ip = controller_ip
        self._axis_units = axis_units or {}
        self._axis: dict[int, _AxisState] = {i: _AxisState() for i in range(self.MAX_AXES)}
        for axis_no, unit in self._axis_units.items():
            if 0 <= int(axis_no) < self.MAX_AXES and float(unit) > 0:
                self._axis[int(axis_no)].units = float(unit)

        self._outputs: dict[int, bool] = {}
        # 模拟模式下缓存的输入口状态（真实硬件时以 DLL 回读为准）
        self._inputs: dict[int, bool] = {}
        self._connected = False
        self._driver_mode = "sim"
        self._zaux: Any | None = None
        self._zaux_lock = Lock()
        self._logger = logging.getLogger("qomotech.zmotion")
        self._last_error: str | None = None
        self._last_error_code: int | None = None

    @staticmethod
    def _ret_ok(ret: int) -> bool:
        return int(ret) == 0

    def _set_error(self, message: str, code: int | None = None) -> None:
        self._last_error = message
        self._last_error_code = code

    def _clear_error(self) -> None:
        self._last_error = None
        self._last_error_code = None

    def _check_axis(self, axis_no: int) -> bool:
        axis = int(axis_no)
        if 0 <= axis < self.MAX_AXES:
            return True
        self._set_error(f"axis_no 超出范围: {axis_no}")
        return False

    def _require_connected(self) -> bool:
        if self._connected:
            return True
        self._set_error("控制器未连接")
        return False

    def _call_zaux(self, method_name: str, *args: Any) -> bool:
        if self._zaux is None or self._driver_mode != "zauxdll":
            return True
        fn = getattr(self._zaux, method_name, None)
        if fn is None:
            return True
        with self._zaux_lock:
            ret = fn(*args)
        if self._ret_ok(ret):
            return True
        self._set_error(f"{method_name} 调用失败", int(ret))
        return False

    @staticmethod
    def _normalize_range(start: int, end: int) -> tuple[int, int]:
        start = int(start)
        end = int(end)
        if end < start:
            return end, start
        return start, end

    def _using_dll(self) -> bool:
        return self._zaux is not None and self._driver_mode == "zauxdll" and self._connected

    def _read_zaux_raw(self, method_name: str, *args: Any) -> tuple[int, Any] | None:
        if not self._using_dll():
            return None
        fn = getattr(self._zaux, method_name, None)
        if fn is None:
            return None
        with self._zaux_lock:
            return fn(*args)

    def _read_zaux_value(self, method_name: str, *args: Any, cast: type) -> Any | None:
        result = self._read_zaux_raw(method_name, *args)
        if result is None:
            return None
        ret, val = result
        if not self._ret_ok(ret):
            return None
        try:
            return cast(val.value)
        except Exception:
            return None

    def _read_io_point(
        self,
        *,
        io_no: int,
        method_name: str,
        cache: dict[int, bool],
        missing_method_error: str,
        read_failed_error: str,
    ) -> bool:
        if not self._require_connected():
            return False
        io_no = int(io_no)
        if not self._using_dll():
            return bool(cache.get(io_no, False))

        result = self._read_zaux_raw(method_name, io_no)
        if result is None:
            self._set_error(missing_method_error)
            return False
        ret, val = result
        if self._ret_ok(ret):
            io_val = bool(int(val.value))
            cache[io_no] = io_val
            self._clear_error()
            return io_val

        self._set_error(read_failed_error, int(ret))
        return False

    # 1. 连接控制器
    def connect(self, ipAddress: str) -> bool:
        if self._connected:
            return True
        self._clear_error()
        try:
            from libs.zmcdll.zauxdllPython import ZAUXDLL

            self._zaux = ZAUXDLL()
            ret = self._zaux.ZAux_OpenEth(ipAddress)
            if self._ret_ok(ret):
                self._driver_mode = "zauxdll"
                self._connected = True
                return self.set_all_axes_params()
            self._set_error("ZAux_OpenEth 连接失败", int(ret))
            self._logger.warning("ZAux_OpenEth failed ret=%s", ret)
            return False
        except Exception as exc:
            self._driver_mode = "sim"
            self._zaux = None
            self._connected = True
            self._set_error(f"zauxdll 加载失败，已回退模拟模式: {exc}")
            self._logger.warning("load zauxdll failed, fallback sim: %s", exc)
            return True

    # 2. 断开控制器连接
    def disconnect(self) -> bool:
        if self._zaux is not None and self._driver_mode == "zauxdll":
            try:
                self._zaux.ZAux_Close()
            except Exception as exc:
                self._set_error(f"ZAux_Close 失败: {exc}")
                return False
        self._zaux = None
        self._connected = False
        self._driver_mode = "sim"
        return True

    def is_connected(self) -> bool:
        return self._connected

    # 3. 设置所有轴参数
    def set_all_axes_params(self, params_by_axis: dict[int, dict[str, float | bool]] | None = None) -> bool:
        if not self._require_connected():
            return False

        params_by_axis = params_by_axis or {}
        for axis_no in range(self.MAX_AXES):
            axis = self._axis[axis_no]
            # 会将这个重置回默认值
            # if axis_no in self._axis_units and self._axis_units[axis_no] > 0:
            #     axis.units = float(self._axis_units[axis_no])
            custom = params_by_axis.get(axis_no, {})
            for field in self._AXIS_FLOAT_FIELDS:
                if field in custom:
                    setattr(axis, field, float(custom[field]))

            for method_name, value in (
                ("ZAux_Direct_SetUnits", axis.units),
                ("ZAux_Direct_SetLspeed", axis.lspeed),
                ("ZAux_Direct_SetSpeed", axis.speed),
                ("ZAux_Direct_SetAccel", axis.accel),
                ("ZAux_Direct_SetDecel", axis.decel),
                ("ZAux_Direct_SetSramp", axis.sramp),
            ):
                if not self._call_zaux(method_name, axis_no, value):
                    return False

            for custom_key, method_name in (
                ("merge", "ZAux_Direct_SetMerge"),
                ("fwd_in", "ZAux_Direct_SetFwdIn"),
                ("rev_in", "ZAux_Direct_SetRevIn"),
                ("corner_mode", "ZAux_Direct_SetCornerMode"),
                ("axisType", "ZAux_Direct_SetAtype"),
            ):
                if custom_key in custom and not self._call_zaux(method_name, axis_no, int(custom[custom_key])):
                    return False
            if "backlash_enable" in custom or "backlash" in custom:
                backlash_enable = bool(custom.get("backlash_enable", False))
                backlash_dist = float(custom.get("backlash", 0.0))
                self.设置控制器反向间隙参数(axis_no, backlash_enable, backlash_dist)
        self._clear_error()
        return True
    # 3.1 设置控制器反向间隙参数
    def 设置控制器反向间隙参数(self, axis_no: int, backlash_enable: bool, backlash_dist: float, speed: float | None = None, accel: float | None = None) -> bool:
        if not self._require_connected():
            return False
        反向间隙的距离需要转换为mm = backlash_dist/1000
        是否打开反向间隙 = 1 if backlash_enable else 0
        if backlash_enable and speed is not None and accel is not None:
            command = f"BACKLASH({是否打开反向间隙},{反向间隙的距离需要转换为mm},{speed},{accel}) AXIS({axis_no})"
        elif backlash_enable and speed is None and accel is None:
            command = f"BACKLASH({是否打开反向间隙},{反向间隙的距离需要转换为mm},50,100) AXIS({axis_no})"
        else:
            command = f"BACKLASH({是否打开反向间隙}) AXIS({axis_no})"
        fn = getattr(self._zaux, "ZAux_Execute", None)
        with self._zaux_lock:
            输出结果,输出信息 = fn(command)
        if int(输出结果) != 0: 
            self._set_error(f"设置控制器反向间隙参数失败: {输出信息}")
            return False
        self._clear_error()
        return True

    # 4. 清除轴错误
    def clear_axis_error(self, axis_no: int) -> bool:
        if not self._require_connected() or not self._check_axis(axis_no):
            return False
        axis = self._axis[int(axis_no)]
        axis.last_error = None
        axis.axis_status = 0
        if not self._call_zaux("ZAux_Direct_Single_Cancel", int(axis_no), 2):
            return False
        self._clear_error()
        return True

    # 5. 设置单轴限位
    def set_axis_limit(self, axis_no: int, *, fs_limit: int | None = None, rs_limit: int | None = None) -> bool:
        if not self._require_connected() or not self._check_axis(axis_no):
            return False
        axis = self._axis[int(axis_no)]
        if fs_limit is not None:
            axis.fs_limit = int(fs_limit)
            if not self._call_zaux("ZAux_Direct_SetFsLimit", int(axis_no), int(fs_limit)):
                return False
        if rs_limit is not None:
            axis.rs_limit = int(rs_limit)
            if not self._call_zaux("ZAux_Direct_SetRsLimit", int(axis_no), int(rs_limit)):
                return False
        self._clear_error()
        return True

    # 6. 设置输出
    def set_output(self, io_no: int, value: bool) -> bool:
        if not self._require_connected():
            return False
        io_no = int(io_no)
        if io_no < 0:
            self._set_error("io_no 必须 >= 0")
            return False
        if not self._call_zaux("ZAux_Direct_SetOp", io_no, 1 if value else 0):
            return False
        self._outputs[io_no] = bool(value)
        self._clear_error()
        return True

    # 6.1 读取输入口
    def get_input(self, io_no: int) -> bool:
        """
        读取数字量输入口（对应 DLL: ZAux_Direct_GetIn）。
        在模拟模式下返回缓存的输入值。
        """
        return self._read_io_point(
            io_no=io_no,
            method_name="ZAux_Direct_GetIn",
            cache=self._inputs,
            missing_method_error="ZAux_Direct_GetIn 不存在",
            read_failed_error="ZAux_Direct_GetIn 读取失败",
        )

    def get_inputs_status(self, io_start: int = 0, io_end: int = 8) -> dict[int, bool]:
        """
        批量读取输入口状态（默认 0-8）。
        返回结构：{ ioNo: bool }
        """
        io_start, io_end = self._normalize_range(io_start, io_end)
        result: dict[int, bool] = {}
        for io_no in range(io_start, io_end + 1):
            result[io_no] = self.get_input(io_no)
        return result

    # 读取输出口（便于回读到前端 iomap）
    def get_output(self, io_no: int) -> bool:
        """
        读取数字量输出口状态（对应 DLL: ZAux_Direct_GetOp）。
        在模拟模式下优先返回缓存值 self._outputs。
        """
        return self._read_io_point(
            io_no=io_no,
            method_name="ZAux_Direct_GetOp",
            cache=self._outputs,
            missing_method_error="ZAux_Direct_GetOp 不存在",
            read_failed_error="ZAux_Direct_GetOp 读取失败",
        )

    def get_outputs_status(self, io_start: int = 0, io_end: int = 8) -> dict[int, bool]:
        """
        批量读取输出口状态（默认 0-8）。
        返回结构：{ ioNo: bool }
        """
        io_start, io_end = self._normalize_range(io_start, io_end)
        result: dict[int, bool] = {}
        for io_no in range(io_start, io_end + 1):
            result[io_no] = self.get_output(io_no)
        return result

    # 急停：立刻停止选中轴并清空该轴缓存队列
    def emergency_stop_axis(self, axis_no: int) -> bool:
        if not self._require_connected() or not self._check_axis(axis_no):
            return False
        axis = int(axis_no)

        # 模拟模式：直接置空闲
        if self._zaux is None or self._driver_mode != "zauxdll":
            self._axis[axis].moving = False
            self._clear_error()
            return True

        
        ok = True
        single_cancel = getattr(self._zaux, "ZAux_Direct_Single_Cancel", None)

        if single_cancel is not None:
            ret = single_cancel(axis, 2)
            ok = ok and self._ret_ok(ret)
        else:
            ok = False

        self._axis[axis].moving = False

        if ok:
            self._clear_error()
            return True

        self._set_error(f"急停失败（axis={axis} 停止或清缓存失败）")
        return False

    # 急停：停止多个轴（默认停止全部轴）
    def emergency_stop_all_axes(self, axis_list: list[int] | tuple[int, ...] | None = None) -> bool:
        if not self._require_connected():
            return False

        targets = list(range(self.MAX_AXES)) if axis_list is None else [int(a) for a in axis_list]
        if not targets:
            self._set_error("axis_list 不能为空")
            return False

        # 先做参数校验，避免中途失败导致只停一部分轴
        for axis_no in targets:
            if not self._check_axis(axis_no):
                return False

        for axis_no in targets:
            if not self.emergency_stop_axis(axis_no):
                return False

        self._clear_error()
        return True

    # 7. 轴位置清零
    def zero_axis_position(self, axis_no: int) -> bool:
        if not self._require_connected() or not self._check_axis(axis_no):
            return False
        axis = self._axis[int(axis_no)]
        if not self._call_zaux("ZAux_Direct_SetDpos", int(axis_no), 0.0):
            return False
        if not self._call_zaux("ZAux_Direct_SetMpos", int(axis_no), 0.0):
            return False
        axis.dpos_mm = 0.0
        axis.mpos_mm = 0.0
        axis.moving = False
        self._clear_error()
        return True

    # 8. 单轴绝对运动
    def move_abs(self, axis_no: int, target_mm: float) -> bool:
        if not self._require_connected() or not self._check_axis(axis_no):
            return False
        axis = self._axis[int(axis_no)]
        if not self._call_zaux("ZAux_Direct_Single_MoveAbs", int(axis_no), float(target_mm)):
            axis.last_error = self._last_error
            return False
        axis.moving = True
        axis.dpos_mm = float(target_mm)
        axis.moving = False
        self._clear_error()
        return True

    # 9. 单轴相对运动
    def move_rel(self, axis_no: int, delta_mm: float) -> bool:
        if not self._require_connected() or not self._check_axis(axis_no):
            return False
        axis = self._axis[int(axis_no)]
        if not self._call_zaux("ZAux_Direct_Single_Move", int(axis_no), float(delta_mm)):
            axis.last_error = self._last_error
            return False
        axis.moving = True
        axis.dpos_mm += float(delta_mm)
        axis.moving = False
        self._clear_error()
        return True

    # 10. 获取全部轴状态
    def get_axes_status(self) -> dict[str, dict[str, Any]]:
        status: dict[str, dict[str, Any]] = {}
        for axis_no in range(self.MAX_AXES):
            axis = self._axis[axis_no]
            runtime: dict[str, Any] = {
                "axis_type": 0,
                "merge": 0,
                "fwd_in": -1,
                "rev_in": -1,
                "corner_mode": 0,
                "decel_angle": 0.0,
                "stop_angle": 0.0,
                "zsmooth": 0.0,
                "mspeed": float(axis.speed),
                "vp_speed": float(axis.speed),
                "mtype": 0,
                "move_buffered": 0,
            }
            if self._using_dll():
                mpos = self._read_zaux_value("ZAux_Direct_GetMpos", axis_no, cast=float)
                if mpos is not None:
                    axis.mpos_mm = mpos
                dpos = self._read_zaux_value("ZAux_Direct_GetDpos", axis_no, cast=float)
                if dpos is not None:
                    axis.dpos_mm = dpos
                axis_status_val = self._read_zaux_value("ZAux_Direct_GetAxisStatus", axis_no, cast=int)
                if axis_status_val is not None:
                    axis.axis_status = axis_status_val
                idle_val = self._read_zaux_value("ZAux_Direct_GetIfIdle", axis_no, cast=int)
                if idle_val is not None:
                    axis.moving = idle_val

                int_fields = {
                    "axis_type": "ZAux_Direct_GetAtype",
                    "merge": "ZAux_Direct_GetMerge",
                    "fwd_in": "ZAux_Direct_GetFwdIn",
                    "rev_in": "ZAux_Direct_GetRevIn",
                    "corner_mode": "ZAux_Direct_GetCornerMode",
                    "mtype": "ZAux_Direct_GetMtype",
                    "move_buffered": "ZAux_Direct_GetMovesBuffered",
                }
                float_fields = {
                    "decel_angle": "ZAux_Direct_GetDecelAngle",
                    "stop_angle": "ZAux_Direct_GetStopAngle",
                    "zsmooth": "ZAux_Direct_GetZsmooth",
                    "mspeed": "ZAux_Direct_GetMspeed",
                    "vp_speed": "ZAux_Direct_GetVpSpeed",
                }
                for field, method in int_fields.items():
                    val = self._read_zaux_value(method, axis_no, cast=int)
                    if val is not None:
                        runtime[field] = val
                for field, method in float_fields.items():
                    val = self._read_zaux_value(method, axis_no, cast=float)
                    if val is not None:
                        runtime[field] = val

            status[str(axis_no)] = {
                "axis_no": axis_no,
                "idle": int(axis.moving),
                "dpos": float(axis.dpos_mm),
                "mpos": float(axis.mpos_mm),
                "endmove": float(axis.mpos_mm),
                "units": float(axis.units),
                "lspeed": float(axis.lspeed),
                "speed": float(axis.speed),
                "accel": float(axis.accel),
                "decel": float(axis.decel),
                "sramp": float(axis.sramp),
                "axis_status": int(axis.axis_status),
                "fs_limit": int(axis.fs_limit),
                "rs_limit": int(axis.rs_limit),
                "axis_type": runtime["axis_type"],
                "atype": runtime["axis_type"],
                "merge": runtime["merge"],
                "fwd_in": runtime["fwd_in"],
                "rev_in": runtime["rev_in"],
                "corner_mode": runtime["corner_mode"],
                "decel_angle": runtime["decel_angle"],
                "stop_angle": runtime["stop_angle"],
                "zsmooth": runtime["zsmooth"],
                "zxmooth": runtime["zsmooth"],
                "mspeed": float(runtime["mspeed"]),
                "mtype": int(runtime["mtype"]),
                "vp_speed": float(runtime["vp_speed"]),
                "move_buffered": int(runtime["move_buffered"]),
                "error": axis.last_error,
            }
        return status

    # 11. 连续插补运动（按路径点连续下发 MoveAbsSp）
    def continuous_interpolation_move(
        self,
        axis_list: list[int] | tuple[int, ...],
        path_points: list[dict[str, float] | list[float] | tuple[float, ...]],
        *,
        merge_enable: bool = True,
        auto_corner_decel: bool = False,
        auto_small_circle_limit: bool = False,
        auto_corner_angle: bool = False,
        first_corner_angle_deg: float = 15.0,
        end_corner_angle_deg: float = 45.0,
        small_circle_limit: float = 0.0,
        corner_radius: float = 0.0,
        start_move_speed: float | None = None,
        end_move_speed: float | None = None,
        default_speed: float | None = None,
        sleep_when_buffer_full_s: float = 0.005,
        wait_until_done: bool = True,
        done_timeout_s: float = 120.0,
        done_poll_interval_s: float = 0.02,
    ) -> bool:
        if not self._require_connected():
            return False
        if not axis_list or len(axis_list) < 2:
            self._set_error("axis_list 至少包含 2 个轴")
            return False
        if not path_points:
            self._set_error("path_points 不能为空")
            return False

        axis_ids = [int(a) for a in axis_list]
        for axis_no in axis_ids:
            if not self._check_axis(axis_no):
                return False

        axis_count = len(axis_ids)
        axis_array = (ctypes.c_int * axis_count)(*axis_ids)
        master_axis = axis_ids[0]
        master_state = self._axis[master_axis]
        base_speed = float(default_speed if default_speed is not None else master_state.speed)

        mode = 0
        if auto_corner_decel:
            mode += 2
        if auto_small_circle_limit:
            mode += 8
        if auto_corner_angle:
            mode += 32

        # 参考例程：先设置 BASE，再下发插补相关参数
        if not self._call_zaux("ZAux_Direct_Base", axis_count, axis_array):
            return False
        for axis_no in axis_ids:
            axis = self._axis[axis_no]
            for method_name, value in (
                ("ZAux_Direct_SetUnits", axis.units),
                ("ZAux_Direct_SetLspeed", axis.lspeed),
                ("ZAux_Direct_SetSpeed", axis.speed),
                ("ZAux_Direct_SetAccel", axis.accel),
                ("ZAux_Direct_SetDecel", axis.decel),
                ("ZAux_Direct_SetSramp", axis.sramp),
            ):
                if not self._call_zaux(method_name, axis_no, value):
                    return False

        if not self._call_zaux("ZAux_Direct_SetMerge", master_axis, 1 if merge_enable else 0):
            return False
        if not self._call_zaux("ZAux_Direct_SetCornerMode", master_axis, mode):
            return False
        if not self._call_zaux("ZAux_Direct_SetDecelAngle", master_axis, float(first_corner_angle_deg) * 3.14 / 180):
            return False
        if not self._call_zaux("ZAux_Direct_SetStopAngle", master_axis, float(end_corner_angle_deg) * 3.14 / 180):
            return False
        if not self._call_zaux("ZAux_Direct_SetFullSpRadius", master_axis, float(small_circle_limit)):
            return False
        if not self._call_zaux("ZAux_Direct_SetZsmooth", master_axis, float(corner_radius)):
            return False
        if not self._call_zaux(
            "ZAux_Direct_SetStartMoveSpeed",
            master_axis,
            float(base_speed if merge_enable else 0.0) if start_move_speed is None else float(start_move_speed),
        ):
            return False
        if not self._call_zaux(
            "ZAux_Direct_SetEndMoveSpeed",
            master_axis,
            float(base_speed if merge_enable else 0.0) if end_move_speed is None else float(end_move_speed),
        ):
            return False
        if not self._call_zaux("ZAux_Direct_SetMovemark", master_axis, 0):
            return False
        if not self._call_zaux("ZAux_Trigger"):
            return False

        segments: list[tuple[list[float], float]] = []
        for idx, point in enumerate(path_points):
            coords: list[float] = []
            speed_val = base_speed

            if isinstance(point, dict):
                for axis_no in axis_ids:
                    axis_name = self._AXIS_NAME_BY_NO.get(axis_no)
                    if axis_name is None or axis_name not in point:
                        self._set_error(f"path_points[{idx}] 缺少轴坐标: axis={axis_no}")
                        return False
                    coords.append(float(point[axis_name]))
                if "speed" in point and point["speed"] is not None:
                    speed_val = float(point["speed"])
            elif isinstance(point, (list, tuple)):
                if len(point) < axis_count:
                    self._set_error(f"path_points[{idx}] 维度不足，至少需要 {axis_count} 个坐标")
                    return False
                coords = [float(v) for v in point[:axis_count]]
                if len(point) >= axis_count + 1 and point[axis_count] is not None:
                    speed_val = float(point[axis_count])
            else:
                self._set_error(f"path_points[{idx}] 类型不支持: {type(point)}")
                return False

            segments.append((coords, speed_val))

        last_speed: float | None = None
        pushed = 0
        total = len(segments)
        for axis_no in axis_ids:
            self._axis[axis_no].moving = True

        while pushed < total:
            remain = self._read_zaux_value("ZAux_Direct_GetRemain_LineBuffer", master_axis, cast=int)
            if remain is None:
                remain = 4096
            if remain <= 0:
                time.sleep(max(float(sleep_when_buffer_full_s), 0.001))
                continue

            coords, speed_val = segments[pushed]
            if last_speed != speed_val:
                if not self._call_zaux("ZAux_Direct_SetForceSpeed", master_axis, float(speed_val)):
                    for axis_no in axis_ids:
                        self._axis[axis_no].moving = False
                    return False
                last_speed = speed_val

            pos_array = (ctypes.c_float * axis_count)(*coords)
            if not self._call_zaux("ZAux_Direct_MoveAbsSp", axis_count, axis_array, pos_array):
                for axis_no in axis_ids:
                    self._axis[axis_no].moving = False
                return False
            pushed += 1

        # 缓存下发完成，更新本地目标位置（真实设备最终位置由 status 回读修正）
        final_coords, _ = segments[-1]
        for i, axis_no in enumerate(axis_ids):
            self._axis[axis_no].mpos_mm = float(final_coords[i])
            self._axis[axis_no].moving = True

        if wait_until_done:
            start_ts = time.time()
            while True:
                # 读取执行态：缓冲剩余(空闲通常为 4096)、轴 idle 标记
                remain = self._read_zaux_value("ZAux_Direct_GetRemain_LineBuffer", master_axis, cast=int)
                if remain is None:
                    remain = 4096
                all_idle = True
                for axis_no in axis_ids:
                    idle_val = self._read_zaux_value("ZAux_Direct_GetIfIdle", axis_no, cast=int)
                    idle = bool(idle_val) if idle_val is not None else True
                    if not idle:
                        all_idle = False
                        break

                if remain >= 4094 and all_idle:
                    break

                if time.time() - start_ts > float(done_timeout_s):
                    for axis_no in axis_ids:
                        self._axis[axis_no].moving = False
                    self._set_error("连续插补等待完成超时")
                    return False

                time.sleep(max(float(done_poll_interval_s), 0.005))

        for axis_no in axis_ids:
            self._axis[axis_no].moving = False

        self._clear_error()
        return True
        

    def getAxisisMoving(self, axis_no: int) -> bool:
        idle_val = self._read_zaux_value("ZAux_Direct_GetIfIdle", axis_no, cast=int)
        return idle_val

    def 控制器执行缓存在线命令(self, command: str) -> tuple[bool, str]:
        cmd = str(command).strip()
        if not cmd:
            self._set_error("在线命令不能为空")
            return False, ""
        if not self._require_connected():
            return False, ""

        if not self._using_dll():
            self._clear_error()
            return True, f"[sim] {cmd}"

        fn = getattr(self._zaux, "ZAux_Execute", None)
        if fn is None:
            self._set_error("ZAux_Execute 不存在")
            return False, ""

        with self._zaux_lock:
            输出结果,输出信息 = fn(command)
        if self._ret_ok(输出结果):
            self._clear_error()
            return True, str(输出信息 or "")

        输出返回信息 = str(输出信息 or "")
        self._set_error(输出返回信息 or "在线命令执行失败", int(输出结果))
        return False, 输出返回信息

    @property
    def driver_mode(self) -> str:
        return self._driver_mode

    @property
    def last_error(self) -> str | None:
        return self._last_error

    @property
    def last_error_code(self) -> int | None:
        return self._last_error_code
