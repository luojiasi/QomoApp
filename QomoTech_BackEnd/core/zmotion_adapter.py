from __future__ import annotations
import time
from typing import Any
from core.state_manager import state_manager as _global_state
from api.dependencies import motion_driver

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
        if not self._motion.set_all_axes_params({axis: {"speed": speed}}):
            return {"success": False, "message": self._motion.last_error or "设置速度失败"}
        ok = self._motion.move_abs(axis, move_distance)
        if prev_speed is not None:
            self._motion.set_all_axes_params({axis: {"speed": prev_speed}})
        if not ok:
            return {"success": False, "message": self._motion.last_error or "absolute_move_slice 失败"}
        return {"success": True}

    # 这里是用来写U轴旋转角度
    def U轴旋转的角度(self, 旋转参数: dict[str, Any]) -> dict[str, Any] | None:
        if not self._motion.is_connected():
            return {"success": False, "message": "控制器未连接"}
        if not isinstance(旋转参数, dict):
            return {"success": False, "message": "旋转参数必须是对象"}
        try:
            旋转角度 = float(旋转参数.get("旋转角度", 0))
            旋转速度 = float(旋转参数.get("旋转速度", 0.1))
            每圈脉冲数 = float(旋转参数.get("每圈脉冲数", 10000.0))
            电子齿轮比 = float(旋转参数.get("电子齿轮比", 1.0))
            减速比 = float(旋转参数.get("减速比", 1.0))
            角度下限原值 = 旋转参数.get("角度下限", -90)
            角度上限原值 = 旋转参数.get("角度上限", 90)
            角度下限 = float(角度下限原值) if 角度下限原值 is not None else None
            角度上限 = float(角度上限原值) if 角度上限原值 is not None else None
        except (TypeError, ValueError): return {"success": False, "message": "旋转参数格式错误（角度/速度/脉冲数/齿轮比/减速比/限位）"}
        if 旋转速度 <= 0: return {"success": False, "message": "旋转速度必须大于0"}
        if 每圈脉冲数 <= 0 or 电子齿轮比 <= 0 or 减速比 <= 0: return {"success": False, "message": "每圈脉冲数/电子齿轮比/减速比必须大于0"}
        if 角度下限 is not None and 角度上限 is not None and 角度下限 > 角度上限: return {"success": False, "message": "角度下限不能大于角度上限"}
        方向原值 = str(旋转参数.get("旋转方向", "顺时针")).strip()
        if 方向原值 in {"顺时针", "CW", "cw", "1", "+1"}:旋转方向 = 1
        elif 方向原值 in {"逆时针", "CCW", "ccw", "-1"}:旋转方向 = -1
        else: return {"success": False, "message": "旋转方向仅支持 顺时针/逆时针"}
        运动模式原值 = str(旋转参数.get("运动模式", 旋转参数.get("mode", "relative"))).strip().lower()
        if 运动模式原值 in {"relative", "rel", "相对"}:
            运动模式 = "relative"
        elif 运动模式原值 in {"absolute", "abs", "绝对"}:
            运动模式 = "absolute"
        else:
            return {"success": False, "message": "运动模式仅支持 relative/absolute"}
        if not self._motion.set_all_axes_params({3: {"speed": float(旋转速度)}}):
            return {"success": False, "message": self._motion.last_error or "设置U轴速度失败"}

        # 角度 -> 脉冲 -> 工程单位：
        # ZMotion MOVE 的单位是“工程单位”，UNITS 是“每工程单位对应脉冲数”。
        # 有效每圈脉冲数 = 电机每圈脉冲数 * 电子齿轮比 * 减速比。
        有效每圈脉冲数 = 每圈脉冲数 * 电子齿轮比 * 减速比

        axes_status = self._motion.get_axes_status()
        axis_units = float(axes_status.get("3", {}).get("units", 0.0))
        if axis_units <= 0:return {"success": False, "message": "U轴 units 未配置或非法"}
        输入角度 = float(旋转角度) * float(旋转方向)
        
        当前工程位移 = float(axes_status.get("3", {}).get("mpos", 0.0))
        当前角度 = (当前工程位移 * axis_units / 有效每圈脉冲数) * 360.0
        目标角度 = 当前角度 + 输入角度 if 运动模式 == "relative" else 输入角度
        if 角度下限 is not None and 角度上限 is not None:实际目标角度 = max(角度下限, min(角度上限, 目标角度))
        elif 角度下限 is not None:实际目标角度 = max(角度下限, 目标角度)
        elif 角度上限 is not None:实际目标角度 = min(角度上限, 目标角度)
        else:实际目标角度 = 目标角度
        实际增量角度 = 实际目标角度 - 当前角度
        if abs(实际增量角度) <= 1e-9:
            return {
                "success": True,
                "message": "U轴目标与当前位置一致，无需运动",
                "data": {
                    "axis": 3,
                    "delta": 0.0,
                    "mode": 运动模式,
                    "current_angle": 当前角度,
                    "requested_target_angle": 目标角度,
                    "actual_target_angle": 实际目标角度,
                    "axis_units": axis_units,
                    "effective_pulses_per_rev": 有效每圈脉冲数,
                },
            }
        目标脉冲数 = (实际增量角度 / 360.0) * 有效每圈脉冲数
        旋转位移 = 目标脉冲数 / axis_units
        if not self._motion.move_rel(3, 旋转位移):return {"success": False, "message": self._motion.last_error or "U轴旋转失败"}
        return {
            "success": True,
            "data": {
                "axis": 3,
                "delta": 旋转位移,
                "mode": 运动模式,
                "current_angle": 当前角度,
                "actual_increment_angle": 实际增量角度,
                "requested_target_angle": 目标角度,
                "actual_target_angle": 实际目标角度,
                "axis_units": axis_units,
                "effective_pulses_per_rev": 有效每圈脉冲数,
            },
        }
    
    def U轴旋转角度(self, 旋转角度: float) -> dict[str, Any] | None:
        """
        简化版 U 轴旋转接口：直接传 float，正数顺时针、负数逆时针。
        使用绝对位置模式（move_abs），传入角度即为目标绝对角度。
        其余机械参数可按需覆盖，逻辑与 U轴旋转的角度(dict) 完全一致。
        """
        旋转方向 = "顺时针" if 旋转角度 >= 0 else "逆时针"
        旋转参数 = {
            "旋转角度": abs(旋转角度),
            "旋转方向": 旋转方向,
            "运动模式": "absolute",
        }
        return self.U轴旋转的角度(旋转参数)

    def U轴是否到达旋转角度(self, 旋转角度: float, 容差: float = 0.001) -> bool:
        """
        判断 U 轴是否已到达目标旋转角度。
        判定条件：轴处于静止（idle）且当前 mpos 与目标工程位移之差 ≤ 容差。
        目标工程位移由传入的旋转角度（绝对角度，正顺时针/负逆时针）换算得到。
        机械参数与 U轴旋转的角度() 默认值保持一致：
            每圈脉冲数=10000、电子齿轮比=1.0、减速比=1.0。
        容差单位为工程单位，默认 0.01。
        """
        if not self._motion.is_connected():return False

        axes_status = self._motion.get_axes_status()
        axis_info = axes_status.get("3", {})

        # idle: ZAux_Direct_GetIfIdle 返回非零表示轴已静止
        if int(axis_info.get("idle", 0)) == 0:return False

        axis_units = float(axis_info.get("units", 0.0))
        if axis_units <= 0:return False
        # 与 U轴旋转的角度() 默认机械参数保持一致
        有效每圈脉冲数 = 10000.0 * 1.0 * 1.0  # 每圈脉冲数 * 电子齿轮比 * 减速比
        # 目标角度 → 目标工程位移
        目标工程位移 = (旋转角度 / 360.0) * 有效每圈脉冲数 / axis_units

        mpos = float(axis_info.get("mpos", 0.0))

        return abs(mpos - 目标工程位移) <= 容差

    

    # 这里是用来写R轴的旋转
    def R轴旋转的圈数(self, 旋转参数: dict[str, Any]) -> dict[str, Any] | None:
        if not self._motion.is_connected():
            return {"success": False, "message": "控制器未连接"}
        if not isinstance(旋转参数, dict):
            return {"success": False, "message": "旋转参数必须是对象"}

        try:
            旋转圈数 = float(旋转参数.get("旋转圈数", 0))
            旋转速度 = float(旋转参数.get("旋转速度", 0))
        except (TypeError, ValueError):
            return {"success": False, "message": "旋转圈数/旋转速度参数格式错误"}

        if 旋转圈数 < 0:
            return {"success": False, "message": "旋转圈数不能小于0"}
        if 旋转速度 <= 0:
            return {"success": False, "message": "旋转速度必须大于0"}

        方向原值 = str(旋转参数.get("旋转方向", "顺时针")).strip()
        if 方向原值 in {"顺时针", "CW", "cw", "1", "+1"}:
            旋转方向 = 1
        elif 方向原值 in {"逆时针", "CCW", "ccw", "-1"}:
            旋转方向 = -1
        else:
            return {"success": False, "message": "旋转方向仅支持 顺时针/逆时针"}
        运动模式原值 = str(旋转参数.get("运动模式", 旋转参数.get("mode", "relative"))).strip().lower()
        if 运动模式原值 in {"relative", "rel", "相对"}:
            运动模式 = "relative"
        elif 运动模式原值 in {"absolute", "abs", "绝对"}:
            运动模式 = "absolute"
        else:
            return {"success": False, "message": "运动模式仅支持 relative/absolute"}

        if not self._motion.set_all_axes_params({4: {"speed": float(旋转速度)}}):
            return {"success": False, "message": self._motion.last_error or "设置R轴速度失败"}

        # 机械参数：200 步/圈(1.8°)；默认 32 细分；可选减速比(默认 1:1)。
        # 支持通过 payload 覆盖：步进角度/细分数/减速比。
        try:
            步进角度 = float(旋转参数.get("步进角度", 1.8))
            细分数 = float(旋转参数.get("细分数", 32))
            减速比 = float(旋转参数.get("减速比", 1.0))
        except (TypeError, ValueError):
            return {"success": False, "message": "步进角度/细分数/减速比参数格式错误"}

        if 步进角度 <= 0 or 细分数 <= 0 or 减速比 <= 0:
            return {"success": False, "message": "步进角度/细分数/减速比必须大于0"}

        电机每圈整步数 = 360.0 / 步进角度
        每圈脉冲数 = 电机每圈整步数 * 细分数 * 减速比
        # ZMotion MOVE 指令的位移单位是“工程单位”，UNITS 是“每工程单位对应脉冲数”。
        # 所以：工程单位位移 = 脉冲数 / UNITS。
        axes_status = self._motion.get_axes_status()
        axis_units = float(axes_status.get("4", {}).get("units", 0.0))
        if axis_units <= 0:
            return {"success": False, "message": "R轴 units 未配置或非法"}

        每圈距离 = 每圈脉冲数 / axis_units
        输入圈数 = float(旋转圈数) * float(旋转方向)
        当前工程位移 = float(axes_status.get("4", {}).get("mpos", 0.0))
        当前圈数 = 当前工程位移 / 每圈距离
        实际增量圈数 = 输入圈数 if 运动模式 == "relative" else (输入圈数 - 当前圈数)
        if 运动模式 == "relative" and abs(实际增量圈数) <= 1e-12:
            return {"success": False, "message": "相对模式下旋转圈数不能为0"}
        if abs(实际增量圈数) <= 1e-12:
            return {
                "success": True,
                "message": "R轴目标与当前位置一致，无需运动",
                "data": {
                    "axis": 4,
                    "delta": 0.0,
                    "mode": 运动模式,
                    "current_turns": 当前圈数,
                    "requested_target_turns": 输入圈数,
                    "actual_target_turns": 当前圈数,
                    "axis_units": axis_units,
                    "pulses_per_rev": 每圈脉冲数,
                },
            }
        旋转位移 = 实际增量圈数 * 每圈距离
        if not self._motion.move_rel(4, 旋转位移):
            return {"success": False, "message": self._motion.last_error or "R轴旋转失败"}
        return {
            "success": True,
            "data": {
                "axis": 4,
                "delta": 旋转位移,
                "mode": 运动模式,
                "current_turns": 当前圈数,
                "actual_increment_turns": 实际增量圈数,
                "requested_target_turns": 输入圈数 if 运动模式 == "absolute" else (当前圈数 + 输入圈数),
                "actual_target_turns": 当前圈数 + 实际增量圈数,
                "axis_units": axis_units,
                "pulses_per_rev": 每圈脉冲数,
            },
        }

    def R轴一直进行旋转(self, R轴旋转速度: float | None = None) -> dict[str, Any] | None:
        if not self._motion.is_connected():
            return {"success": False, "message": "控制器未连接"}
        if R轴旋转速度 is None:
            轴状态 = self._motion.get_axes_status().get("4", {})
            读取到的速度 = float(轴状态.get("speed", 0.0))
            if 读取到的速度 is None: return {"success": False, "message": "未传R轴旋转速度，且无法从驱动器读取到有效运行速度"}
            R轴旋转速度 = 读取到的速度
        if R轴旋转速度 <= 0: return {"success": False, "message": "R轴旋转速度必须大于0"}
        if not self._motion.set_all_axes_params({4: {"speed": R轴旋转速度}}): return {"success": False, "message": self._motion.last_error or "设置R轴速度失败"}

        # 底层驱动暂未提供独立 jog 接口：这里下发一个足够大的相对位移，
        # 由外部通过急停/停止接口终止，可满足“持续旋转”诉求。
        持续旋转位移 = 1_000_000.0
        if not self._motion.move_rel(4, 持续旋转位移):
            return {"success": False, "message": self._motion.last_error or "R轴持续旋转启动失败"}
        return {"success": True, "message": "R轴已开始持续旋转", "data": {"axis": 4}}


    def get_notIsMoving(self, axis_no: int, untilReturnTrue: bool = False, countOut: float = 2000.0, interruptTime: float = 0.05) -> dict[str, Any]:
        key = str(int(axis_no))
        st = self._motion.get_axes_status()
        axis_data = st.get(key, {})
        if not axis_data:
            return {"success": False, "notMoving": False, "message": f"轴 {key} 不存在"}
        idle = int(axis_data.get("idle", 0))
        if not untilReturnTrue:
            return {"success": True, "notMoving": idle == -1}
        jumpoutCount = 0
        while jumpoutCount <= countOut:
            time.sleep(interruptTime)
            st = self._motion.get_axes_status()
            axis_data = st.get(key, {})
            idle = int(axis_data.get("idle", 0))
            if idle == -1:
                return {"success": True, "notMoving": True}
            jumpoutCount += 1
        return {"success": False, "notMoving": False, "message": f"轴 {key} 等待静止超时"}

    def get_xy_dpos_mm(self) -> tuple[float, float]:
        st = self._motion.get_axes_status()
        x = float(st["0"]["mpos"])
        y = float(st["1"]["mpos"])
        return x, y

    def get_z_mpos_mm(self) -> float:
        st = self._motion.get_axes_status()
        z = float(st["2"]["mpos"])
        return z
    def 获取R轴的当前位置(self) -> float:
        st = self._motion.get_axes_status()
        当前工程位移 = float(st.get("4", {}).get("mpos", 0.0))
        R轴设置的脉冲当量 = float(st.get("4", {}).get("units", 0.0))
        if R轴设置的脉冲当量 <= 0:return 0.0

        # 与 R轴旋转的圈数() 默认口径一致：1.8°步进角、32细分、减速比1:1
        每圈脉冲数 = (360.0 / 1.8) * 32.0 * 1.0
        当前圈数 = 当前工程位移 * R轴设置的脉冲当量 / 每圈脉冲数
        return 当前圈数

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
                {axis_list[0]: {"speed": speed_val}, axis_list[1]: {"speed": speed_val}}
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
                    restore_payload[axis_no] = {"speed": prev_speeds[key]}
            # 恢复失败不影响运动返回结果
            self._motion.set_all_axes_params(restore_payload)

        if not ok:
            return {"success": False, "message": self._motion.last_error or "continuous_interpolation_move 失败"}
        return {"success": True}


# 兼容 api.driver_api 中的 `from core.zmotion_adapter import zmotion_adapter`
zmotion_adapter = ZMotionAdapter(motion_driver)
