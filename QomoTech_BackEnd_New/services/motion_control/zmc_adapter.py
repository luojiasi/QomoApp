"""ZMC 控制器 DLL 适配器。=========硬件SDK封装

设计要点：
  1. **唯一 DLL 入口**：所有上层模块通过本类访问 zauxdll，禁止直接调用 ZAUXDLL；
  2. **单线程串行化**：DLL 同步阻塞、且 handle 不允许并发，使用 1-worker
     ThreadPoolExecutor + RLock 双重保险；
  3. **async 接口**：对外 async 方法，内部 loop.run_in_executor，绝不阻塞 event loop；
  4. **错误码翻译**：每次 DLL 调用返回码 ≠ 0 抛 ZMCError；
  5. **轴号语义化**：上层用整数轴号；模块不感知 'X/Y/Z' 等业务命名；
  6. **批量读取**：批量读取() 在一次 IO 任务内读 5 轴位置，减少锁竞争。

DLL 资源：
  - libs/zmcdll/zauxdll.dll  (主 DLL)
  - libs/zmcdll/zmotion.dll  (依赖)
  - libs/zmcdll/zauxdllPython.py 在 import 时加载 dll；故本模块 import 即触发 DLL 装载。
    单元测试不应 import 本模块，对应测试推迟到集成阶段。
"""

from __future__ import annotations

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Callable, List, Optional, Sequence

from libs.zmcdll.zauxdllPython import ZAUXDLL
from services.motion_control.config_loader import 运动配置, 轴配置
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("ZMCAdapter")


# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

# 轴停止模式 (ZAux_Direct_Single_Cancel / CancelAxisList 的 imode)
取消_当前 = 0           # 仅取消当前运动
取消_缓冲 = 1           # 仅取消缓冲运动
取消_全部 = 2           # 取消当前 + 缓冲（推荐用作软停止）
取消_立即 = 3           # 立即中断脉冲（急停专用）

# 圆弧方向
圆弧_逆时针 = 0
圆弧_顺时针 = 1


# ---------------------------------------------------------------------------
# 异常
# ---------------------------------------------------------------------------


class ZMCError(RuntimeError):
    """ZMC DLL 调用失败。"""

    def __init__(self, 函数名: str, 错误码: int, 备注: str = "") -> None:
        self.函数名 = 函数名
        self.错误码 = int(错误码)
        消息 = f"{函数名} 调用失败：错误码={self.错误码}"
        if 备注:
            消息 = f"{消息} ({备注})"
        super().__init__(消息)


# ---------------------------------------------------------------------------
# 数据载体
# ---------------------------------------------------------------------------


@dataclass
class 轴读数:
    """批量读取() 返回的单轴瞬时读数（裸数据，未归一化）。"""

    轴号: int
    指令位置: float
    实际位置: float
    空闲: bool


# ---------------------------------------------------------------------------
# 适配器
# ---------------------------------------------------------------------------


class ZMC适配器:
    """ZMC 控制器同步 DLL 操作的异步包装。

    生命周期：
      __init__ → 连接(ip)         # 建链 + 下发轴参数（ATYPE/UNITS/速度/限位）
              → ... 各种运动 ...
              → 关闭()            # ZAux_Close + 关闭 IO 线程池
    """

    def __init__(self, 配置: 运动配置) -> None:
        self._配置 = 配置
        self._dll = ZAUXDLL()
        self._锁 = threading.RLock()
        self._执行器 = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ZMC-IO")
        self._已连接: bool = False
        self._已销毁: bool = False

    # ------------------------------------------------------------------
    # 属性
    # ------------------------------------------------------------------

    @property
    def 已连接(self) -> bool:
        return self._已连接

    @property
    def 配置(self) -> 运动配置:
        return self._配置

    # ------------------------------------------------------------------
    # 异步桥
    # ------------------------------------------------------------------

    async def _执行(self, 同步函数: Callable[[], Any]) -> Any:
        """所有 DLL 调用统一通过此方法进入 IO 线程。"""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._执行器, 同步函数)

    def _校验(self, 函数名: str, 返回值: Any, 备注: str = "") -> None:
        """ZMC 函数返回值通常是 int 或 (int, value)。0 表示成功。"""
        ret = 返回值[0] if isinstance(返回值, tuple) else 返回值
        if int(ret) != 0:
            raise ZMCError(函数名, int(ret), 备注)

    def _锁定调用(self, 名称: str, 函数: Callable, *参数: Any) -> Any:
        """通用同步调用：锁 + DLL 调用 + 错误码校验。返回原始值（含 ctypes 输出参数）。"""
        with self._锁:
            返回值 = 函数(*参数)
        self._校验(名称, 返回值)
        return 返回值

    # ------------------------------------------------------------------
    # 连接 / 关闭 / 初始化
    # ------------------------------------------------------------------

    async def 连接(self, ip: Optional[str] = None) -> None:
        实际ip = ip or self._配置.控制器.ip
        日志.info(f"连接 ZMC 控制器 {实际ip}")
        await self._执行(lambda: self._同步_连接(实际ip))
        self._已连接 = True
        try:
            await self._执行(self._同步_初始化所有轴)
        except Exception:
            self._已连接 = False
            await self._执行(self._同步_关闭)
            raise
        日志.info("ZMC 连接并初始化完成")

    def _同步_连接(self, ip: str) -> None:
        with self._锁:
            ret = self._dll.ZAux_OpenEth(ip)
        if int(ret) != 0:
            raise ZMCError("ZAux_OpenEth", int(ret), f"ip={ip}")

    def _同步_初始化所有轴(self) -> None:
        """启动时一次性把 motion_config 中的轴参数下发到控制器。"""
        with self._锁:
            for 名, cfg in self._配置.轴.items():
                self._校验("ZAux_Direct_SetAtype",
                          self._dll.ZAux_Direct_SetAtype(cfg.轴号, cfg.轴类型),
                          备注=f"{名}#{cfg.轴号}")
                self._校验("ZAux_Direct_SetUnits",
                          self._dll.ZAux_Direct_SetUnits(cfg.轴号, cfg.脉冲当量),
                          备注=f"{名}")
                self._校验("ZAux_Direct_SetSpeed",
                          self._dll.ZAux_Direct_SetSpeed(cfg.轴号, cfg.最大速度),
                          备注=f"{名}")
                self._校验("ZAux_Direct_SetAccel",
                          self._dll.ZAux_Direct_SetAccel(cfg.轴号, cfg.加速度),
                          备注=f"{名}")
                self._校验("ZAux_Direct_SetDecel",
                          self._dll.ZAux_Direct_SetDecel(cfg.轴号, cfg.减速度),
                          备注=f"{名}")
                self._校验("ZAux_Direct_SetFsLimit",
                          self._dll.ZAux_Direct_SetFsLimit(cfg.轴号, cfg.软限位正),
                          备注=f"{名}")
                self._校验("ZAux_Direct_SetRsLimit",
                          self._dll.ZAux_Direct_SetRsLimit(cfg.轴号, cfg.软限位负),
                          备注=f"{名}")
                日志.debug(f"轴 {名}#{cfg.轴号} 初始化完成 (ATYPE={cfg.轴类型}, units={cfg.脉冲当量})")

    async def 关闭(self) -> None:
        """断开与控制器的连接（不会销毁线程池，允许后续再次 连接()）。"""
        if self._已销毁: return
        if not self._已连接:
            return
        try:
            await self._执行(self._同步_关闭)
        finally:
            self._已连接 = False
            日志.info("ZMC 已关闭")

    async def 销毁(self) -> None:
        """释放适配器资源（断开连接 + 关闭线程池）。

        仅应在进程退出/应用 shutdown 时调用；调用后不可再复用本实例。
        """
        if self._已销毁:
            return
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

    # ------------------------------------------------------------------
    # 运行时轴参数写入
    # ------------------------------------------------------------------
    # 这一组方法把 ZMC 的零散 SetXxx DLL 调用包装成语义化、async、加锁的接口。
    # 上层（motion_service / 配置面板）可在不重连的情况下任意调整轴参数。

    async def 设置速度(self, 轴号: int, 速度: float) -> None:
        """SPEED —— 单轴目标速度（工程单位/秒）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetSpeed",
            self._dll.ZAux_Direct_SetSpeed, 轴号, float(速度)))

    async def 设置加速度(self, 轴号: int, 加速度: float) -> None:
        """ACCEL —— 加速度（工程单位/秒²）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetAccel",
            self._dll.ZAux_Direct_SetAccel, 轴号, float(加速度)))

    async def 设置减速度(self, 轴号: int, 减速度: float) -> None:
        """DECEL —— 减速度（工程单位/秒²）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetDecel",
            self._dll.ZAux_Direct_SetDecel, 轴号, float(减速度)))

    async def 设置使能(self, 轴号: int, 使能: bool) -> None:
        """AXISENABLE —— 仅对 EtherCAT 总线轴有效；脉冲方向轴此函数无效。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetAxisEnable",
            self._dll.ZAux_Direct_SetAxisEnable, 轴号, 1 if 使能 else 0))

    async def 设置脉冲当量(self, 轴号: int, 脉冲当量: float) -> None:
        """UNITS —— 每工程单位对应的脉冲数。改变后所有距离/速度按新当量解释。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetUnits",
            self._dll.ZAux_Direct_SetUnits, 轴号, float(脉冲当量)))

    async def 设置轴类型(self, 轴号: int, 轴类型: int) -> None:
        """ATYPE —— 轴类型。1=方向脉冲(CW/CCW)，4=正交编码器，65=EtherCAT 等。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetAtype",
            self._dll.ZAux_Direct_SetAtype, 轴号, int(轴类型)))

    async def 设置正软限位(self, 轴号: int, 限位: float) -> None:
        """FS_LIMIT —— 正向软限位。设置一个极大值（如 1e9）视为禁用。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetFsLimit",
            self._dll.ZAux_Direct_SetFsLimit, 轴号, float(限位)))

    async def 设置负软限位(self, 轴号: int, 限位: float) -> None:
        """RS_LIMIT —— 负向软限位。设置一个极小值（如 -1e9）视为禁用。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetRsLimit",
            self._dll.ZAux_Direct_SetRsLimit, 轴号, float(限位)))

    async def 设置参数(self, 参数名: str, 轴号: int, 值: float) -> None:
        """通用 SetParam —— 兜底任意 BAS 轴参数（如 CREEP/JOGSPEED/MERGE 等）。

        参数名见正运动 BASIC 编程手册，区分大小写。
        """
        参数名_去空白 = 参数名.strip()
        if not 参数名_去空白:
            raise ValueError("参数名不能为空")

        def _():
            with self._锁:
                ret = self._dll.ZAux_Direct_SetParam(参数名_去空白, 轴号, float(值))
            if int(ret) != 0:
                raise ZMCError("ZAux_Direct_SetParam", int(ret),
                              f"{参数名_去空白} axis={轴号} value={值}")
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
                raise ZMCError("ZAux_Direct_GetParam", int(ret),
                              f"{参数名_去空白} axis={轴号}")
            return float(value.value)
        return await self._执行(_)

    # ------------------------------------------------------------------
    # 批量写入
    # ------------------------------------------------------------------

    async def 写入轴参数(
        self,
        轴号: int,
        *,
        最大速度: Optional[float] = None,
        加速度: Optional[float] = None,
        减速度: Optional[float] = None,
        软限位正: Optional[float] = None,
        软限位负: Optional[float] = None,
        脉冲当量: Optional[float] = None,
        轴类型: Optional[int] = None,
        使能: Optional[bool] = None,
    ) -> None:
        """选择性下发某轴的多个参数 —— 仅传非 None 的字段。

        所有传入字段在同一把 IO 任务里串行写入，避免多次 executor 调度。
        任一字段出错时抛 ZMCError，已写入的字段不会回滚。
        """
        待写入: List[tuple[str, Callable, tuple]] = []
        if 轴类型 is not None:
            待写入.append(("ZAux_Direct_SetAtype",
                          self._dll.ZAux_Direct_SetAtype, (轴号, int(轴类型))))
        if 脉冲当量 is not None:
            待写入.append(("ZAux_Direct_SetUnits",
                          self._dll.ZAux_Direct_SetUnits, (轴号, float(脉冲当量))))
        if 最大速度 is not None:
            待写入.append(("ZAux_Direct_SetSpeed",
                          self._dll.ZAux_Direct_SetSpeed, (轴号, float(最大速度))))
        if 加速度 is not None:
            待写入.append(("ZAux_Direct_SetAccel",
                          self._dll.ZAux_Direct_SetAccel, (轴号, float(加速度))))
        if 减速度 is not None:
            待写入.append(("ZAux_Direct_SetDecel",
                          self._dll.ZAux_Direct_SetDecel, (轴号, float(减速度))))
        if 软限位正 is not None:
            待写入.append(("ZAux_Direct_SetFsLimit",
                          self._dll.ZAux_Direct_SetFsLimit, (轴号, float(软限位正))))
        if 软限位负 is not None:
            待写入.append(("ZAux_Direct_SetRsLimit",
                          self._dll.ZAux_Direct_SetRsLimit, (轴号, float(软限位负))))
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
                        raise ZMCError(名, int(ret), f"axis={轴号}")
        await self._执行(_)

    async def 写入轴配置(self, 轴cfg: 轴配置) -> None:
        """把一个完整的 轴配置 dataclass 应用到对应轴。

        相当于配置变更后无需重连即可"热更新"。
        """
        await self.写入轴参数(
            轴cfg.轴号,
            轴类型=轴cfg.轴类型,
            脉冲当量=轴cfg.脉冲当量,
            最大速度=轴cfg.最大速度,
            加速度=轴cfg.加速度,
            减速度=轴cfg.减速度,
            软限位正=轴cfg.软限位正,
            软限位负=轴cfg.软限位负,
        )
        # SetAxisEnable 仅对总线轴有效；脉冲方向轴下发也只是 no-op，统一调用方便上层不分支
        if 轴cfg.使能 is not None:
            try:
                await self.设置使能(轴cfg.轴号, 轴cfg.使能)
            except ZMCError as exc:
                日志.debug(f"轴 {轴cfg.名称}#{轴cfg.轴号} 使能调用忽略: {exc}")

    async def 重新下发所有轴(self) -> None:
        """把当前 motion_config 的所有轴配置重新下发到控制器。

        典型用例：用户在 UI 改了 motion_config.json 后调用此方法热更新。
        """
        await self._执行(self._同步_初始化所有轴)

    # ------------------------------------------------------------------
    # 单轴运动
    # ------------------------------------------------------------------

    async def 单轴绝对(self, 轴号: int, 位置: float) -> None:
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_Single_MoveAbs",
            self._dll.ZAux_Direct_Single_MoveAbs, 轴号, 位置))

    async def 单轴相对(self, 轴号: int, 距离: float) -> None:
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_Single_Move",
            self._dll.ZAux_Direct_Single_Move, 轴号, 距离))

    async def 单轴连续(self, 轴号: int, 方向: int) -> None:
        """JOG。方向 +1 / -1。"""
        if 方向 not in (-1, 1):
            raise ValueError(f"非法 JOG 方向: {方向}（应为 +1 或 -1）")
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_Single_Vmove",
            self._dll.ZAux_Direct_Single_Vmove, 轴号, 方向))

    async def 单轴回零(self, 轴号: int, 模式: int) -> None:
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_Single_Datum",
            self._dll.ZAux_Direct_Single_Datum, 轴号, 模式))

    async def 单轴停止(self, 轴号: int, 模式: int = 取消_全部) -> None:
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_Single_Cancel",
            self._dll.ZAux_Direct_Single_Cancel, 轴号, 模式))

    # ------------------------------------------------------------------
    # 多轴插补 —— 直线
    # ------------------------------------------------------------------

    async def 多轴绝对直线(self, 轴号列表: Sequence[int], 位置列表: Sequence[float]) -> None:
        n = self._校验插补长度(轴号列表, 位置列表)
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_MoveAbs",
            self._dll.ZAux_Direct_MoveAbs, n, list(轴号列表), list(位置列表)))

    async def 多轴相对直线(self, 轴号列表: Sequence[int], 距离列表: Sequence[float]) -> None:
        """相对多轴直线插补 (ZAux_Direct_MoveSp)。"""
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

    # ------------------------------------------------------------------
    # 多轴插补 —— 圆弧 / 螺旋
    # ------------------------------------------------------------------

    async def 圆心圆弧(
        self,
        轴号列表: Sequence[int],
        终点1: float, 终点2: float,
        圆心1: float, 圆心2: float,
        方向: int = 圆弧_逆时针,
        绝对: bool = True,
    ) -> None:
        """圆心定 2 点圆弧。
        圆心坐标在相对模式下相对起始点，绝对模式下亦为相对起始点（ZMC 约定）。
        """
        n = len(轴号列表)
        if n < 2:
            raise ValueError("圆弧插补至少需要 2 个轴")
        if 方向 not in (圆弧_逆时针, 圆弧_顺时针):
            raise ValueError(f"非法圆弧方向: {方向}")
        if 绝对:
            await self._执行(lambda: self._锁定调用(
                "ZAux_Direct_MoveCircAbs",
                self._dll.ZAux_Direct_MoveCircAbs, n, list(轴号列表),
                终点1, 终点2, 圆心1, 圆心2, 方向))
        else:
            await self._执行(lambda: self._锁定调用(
                "ZAux_Direct_MoveCirc",
                self._dll.ZAux_Direct_MoveCirc, n, list(轴号列表),
                终点1, 终点2, 圆心1, 圆心2, 方向))

    async def 三点圆弧(
        self,
        轴号列表: Sequence[int],
        中点1: float, 中点2: float,
        终点1: float, 终点2: float,
        绝对: bool = True,
    ) -> None:
        """三点圆弧。中点/终点坐标含义跟随 绝对 参数。"""
        n = len(轴号列表)
        if n < 2:
            raise ValueError("圆弧插补至少需要 2 个轴")
        if 绝对:
            await self._执行(lambda: self._锁定调用(
                "ZAux_Direct_MoveCirc2Abs",
                self._dll.ZAux_Direct_MoveCirc2Abs, n, list(轴号列表),
                中点1, 中点2, 终点1, 终点2))
        else:
            await self._执行(lambda: self._锁定调用(
                "ZAux_Direct_MoveCirc2",
                self._dll.ZAux_Direct_MoveCirc2, n, list(轴号列表),
                中点1, 中点2, 终点1, 终点2))

    async def 螺旋(
        self,
        轴号列表: Sequence[int],
        圆心1: float, 圆心2: float,
        圈数: int, 螺距: float,
        第三轴距离: float = 0.0,
        第四轴距离: float = 0.0,
    ) -> None:
        """螺旋插补 (ZAux_Direct_MoveSpiral)，相对运动。

        n=3 时只用 第三轴距离；n=4 时同时使用 第三轴/第四轴距离。
        """
        n = len(轴号列表)
        if n < 3:
            raise ValueError("螺旋插补至少需要 3 个轴")
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_MoveSpiral",
            self._dll.ZAux_Direct_MoveSpiral, n, list(轴号列表),
            圆心1, 圆心2, 圈数, 螺距, 第三轴距离, 第四轴距离))

    # ------------------------------------------------------------------
    # 连续轨迹（Buffered Move）
    # ------------------------------------------------------------------

    async def 设置合并(self, 轴号: int, 启用: bool) -> None:
        """开/关 MERGE：开启后轴的相邻 Move 指令缓冲连续执行（不停顿过渡）。"""
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_SetMerge",
            self._dll.ZAux_Direct_SetMerge, 轴号, 1 if 启用 else 0))

    async def 多轴停止(self, 轴号列表: Sequence[int], 模式: int = 取消_全部) -> None:
        """指定多轴同时停止。"""
        n = len(轴号列表)
        if n == 0:
            return
        await self._执行(lambda: self._锁定调用(
            "ZAux_Direct_CancelAxisList",
            self._dll.ZAux_Direct_CancelAxisList, n, list(轴号列表), 模式))

    async def 全部停止(self, 模式: int = 取消_全部) -> None:
        await self.多轴停止(self._配置.轴号列表, 模式)

    async def 急停(self) -> None:
        """硬急停 —— 立即中断脉冲发送，跳过减速。"""
        await self.多轴停止(self._配置.轴号列表, 取消_立即)

    # ------------------------------------------------------------------
    # 进给倍率（用于纯 Direct API 模式下的"软暂停"）
    # ------------------------------------------------------------------
    # 设计说明：
    #   ZAux_Pause / ZAux_Resume 仅对控制器中运行的 BAS 工程生效，
    #   纯 Direct API（无 BAS 工程）下无效。
    #   ZMC 推荐用 FEED_OVERRIDE 实现 Direct 模式的软暂停：
    #     FEED_OVERRIDE = 0   → 平滑减速到停（暂停）
    #     FEED_OVERRIDE = 100 → 恢复全速（继续）
    #   motion_service 负责暂停前保存当前倍率、继续时恢复。

    async def 设置进给倍率(self, 倍率: float) -> None:
        """设置控制器全局 FEED_OVERRIDE。范围 0–200。"""
        def _():
            with self._锁:
                ret, _resp = self._dll.ZAux_Execute(f"FEED_OVERRIDE = {倍率}")
            if int(ret) != 0:
                raise ZMCError("ZAux_Execute(FEED_OVERRIDE=)", int(ret), f"value={倍率}")
        await self._执行(_)

    async def 读_进给倍率(self) -> float:
        """读取当前 FEED_OVERRIDE。"""
        def _() -> float:
            with self._锁:
                ret, resp = self._dll.ZAux_Execute("?FEED_OVERRIDE")
            if int(ret) != 0:
                raise ZMCError("ZAux_Execute(?FEED_OVERRIDE)", int(ret))
            try:
                return float(str(resp).strip())
            except (TypeError, ValueError) as exc:
                raise ZMCError("ZAux_Execute(?FEED_OVERRIDE)", -1, f"无法解析: {resp!r}") from exc
        return await self._执行(_)

    # ------------------------------------------------------------------
    # 状态读取
    # ------------------------------------------------------------------

    async def 读_dpos(self, 轴号: int) -> float:
        def _() -> float:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetDpos(轴号)
            if int(ret) != 0:
                raise ZMCError("ZAux_Direct_GetDpos", int(ret), f"axis={轴号}")
            return float(value.value)
        return await self._执行(_)

    async def 读_mpos(self, 轴号: int) -> float:
        def _() -> float:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetMpos(轴号)
            if int(ret) != 0:
                raise ZMCError("ZAux_Direct_GetMpos", int(ret), f"axis={轴号}")
            return float(value.value)
        return await self._执行(_)

    async def 读_idle(self, 轴号: int) -> bool:
        def _() -> bool:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetIfIdle(轴号)
            if int(ret) != 0:
                raise ZMCError("ZAux_Direct_GetIfIdle", int(ret), f"axis={轴号}")
            return int(value.value) == -1   # ZMC 约定：-1=停止, 0=运动中
        return await self._执行(_)

    async def 读_轴状态(self, 轴号: int) -> int:
        """ZAux_Direct_GetAxisStatus —— 位标志报警/限位/使能等。"""
        def _() -> int:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetAxisStatus(轴号)
            if int(ret) != 0:
                raise ZMCError("ZAux_Direct_GetAxisStatus", int(ret), f"axis={轴号}")
            return int(value.value)
        return await self._执行(_)

    async def 读_停止原因(self, 轴号: int) -> int:
        """ZAux_Direct_GetAxisStopReason —— 位标志停止/取消原因。"""
        def _() -> int:
            with self._锁:
                ret, value = self._dll.ZAux_Direct_GetAxisStopReason(轴号)
            if int(ret) != 0:
                raise ZMCError("ZAux_Direct_GetAxisStopReason", int(ret), f"axis={轴号}")
            return int(value.value)
        return await self._执行(_)

    def _同步_批量读取(self) -> List[轴读数]:
        """同步版批量读取 —— 由 status_monitor 线程直接调用。

        与 IO 线程串行：双方共享同一把 RLock。
        单轴读取失败时记日志并跳过该轴，不抛异常 —— 采集线程必须保持运行。
        """
        if not self._已连接:
            return []
        轴号_快照 = list(self._配置.轴号列表)
        名_快照 = list(self._配置.轴名列表)
        结果: List[轴读数] = []
        with self._锁:
            for 名, 轴号 in zip(名_快照, 轴号_快照):
                rd, dpos = self._dll.ZAux_Direct_GetDpos(轴号)
                rm, mpos = self._dll.ZAux_Direct_GetMpos(轴号)
                ri, idle = self._dll.ZAux_Direct_GetIfIdle(轴号)
                if int(rd) != 0 or int(rm) != 0 or int(ri) != 0:
                    日志.warning(
                        f"批量读取轴 {名}#{轴号} 异常: "
                        f"dpos={int(rd)} mpos={int(rm)} idle={int(ri)}"
                    )
                    continue
                结果.append(轴读数(
                    轴号=轴号,
                    指令位置=float(dpos.value),
                    实际位置=float(mpos.value),
                    空闲=(int(idle.value) == -1),
                ))
        return 结果

    async def 批量读取(self) -> List[轴读数]:
        """一次性读取所有配置轴的 DPOS/MPOS/IDLE（异步包装）。"""
        return await self._执行(self._同步_批量读取)

    # ------------------------------------------------------------------
    # 透传：少数边缘场景仍需要 BAS 文本命令
    # ------------------------------------------------------------------

    async def 执行命令(self, 命令: str) -> str:
        """ZAux_Execute —— 任意 BAS 表达式。返回控制器响应字符串。"""
        def _() -> str:
            with self._锁:
                ret, resp = self._dll.ZAux_Execute(命令)
            if int(ret) != 0:
                raise ZMCError("ZAux_Execute", int(ret), f"cmd={命令!r}")
            return resp
        return await self._执行(_)
