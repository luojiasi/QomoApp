from __future__ import annotations
import time
from typing import Any

from drivers.zmotion_driver import ZMotionDriver


class ZMotionAdapter:
    """
    期望的 controller 接口（get_status / open_output / absolute_move 等）
    映射到 ZMotionDriver。
    """

    def __init__(self, motion: ZMotionDriver) -> None:
        self._motion = motion

    def get_status(self) -> dict[str, Any]:
        return {"connected": self._motion.is_connected()}

    def open_output(self, io_no: int, value: int) -> None:
        self._motion.set_output(int(io_no), bool(int(value)))

    def absolute_move(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        axis = int(payload["axis"])
        move_distance = float(payload["moveDistance"])
        if not self._motion.is_connected():
            return {"success": False, "message": "控制器未连接"}
        ok = self._motion.move_abs(axis, move_distance)
        if not ok:
            return {"success": False, "message": self._motion.last_error or "absolute_move 失败"}
        return {"success": True}

    def absolute_move_speed(self, payload: dict[str, Any]) -> dict[str, Any]:
        axis = int(payload["axis"])
        move_distance = float(payload["moveDistance"])
        speed = float(payload["speed"])
        if not self._motion.is_connected():
            return {"success": False, "message": "控制器未连接"}
        st = self._motion.get_axes_status()
        key = str(axis)
        prev_speed: float | None = None
        if key in st:
            prev_speed = float(st[key].get("speed", 20.0))
        if not self._motion.set_all_axes_params({axis: {"speed": speed, "lspeed": speed}}):
            return {"success": False, "message": self._motion.last_error or "设置速度失败"}
        ok = self._motion.move_abs(axis, move_distance)
        if prev_speed is not None:
            self._motion.set_all_axes_params({axis: {"speed": prev_speed, "lspeed": prev_speed}})
        if not ok:
            return {"success": False, "message": self._motion.last_error or "absolute_move_slice 失败"}
        return {"success": True}

    def get_notIsMoving(self, axis_no: int ,untilReturnTrue:bool=False ,countOut:float=2000.0,interruptTime:float=0.05) -> dict[str, Any]:
        st = self._motion.get_axes_status()
        key = str(int(axis_no))
        if key not in st:
            return {"success": False}
        idle = int(st[key].get("idle"))
        idle = self._motion.getAxisisMoving(axis_no)

        
        if untilReturnTrue:
            jumpoutCount = 0
            while jumpoutCount<=countOut:
                time.sleep(interruptTime)
                idle = self._motion.getAxisisMoving(axis_no)
                if idle == -1:
                    return {"success": True, "notMoving": idle}
                jumpoutCount+=1
                print('jumpoutCount:',jumpoutCount)
            return {"success": False, "notMoving": idle}
        return {"success": True, "notMoving": idle}

    def get_xy_dpos_mm(self) -> tuple[float, float]:
        st = self._motion.get_axes_status()
        x = float(st["0"]["mpos"])
        y = float(st["1"]["mpos"])
        return x, y

    def get_z_dpos_mm(self) -> float:
        st = self._motion.get_axes_status()
        z = float(st["2"]["mpos"])
        return z

    def stop_axis_motion(self, axes: list[int]) -> None:
        self._motion.emergency_stop_all_axes(list(axes))

    def continuous_interpolation_move_adapter(
        self,
        path_points: list[dict[str, float] | list[float] | tuple[float, ...]] | None = None,
        speed: float | None = None,
        *,
        merge_enable: bool = False,
        auto_corner_decel: bool = False,
        auto_small_circle_limit: bool = False,
        auto_corner_angle: bool = False,
        wait_until_done: bool = True,
        done_timeout_s: float = 120.0,
        done_poll_interval_s: float = 0.02,
    ) -> dict[str, Any]:
        """
        连续运动（固定 X=0、Y=1）。

        1) `path_points` 推荐格式：
           - dict：`{"x": <float>, "y": <float>}`
           - list/tuple：`[x, y]`
        2) `speed`：作为“所有点的恒定速度”下发到底层。
        """
        if not self._motion.is_connected():
            return {"success": False, "message": "控制器未连接"}
        if not path_points:
            return {"success": False, "message": "path_points 不能为空"}

        # 只用 X=0、Y=1 做连续插补
        axis_list = [0, 1]

        # 若速度固定传入，则先把 X/Y 两轴速度参数同步成该值（和 absolute_move_speed 的行为保持一致）
        prev_speeds: dict[str, float] = {}
        if speed is not None:
            st = self._motion.get_axes_status()
            for axis_no in axis_list:
                key = str(axis_no)
                if key in st:
                    prev_speeds[key] = float(st[key].get("speed", 20.0))
            speed_val = float(speed)
            if not self._motion.set_all_axes_params(
                {axis_list[0]: {"speed": speed_val, "lspeed": speed_val}, axis_list[1]: {"speed": speed_val, "lspeed": speed_val}}
            ):
                return {"success": False, "message": self._motion.last_error or "设置速度失败"}

        def _pick_point_speed(point: dict[str, float] | list[float] | tuple[float, ...], idx: int) -> float:
            if speed is not None:
                return float(speed)
            # 兼容：点位 dict/list/tuple 自带 speed（如果未显式传 speed）
            if isinstance(point, dict):
                if point.get("speed", None) is not None:
                    return float(point["speed"])
                raise ValueError(f"path_points[{idx}] 缺少 speed")
            if isinstance(point, (list, tuple)):
                if len(point) >= 3 and point[2] is not None:
                    return float(point[2])  # type: ignore[index]
                raise ValueError(f"path_points[{idx}] 缺少 speed")

        # 转换成驱动器期望的格式：dict 含 x/y/speed
        converted: list[dict[str, float]] = []
        try:
            for idx, point in enumerate(path_points):
                sp = _pick_point_speed(point, idx)
                if isinstance(point, dict):
                    if "x" not in point or "y" not in point:
                        return {"success": False, "message": f"path_points[{idx}] 必须包含 x/y"}
                    converted.append({"x": float(point["x"]), "y": float(point["y"]), "speed": sp})
                elif isinstance(point, (list, tuple)):
                    if len(point) < 2:
                        return {"success": False, "message": f"path_points[{idx}] 坐标不足：至少需要 [x, y]"}
                    converted.append({"x": float(point[0]), "y": float(point[1]), "speed": sp})
                else:
                    return {"success": False, "message": f"path_points[{idx}] 类型不支持: {type(point)}"}
        except Exception as exc:
            return {"success": False, "message": f"参数解析失败: {exc}"}

        ok = self._motion.continuous_interpolation_move(
            axis_list=axis_list,
            path_points=converted,
            merge_enable=merge_enable,
            auto_corner_decel=auto_corner_decel,
            auto_small_circle_limit=auto_small_circle_limit,
            auto_corner_angle=auto_corner_angle,
            wait_until_done=wait_until_done,
            done_timeout_s=done_timeout_s,
            done_poll_interval_s=done_poll_interval_s,
        )

        # 运动发起成功/失败后，恢复之前的速度参数（仅当你显式传了 speed 时才进行恢复）
        if speed is not None and prev_speeds:
            restore_payload: dict[int, dict[str, float]] = {}
            for axis_no in axis_list:
                key = str(axis_no)
                if key in prev_speeds:
                    restore_payload[axis_no] = {"speed": prev_speeds[key], "lspeed": prev_speeds[key]}
            # 恢复失败不影响运动返回结果
            self._motion.set_all_axes_params(restore_payload)

        if not ok:
            return {"success": False, "message": self._motion.last_error or "continuous_interpolation_move 失败"}
        return {"success": True}
