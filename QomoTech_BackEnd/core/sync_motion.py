"""同步桥接 —— 在同步线程中安全调用 MotionService 的 async 方法。

使用 ``asyncio.run_coroutine_threadsafe()`` 将 async 调用投递到 MotionService
所在的事件循环，让 ``startPragram.py`` 等同步旧代码无需改造即可使用新服务。
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from services.MotionService import MotionService

logger = logging.getLogger("qomotech.sync_motion")

_轴号映射: dict[int, str] = {0: "X", 1: "Y", 2: "Z", 3: "U", 4: "R"}


class SyncMotion:
    """MotionService 的同步代理，替换旧 ``ZMotionAdapter``。"""

    def __init__(self) -> None:
        self._service = MotionService.获取实例()
        if self._service._loop is None: raise RuntimeError("MotionService 未启动（_loop 为 None）")
        self._loop: asyncio.AbstractEventLoop = self._service._loop

    # ------------------------------------------------------------------
    # 内部辅助
    # ------------------------------------------------------------------

    def _投递调用(self, coro_factory: Any, timeout: float | None = None) -> Any:
        """将 async 协程投递到 MotionService 的事件循环，同步等待结果。

        coro_factory —— 无参数的可调用，返回一个协程对象（lambda）。
        timeout     —— None=无限等待。
        """
        future = asyncio.run_coroutine_threadsafe(coro_factory(), self._loop)
        return future.result(timeout=timeout)

    def _安全调用(
        self, coro_factory: Any, default: Any = None, timeout: float | None = None,
    ) -> Any:
        """_投递调用 的异常安全版：失败时返回 default 并记日志。"""
        try:
            return self._投递调用(coro_factory, timeout=timeout)
        except Exception:
            logger.exception("SyncMotion._安全调用 异常")
            return default

    @staticmethod
    def _轴名(axis_no: int) -> str | None:
        return _轴号映射.get(int(axis_no))

    # ------------------------------------------------------------------
    # 状态 / 连接
    # ------------------------------------------------------------------

    def 获取状态(self) -> dict[str, Any]:
        adapter = self._service._adapter
        return {"connected": adapter.已连接 if adapter else False}

    def 是否已连接(self) -> bool:
        adapter = self._service._adapter
        return bool(adapter and adapter.已连接)

    # ------------------------------------------------------------------
    # IO
    # ------------------------------------------------------------------

    def 设置输出(self, io_no: int, value: int) -> None:
        self._安全调用(lambda: self._service.设置输出(int(io_no), bool(int(value))))

    def 设置输出布尔值(self, io_no: int, value: bool) -> None:
        self._安全调用(lambda: self._service.设置输出(int(io_no), value))

    def 获取输出(self, io_no: int) -> bool:
        result = self._安全调用(lambda: self._service.读_输出(int(io_no)), default=False)
        return bool(result)

    # ------------------------------------------------------------------
    # 单轴运动（带速度暂存 — 由 MotionService 内部处理）
    # ------------------------------------------------------------------

    def 绝对运动并设速度(self, payload: dict[str, Any]) -> dict[str, Any]:
        axis = int(payload["axis"])
        name = self._轴名(axis)
        if name is None:
            return {"success": False, "message": f"未知轴号: {axis}"}
        try:
            self._投递调用(lambda: self._service.绝对运动并设速度(
                name, float(payload["moveDistance"]), float(payload["speed"]),
            ))
            return {"success": True}
        except Exception as exc:
            return {"success": False, "message": str(exc)}

    # ------------------------------------------------------------------
    # 轴状态查询
    # ------------------------------------------------------------------

    def 获取轴是否静止(self, axis_no: int) -> dict[str, Any]:
        name = self._轴名(int(axis_no))
        if name is None:
            return {"success": False, "notMoving": False, "message": f"未知轴号: {axis_no}"}
        try:
            idle = self._投递调用(lambda: self._service.读_idle(name), timeout=10)
            return {"success": True, "notMoving": bool(idle)}
        except Exception as exc:
            return {"success": False, "notMoving": False, "message": str(exc)}

    def 取XY实际位置(self) -> tuple[float, float]:
        result = self._安全调用(lambda: self._service.取_xy_实际位置(), default=(0.0, 0.0))
        return (float(result[0]), float(result[1])) if isinstance(result, (list, tuple)) else (0.0, 0.0)

    def 取Z实际位置(self) -> float:
        return float(self._安全调用(lambda: self._service.取_z_实际位置(), default=0.0))

    # ------------------------------------------------------------------
    # 停止
    # ------------------------------------------------------------------

    def 停止运动(self, axes: list[int] | None = None) -> None:
        """停止运动。参数兼容旧接口，实际全部停止。"""
        self._安全调用(lambda: self._service.停止运动())

    def 急停(self, axes: list[int] | None = None) -> None:
        self._安全调用(lambda: self._service.急停())

    def 复位(self) -> None:
        """复位状态机（ESTOP/ALARM → IDLE），供下次程序启动前调用。"""
        self._安全调用(lambda: self._service.复位())

    def 清除轴错误(self, axis_no: int) -> bool:
        name = self._轴名(int(axis_no))
        if name is None:
            return False
        try:
            self._投递调用(lambda: self._service.清除轴错误(name), timeout=10)
            return True
        except Exception:
            return False

    # ------------------------------------------------------------------
    # 连续插补 XY
    # ------------------------------------------------------------------

    def 连续插补XY(
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
        try:
            self._投递调用(lambda: self._service.连续插补XY(
                路径点=path_points,
                速度=speed,
                merge_enable=merge_enable,
                auto_corner_decel=auto_corner_decel,
                auto_small_circle_limit=auto_small_circle_limit,
                auto_corner_angle=auto_corner_angle,
                wait_until_done=wait_until_done,
                done_timeout_s=done_timeout_s,
                done_poll_interval_s=done_poll_interval_s,
            ))
            return {"success": True}
        except Exception as exc:
            return {"success": False, "message": str(exc)}

    # ------------------------------------------------------------------
    # U 轴旋转
    # ------------------------------------------------------------------

    def U轴旋转的角度(self, 旋转参数: dict[str, Any]) -> dict[str, Any]:
        return self._安全调用(
            lambda: self._service.U轴旋转的角度(旋转参数),
            default={"success": False, "message": "U轴旋转失败"},
        )

    def U轴旋转角度(self, 旋转角度: float) -> dict[str, Any]:
        return self._安全调用(
            lambda: self._service.U轴旋转角度(float(旋转角度)),
            default={"success": False, "message": "U轴旋转角度失败"},
        )

    def U轴是否到达旋转角度(self, 旋转角度: float, 容差: float = 0.001) -> bool:
        return bool(self._安全调用(
            lambda: self._service.U轴是否到达旋转角度(float(旋转角度), float(容差)),
            default=False,
        ))

    # ------------------------------------------------------------------
    # R 轴旋转
    # ------------------------------------------------------------------

    def R轴一直进行旋转(self, R轴旋转速度: float | None = None) -> dict[str, Any]:
        return self._安全调用(
            lambda: self._service.R轴一直进行旋转(R轴旋转速度),
            default={"success": False, "message": "R轴旋转失败"},
        )

    def 获取R轴的当前位置(self) -> float:
        return float(self._安全调用(
            lambda: self._service.获取R轴的当前位置(),
            default=0.0,
        ))
