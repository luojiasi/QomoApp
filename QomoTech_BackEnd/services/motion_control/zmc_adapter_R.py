"""ZMC 控制器 DLL 适配器 —— 唯一对外门面（async / 单线程串行化）。

设计要点
========
1. **唯一 DLL 入口**：所有上层模块通过本类访问 zauxdll，禁止直接调用 ZAUXDLL；
2. **单线程串行化**：ZMC handle 不允许并发，使用 1-worker ThreadPoolExecutor + RLock 双重保险；
3. **async 接口**：对外 async 方法，内部 loop.run_in_executor，绝不阻塞 event loop；
4. **错误码翻译**：每次 DLL 调用返回码 ≠ 0 抛 ZMCError；
5. **轴号语义化**：上层用整数轴号；模块不感知 'X/Y/Z' 等业务命名（U=3, R=4 与 motion_config 对齐）；
6. **批量读取**：批量读取() 在一次 IO 任务内读 5 轴位置，减少锁竞争。

五轴加工支持
============
本适配器配合 QomoTech 5 轴硬件（X/Y/Z 三直线 + U 工件旋转 + R 工具旋转），同时支持：
  - **3+2 定向加工**：三加二定向加工() 先把 U/R 定位锁定，再做 XYZ 三轴联动
  - **五轴联动直线**：五轴联动直线() 5 轴同时插补到目标位置
  - **多轴圆弧 / 螺旋**：圆心圆弧 / 三点圆弧 / 螺旋
  - **连续轨迹合并**（MERGE）：连续插补运动() 缓冲推送大量路径点

方法覆盖
========
本类整合了原 drivers/zmotion_driver.py 与 core/zmotion_adapter.py 的全部方法：
  drivers ZMotionDriver:    connect / disconnect / set_all_axes_params / 设置控制器反向间隙参数 /
                            clear_axis_error / set_axis_limit / set_output / get_input(s) /
                            get_output(s) / emergency_stop_axis / emergency_stop_all_axes /
                            zero_axis_position / move_abs / move_rel / get_axes_status /
                            continuous_interpolation_move / getAxisisMoving /
                            控制器执行缓存在线命令
  core ZMotionAdapter:      get_status / open_output / absolute_move / absolute_move_speed /
                            U轴旋转的角度参数 / U轴旋转角度 / U轴是否到达旋转角度 /
                            R轴旋转的圈数带参数 / R轴一直进行旋转 / 获取R轴的当前位置 /
                            get_notIsMoving / get_xy_dpos_mm / get_z_mpos_mm /
                            stop_axis_motion / continuous_interpolation_move_adapter

DLL 资源
========
  libs/zmcdll/zauxdll.dll  (主 DLL)
  libs/zmcdll/zmotion.dll  (依赖)
  libs/zmcdll/zauxdllPython.py  在 import 时加载 dll；故本模块 import 即触发 DLL 装载。
  单元测试不应 import 本模块，对应测试推迟到集成阶段。
"""
from __future__ import annotations

import asyncio
import ctypes
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Sequence

from libs.zmcdll.zauxdllPython import ZAUXDLL
from configs.motion_config import MotionConfig
from services.motion_control.config_loader import 加载运动配置, 取轴
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("ZMC适配器")


# ======================================================================
# 常量
# ======================================================================

# 轴停止模式（ZAux_Direct_Single_Cancel / CancelAxisList 的 imode）
取消_当前 = 0           # 仅取消当前运动
取消_缓冲 = 1           # 仅取消缓冲运动
取消_全部 = 2           # 取消当前 + 缓冲（推荐用作软停止）
取消_立即 = 3           # 立即中断脉冲（急停专用）

# 圆弧方向
圆弧_逆时针 = 0
圆弧_顺时针 = 1

# 默认轴号（与 configs/motion_config.py 对齐）
轴_X = 0
轴_Y = 1
轴_Z = 2
轴_U = 3                # 工件旋转
轴_R = 4                # 工具旋转


# ======================================================================
# 异常 / 数据载体
# ======================================================================


class ZMCError(RuntimeError):
    """ZMC DLL 调用失败。

    路由层（motion_http.py）将其翻译为 HTTP 502 BAD_GATEWAY。
    """

    def __init__(self, 函数名: str, 错误码: int, 备注: str = "") -> None:
        self.函数名 = 函数名
        self.错误码 = int(错误码)
        消息 = f"{函数名} 调用失败：错误码={self.错误码}"
        if 备注:
            消息 = f"{消息} ({备注})"
        super().__init__(消息)


@dataclass
class 轴读数:
    """批量读取() 返回的单轴瞬时读数（裸数据，未做业务归一化）。"""

    轴号: int
    指令位置: float
    实际位置: float
    空闲: bool


# ======================================================================
# 主类
# ======================================================================


class ZMC适配器:
    """ZMC 控制器同步 DLL 操作的异步包装。

    生命周期：
      __init__ → 连接(ip)         # 建链 + 下发轴参数
              → ... 各种运动 / 状态读取 ...
              → 关闭()            # ZAux_Close（不关线程池，可再次连接）
              → 销毁()            # 关闭() + 关闭线程池
    """

    # --- 静态映射：业务级方法用到的 IO 字段名 ---
    _动态int字段 = {
        "mtype": "ZAux_Direct_GetMtype",
        "move_buffered": "ZAux_Direct_GetMovesBuffered",
    }
    _动态float字段 = {
        "mspeed": "ZAux_Direct_GetMspeed",
        "vp_speed": "ZAux_Direct_GetVpSpeed",
    }
    _静态int字段 = {
        "axis_type": "ZAux_Direct_GetAtype",
        "merge": "ZAux_Direct_GetMerge",
        "fwd_in": "ZAux_Direct_GetFwdIn",
        "rev_in": "ZAux_Direct_GetRevIn",
        "corner_mode": "ZAux_Direct_GetCornerMode",
    }
    _静态float字段 = {
        "decel_angle": "ZAux_Direct_GetDecelAngle",
        "stop_angle": "ZAux_Direct_GetStopAngle",
        "zsmooth": "ZAux_Direct_GetZsmooth",
    }

    def __init__(self, 配置: Optional[MotionConfig] = None) -> None:
        self._配置: MotionConfig = 配置 if 配置 is not None else 加载运动配置()
        self._dll = ZAUXDLL()
        self._锁 = threading.RLock()
        self._执行器 = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ZMC-IO")
        self._已连接: bool = False
        self._已销毁: bool = False
        self._最近错误: Optional[str] = None
        self._最近错误码: Optional[int] = None
        # 静态字段缓存（连接后填充一次，减少每次状态读取的 DLL 调用）
        self._静态字段缓存: Dict[int, Dict[str, Any]] = {}
        # 中止事件 —— 急停/停止时立即广播,连续插补循环检测到后主动退出
        # 不依赖 IO worker 队列,避免长任务占用 worker 时急停无法及时执行
        self._中止事件: threading.Event = threading.Event()

    # ------------------------------------------------------------------
    # 属性
    # ------------------------------------------------------------------

    @property
    def 已连接(self) -> bool:
        return self._已连接

    @property
    def 配置(self) -> MotionConfig:
        return self._配置

    @property
    def _U轴每圈脉冲数(self) -> float:
        return float(self._配置.u_axis.pulses_per_rev)

    @property
    def _U轴电子齿轮比(self) -> float:
        return float(self._配置.u_axis.electronic_gear_ratio)

    @property
    def _U轴减速比(self) -> float:
        return float(self._配置.u_axis.gear_ratio)

    @property
    def _R轴每圈脉冲数(self) -> float:
        return float(self._配置.r_axis.pulses_per_rev)

    @property
    def _R轴电子齿轮比(self) -> float:
        return float(self._配置.r_axis.electronic_gear_ratio)

    @property
    def _R轴减速比(self) -> float:
        return float(self._配置.r_axis.gear_ratio)

    @property
    def 最近错误(self) -> Optional[str]:
        return self._最近错误

    @property
    def 最近错误码(self) -> Optional[int]:
        return self._最近错误码

    # ------------------------------------------------------------------
    # 异步桥 / 错误处理
    # ------------------------------------------------------------------

    async def _执行(self, 同步函数: Callable[[], Any]) -> Any:
        """所有 DLL 调用统一通过此方法进入 IO 线程。"""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._执行器, 同步函数)

    @staticmethod
    def _返回码(返回值: Any) -> int:
        """ZMC 函数返回值通常是 int 或 (int, ctypes.value)。取出 int 部分。"""
        return int(返回值[0]) if isinstance(返回值, tuple) else int(返回值)

    def _校验(self, 函数名: str, 返回值: Any, 备注: str = "") -> None:
        ret = self._返回码(返回值)
        if ret != 0:
            self._记录错误(函数名, ret, 备注)
            raise ZMCError(函数名, ret, 备注)

    def _锁定调用(self, 名称: str, 函数: Callable, *参数: Any) -> Any:
        """通用同步调用：锁 + 连接检查 + DLL 调用 + 错误码校验。"""
        with self._锁:
            返回值 = 函数(*参数)
        self._校验(名称, 返回值)
        return 返回值

    def _记录错误(self, 函数名: str, 错误码: int, 备注: str = "") -> None:
        self._最近错误 = f"{函数名}({备注})" if 备注 else 函数名
        self._最近错误码 = int(错误码)

    def _清除错误记录(self) -> None:
        self._最近错误 = None
        self._最近错误码 = None

    def _要求已连接(self) -> None:
        if not self._已连接:
            raise ZMCError("connection", -1, "控制器未连接")

    # ------------------------------------------------------------------
    # 连接 / 关闭 / 销毁
    # ------------------------------------------------------------------

    async def 连接(self, ip: Optional[str] = None) -> None:
        """建链 + 下发全部轴参数 + 刷新静态字段缓存。"""
        实际ip = ip or self._配置.controller_ip
        日志.info(f"连接 ZMC 控制器 {实际ip}")
        try:
            await asyncio.wait_for(
                self._执行(lambda: self._同步_连接(实际ip)),
                timeout=self._配置.connect_timeout_s,
            )
        except asyncio.TimeoutError:
            raise ZMCError(
                "ZAux_OpenEth", -1,
                f"控制器 {实际ip} 连接超时（{self._配置.connect_timeout_s} 秒）",
            )
        self._已连接 = True
        try:
            await self._执行(self._同步_初始化所有轴)
            await self._执行(self._同步_刷新静态缓存)
        except Exception:
            self._已连接 = False
            await self._执行(self._同步_关闭)
            raise
        日志.info("ZMC 连接并初始化完成")

    def _同步_连接(self, ip: str) -> None:
        with self._锁:
            ret = self._dll.ZAux_OpenEth(ip)
        if int(ret) != 0:
            self._记录错误("ZAux_OpenEth", int(ret), f"ip={ip}")
            raise ZMCError("ZAux_OpenEth", int(ret), f"ip={ip}")
        self._清除错误记录()

    def _同步_初始化所有轴(self) -> None:
        """连接后一次性把 motion_config 中的所有轴参数下发到控制器。"""
        with self._锁:
            for 名, cfg in self._配置.axes.items():
                self._校验("ZAux_Direct_SetAtype",
                          self._dll.ZAux_Direct_SetAtype(cfg.axis_no, cfg.axis_type),
                          备注=f"{名}#{cfg.axis_no}")
                self._校验("ZAux_Direct_SetUnits",
                          self._dll.ZAux_Direct_SetUnits(cfg.axis_no, cfg.units),
                          备注=f"{名}")
                self._校验("ZAux_Direct_SetSpeed",
                          self._dll.ZAux_Direct_SetSpeed(cfg.axis_no, cfg.speed),
                          备注=f"{名}")
                self._校验("ZAux_Direct_SetLspeed",
                          self._dll.ZAux_Direct_SetLspeed(cfg.axis_no, cfg.lspeed),
                          备注=f"{名}")
                self._校验("ZAux_Direct_SetAccel",
                          self._dll.ZAux_Direct_SetAccel(cfg.axis_no, cfg.accel),
                          备注=f"{名}")
                self._校验("ZAux_Direct_SetDecel",
                          self._dll.ZAux_Direct_SetDecel(cfg.axis_no, cfg.decel),
                          备注=f"{名}")
                self._校验("ZAux_Direct_SetSramp",
                          self._dll.ZAux_Direct_SetSramp(cfg.axis_no, cfg.sramp),
                          备注=f"{名}")
                # 限位输入端口（-1 表示不启用）
                if cfg.fwd_in >= 0:
                    self._校验("ZAux_Direct_SetFwdIn",
                              self._dll.ZAux_Direct_SetFwdIn(cfg.axis_no, cfg.fwd_in),
                              备注=f"{名}")
                if cfg.rev_in >= 0:
                    self._校验("ZAux_Direct_SetRevIn",
                              self._dll.ZAux_Direct_SetRevIn(cfg.axis_no, cfg.rev_in),
                              备注=f"{名}")
                日志.debug(
                    f"轴 {名}#{cfg.axis_no} 初始化完成 "
                    f"(ATYPE={cfg.axis_type}, units={cfg.units}, speed={cfg.speed})"
                )

    def _同步_刷新静态缓存(self) -> None:
        """填充各轴的静态字段缓存（atype/merge/fwd_in/rev_in/corner_mode/decel_angle/...）。"""
        缓存: Dict[int, Dict[str, Any]] = {}
        with self._锁:
            for cfg in self._配置.axes.values():
                项: Dict[str, Any] = {}
                for 字段, 方法 in self._静态int字段.items():
                    项[字段] = self._读_int(方法, cfg.axis_no, 默认=0)
                for 字段, 方法 in self._静态float字段.items():
                    项[字段] = self._读_float(方法, cfg.axis_no, 默认=0.0)
                缓存[cfg.axis_no] = 项
        self._静态字段缓存 = 缓存

    async def 关闭(self) -> None:
        """断开与控制器的连接（保留线程池，允许后续再 连接()）。"""
        if self._已销毁: return
        if not self._已连接: return
        try:
            await self._执行(self._同步_关闭)
        finally:
            self._已连接 = False
            self._静态字段缓存 = {}
            日志.info("ZMC 已关闭")

    async def 销毁(self) -> None:
        """释放适配器资源（断开 + 关闭线程池）；销毁后实例不可复用。"""
        if self._已销毁:return
        try:
            await self.关闭()
        finally:
            self._已销毁 = True
            try:
                self._执行器.shutdown(wait=False)
            except Exception:
                pass

    def _同步_关闭(self) -> None:
        with self._锁:
            try:
                self._dll.ZAux_Close()
            except Exception as exc:
                日志.warning(f"关闭 ZMC 异常: {exc}")
            finally:
                self._已连接 = False

    # ------------------------------------------------------------------
    # 同步读取辅助（供 _同步_批量读取 / 静态缓存 / 业务级方法复用）
    # ------------------------------------------------------------------

    def _读_int(self, 方法名: str, *参数: Any, 默认: int = 0) -> int:
        """已加锁路径下读取 ctypes 整数返回值；失败返回默认值（仅用于状态采集，不抛异常）。"""
        fn = getattr(self._dll, 方法名, None)
        if fn is None:
            return 默认
        ret = fn(*参数)
        if not isinstance(ret, tuple):
            return 默认
        rc, val = ret
        if int(rc) != 0:
            return 默认
        try:
            return int(val.value)
        except Exception:
            return 默认

    def _读_float(self, 方法名: str, *参数: Any, 默认: float = 0.0) -> float:
        fn = getattr(self._dll, 方法名, None)
        if fn is None:
            return 默认
        ret = fn(*参数)
        if not isinstance(ret, tuple):
            return 默认
        rc, val = ret
        if int(rc) != 0:
            return 默认
        try:
            return float(val.value)
        except Exception:
            return 默认

    # ==================================================================
    # 轴参数下发
    # ==================================================================

    async def 设置速度(self, 轴号: int, 速度: float) -> None:
        """SPEED —— 单轴目标速度（工程单位/秒）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetSpeed",
            self._dll.ZAux_Direct_SetSpeed, 轴号, float(速度)))

    async def 设置起跳速度(self, 轴号: int, 起跳速度: float) -> None:
        """LSPEED —— 起跳速度（速度从 0 直接达到的最大值，避免共振）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetLspeed",
            self._dll.ZAux_Direct_SetLspeed, 轴号, float(起跳速度)))

    async def 设置加速度(self, 轴号: int, 加速度: float) -> None:
        """ACCEL —— 加速度（工程单位/秒²）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetAccel",
            self._dll.ZAux_Direct_SetAccel, 轴号, float(加速度)))

    async def 设置减速度(self, 轴号: int, 减速度: float) -> None:
        """DECEL —— 减速度。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetDecel",
            self._dll.ZAux_Direct_SetDecel, 轴号, float(减速度)))

    async def 设置S曲线(self, 轴号: int, sramp: float) -> None:
        """SRAMP —— S 曲线时间（毫秒）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetSramp",
            self._dll.ZAux_Direct_SetSramp, 轴号, float(sramp)))

    async def 设置脉冲当量(self, 轴号: int, units: float) -> None:
        """UNITS —— 每工程单位对应的脉冲数。改变后所有距离/速度按新当量解释。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetUnits",
            self._dll.ZAux_Direct_SetUnits, 轴号, float(units)))

    async def 设置轴类型(self, 轴号: int, atype: int) -> None:
        """ATYPE —— 轴类型。1=方向脉冲(CW/CCW)，4=正交编码器，65=EtherCAT 等。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetAtype",
            self._dll.ZAux_Direct_SetAtype, 轴号, int(atype)))

    async def 设置使能(self, 轴号: int, 使能: bool) -> None:
        """AXISENABLE —— 仅对 EtherCAT 总线轴有效；脉冲方向轴此函数无效。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetAxisEnable",
            self._dll.ZAux_Direct_SetAxisEnable, 轴号, 1 if 使能 else 0))

    async def 设置正软限位(self, 轴号: int, 限位: float) -> None:
        """FS_LIMIT —— 正向软限位。设置极大值（如 1e9）视为禁用。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetFsLimit",
            self._dll.ZAux_Direct_SetFsLimit, 轴号, float(限位)))

    async def 设置负软限位(self, 轴号: int, 限位: float) -> None:
        """RS_LIMIT —— 负向软限位。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetRsLimit",
            self._dll.ZAux_Direct_SetRsLimit, 轴号, float(限位)))

    async def 设置软限位(
        self, 轴号: int, 
        正限位: Optional[float] = None, 
        负限位: Optional[float] = None,
    ) -> None:
        """便捷封装：一次同时设置正/负软限位（任意一个传 None 则不修改）。

        对应 drivers/zmotion_driver.set_axis_limit(axis, fs_limit, rs_limit)。
        """
        if 正限位 is not None:
            await self.设置正软限位(轴号, float(正限位))
        if 负限位 is not None:
            await self.设置负软限位(轴号, float(负限位))

    async def 设置参数(self, 参数名: str, 轴号: int, 值: float) -> None:
        """通用 SetParam —— 兜底任意 BAS 轴参数（如 CREEP/JOGSPEED 等），区分大小写。"""
        参数名_去空白 = 参数名.strip()
        if not 参数名_去空白:
            raise ValueError("参数名不能为空")

        def _():
            with self._锁:
                ret = self._dll.ZAux_Direct_SetParam(参数名_去空白, 轴号, float(值))
            if int(ret) != 0:
                self._记录错误("ZAux_Direct_SetParam", int(ret), f"{参数名_去空白} axis={轴号}")
                raise ZMCError(
                    "ZAux_Direct_SetParam", int(ret),
                    f"{参数名_去空白} axis={轴号} value={值}",
                )
        await self._执行(_)

    async def 读_参数(self, 参数名: str, 轴号: int) -> float:
        """通用 GetParam —— 读取任意 BAS 轴参数。"""
        参数名_去空白 = 参数名.strip()
        if not 参数名_去空白:
            raise ValueError("参数名不能为空")

        def _() -> float:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetParam(参数名_去空白, 轴号)
            if int(ret) != 0:
                self._记录错误("ZAux_Direct_GetParam", int(ret), f"{参数名_去空白} axis={轴号}")
                raise ZMCError("ZAux_Direct_GetParam", int(ret), f"{参数名_去空白} axis={轴号}")
            return float(value.value)

        return await self._执行(_)

    # ==================================================================
    # 拐角 / 连续轨迹合并参数（对应 motion_config.axis.merge_params）
    # ==================================================================

    async def 设置合并(self, 轴号: int, 启用: bool) -> None:
        """开/关 MERGE：开启后相邻 Move 指令缓冲连续执行（不停顿过渡）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetMerge",
            self._dll.ZAux_Direct_SetMerge, 轴号, 1 if 启用 else 0))

    async def 设置拐角模式(self, 轴号: int, 模式: int) -> None:
        """CORNERMODE —— 拐角处理位标志（参考正运动手册）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetCornerMode",
            self._dll.ZAux_Direct_SetCornerMode, 轴号, int(模式)))

    async def 设置减速拐角阈值(self, 轴号: int, 弧度: float) -> None:
        """DECEL_ANGLE —— 拐角达到该角度开始减速（弧度）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetDecelAngle",
            self._dll.ZAux_Direct_SetDecelAngle, 轴号, float(弧度)))

    async def 设置停止拐角阈值(self, 轴号: int, 弧度: float) -> None:
        """STOP_ANGLE —— 拐角超过该角度强制停止（弧度）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetStopAngle",
            self._dll.ZAux_Direct_SetStopAngle, 轴号, float(弧度)))

    async def 设置拐角圆滑半径(self, 轴号: int, 半径: float) -> None:
        """ZSMOOTH —— 拐角圆滑半径。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetZsmooth",
            self._dll.ZAux_Direct_SetZsmooth, 轴号, float(半径)))

    # ==================================================================
    # 反向间隙补偿（对应 drivers/zmotion_driver.设置控制器反向间隙参数）
    # ==================================================================

    async def 设置反向间隙(
        self,
        轴号: int,
        启用: bool,
        距离_脉冲: float,
        速度: Optional[float] = None,
        加速度: Optional[float] = None,
    ) -> None:
        """通过 ZAux_Execute("BACKLASH(...) AXIS(n)") 启用/关闭反向间隙补偿。

        参数：
          距离_脉冲   反向间隙距离（脉冲数）。内部按老逻辑除以 1000 转 mm，
                     对应 BACKLASH 第 2 参数。
          速度       补偿运动速度（None 时用默认 50）
          加速度     补偿运动加速度（None 时用默认 100）
        """
        距离_mm = float(距离_脉冲) / 1000.0
        启用值 = 1 if 启用 else 0
        if 启用 and 速度 is not None and 加速度 is not None:
            命令 = f"BACKLASH({启用值},{距离_mm},{float(速度)},{float(加速度)}) AXIS({轴号})"
        elif 启用:
            命令 = f"BACKLASH({启用值},{距离_mm},50,100) AXIS({轴号})"
        else:
            命令 = f"BACKLASH({启用值}) AXIS({轴号})"
        await self.执行命令(命令)

    # ==================================================================
    # 轴错误清除 / 位置清零
    # ==================================================================

    async def 清除轴错误(self, 轴号: int) -> None:
        """对应 drivers ZMotionDriver.clear_axis_error —— 取消当前+缓冲。"""
        await self.单轴停止(轴号, 取消_全部)

    async def 轴位置清零(self, 轴号: int) -> None:
        """同时把 DPOS 与 MPOS 设为 0。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetDpos",
            self._dll.ZAux_Direct_SetDpos, 轴号, 0.0))
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetMpos",
            self._dll.ZAux_Direct_SetMpos, 轴号, 0.0))

    # ==================================================================
    # 批量轴参数（重新下发）
    # ==================================================================

    async def 写入轴参数(
        self,
        轴号: int,
        *,
        speed: Optional[float] = None,
        lspeed: Optional[float] = None,
        accel: Optional[float] = None,
        decel: Optional[float] = None,
        sramp: Optional[float] = None,
        units: Optional[float] = None,
        atype: Optional[int] = None,
        merge: Optional[int] = None,
        fwd_in: Optional[int] = None,
        rev_in: Optional[int] = None,
        正软限位: Optional[float] = None,
        负软限位: Optional[float] = None,
        使能: Optional[bool] = None,
    ) -> None:
        """选择性下发某轴的多个参数 —— 仅传非 None 的字段在同一把 IO 任务里串行写入。

        对应 drivers/zmotion_driver.set_all_axes_params 的单轴版。
        """
        待写入: List[tuple[str, Callable, tuple]] = []
        if atype is not None:
            待写入.append(("ZAux_Direct_SetAtype",
                          self._dll.ZAux_Direct_SetAtype, (轴号, int(atype))))
        if units is not None:
            待写入.append(("ZAux_Direct_SetUnits",
                          self._dll.ZAux_Direct_SetUnits, (轴号, float(units))))
        if speed is not None:
            待写入.append(("ZAux_Direct_SetSpeed",
                          self._dll.ZAux_Direct_SetSpeed, (轴号, float(speed))))
        if lspeed is not None:
            待写入.append(("ZAux_Direct_SetLspeed",
                          self._dll.ZAux_Direct_SetLspeed, (轴号, float(lspeed))))
        if accel is not None:
            待写入.append(("ZAux_Direct_SetAccel",
                          self._dll.ZAux_Direct_SetAccel, (轴号, float(accel))))
        if decel is not None:
            待写入.append(("ZAux_Direct_SetDecel",
                          self._dll.ZAux_Direct_SetDecel, (轴号, float(decel))))
        if sramp is not None:
            待写入.append(("ZAux_Direct_SetSramp",
                          self._dll.ZAux_Direct_SetSramp, (轴号, float(sramp))))
        if merge is not None:
            待写入.append(("ZAux_Direct_SetMerge",
                          self._dll.ZAux_Direct_SetMerge, (轴号, int(merge))))
        if fwd_in is not None and int(fwd_in) >= 0:
            待写入.append(("ZAux_Direct_SetFwdIn",
                          self._dll.ZAux_Direct_SetFwdIn, (轴号, int(fwd_in))))
        if rev_in is not None and int(rev_in) >= 0:
            待写入.append(("ZAux_Direct_SetRevIn",
                          self._dll.ZAux_Direct_SetRevIn, (轴号, int(rev_in))))
        if 正软限位 is not None:
            待写入.append(("ZAux_Direct_SetFsLimit",
                          self._dll.ZAux_Direct_SetFsLimit, (轴号, float(正软限位))))
        if 负软限位 is not None:
            待写入.append(("ZAux_Direct_SetRsLimit",
                          self._dll.ZAux_Direct_SetRsLimit, (轴号, float(负软限位))))
        if 使能 is not None:
            待写入.append(("ZAux_Direct_SetAxisEnable",
                          self._dll.ZAux_Direct_SetAxisEnable,
                          (轴号, 1 if 使能 else 0)))

        if not 待写入:
            return

        def _():
            with self._锁:
                for 名, 函数, 参数 in 待写入:
                    ret = 函数(*参数)
                    if int(ret) != 0:
                        self._记录错误(名, int(ret), f"axis={轴号}")
                        raise ZMCError(名, int(ret), f"axis={轴号}")
        await self._执行(_)

        # 下发成功后同步内存配置，保证 读全部轴状态 返回实际值
        轴名 = self._配置.axis_no_to_name.get(轴号)
        if 轴名 is not None:
            cfg = self._配置.axes[轴名]
            if units is not None: cfg.units = units
            if speed is not None: cfg.speed = speed
            if lspeed is not None: cfg.lspeed = lspeed
            if accel is not None: cfg.accel = accel
            if decel is not None: cfg.decel = decel
            if sramp is not None: cfg.sramp = sramp
            if atype is not None: cfg.axis_type = atype
            if merge is not None: cfg.merge = merge
            if fwd_in is not None and int(fwd_in) >= 0: cfg.fwd_in = fwd_in
            if rev_in is not None and int(rev_in) >= 0: cfg.rev_in = rev_in
            # 同步静态缓存（读全部轴状态优先取缓存值）
            cache = self._静态字段缓存.get(轴号, {})
            if atype is not None: cache["axis_type"] = atype
            if merge is not None: cache["merge"] = merge
            if fwd_in is not None and int(fwd_in) >= 0: cache["fwd_in"] = fwd_in
            if rev_in is not None and int(rev_in) >= 0: cache["rev_in"] = rev_in

    async def 批量设置轴参数(self, 参数表: Dict[int, Dict[str, Any]]) -> None:
        """对应 drivers/zmotion_driver.set_all_axes_params 多轴一次性下发。

        参数表: {轴号: {字段名: 值}}，字段名见 写入轴参数 的 kwargs 列表。
        任一字段失败抛 ZMCError，已写入的字段不回滚（DLL 限制）。
        """
        for 轴号, 字段们 in 参数表.items():
            if not 字段们:
                continue
            await self.写入轴参数(int(轴号), **字段们)

    async def 重新下发所有轴(self) -> None:
        """重新把当前 motion_config 的所有轴参数下发到控制器（热更新场景）。"""
        await self._执行(self._同步_初始化所有轴)

    # ==================================================================
    # IO 输入 / 输出
    # ==================================================================

    async def 设置输出(self, io号: int, 值: bool) -> None:
        """对应 drivers ZMotionDriver.set_output / core 适配器 open_output。"""
        if int(io号) < 0:
            raise ValueError(f"io号必须 >= 0，收到 {io号}")
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetOp",
            self._dll.ZAux_Direct_SetOp, int(io号), 1 if 值 else 0))

    async def 读_输出(self, io号: int) -> bool:
        """对应 drivers ZMotionDriver.get_output。"""
        def _() -> bool:
            with self._锁:
                ret, val = self._dll.ZAux_Direct_GetOp(int(io号))
            if int(ret) != 0:
                self._记录错误("ZAux_Direct_GetOp", int(ret), f"io={io号}")
                raise ZMCError("ZAux_Direct_GetOp", int(ret), f"io={io号}")
            return int(val.value) != 0
        return await self._执行(_)

    async def 读_输入(self, io号: int) -> bool:
        """对应 drivers ZMotionDriver.get_input。"""
        def _() -> bool:
            with self._锁:
                ret, val = self._dll.ZAux_Direct_GetIn(int(io号))
            if int(ret) != 0:
                self._记录错误("ZAux_Direct_GetIn", int(ret), f"io={io号}")
                raise ZMCError("ZAux_Direct_GetIn", int(ret), f"io={io号}")
            return int(val.value) != 0
        return await self._执行(_)

    async def 批量读_输出(self, io起: int = 0, io止: int = 8) -> Dict[int, bool]:
        """对应 drivers ZMotionDriver.get_outputs_status。"""
        io起, io止 = self._规整范围(io起, io止)

        def _() -> Dict[int, bool]:
            结果: Dict[int, bool] = {}
            with self._锁:
                for io in range(io起, io止 + 1):
                    ret, val = self._dll.ZAux_Direct_GetOp(io)
                    if int(ret) == 0:
                        结果[io] = int(val.value) != 0
                    else:
                        结果[io] = False
            return 结果
        return await self._执行(_)

    async def 批量读_输入(self, io起: int = 0, io止: int = 8) -> Dict[int, bool]:
        """对应 drivers ZMotionDriver.get_inputs_status。"""
        io起, io止 = self._规整范围(io起, io止)

        def _() -> Dict[int, bool]:
            结果: Dict[int, bool] = {}
            with self._锁:
                for io in range(io起, io止 + 1):
                    ret, val = self._dll.ZAux_Direct_GetIn(io)
                    if int(ret) == 0:
                        结果[io] = int(val.value) != 0
                    else:
                        结果[io] = False
            return 结果
        return await self._执行(_)

    @staticmethod
    def _规整范围(起: int, 止: int) -> tuple[int, int]:
        起, 止 = int(起), int(止)
        return (起, 止) if 起 <= 止 else (止, 起)

    # ==================================================================
    # 单轴运动
    # ==================================================================

    async def 单轴绝对(self, 轴号: int, 位置: float) -> None:
        """对应 drivers ZMotionDriver.move_abs。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_Single_MoveAbs",
            self._dll.ZAux_Direct_Single_MoveAbs, int(轴号), float(位置)))

    async def 单轴相对(self, 轴号: int, 距离: float) -> None:
        """对应 drivers ZMotionDriver.move_rel。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_Single_Move",
            self._dll.ZAux_Direct_Single_Move, int(轴号), float(距离)))

    async def 单轴连续(self, 轴号: int, 方向: int) -> None:
        """JOG —— 方向 +1 / -1。"""
        if 方向 not in (-1, 1):
            raise ValueError(f"非法 JOG 方向: {方向}（应为 +1 或 -1）")
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_Single_Vmove",
            self._dll.ZAux_Direct_Single_Vmove, int(轴号), int(方向)))

    async def 单轴回零(self, 轴号: int, 模式: int = 0) -> None:
        """ZAux_Direct_Single_Datum —— 模式 0-6（+10 = 限位倒序找原点变体）。

          0  仅复位 DPOS=0，不运动
          1  正向 CREEP 直到 Z 信号 → DPOS=0
          2  反向 CREEP 直到 Z 信号 → DPOS=0
          3  正向 SPEED 找原点开关，反向 CREEP 离开
          4  反向 SPEED 找原点开关，正向 CREEP 离开
          5  正向先找原点再找 Z 信号
          6  反向先找原点再找 Z 信号
        """
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_Single_Datum",
            self._dll.ZAux_Direct_Single_Datum, int(轴号), int(模式)))

    async def 单轴停止(self, 轴号: int, 模式: int = 取消_全部) -> None:
        """对应 drivers ZMotionDriver.emergency_stop_axis（默认 mode=2）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_Single_Cancel",
            self._dll.ZAux_Direct_Single_Cancel, int(轴号), int(模式)))

    # ==================================================================
    # 多轴插补 —— 直线
    # ==================================================================

    async def 多轴绝对直线(self, 轴号列表: Sequence[int], 位置列表: Sequence[float]) -> None:
        """ZAux_Direct_MoveAbs —— 多轴直线绝对插补。"""
        n = self._校验插补长度(轴号列表, 位置列表)
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_MoveAbs",
            self._dll.ZAux_Direct_MoveAbs, n, list(轴号列表), list(位置列表)))

    async def 多轴相对直线(self, 轴号列表: Sequence[int], 距离列表: Sequence[float]) -> None:
        """ZAux_Direct_MoveSp —— 多轴直线相对插补。"""
        n = self._校验插补长度(轴号列表, 距离列表)
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_MoveSp",
            self._dll.ZAux_Direct_MoveSp, n, list(轴号列表), list(距离列表)))

    @staticmethod
    def _校验插补长度(轴号列表: Sequence[int], 数值列表: Sequence[float]) -> int:
        n = len(轴号列表)
        if n != len(数值列表):
            raise ValueError(f"轴号与数值长度不一致: {n} vs {len(数值列表)}")
        if n == 0:
            raise ValueError("插补轴列表不能为空")
        return n

    # ==================================================================
    # 多轴插补 —— 圆弧 / 螺旋
    # ==================================================================

    async def 圆心圆弧(
        self,
        轴号列表: Sequence[int],
        终点1: float, 终点2: float,
        圆心1: float, 圆心2: float,
        方向: int = 圆弧_逆时针,
        绝对: bool = True,
    ) -> None:
        """圆心定 2 点圆弧（圆心坐标始终相对起始点）。"""
        n = len(轴号列表)
        if n < 2:
            raise ValueError("圆弧插补至少需要 2 个轴")
        if 方向 not in (圆弧_逆时针, 圆弧_顺时针):
            raise ValueError(f"非法圆弧方向: {方向}")
        if 绝对:
            await self._执行(lambda: self._锁定调用(
                "ZAux_Direct_MoveCircAbs",
                self._dll.ZAux_Direct_MoveCircAbs, n, list(轴号列表),
                float(终点1), float(终点2), float(圆心1), float(圆心2), int(方向)))
        else:
            await self._执行(lambda: self._锁定调用(
                "ZAux_Direct_MoveCirc",
                self._dll.ZAux_Direct_MoveCirc, n, list(轴号列表),
                float(终点1), float(终点2), float(圆心1), float(圆心2), int(方向)))

    async def 三点圆弧(
        self,
        轴号列表: Sequence[int],
        中点1: float, 中点2: float,
        终点1: float, 终点2: float,
        绝对: bool = True,
    ) -> None:
        """三点圆弧 —— 起点 + 中间点 + 终点。"""
        n = len(轴号列表)
        if n < 2:
            raise ValueError("圆弧插补至少需要 2 个轴")
        if 绝对:
            await self._执行(lambda: self._锁定调用(
                "ZAux_Direct_MoveCirc2Abs",
                self._dll.ZAux_Direct_MoveCirc2Abs, n, list(轴号列表),
                float(中点1), float(中点2), float(终点1), float(终点2)))
        else:
            await self._执行(lambda: self._锁定调用(
                "ZAux_Direct_MoveCirc2",
                self._dll.ZAux_Direct_MoveCirc2, n, list(轴号列表),
                float(中点1), float(中点2), float(终点1), float(终点2)))

    async def 螺旋(
        self,
        轴号列表: Sequence[int],
        圆心1: float, 圆心2: float,
        圈数: int, 螺距: float,
        第三轴距离: float = 0.0,
        第四轴距离: float = 0.0,
    ) -> None:
        """ZAux_Direct_MoveSpiral —— 螺旋插补，相对运动。

        n=3 时只用 第三轴距离；n=4 时同时使用 第三轴/第四轴距离。
        """
        n = len(轴号列表)
        if n < 3:
            raise ValueError("螺旋插补至少需要 3 个轴")
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_MoveSpiral",
            self._dll.ZAux_Direct_MoveSpiral, n, list(轴号列表),
            float(圆心1), float(圆心2), int(圈数), float(螺距),
            float(第三轴距离), float(第四轴距离)))

    # ==================================================================
    # 五轴加工
    # ==================================================================

    async def 五轴联动直线(
        self,
        位置列表: Sequence[float],
        轴号列表: Optional[Sequence[int]] = None,
        速度: Optional[float] = None,
        相对: bool = False,
    ) -> None:
        """五轴联动直线插补 —— X/Y/Z/U/R 同时插补到目标位置。

        参数：
          位置列表    长度 = 5 的浮点列表（绝对或相对，由 相对 参数决定）
          轴号列表    默认 [0,1,2,3,4]；若控制器轴映射不同可显式传入
          速度        合成速度（None 表示沿用各轴当前 SPEED）
          相对        True=相对位移，False=绝对位置（默认）

        典型场景：CAM 后处理输出的 5 轴 G 代码逐段下发；ZMC 内部对各轴速度做矢量
        分配，保证合成速度恒定（前提：ATYPE 与 UNITS 已正确配置）。
        """
        轴号列表 = list(轴号列表) if 轴号列表 is not None else [轴_X, 轴_Y, 轴_Z, 轴_U, 轴_R]
        if len(位置列表) != 5 or len(轴号列表) != 5:
            raise ValueError("五轴联动需要 5 个轴 + 5 个目标位置")

        # 速度作为合成速度下发到第一个参与轴（ZMC 多轴插补使用首轴 SPEED）
        if 速度 is not None:
            await self.设置速度(轴号列表[0], float(速度))

        if 相对:
            await self.多轴相对直线(轴号列表, list(位置列表))
        else:
            await self.多轴绝对直线(轴号列表, list(位置列表))

    async def 三加二定向加工(
        self,
        u角度: float,
        r角度: float,
        xyz路径: Sequence[Sequence[float]],
        定位速度: Optional[float] = None,
        加工速度: Optional[float] = None,
        定位等待超时秒: float = 30.0,
        相对xyz: bool = False,
    ) -> None:
        """3+2 定向加工 —— 先把 U/R 定位锁定，再做 XYZ 三轴联动。

        流程：
          1. U/R 绝对定位到指定角度（独立单轴绝对）
          2. 等待 U/R 静止（最长 定位等待超时秒）
          3. 沿 xyz路径 逐段做 3 轴联动直线（绝对或相对，由 相对xyz 决定）

        参数：
          u角度       U 轴目标绝对角度（工程单位，下发前请确认 UNITS 与减速比）
          r角度       R 轴目标绝对角度
          xyz路径     列表的列表，每个元素 [x, y, z]
          定位速度    U/R 定位运动速度（None=沿用当前 SPEED）
          加工速度    XYZ 联动合成速度（None=沿用当前 SPEED）
          相对xyz     True=路径点为相对位移；False=绝对坐标（默认）

        异常：
          ZMCError    DLL 调用失败 / 定位超时未静止
        """
        if not xyz路径:
            raise ValueError("xyz路径不能为空")
        for idx, 点 in enumerate(xyz路径):
            if len(点) != 3:
                raise ValueError(f"xyz路径[{idx}] 必须是 [x, y, z] 三元素")

        # ---- 1. U/R 定位 ----
        if 定位速度 is not None:
            await self.设置速度(轴_U, float(定位速度))
            await self.设置速度(轴_R, float(定位速度))
        await self.单轴绝对(轴_U, float(u角度))
        await self.单轴绝对(轴_R, float(r角度))

        # ---- 2. 等待 U/R 静止 ----
        await self._异步_等待静止(轴_U, 超时秒=定位等待超时秒)
        await self._异步_等待静止(轴_R, 超时秒=定位等待超时秒)

        # ---- 3. XYZ 三轴联动 ----
        xyz轴号 = [轴_X, 轴_Y, 轴_Z]
        if 加工速度 is not None:
            await self.设置速度(轴_X, float(加工速度))

        for 点 in xyz路径:
            if 相对xyz:
                await self.多轴相对直线(xyz轴号, [float(v) for v in 点])
            else:
                await self.多轴绝对直线(xyz轴号, [float(v) for v in 点])

    # ==================================================================
    # 多轴/全部停止 + 急停
    # ==================================================================

    async def 多轴停止(
        self, 轴号列表: Optional[Sequence[int]] = None, 模式: int = 取消_全部,
    ) -> None:
        """对应 drivers ZMotionDriver.emergency_stop_all_axes / core stop_axis_motion。

        轴号列表=None 时停止配置中所有轴。
        立即/全部停止时先广播中止事件,让正在跑的连续插补循环立刻退出 worker。
        """
        # 立即/全部 取消 → 先广播,让连续插补循环立即看到并自停
        if int(模式) in (取消_全部, 取消_立即):
            self._中止事件.set()
        if 轴号列表 is None:
            轴号列表 = [cfg.axis_no for cfg in self._配置.axes.values()]
        n = len(轴号列表)
        if n == 0:
            return
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_CancelAxisList",
            self._dll.ZAux_Direct_CancelAxisList, n, list(轴号列表), int(模式)))

    async def 全部停止(self, 模式: int = 取消_全部) -> None:
        """配置中全部轴减速停止。"""
        await self.多轴停止(None, 模式)

    async def 急停(self) -> None:
        """硬急停 —— 立即中断脉冲，跳过减速。

        关键设计:先广播中止事件(同步,瞬时),让连续插补循环立即 break 并自停;
        然后再走 IO worker 调 DLL Cancel(此时 worker 已空闲)。
        """
        日志.info("[急停] 广播中止事件 + 调用 CancelAxisList(立即)")
        self._中止事件.set()
        await self.多轴停止(None, 取消_立即)

    # ==================================================================
    # 进给倍率 —— 纯 Direct API 模式下的"软暂停 / 继续"
    # ==================================================================
    # ZAux_Pause / ZAux_Resume 仅对控制器中运行的 BAS 工程生效，纯 Direct API
    # （无 BAS 工程）下无效。ZMC 推荐用 FEED_OVERRIDE 实现 Direct 模式的软暂停：
    #   FEED_OVERRIDE = 0   → 平滑减速到停（暂停）
    #   FEED_OVERRIDE = 100 → 恢复全速（继续）

    async def 设置进给倍率(self, 倍率: float) -> None:
        """设置控制器全局 FEED_OVERRIDE（0–200）。"""
        def _():
            with self._锁:
                ret, _resp = self._dll.ZAux_Execute(f"FEED_OVERRIDE = {float(倍率)}")
            if int(ret) != 0:
                self._记录错误("ZAux_Execute(FEED_OVERRIDE=)", int(ret), f"value={倍率}")
                raise ZMCError("ZAux_Execute(FEED_OVERRIDE=)", int(ret), f"value={倍率}")
        await self._执行(_)

    async def 读_进给倍率(self) -> float:
        """读取当前 FEED_OVERRIDE。"""
        def _() -> float:
            with self._锁:
                ret, resp = self._dll.ZAux_Execute("?FEED_OVERRIDE")
            if int(ret) != 0:
                self._记录错误("ZAux_Execute(?FEED_OVERRIDE)", int(ret))
                raise ZMCError("ZAux_Execute(?FEED_OVERRIDE)", int(ret))
            try:
                return float(str(resp).strip())
            except (TypeError, ValueError) as exc:
                raise ZMCError(
                    "ZAux_Execute(?FEED_OVERRIDE)", -1, f"无法解析: {resp!r}",
                ) from exc
        return await self._执行(_)

    # ==================================================================
    # 状态读取
    # ==================================================================

    async def 读_dpos(self, 轴号: int) -> float:
        def _() -> float:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetDpos(int(轴号))
            if int(ret) != 0:
                self._记录错误("ZAux_Direct_GetDpos", int(ret), f"axis={轴号}")
                raise ZMCError("ZAux_Direct_GetDpos", int(ret), f"axis={轴号}")
            return float(value.value)
        return await self._执行(_)

    async def 读_mpos(self, 轴号: int) -> float:
        def _() -> float:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetMpos(int(轴号))
            if int(ret) != 0:
                self._记录错误("ZAux_Direct_GetMpos", int(ret), f"axis={轴号}")
                raise ZMCError("ZAux_Direct_GetMpos", int(ret), f"axis={轴号}")
            return float(value.value)
        return await self._执行(_)

    async def 读_idle(self, 轴号: int) -> bool:
        """ZMC 约定：-1=停止 / 0=运动中。本方法归一化为 bool（True=空闲）。"""
        def _() -> bool:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetIfIdle(int(轴号))
            if int(ret) != 0:
                self._记录错误("ZAux_Direct_GetIfIdle", int(ret), f"axis={轴号}")
                raise ZMCError("ZAux_Direct_GetIfIdle", int(ret), f"axis={轴号}")
            return int(value.value) == -1
        return await self._执行(_)

    async def 读_轴状态(self, 轴号: int) -> int:
        """ZAux_Direct_GetAxisStatus —— 位标志：报警 / 限位 / 使能 等。"""
        def _() -> int:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetAxisStatus(int(轴号))
            if int(ret) != 0:
                self._记录错误("ZAux_Direct_GetAxisStatus", int(ret), f"axis={轴号}")
                raise ZMCError("ZAux_Direct_GetAxisStatus", int(ret), f"axis={轴号}")
            return int(value.value)
        return await self._执行(_)

    async def 读_停止原因(self, 轴号: int) -> int:
        """ZAux_Direct_GetAxisStopReason —— 停止/取消原因位标志。"""
        def _() -> int:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetAxisStopReason(int(轴号))
            if int(ret) != 0:
                self._记录错误("ZAux_Direct_GetAxisStopReason", int(ret), f"axis={轴号}")
                raise ZMCError("ZAux_Direct_GetAxisStopReason", int(ret), f"axis={轴号}")
            return int(value.value)
        return await self._执行(_)

    async def 读_缓冲剩余(self, 轴号: int) -> int:
        """ZAux_Direct_GetRemain_LineBuffer —— 直线缓冲剩余条数（用于连续插补流控）。"""
        def _() -> int:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetRemain_LineBuffer(int(轴号))
            if int(ret) != 0:
                # 缓冲剩余读失败时返回 4096（默认满），避免业务卡死
                return 4096
            return int(value.value)
        return await self._执行(_)

    def _同步_批量读取(self) -> List[轴读数]:
        """同步版批量读取 —— 由 status_monitor 线程直接调用。

        与 IO 线程串行：双方共享同一把 RLock。
        单轴读取失败时记日志并跳过，不抛异常 —— 采集线程必须保持运行。
        """
        结果: List[轴读数] = []
        with self._锁:
            if not self._已连接:
                return []
            for cfg in self._配置.axes.values():
                rd, dpos = self._dll.ZAux_Direct_GetDpos(cfg.axis_no)
                rm, mpos = self._dll.ZAux_Direct_GetMpos(cfg.axis_no)
                ri, idle = self._dll.ZAux_Direct_GetIfIdle(cfg.axis_no)
                if int(rd) != 0 or int(rm) != 0 or int(ri) != 0:
                    日志.warning(
                        f"批量读取轴 {cfg.axis_name}#{cfg.axis_no} 异常: "
                        f"dpos={int(rd)} mpos={int(rm)} idle={int(ri)}"
                    )
                    continue
                结果.append(轴读数(
                    轴号=cfg.axis_no,
                    指令位置=float(dpos.value),
                    实际位置=float(mpos.value),
                    空闲=(int(idle.value) == -1),
                ))
        return 结果

    def _同步_批量读IO(self) -> tuple[Dict[int, bool], Dict[int, bool]]:
        """同步版批量读 IO —— 由 status_monitor 线程直接调用。

        与 IO 线程串行：共享同一把 RLock。单点读取失败时该点记为 False 不抛异常。
        返回 (io_in, io_out) 字典。
        """
        入: Dict[int, bool] = {}
        出: Dict[int, bool] = {}
        with self._锁:
            if not self._已连接:
                return {}, {}
            for io in range(self._配置.io_count):
                ret_in, val_in = self._dll.ZAux_Direct_GetIn(io)
                入[io] = int(val_in.value) != 0 if int(ret_in) == 0 else False
                ret_out, val_out = self._dll.ZAux_Direct_GetOp(io)
                出[io] = int(val_out.value) != 0 if int(ret_out) == 0 else False
        return 入, 出

    async def 批量读取(self) -> List[轴读数]:
        """异步版批量读取 —— 一次性读所有配置轴的 DPOS/MPOS/IDLE。"""
        return await self._执行(self._同步_批量读取)

    async def 读全部轴状态(self) -> Dict[str, Dict[str, Any]]:
        """对应 drivers ZMotionDriver.get_axes_status —— 返回完整轴状态 dict。

        结构（与 5 轴前端契约保持一致）：
          { "0": {axis_no, idle, dpos, mpos, units, speed, ..., axis_status,
                  fs_limit, rs_limit, atype, merge, fwd_in, rev_in, ...}, "1": {...}, ... }
        """
        def _() -> Dict[str, Dict[str, Any]]:
            状态: Dict[str, Dict[str, Any]] = {}
            with self._锁:
                for cfg in self._配置.axes.values():
                    静态 = self._静态字段缓存.get(cfg.axis_no, {})
                    项: Dict[str, Any] = {
                        "axis_no": cfg.axis_no,
                        "name": cfg.axis_name,
                        "units": float(cfg.units),
                        "speed": float(cfg.speed),
                        "lspeed": float(cfg.lspeed),
                        "accel": float(cfg.accel),
                        "decel": float(cfg.decel),
                        "sramp": float(cfg.sramp),
                        "axis_type": 静态.get("axis_type", cfg.axis_type),
                        "atype": 静态.get("axis_type", cfg.axis_type),
                        "merge": 静态.get("merge", cfg.merge),
                        "fwd_in": 静态.get("fwd_in", cfg.fwd_in),
                        "rev_in": 静态.get("rev_in", cfg.rev_in),
                        "corner_mode": 静态.get("corner_mode", cfg.merge_params.corner_mode),
                        "decel_angle": 静态.get("decel_angle", cfg.merge_params.decel_angle),
                        "stop_angle": 静态.get("stop_angle", cfg.merge_params.stop_angle),
                        "zsmooth": 静态.get("zsmooth", cfg.merge_params.zxmooth),
                        "zxmooth": 静态.get("zsmooth", cfg.merge_params.zxmooth),
                    }
                    项["dpos"] = self._读_float("ZAux_Direct_GetDpos", cfg.axis_no, 默认=0.0)
                    项["mpos"] = self._读_float("ZAux_Direct_GetMpos", cfg.axis_no, 默认=0.0)
                    项["endmove"] = 项["mpos"]
                    项["axis_status"] = self._读_int("ZAux_Direct_GetAxisStatus", cfg.axis_no, 默认=0)
                    项["fs_limit"] = self._读_int("ZAux_Direct_GetFsLimit", cfg.axis_no, 默认=0)
                    项["rs_limit"] = self._读_int("ZAux_Direct_GetRsLimit", cfg.axis_no, 默认=0)
                    项["idle"] = self._读_int("ZAux_Direct_GetIfIdle", cfg.axis_no, 默认=0)
                    for 字段, 方法 in self._动态int字段.items():
                        项[字段] = self._读_int(方法, cfg.axis_no, 默认=0)
                    for 字段, 方法 in self._动态float字段.items():
                        项[字段] = self._读_float(方法, cfg.axis_no, 默认=0.0)
                    项["error"] = None
                    状态[str(cfg.axis_no)] = 项
            return 状态
        return await self._执行(_)

    # ==================================================================
    # 透传：在线命令
    # ==================================================================

    async def 执行命令(self, 命令: str) -> str:
        """ZAux_Execute —— 任意 BAS 表达式。返回控制器响应字符串。

        对应 drivers ZMotionDriver.控制器执行缓存在线命令。
        """
        cmd = str(命令).strip()
        if not cmd:
            raise ValueError("在线命令不能为空")

        def _() -> str:
            with self._锁:
                ret, resp = self._dll.ZAux_Execute(cmd)
            if int(ret) != 0:
                self._记录错误("ZAux_Execute", int(ret), f"cmd={cmd!r}")
                raise ZMCError("ZAux_Execute", int(ret), f"cmd={cmd!r}")
            return str(resp or "")
        return await self._执行(_)

    # ==================================================================
    # ==================================================================
    # 业务级便捷方法（兼容老业务代码 —— 未来可下移到 MotionService）
    # ==================================================================
    # ==================================================================

    # ------------------------------------------------------------------
    # 等待静止
    # ------------------------------------------------------------------

    async def 等待静止(
        self,
        轴号: int,
        超时秒: float = 100.0,
        轮询间隔秒: float = 0.05,
    ) -> bool:
        """等待轴 IDLE。对应 core ZMotionAdapter.get_notIsMoving(untilReturnTrue=True)。

        返回：
          True   超时前已静止
          False  超时仍未静止
        """
        return await self._异步_等待静止(轴号, 超时秒=超时秒, 轮询间隔秒=轮询间隔秒)

    async def _异步_等待静止(
        self, 轴号: int, 超时秒: float = 100.0, 轮询间隔秒: float = 0.05,
    ) -> bool:
        起始 = time.monotonic()
        while time.monotonic() - 起始 < 超时秒:
            try:
                if await self.读_idle(轴号):
                    return True
            except ZMCError:
                # 读取异常时不退出，继续等待重试
                pass
            await asyncio.sleep(轮询间隔秒)
        return False

    # ------------------------------------------------------------------
    # XY / Z 当前位置（业务专用 —— 5 轴硬件下的 X=0, Y=1, Z=2）
    # ------------------------------------------------------------------

    async def 取_xy_实际位置(self) -> tuple[float, float]:
        """对应 core ZMotionAdapter.get_xy_dpos_mm（注：原方法名 get_xy_dpos_mm
        但实际取的是 mpos —— 这里沿用原语义读 mpos）。"""
        x = await self.读_mpos(轴_X)
        y = await self.读_mpos(轴_Y)
        return x, y

    async def 取_z_实际位置(self) -> float:
        """对应 core ZMotionAdapter.get_z_mpos_mm。"""
        return await self.读_mpos(轴_Z)

    # ------------------------------------------------------------------
    # 单轴绝对带速度（先设速度再 move_abs，结束恢复原速度）
    # ------------------------------------------------------------------

    async def 绝对运动并设速度(self, 轴号: int, 位置: float, 速度: float) -> None:
        """对应 core ZMotionAdapter.absolute_move_speed。

        临时设置速度 → 单轴绝对运动 → 无论成败都恢复原速度。
        """
        try:
            原速度 = await self.读_参数("SPEED", 轴号)
        except ZMCError:
            原速度 = float(取轴(self._配置.axis_no_to_name[int(轴号)]).speed)
        await self.设置速度(轴号, float(速度))
        try:
            await self.单轴绝对(轴号, float(位置))
        finally:
            try:
                await self.设置速度(轴号, float(原速度))
            except ZMCError as exc:
                日志.warning(f"恢复轴 {轴号} 速度失败: {exc}")

    # ------------------------------------------------------------------
    # U 轴角度旋转（业务级换算）
    # ------------------------------------------------------------------

    async def U轴旋转的角度参数(self, 旋转参数: Dict[str, Any]) -> Dict[str, Any]:
        """对应 core ZMotionAdapter.U轴旋转的角度，参数 dict 含：
          旋转角度        必填，浮点
          旋转速度        必填，> 0
          每圈脉冲数      默认 10000
          电子齿轮比      默认 1.0
          减速比          默认 1.0
          角度下限/上限   可选限位
          旋转方向        "顺时针"/"逆时针"/"CW"/"CCW"/"+1"/"-1"
          运动模式        "relative"/"absolute"

        返回 dict（保留原 success/data/message 风格，兼容业务调用）。
        """
        if not isinstance(旋转参数, dict):
            return {"success": False, "message": "旋转参数必须是对象"}
        try:
            旋转角度 = float(旋转参数.get("旋转角度", 0))
            # 旋转速度 = float(旋转参数.get("旋转速度", 1))
            每圈脉冲数 = float(旋转参数.get("每圈脉冲数", self._U轴每圈脉冲数))
            电子齿轮比 = float(旋转参数.get("电子齿轮比", self._U轴电子齿轮比))
            减速比 = float(旋转参数.get("减速比", self._U轴减速比))
            角度下限_原值 = 旋转参数.get("角度下限", -90)
            角度上限_原值 = 旋转参数.get("角度上限", 90)
            角度下限 = float(角度下限_原值) if 角度下限_原值 is not None else None
            角度上限 = float(角度上限_原值) if 角度上限_原值 is not None else None
        except (TypeError, ValueError):
            return {"success": False, "message": "旋转参数格式错误（角度/速度/脉冲数/齿轮比/减速比/限位）"}

        # if 旋转速度 <= 0:
        #     return {"success": False, "message": "旋转速度必须大于 0"}
        if 每圈脉冲数 <= 0 or 电子齿轮比 <= 0 or 减速比 <= 0:
            return {"success": False, "message": "每圈脉冲数/电子齿轮比/减速比必须大于 0"}
        if 角度下限 is not None and 角度上限 is not None and 角度下限 > 角度上限:
            return {"success": False, "message": "角度下限不能大于角度上限"}

        方向归一 = self._解析旋转方向(str(旋转参数.get("旋转方向", "顺时针")))
        if 方向归一 == 0:
            return {"success": False, "message": "旋转方向仅支持 顺时针/逆时针"}
        模式归一 = self._解析运动模式(str(旋转参数.get("运动模式", 旋转参数.get("mode", "relative"))))
        if 模式归一 is None:
            return {"success": False, "message": "运动模式仅支持 relative/absolute"}

        # 角度 → 工程位移的换算口径与历史实现保持一致
        有效每圈脉冲数 = 每圈脉冲数 * 电子齿轮比 * 减速比
        # try:
        #     await self.设置速度(轴_U, float(旋转速度))
        # except ZMCError as exc:
        #     return {"success": False, "message": f"设置 U 轴速度失败: {exc}"}

        try:
            axis_units = float((await self.读全部轴状态()).get(str(轴_U), {}).get("units", 0.0))
        except ZMCError as exc:
            return {"success": False, "message": f"读取 U 轴 units 失败: {exc}"}
        if axis_units <= 0:
            return {"success": False, "message": "U 轴 units 未配置或非法"}

        输入角度 = float(旋转角度) * float(方向归一)
        try:
            当前工程位移 = await self.读_mpos(轴_U)
        except ZMCError as exc:
            return {"success": False, "message": f"读取 U 轴 mpos 失败: {exc}"}
        当前角度 = (当前工程位移 * axis_units / 有效每圈脉冲数) * 360.0
        目标角度 = 当前角度 + 输入角度 if 模式归一 == "relative" else 输入角度
        实际目标角度 = self._clamp(目标角度, 角度下限, 角度上限)
        实际增量角度 = 实际目标角度 - 当前角度

        if abs(实际增量角度) <= 1e-9:
            return {
                "success": True,
                "message": "U 轴目标与当前位置一致，无需运动",
                "data": {
                    "axis": 轴_U, "delta": 0.0, "mode": 模式归一,
                    "current_angle": 当前角度,
                    "requested_target_angle": 目标角度,
                    "actual_target_angle": 实际目标角度,
                    "axis_units": axis_units,
                    "effective_pulses_per_rev": 有效每圈脉冲数,
                },
            }

        目标脉冲数 = (实际增量角度 / 360.0) * 有效每圈脉冲数
        旋转位移 = 目标脉冲数 / axis_units
        try:
            await self.单轴相对(轴_U, 旋转位移)
        except ZMCError as exc:
            return {"success": False, "message": f"U 轴旋转失败: {exc}"}
        return {
            "success": True,
            "data": {
                "axis": 轴_U, "delta": 旋转位移, "mode": 模式归一,
                "current_angle": 当前角度,
                "actual_increment_angle": 实际增量角度,
                "requested_target_angle": 目标角度,
                "actual_target_angle": 实际目标角度,
                "axis_units": axis_units,
                "effective_pulses_per_rev": 有效每圈脉冲数,
            },
        }

    async def U轴旋转角度(self, 旋转角度: float) -> Dict[str, Any]:
        """简化版 U 轴绝对旋转 —— 正数顺时针、负数逆时针。"""
        return await self.U轴旋转的角度参数({
            "旋转角度": abs(float(旋转角度)),
            "旋转方向": "顺时针" if float(旋转角度) >= 0 else "逆时针",
            "运动模式": "absolute",
        })

    async def U轴是否到达旋转角度(self, 旋转角度: float, 容差: float = 0.001) -> bool:
        """对应 core ZMotionAdapter.U轴是否到达旋转角度。

        判定：轴静止 + |当前 mpos - 目标工程位移| ≤ 容差。
        机械参数与 U轴旋转的角度参数() 默认值一致。
        """
        try:
            空闲 = await self.读_idle(轴_U)
        except ZMCError:
            return False
        if not 空闲:
            return False

        try:
            状态 = await self.读全部轴状态()
        except ZMCError:
            return False
        u状态 = 状态.get(str(轴_U), {})
        axis_units = float(u状态.get("units", 0.0))
        if axis_units <= 0:
            return False
        有效每圈脉冲数 = (self._U轴每圈脉冲数 * self._U轴电子齿轮比 * self._U轴减速比)
        目标工程位移 = (float(旋转角度) / 360.0) * 有效每圈脉冲数 / axis_units
        mpos = float(u状态.get("mpos", 0.0))
        return abs(mpos - 目标工程位移) <= float(容差)

    # ------------------------------------------------------------------
    # R 轴圈数旋转（业务级换算）
    # ------------------------------------------------------------------

    async def R轴旋转的圈数(self, 旋转圈数: float) -> Dict[str, Any]:
        """简化版 R 轴旋转 —— 只传圈数，不改速度，顺时针相对运动。"""
        if not isinstance(旋转圈数, (int, float)):
            return {"success": False, "message": "旋转圈数必须是数字"}
        旋转圈数 = float(旋转圈数)
        if 旋转圈数 <= 0:
            return {"success": False, "message": "旋转圈数必须大于 0"}

        每圈脉冲数 = self._R轴每圈脉冲数 * self._R轴电子齿轮比 * self._R轴减速比
        方向归一 = 1  # 顺时针
        try:
            状态 = await self.读全部轴状态()
        except ZMCError as exc:
            return {"success": False, "message": f"读取轴状态失败: {exc}"}
        r状态 = 状态.get(str(轴_R), {})
        axis_units = float(r状态.get("units", 0.0))
        if axis_units <= 0:
            return {"success": False, "message": "R 轴 units 未配置或非法"}

        每圈距离 = 每圈脉冲数 / axis_units
        输入圈数 = 旋转圈数 * 方向归一
        实际增量圈数 = 输入圈数

        旋转位移 = 实际增量圈数 * 每圈距离
        try:
            await self.单轴相对(轴_R, 旋转位移)
        except ZMCError as exc:
            return {"success": False, "message": f"R 轴旋转失败: {exc}"}
        return {
            "success": True,
            "message": f"R 轴已旋转 {旋转圈数} 圈",
        }
    
    async def R轴旋转的圈数带参数(self, 旋转参数: Dict[str, Any]) -> Dict[str, Any]:
        """对应 core ZMotionAdapter.R轴旋转的圈数。伺服电机：脉冲每圈*电子齿轮比*减速比。"""
        if not isinstance(旋转参数, dict):
            return {"success": False, "message": "旋转参数必须是对象"}
        try:
            旋转圈数 = float(旋转参数.get("旋转圈数", 0))
            旋转速度 = float(旋转参数.get("旋转速度", 0))
        except (TypeError, ValueError):
            return {"success": False, "message": "旋转圈数/旋转速度参数格式错误"}

        if 旋转圈数 < 0:
            return {"success": False, "message": "旋转圈数不能小于 0"}
        if 旋转速度 <= 0:
            return {"success": False, "message": "旋转速度必须大于 0"}

        方向归一 = self._解析旋转方向(str(旋转参数.get("旋转方向", "顺时针")))
        if 方向归一 == 0:
            return {"success": False, "message": "旋转方向仅支持 顺时针/逆时针"}
        模式归一 = self._解析运动模式(str(旋转参数.get("运动模式", 旋转参数.get("mode", "relative"))))
        if 模式归一 is None:
            return {"success": False, "message": "运动模式仅支持 relative/absolute"}

        try:
            每圈脉冲数_param = float(旋转参数.get("每圈脉冲数", self._R轴每圈脉冲数))
            电子齿轮比 = float(旋转参数.get("电子齿轮比", self._R轴电子齿轮比))
            减速比 = float(旋转参数.get("减速比", self._R轴减速比))
        except (TypeError, ValueError):
            return {"success": False, "message": "每圈脉冲数/电子齿轮比/减速比参数格式错误"}
        if 每圈脉冲数_param <= 0 or 电子齿轮比 <= 0 or 减速比 <= 0:
            return {"success": False, "message": "每圈脉冲数/电子齿轮比/减速比必须大于 0"}

        try:
            await self.设置速度(轴_R, float(旋转速度))
        except ZMCError as exc:
            return {"success": False, "message": f"设置 R 轴速度失败: {exc}"}

        每圈脉冲数 = 每圈脉冲数_param * 电子齿轮比 * 减速比
        try:
            状态 = await self.读全部轴状态()
        except ZMCError as exc:
            return {"success": False, "message": f"读取轴状态失败: {exc}"}
        r状态 = 状态.get(str(轴_R), {})
        axis_units = float(r状态.get("units", 0.0))
        if axis_units <= 0:
            return {"success": False, "message": "R 轴 units 未配置或非法"}

        每圈距离 = 每圈脉冲数 / axis_units
        输入圈数 = float(旋转圈数) * float(方向归一)
        当前工程位移 = float(r状态.get("mpos", 0.0))
        当前圈数 = 当前工程位移 / 每圈距离
        实际增量圈数 = 输入圈数 if 模式归一 == "relative" else (输入圈数 - 当前圈数)

        if 模式归一 == "relative" and abs(实际增量圈数) <= 1e-12:
            return {"success": False, "message": "相对模式下旋转圈数不能为 0"}
        if abs(实际增量圈数) <= 1e-12:
            return {
                "success": True,
                "message": "R 轴目标与当前位置一致，无需运动",
                "data": {
                    "axis": 轴_R, "delta": 0.0, "mode": 模式归一,
                    "current_turns": 当前圈数,
                    "requested_target_turns": 输入圈数,
                    "actual_target_turns": 当前圈数,
                    "axis_units": axis_units,
                    "pulses_per_rev": 每圈脉冲数,
                },
            }

        旋转位移 = 实际增量圈数 * 每圈距离
        try:
            await self.单轴相对(轴_R, 旋转位移)
        except ZMCError as exc:
            return {"success": False, "message": f"R 轴旋转失败: {exc}"}
        return {
            "success": True,
            "data": {
                "axis": 轴_R, "delta": 旋转位移, "mode": 模式归一,
                "current_turns": 当前圈数,
                "actual_increment_turns": 实际增量圈数,
                "requested_target_turns": 输入圈数 if 模式归一 == "absolute" else (当前圈数 + 输入圈数),
                "actual_target_turns": 当前圈数 + 实际增量圈数,
                "axis_units": axis_units,
                "pulses_per_rev": 每圈脉冲数,
            },
        }

    async def R轴一直进行旋转(self, R轴旋转速度: Optional[float] = None) -> Dict[str, Any]:
        """对应 core ZMotionAdapter.R轴一直进行旋转。

        策略：下发一个足够大的相对位移（1e6 工程单位），由外部通过急停/停止终止。
        """
        if R轴旋转速度 is None:
            try:
                状态 = await self.读全部轴状态()
                读速度 = float(状态.get(str(轴_R), {}).get("speed", 0.0))
            except ZMCError as exc:
                return {"success": False, "message": f"读取 R 轴速度失败: {exc}"}
            if 读速度 is None:
                return {"success": False, "message": "未传 R 轴旋转速度，且无法从驱动器读取到有效运行速度"}
            R轴旋转速度 = 读速度
        if R轴旋转速度 <= 0:
            return {"success": False, "message": "R 轴旋转速度必须大于 0"}

        try:
            await self.设置速度(轴_R, float(R轴旋转速度))
        except ZMCError as exc:
            return {"success": False, "message": f"设置 R 轴速度失败: {exc}"}

        try:
            await self.单轴相对(轴_R, 1_000_000.0)
        except ZMCError as exc:
            return {"success": False, "message": f"R 轴持续旋转启动失败: {exc}"}
        return {"success": True, "message": "R 轴已开始持续旋转", "data": {"axis": 轴_R}}

    async def 获取R轴的当前位置(self) -> float:
        """对应 core ZMotionAdapter.获取R轴的当前位置 —— 返回 R 轴当前圈数。"""
        try:
            状态 = await self.读全部轴状态()
        except ZMCError:
            return 0.0
        r状态 = 状态.get(str(轴_R), {})
        当前工程位移 = float(r状态.get("mpos", 0.0))
        axis_units = float(r状态.get("units", 0.0))
        if axis_units <= 0: return 0.0
        每圈脉冲数 = (
            self._R轴每圈脉冲数 * self._R轴电子齿轮比 * self._R轴减速比
        )
        return 当前工程位移 * axis_units / 每圈脉冲数

    # ------------------------------------------------------------------
    # 连续插补运动
    # ------------------------------------------------------------------

    async def 连续插补运动(
        self,
        轴号列表: Sequence[int],
        路径点: Sequence[Any],
        *,
        merge_enable: bool = True,
        auto_corner_decel: bool = True,
        auto_small_circle_limit: bool = True,
        auto_corner_angle: bool = False,
        first_corner_angle_deg: float = 15.0,
        end_corner_angle_deg: float = 45.0,
        small_circle_limit: float = 5.0,
        corner_radius: float = 0.0,
        start_move_speed: Optional[float] = None,
        end_move_speed: Optional[float] = None,
        default_speed: Optional[float] = None,
        sleep_when_buffer_full_s: float = 0.005,
    ) -> bool:
        """连续插补运动 —— 整条路径使用同一速度,实现段间速度真正连续。

        语义要点(2026 重构):
          - 整条路径只在循环开始前设一次 FORCE_SPEED(= default_speed),不在
            循环中切速。避免破坏 ZMC look-ahead 的速度规划,保证段间速度连续。
          - 路径点字段中的 speed 会被**静默忽略**(向前兼容旧调用方,但不再生效)。
          - MERGE 对所有参与轴开启,CORNER_MODE 默认 2+8(自动减速 + 小圆限速)。
          - 大于 STOP_ANGLE 的拐角会按 ZMC 内置规划自动减速;小于 DECEL_ANGLE
            的拐角不减速;之间按角度比例平滑过渡。

        路径点支持:
          dict   {"x": <float>, "y": <float>, "z"?, "u"?, "r"?, "speed"?(忽略)}
          list/tuple  [v0, v1, ..., (speed,忽略)]   长度 ≥ len(轴号列表)
        """
        self._要求已连接()
        if len(轴号列表) < 2:
            raise ValueError("axis_list 至少包含 2 个轴")
        if not 路径点:
            raise ValueError("path_points 不能为空")

        轴号 = [int(a) for a in 轴号列表]
        await self._执行(lambda: self._同步_连续插补(
            轴号列表=轴号,
            路径点=list(路径点),
            merge_enable=merge_enable,
            auto_corner_decel=auto_corner_decel,
            auto_small_circle_limit=auto_small_circle_limit,
            auto_corner_angle=auto_corner_angle,
            first_corner_angle_deg=first_corner_angle_deg,
            end_corner_angle_deg=end_corner_angle_deg,
            small_circle_limit=small_circle_limit,
            corner_radius=corner_radius,
            start_move_speed=start_move_speed,
            end_move_speed=end_move_speed,
            default_speed=default_speed,
            sleep_when_buffer_full_s=sleep_when_buffer_full_s,
        ))
        return True

    def _同步_连续插补(self, **kw: Any) -> None:
        """连续插补的同步实现（IO 线程内执行）。

        关键改动:
          1. MERGE 对所有参与轴都开启(原代码只设主轴 → Y 轴 MERGE=0 → 段尾减速)
          2. 整条路径只在循环开始前设一次 FORCE_SPEED,循环中不再切速
          3. ⭐ 主循环不再大块持锁,改为每次 DLL 调用单独短锁,让 status_monitor
             能在 5-20ms 的间隙拿到锁继续推 WebSocket
          4. ⭐ 主循环每轮检查 self._中止事件,急停时立即 break 并自己调
             CancelAxisList,无需等 IO worker 释放
          5. 推完路径点即返回,完成等待由调用方通过安全拉取是否空闲轮询
          6. finally 同时恢复 LSPEED 与 MERGE
        """
        if not self._已连接:
            raise ZMCError("ContinuousInterp", -1, "控制器已断开")
        轴号列表: List[int] = kw["轴号列表"]
        路径点: List[Any] = kw["路径点"]
        n = len(轴号列表)
        轴数组 = (ctypes.c_int * n)(*轴号列表)
        主轴 = 轴号列表[0]
        merge_on = bool(kw["merge_enable"])

        默认速度 = float(
            kw["default_speed"] if kw["default_speed"] is not None
            else self._配置.axes[
                self._配置.axis_no_to_name[主轴]
            ].speed
        )
        self._校验浮点值(默认速度, "default_speed", 上下文="连续插补")

        模式 = 0
        if kw["auto_corner_decel"]:
            模式 += 2
        if kw["auto_small_circle_limit"]:
            模式 += 8
        if kw["auto_corner_angle"]:
            模式 += 32

        # ---- 进入插补前清空中止事件(允许本次完整运行) ----
        self._中止事件.clear()
        日志.info(f"[连续插补] 启动 轴={轴号列表} 段数={len(路径点)} 速度={默认速度} merge={merge_on} mode={模式}")

        # 保存原始起跳速度 & MERGE 状态,finally 恢复(不持锁,纯内存读取)
        原始Lspeed: Dict[int, float] = {}
        原始Merge: Dict[int, int] = {}
        for 轴号 in 轴号列表:
            cfg = self._配置.axes[self._配置.axis_no_to_name[轴号]]
            原始Lspeed[轴号] = cfg.lspeed
            原始Merge[轴号] = int(cfg.merge)

        # ---- 阶段一: 一次性下发所有参数(此处一段短锁,毫秒级) ----
        with self._锁:
            self._校验("ZAux_Direct_Base", self._dll.ZAux_Direct_Base(n, 轴数组), 备注="continuous")
            # (1) 所有参与轴下发轴参数,LSPEED=0 避免段间起跳台阶
            for 轴号 in 轴号列表:
                cfg = self._配置.axes[self._配置.axis_no_to_name[轴号]]
                for 名, 值 in (
                    ("ZAux_Direct_SetUnits", cfg.units),
                    ("ZAux_Direct_SetLspeed", 0.0),
                    ("ZAux_Direct_SetSpeed", 默认速度),
                    ("ZAux_Direct_SetAccel", cfg.accel),
                    ("ZAux_Direct_SetDecel", cfg.decel),
                    ("ZAux_Direct_SetSramp", cfg.sramp),
                ):
                    fn = getattr(self._dll, 名)
                    self._校验(名, fn(轴号, 值), 备注=f"axis={轴号}")
            # (2) MERGE 对所有参与轴开启
            for 轴号 in 轴号列表:
                self._校验("ZAux_Direct_SetMerge",
                           self._dll.ZAux_Direct_SetMerge(轴号, 1 if merge_on else 0),
                           备注=f"axis={轴号}")
            # (3) 拐角/小圆/圆滑参数(只对主轴有效)
            self._校验("ZAux_Direct_SetCornerMode",
                       self._dll.ZAux_Direct_SetCornerMode(主轴, 模式), 备注=f"axis={主轴}")
            self._校验("ZAux_Direct_SetDecelAngle",
                       self._dll.ZAux_Direct_SetDecelAngle(
                           主轴, float(kw["first_corner_angle_deg"]) * math.pi / 180,
                       ), 备注=f"axis={主轴}")
            self._校验("ZAux_Direct_SetStopAngle",
                       self._dll.ZAux_Direct_SetStopAngle(
                           主轴, float(kw["end_corner_angle_deg"]) * math.pi / 180,
                       ), 备注=f"axis={主轴}")
            self._校验("ZAux_Direct_SetFullSpRadius",
                       self._dll.ZAux_Direct_SetFullSpRadius(
                           主轴, float(kw["small_circle_limit"])), 备注=f"axis={主轴}")
            self._校验("ZAux_Direct_SetZsmooth",
                       self._dll.ZAux_Direct_SetZsmooth(
                           主轴, float(kw["corner_radius"])), 备注=f"axis={主轴}")
            # (4) 起点/终点速度
            起点速度 = (
                float(默认速度 if merge_on else 0.0)
                if kw["start_move_speed"] is None else float(kw["start_move_speed"])
            )
            终点速度 = (
                float(默认速度 if merge_on else 0.0)
                if kw["end_move_speed"] is None else float(kw["end_move_speed"])
            )
            self._校验("ZAux_Direct_SetStartMoveSpeed",
                       self._dll.ZAux_Direct_SetStartMoveSpeed(主轴, 起点速度), 备注=f"axis={主轴}")
            self._校验("ZAux_Direct_SetEndMoveSpeed",
                       self._dll.ZAux_Direct_SetEndMoveSpeed(主轴, 终点速度), 备注=f"axis={主轴}")
            self._校验("ZAux_Direct_SetMovemark",
                       self._dll.ZAux_Direct_SetMovemark(主轴, 0), 备注=f"axis={主轴}")
            self._校验("ZAux_Trigger", self._dll.ZAux_Trigger())
            # (5) 整条路径单一 FORCE_SPEED
            self._校验("ZAux_Direct_SetForceSpeed",
                       self._dll.ZAux_Direct_SetForceSpeed(主轴, 默认速度),
                       备注=f"axis={主轴} 全路径单速")

        # ---- 阶段二: 解析路径点(无锁) ----
        段列表: List[List[float]] = []
        for idx, 点 in enumerate(路径点):
            坐标, _段速度_忽略 = self._解析连续插补点(点, 轴号列表, 默认速度, idx)
            段列表.append(坐标)

        被中止 = False
        # ⭐ 关键: sleep 用 Event.wait 替代,中止事件 set() 后立即唤醒,响应 < 1ms
        buf_sleep_s = max(float(kw["sleep_when_buffer_full_s"]), 0.001)
        try:
            # ---- 阶段三: 推送循环,每段短锁,响应中止事件 ----
            已推送 = 0
            总数 = len(段列表)
            while 已推送 < 总数:
                # ⭐ 中止事件优先检查
                if self._中止事件.is_set():
                    被中止 = True
                    break
                # 短锁: 读缓冲剩余 + 推一段
                with self._锁:
                    ret_buf, 剩余_val = self._dll.ZAux_Direct_GetRemain_LineBuffer(主轴)
                    剩余 = int(剩余_val.value) if int(ret_buf) == 0 else 4096
                    if 剩余 > 0:
                        位置数组 = (ctypes.c_float * n)(*段列表[已推送])
                        self._校验("ZAux_Direct_MoveAbsSp",
                                   self._dll.ZAux_Direct_MoveAbsSp(n, 轴数组, 位置数组),
                                   备注=f"段={已推送}")
                        已推送 += 1
                        推送成功 = True
                    else:
                        推送成功 = False
                # 锁外等待 —— 用 Event.wait,中止事件 set 时立即返回
                if not 推送成功:
                    if self._中止事件.wait(buf_sleep_s):
                        被中止 = True
                        break

            if 被中止:
                return

            if 被中止:
                return
        finally:
            # ---- 阶段五: 清理(短锁) ----
            if self._已连接:
                with self._锁:
                    # 中止 → 主动调 DLL Cancel(立即模式),无需等 worker
                    if 被中止:
                        try:
                            n_all = len(轴号列表)
                            轴数组_全 = (ctypes.c_int * n_all)(*轴号列表)
                            self._dll.ZAux_Direct_CancelAxisList(n_all, 轴数组_全, 取消_立即)
                        except Exception as exc:
                            日志.warning(f"中止时 CancelAxisList 失败: {exc}")
                    # 恢复 LSPEED / MERGE
                    for 轴号, 原值 in 原始Lspeed.items():
                        try:
                            self._dll.ZAux_Direct_SetLspeed(轴号, 原值)
                        except Exception:
                            pass
                    for 轴号, 原值 in 原始Merge.items():
                        try:
                            self._dll.ZAux_Direct_SetMerge(轴号, int(原值))
                        except Exception:
                            pass

    @staticmethod
    def _校验浮点值(值: float, 名称: str, 上下文: str = "") -> float:
        """验证浮点值合法（非 NaN/Inf），防止传递给 DLL 导致 segfault。"""
        import math
        if not math.isfinite(值):
            上下文信息 = f" [{上下文}]" if 上下文 else ""
            raise ValueError(f"{名称}={值} 无效 (NaN/Inf){上下文信息}")
        return 值

    def _解析连续插补点(
        self,
        点: Any,
        轴号列表: Sequence[int],
        默认速度: float,
        idx: int,
    ) -> tuple[List[float], float]:
        """把单个路径点解析成 (坐标列表, 段速度)。"""
        坐标: List[float] = []
        速度 = 默认速度
        if isinstance(点, dict):
            for 轴号 in 轴号列表:
                轴名 = self._配置.axis_no_to_name.get(int(轴号))
                if 轴名 is None:
                    raise ValueError(f"path_points[{idx}] 未配置的轴号: {轴号}")
                # 同时兼容大小写键名（前端可能传 "X" 或 "x"）
                if 轴名 in 点:
                    v = float(点[轴名])
                elif 轴名.lower() in 点:
                    v = float(点[轴名.lower()])
                else:
                    raise ValueError(f"path_points[{idx}] 缺少轴坐标 axis={轴号}")
                self._校验浮点值(v, f"path_points[{idx}].{轴名}")
                坐标.append(v)
            if "speed" in 点 and 点["speed"] is not None:
                速度 = self._校验浮点值(float(点["speed"]), f"path_points[{idx}].speed")
        elif isinstance(点, (list, tuple)):
            n = len(轴号列表)
            if len(点) < n:
                raise ValueError(f"path_points[{idx}] 维度不足，至少需要 {n} 个坐标")
            for i, v in enumerate(点[:n]):
                vf = float(v)
                self._校验浮点值(vf, f"path_points[{idx}][{i}]")
                坐标.append(vf)
            if len(点) >= n + 1 and 点[n] is not None:
                速度 = self._校验浮点值(float(点[n]), f"path_points[{idx}].speed")
        else:
            raise ValueError(f"path_points[{idx}] 类型不支持: {type(点)}")
        return 坐标, 速度

    async def 连续插补XY(
        self,
        路径点: Sequence[Any],
        速度: Optional[float] = None,
        *,
        merge_enable: bool = True,
        auto_corner_decel: bool = True,
        auto_small_circle_limit: bool = True,
        auto_corner_angle: bool = False,
        decel_angle_deg: float = 15.0,
        stop_angle_deg: float = 45.0,
        small_circle_limit: float = 5.0,
    ) -> bool:
        """XY 两轴连续插补 —— 整条路径使用同一速度,段间速度连续。

        语义要点(2026 重构):
          - 整条路径使用同一速度: 优先用入参 速度,其次用路径点首段 speed,
            最次回退到 X 轴 motion_config.speed
          - 路径点的 speed 字段被静默忽略(向前兼容,不再生效)
          - MERGE + CORNER_MODE(2+8) 默认开启,实现段间真正连续衔接
          - 不再预先 SetSpeed —— 速度通过底层 SetForceSpeed 统一控制,
            避免临时改 motion_config 速度后再恢复的竞态
        """
        self._要求已连接()
        if not 路径点:
            raise ValueError("path_points 不能为空")

        轴号列表 = [轴_X, 轴_Y]

        # 解析路径点为标准 dict 格式(speed 字段会在底层被忽略,这里保留只为日志)
        转换后: List[Dict[str, float]] = []
        for idx, 点 in enumerate(路径点):
            if isinstance(点, dict):
                if "x" not in 点 or "y" not in 点:
                    raise ValueError(f"path_points[{idx}] 必须包含 x/y")
                转换后.append({"x": float(点["x"]), "y": float(点["y"])})
            elif isinstance(点, (list, tuple)):
                if len(点) < 2:
                    raise ValueError(f"path_points[{idx}] 坐标不足:至少需要 [x, y]")
                转换后.append({"x": float(点[0]), "y": float(点[1])})
            else:
                raise ValueError(f"path_points[{idx}] 类型不支持: {type(点)}")

        # 解析整条路径的统一速度
        if 速度 is not None:
            统一速度: Optional[float] = float(速度)
        else:
            # 尝试从首段路径点取 speed(向前兼容老调用方)
            首段 = 路径点[0]
            首段速度: Optional[float] = None
            if isinstance(首段, dict) and 首段.get("speed") is not None:
                首段速度 = float(首段["speed"])
            elif isinstance(首段, (list, tuple)) and len(首段) >= 3 and 首段[2] is not None:
                首段速度 = float(首段[2])
            统一速度 = 首段速度  # 仍为 None 时让底层回退到 motion_config.speed

        await self.连续插补运动(
            轴号列表=轴号列表,
            路径点=转换后,
            merge_enable=merge_enable,
            auto_corner_decel=auto_corner_decel,
            auto_small_circle_limit=auto_small_circle_limit,
            auto_corner_angle=auto_corner_angle,
            first_corner_angle_deg=decel_angle_deg,
            end_corner_angle_deg=stop_angle_deg,
            small_circle_limit=small_circle_limit,
            default_speed=统一速度,
        )
        return True

    @staticmethod
    def _取段速度(点: Any, 全局速度: Optional[float], idx: int) -> float:
        if 全局速度 is not None:
            return float(全局速度)
        if isinstance(点, dict):
            if 点.get("speed") is not None:
                return float(点["speed"])
            raise ValueError(f"path_points[{idx}] 缺少 speed")
        if isinstance(点, (list, tuple)):
            if len(点) >= 3 and 点[2] is not None:
                return float(点[2])  # type: ignore[index]
            raise ValueError(f"path_points[{idx}] 缺少 speed")
        raise ValueError(f"path_points[{idx}] 类型不支持: {type(点)}")

    # ------------------------------------------------------------------
    # 工具：方向 / 模式 / clamp
    # ------------------------------------------------------------------

    @staticmethod
    def _解析旋转方向(原值: str) -> int:
        """返回 +1 / -1；非法 → 0（调用方据此返回错误）。"""
        归一 = (原值 or "").strip()
        if 归一 in {"顺时针", "CW", "cw", "1", "+1"}:
            return 1
        if 归一 in {"逆时针", "CCW", "ccw", "-1"}:
            return -1
        return 0

    @staticmethod
    def _解析运动模式(原值: str) -> Optional[str]:
        """返回 "relative" / "absolute"；非法 → None。"""
        归一 = (原值 or "").strip().lower()
        if 归一 in {"relative", "rel", "相对"}:
            return "relative"
        if 归一 in {"absolute", "abs", "绝对"}:
            return "absolute"
        return None

    @staticmethod
    def _clamp(
        值: float, 下限: Optional[float], 上限: Optional[float],
    ) -> float:
        if 下限 is not None and 上限 is not None:
            return max(下限, min(上限, 值))
        if 下限 is not None:
            return max(下限, 值)
        if 上限 is not None:
            return min(上限, 值)
        return 值

    # ------------------------------------------------------------------
    # 兼容旧 dict 风格 API
    # ------------------------------------------------------------------

    async def 取连接状态(self) -> Dict[str, Any]:
        """对应 core ZMotionAdapter.get_status。"""
        return {"connected": self._已连接}
