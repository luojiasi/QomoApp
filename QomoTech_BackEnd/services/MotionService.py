"""运动控制对外门面 —— 单例编排层（services 层唯一对外接口）。

职责
====
路由层（routers/）只 `from services.MotionService import MotionService`
即可拿到全部能力，不需要感知 motion_control/ 内部组件结构。

承接的全部 API（按业务分组）：
  生命周期           启动 / 停止 / 连接 / 断开 / 复位
  状态快照 / 订阅    获取状态快照 / 订阅状态 / 取消订阅
  运动指令           归位 / 点动 / 停止点动 / 绝对运动 / 相对运动 /
                    直线插补 / 圆弧插补 / 三点圆弧插补 / 螺旋插补 /
                    五轴联动直线 / 三加二定向加工 /
                    启用连续轨迹 / 关闭连续轨迹
  暂停控制           暂停 / 继续 / 停止 / 急停
  U/R 业务旋转       U轴旋转的角度参数 / U轴旋转角度 / U轴是否到达旋转角度 /
                    R轴旋转的圈数带参数 / R轴一直进行旋转 / 获取R轴的当前位置
  IO                设置输出 / 读输出 / 批量读输出 / 读输入 / 批量读输入
  轴参数             写入轴参数 / 批量设置轴参数 / 重新下发所有轴 /
                    设置反向间隙 / 设置软限位 / 清除轴错误 / 轴位置清零
  状态读取           读_dpos / 读_mpos / 读_idle / 读全部轴状态 /
                    取_xy_实际位置 / 取_z_实际位置
  等待 / 透传        等待静止 / 绝对运动并设速度 / 连续插补XY / 连续插补运动 /
                    执行命令

协作组件（motion_control/ 内部，路由层无需关心）：
  - 安全控制器（指令准入闸 / 软限位 / 速度归一）
  - ZMC 适配器（DLL 操作）
  - 状态机（合法迁移）
  - StatusMonitor（50ms 周期采集 + COMPLETE 自动触发 + 报警检测）

设计取舍
========
1. 状态机的 COMPLETE 由 StatusMonitor 在轴全空闲时驱动；MotionService 下发
   move 指令后立即返回，状态保持 MOVING 直到全空闲。
2. 暂停 / 继续 走 FEED_OVERRIDE 软暂停（适配纯 Direct API，无需 BAS 工程）。
3. 业务级方法（U/R 旋转、连续插补 XY 等）保留 dict 风格返回值兼容老业务；
   底层运动指令使用异常驱动（SafetyViolation / ZMCError）。
"""
from __future__ import annotations

import asyncio
import threading
import time
from typing import Any, Dict, Iterable, List, Optional, Sequence

from services.motion_control.config_loader import 加载运动配置
from configs.motion_config import MotionConfig
from services.motion_control.motion_models import 运动状态, 状态快照, 轴快照
from services.motion_control.safe_controller import 安全控制器, SafetyViolation
from services.motion_control.state_machine import 状态机, 状态事件
from services.motion_control.status_monitor import StatusMonitor
from services.motion_control.zmc_adapter import (
    ZMC适配器,
    ZMCError,
    取消_全部,
    取消_立即,
    圆弧_逆时针,
    圆弧_顺时针,
    轴_R,
    轴_U,
    轴_X,
    轴_Y,
    轴_Z,
)
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("运动服务")


# 软暂停时把 FEED_OVERRIDE 设到 0；继续时恢复保存值
_默认进给倍率 = 100.0

# 默认采集周期（status_monitor 用）—— 等 motion_config 加 MotionMonitorConfig 后改读配置
_默认状态轮询毫秒 = 50
_默认订阅队列上限 = 20
_默认最大订阅数 = 16


class MotionService:
    """运动控制单例编排器。"""

    _实例: Optional["MotionService"] = None
    _实例锁 = threading.Lock()

    # ------------------------------------------------------------------
    # 单例
    # ------------------------------------------------------------------

    @classmethod
    def 获取实例(cls) -> "MotionService":
        with cls._实例锁:
            if cls._实例 is None:
                cls._实例 = cls()
            return cls._实例

    @classmethod
    def 重置实例(cls) -> None:
        """仅供单元测试使用。"""
        with cls._实例锁:
            cls._实例 = None

    def __init__(self) -> None:
        self._配置: Optional[MotionConfig] = None
        self.适配器: Optional[ZMC适配器] = None
        self.安全控制器: Optional[安全控制器] = None
        self._状态机: 状态机 = 状态机()
        self.监控器: Optional[StatusMonitor] = None
        self._最新快照: 状态快照 = 状态快照.未连接()
        self._订阅者: List[asyncio.Queue] = []
        self._订阅锁 = threading.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._保存的倍率: float = _默认进给倍率
        self._已启动: bool = False

    # ==================================================================
    # 生命周期
    # ==================================================================

    async def 启动(self) -> None:
        """加载配置 + 构建协作组件。不主动连接控制器。"""
        if self._已启动:
            return
        self._loop = asyncio.get_running_loop()

        self._配置 = 加载运动配置()
        日志.info(f"运动配置已加载（轴: {list(self._配置.axes.keys())}, "
                 f"控制器: {self._配置.controller_ip}）")

        self.安全控制器 = 安全控制器(self._配置)
        self.适配器 = ZMC适配器(self._配置)
        self._最新快照 = self._构造未连接快照()

        # 拉起 status_monitor —— 此时未连接，monitor 进入空转直到 连接() 后激活
        self.监控器 = StatusMonitor(
            adapter=self.适配器,
            状态机_=self._状态机,
            发布回调=self._发布快照,
            状态轮询毫秒=_默认状态轮询毫秒,
        )
        self.监控器.暂停()    # 未连接时不读 DLL
        self.监控器.启动()

        self._已启动 = True
        日志.info("MotionService 已启动")

    async def 停止(self) -> None:
        if not self._已启动:
            return
        日志.info("MotionService 停止中...")
        if self.监控器 is not None:
            try:
                self.监控器.停止()
            except Exception as exc:
                日志.warning(f"关闭 status_monitor 异常: {exc}")
            self.监控器 = None
        if self.适配器 is not None:
            try:
                await self.适配器.销毁()
            except Exception as exc:
                日志.warning(f"关闭 ZMC 适配器异常: {exc}")
        self._订阅者.clear()
        self._已启动 = False
        日志.info("MotionService 已停止")

    async def 连接(self, ip: Optional[str] = None) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        await adapter.连接(ip)
        self._保存的倍率 = _默认进给倍率
        try:
            await adapter.设置进给倍率(_默认进给倍率)
        except ZMCError as exc:
            日志.warning(f"初始化 FEED_OVERRIDE 失败: {exc}")
        self._状态机.触发(状态事件.CONNECT, 强制=True)
        if self.监控器 is not None:
            self.监控器.恢复()
        await self._刷新快照()
        日志.info(f"控制器 {ip or self._配置.controller_ip} 已连接")

    async def 断开(self) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        if self.监控器 is not None:
            self.监控器.暂停()
        await adapter.关闭()
        self._状态机.触发(状态事件.DISCONNECT, 强制=True)
        self._最新快照 = self._构造未连接快照()
        self._发布快照(self._最新快照)

    async def 复位(self) -> None:
        """清除 ESTOP / ALARM，回到 IDLE。"""
        self._保证已启动()
        当前 = self._状态机.当前
        self._断言safety().准入_停止类(当前)
        if 当前 in (运动状态.ESTOP, 运动状态.ALARM):
            self._状态机.触发(状态事件.RESET)
        日志.info(f"复位完成（原状态: {当前.value}）")
        await self._刷新快照()

    # ==================================================================
    # 状态快照 / 订阅
    # ==================================================================

    def 获取状态快照(self) -> 状态快照:
        return self._最新快照

    def 订阅状态(self, maxsize: int = _默认订阅队列上限) -> asyncio.Queue:
        """注册一个 asyncio.Queue 接收推送（队列满时丢弃最旧元素，保证慢消费者不阻塞采集）。"""
        q: asyncio.Queue = asyncio.Queue(maxsize=maxsize)
        with self._订阅锁:
            if len(self._订阅者) >= _默认最大订阅数:
                raise RuntimeError(f"订阅者数量已达上限 {_默认最大订阅数}")
            self._订阅者.append(q)
        return q

    def 取消订阅(self, q: asyncio.Queue) -> None:
        with self._订阅锁:
            try:
                self._订阅者.remove(q)
            except ValueError:
                pass

    def _发布快照(self, 快照: 状态快照) -> None:
        """从任意线程调用：缓存最新快照并投递到所有订阅者。

        若由非 event loop 线程调用（如 status_monitor 线程），
        通过 loop.call_soon_threadsafe 切回事件循环再 put_nowait。
        """
        self._最新快照 = 快照
        with self._订阅锁:
            订阅者副本 = list(self._订阅者)
        if not 订阅者副本:
            return

        loop = self._loop
        if loop is None or not loop.is_running():
            return

        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None

        if running is loop:
            self._同步分发(订阅者副本, 快照)
        else:
            loop.call_soon_threadsafe(self._同步分发, 订阅者副本, 快照)

    @staticmethod
    def _同步分发(订阅者: Sequence[asyncio.Queue], 快照: 状态快照) -> None:
        """已在 event loop 线程内：逐个 put_nowait；满则丢最旧再 put。"""
        for q in 订阅者:
            try:
                q.put_nowait(快照)
            except asyncio.QueueFull:
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(快照)
                except Exception:
                    pass

    async def _刷新快照(self) -> None:
        """主动读一次位置并发布快照（指令下发后立即调用，不等 50ms 采集周期）。

        若 adapter 未连接：发布"未连接"快照。
        若读取失败：保留旧值，仅刷新顶层状态。
        """
        if self._配置 is None:
            return

        当前状态 = self._状态机.当前
        adapter = self.适配器

        if adapter is None or not adapter.已连接 or 当前状态 == 运动状态.DISCONNECTED:
            self._发布快照(状态快照(状态=当前状态, 轴=self._构造未连接快照().轴))
            return

        try:
            读数列表 = await adapter.批量读取()
            轴号到名 = self._配置.axis_no_to_name
            轴字典: Dict[str, 轴快照] = {}
            for 读数 in 读数列表:
                名 = 轴号到名.get(读数.轴号)
                if 名 is None:
                    continue
                轴字典[名] = 轴快照(
                    名称=名,
                    轴号=读数.轴号,
                    指令位置=读数.指令位置,
                    实际位置=读数.实际位置,
                    空闲=读数.空闲,
                )
            # 缺失的轴（读取失败）保留旧值
            for 名, cfg in self._配置.axes.items():
                if 名 not in 轴字典:
                    旧 = self._最新快照.轴.get(名, 轴快照(名称=名, 轴号=cfg.axis_no))
                    轴字典[名] = 旧
            self._发布快照(状态快照(状态=当前状态, 轴=轴字典))
        except ZMCError as exc:
            日志.debug(f"刷新快照读位置失败（已忽略）: {exc}")
            self._发布快照(状态快照(状态=当前状态, 轴=self._最新快照.轴))

    # ==================================================================
    # 运动指令
    # ==================================================================

    async def 归位(self, 轴名列表: Optional[Iterable[str]] = None) -> None:
        """归位（回零）。轴名列表=None 表示全轴。"""
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfgs = gate.检查回零(self._状态机.当前, 轴名列表)
        self._状态机.触发(状态事件.HOME_START)
        try:
            for cfg in cfgs:
                await adapter.单轴回零(cfg.axis_no, mode := 0)  # 默认 mode=0；后续可加配置
            日志.info(f"已下发回零指令: {[c.axis_name for c in cfgs]}")
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    async def 点动(
        self, 轴名: str, 方向: int, 速度: Optional[float] = None,
    ) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg, 方向归一, 速度归一 = gate.检查点动(
            self._状态机.当前, 轴名, 方向, 速度,
        )
        await adapter.设置速度(cfg.axis_no, 速度归一)
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.单轴连续(cfg.axis_no, 方向归一)
            日志.info(f"点动 {轴名}#{cfg.axis_no} 方向={方向归一} 速度={速度归一}")
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    async def 停止点动(self, 轴名: str) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        await adapter.单轴停止(cfg.axis_no, 取消_全部)
        日志.info(f"停止点动 {轴名}#{cfg.axis_no}")
        # 停止后仍可能有其它轴在动，状态由 monitor 决策；这里仅做硬停
        await self._刷新快照()

    async def 停止轴运动(self, 轴名: str) -> None:
        """单独停止指定轴的运动（取消当前运动+缓冲）。"""
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        await adapter.单轴停止(cfg.axis_no, 取消_全部)
        日志.info(f"停止轴运动 {轴名}#{cfg.axis_no}")
        await self._刷新快照()

    async def 绝对运动(
        self, 轴名: str, 位置: float, 速度: Optional[float] = None,
    ) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg, 速度归一 = gate.检查单轴绝对(
            self._状态机.当前, 轴名, 位置, 速度,
        )
        await adapter.设置速度(cfg.axis_no, 速度归一)
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.单轴绝对(cfg.axis_no, 位置)
            日志.info(f"绝对运动 {轴名}#{cfg.axis_no} → {位置} @ {速度归一}")
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    async def 相对运动(
        self, 轴名: str, 距离: float, 速度: Optional[float] = None,
    ) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()

        当前位置 = self._取轴当前位置_单(轴名)
        cfg, 速度归一 = gate.检查单轴相对(
            self._状态机.当前, 轴名, 距离, 速度, 当前位置=当前位置,
        )
        await adapter.设置速度(cfg.axis_no, 速度归一)
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.单轴相对(cfg.axis_no, 距离)
            日志.info(f"相对运动 {轴名}#{cfg.axis_no} Δ={距离} @ {速度归一}")
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    async def 直线插补(
        self,
        轴名列表: Sequence[str],
        位置列表: Sequence[float],
        速度: Optional[float] = None,
        相对: bool = False,
    ) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()

        当前位置: Optional[List[float]] = None
        if 相对:
            当前位置 = self._取轴当前位置(轴名列表)

        cfgs, 速度归一 = gate.检查直线插补(
            self._状态机.当前, 轴名列表, 位置列表, 速度, 相对, 当前位置=当前位置,
        )
        # 多轴插补使用首轴 SPEED 作为合成速度
        if cfgs:
            await adapter.设置速度(cfgs[0].axis_no, 速度归一)

        轴号列表 = [c.axis_no for c in cfgs]
        self._状态机.触发(状态事件.MOVE_START)
        try:
            if 相对:
                await adapter.多轴相对直线(轴号列表, list(位置列表))
            else:
                await adapter.多轴绝对直线(轴号列表, list(位置列表))
            日志.info(
                f"直线插补 {[c.axis_name for c in cfgs]} → {list(位置列表)} "
                f"@ {速度归一} (相对={相对})"
            )
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    # ------------------------------------------------------------------
    # 圆弧 / 螺旋（轴名 → 轴号转换 + 安全闸的基础校验）
    # ------------------------------------------------------------------

    async def 圆弧插补(
        self,
        轴名列表: Sequence[str],
        终点1: float, 终点2: float,
        圆心1: float, 圆心2: float,
        方向: str = "ccw",
        速度: Optional[float] = None,
        相对: bool = False,
    ) -> None:
        """圆心定 2 点圆弧。

        方向: "ccw" = 逆时针, "cw" = 顺时针。
        圆心坐标按 ZMC 约定：始终是相对起始点的偏移。
        """
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()

        if len(轴名列表) != 2:
            raise SafetyViolation(f"圆弧插补必须 2 个轴，收到 {list(轴名列表)}")

        gate.准入_运动指令(self._状态机.当前)
        cfgs = gate.校验轴名列表(轴名列表)
        速度归一 = gate.归一化多轴速度(轴名列表, 速度)
        方向值 = self._解析圆弧方向(方向)

        if cfgs:
            await adapter.设置速度(cfgs[0].axis_no, 速度归一)

        轴号列表 = [c.axis_no for c in cfgs]
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.圆心圆弧(
                轴号列表, 终点1, 终点2, 圆心1, 圆心2, 方向值, 绝对=not 相对,
            )
            日志.info(
                f"圆弧 {[c.axis_name for c in cfgs]} 终点=({终点1},{终点2}) "
                f"圆心=({圆心1},{圆心2}) {方向} @ {速度归一} (相对={相对})"
            )
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    async def 三点圆弧插补(
        self,
        轴名列表: Sequence[str],
        中点1: float, 中点2: float,
        终点1: float, 终点2: float,
        速度: Optional[float] = None,
        相对: bool = False,
    ) -> None:
        """三点定圆弧（起始点 - 中间点 - 终点）。"""
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()

        if len(轴名列表) != 2:
            raise SafetyViolation(f"圆弧插补必须 2 个轴，收到 {list(轴名列表)}")

        gate.准入_运动指令(self._状态机.当前)
        cfgs = gate.校验轴名列表(轴名列表)
        速度归一 = gate.归一化多轴速度(轴名列表, 速度)

        if cfgs:
            await adapter.设置速度(cfgs[0].axis_no, 速度归一)

        轴号列表 = [c.axis_no for c in cfgs]
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.三点圆弧(
                轴号列表, 中点1, 中点2, 终点1, 终点2, 绝对=not 相对,
            )
            日志.info(
                f"三点圆弧 {[c.axis_name for c in cfgs]} 中点=({中点1},{中点2}) "
                f"终点=({终点1},{终点2}) @ {速度归一} (相对={相对})"
            )
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    async def 螺旋插补(
        self,
        轴名列表: Sequence[str],
        圆心1: float, 圆心2: float,
        圈数: int,
        螺距: float,
        第三轴距离: float = 0.0,
        第四轴距离: float = 0.0,
        速度: Optional[float] = None,
    ) -> None:
        """螺旋插补 —— 3 或 4 轴，相对运动。"""
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()

        n = len(轴名列表)
        if n not in (3, 4):
            raise SafetyViolation(f"螺旋插补需要 3 或 4 个轴，收到 {n}")
        if 圈数 < 1:
            raise SafetyViolation(f"螺旋圈数必须 ≥ 1，收到 {圈数}")
        if 螺距 == 0:
            raise SafetyViolation("螺旋螺距不能为 0（请改用圆弧插补）")

        gate.准入_运动指令(self._状态机.当前)
        cfgs = gate.校验轴名列表(轴名列表)
        速度归一 = gate.归一化多轴速度(轴名列表, 速度)

        if cfgs:
            await adapter.设置速度(cfgs[0].axis_no, 速度归一)

        轴号列表 = [c.axis_no for c in cfgs]
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.螺旋(
                轴号列表, 圆心1, 圆心2, 圈数, 螺距, 第三轴距离, 第四轴距离,
            )
            日志.info(
                f"螺旋 {[c.axis_name for c in cfgs]} 圆心=({圆心1},{圆心2}) "
                f"圈数={圈数} 螺距={螺距} z={第三轴距离} w={第四轴距离} @ {速度归一}"
            )
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    # ------------------------------------------------------------------
    # 五轴加工
    # ------------------------------------------------------------------

    async def 五轴联动直线(
        self,
        位置列表: Sequence[float],
        速度: Optional[float] = None,
        相对: bool = False,
    ) -> None:
        """五轴联动直线插补 —— X/Y/Z/U/R 同时插补到目标位置。

        位置列表 = [X, Y, Z, U, R] 5 个浮点。
        相对=True 时为相对位移；False 时为绝对位置。
        """
        if len(位置列表) != 5:
            raise SafetyViolation(f"五轴联动需要 5 个目标位置，收到 {len(位置列表)}")

        # 直接复用 直线插补 的安全闸 + 状态机逻辑（5 轴=5 个轴的直线插补）
        await self.直线插补(
            轴名列表=["X", "Y", "Z", "U", "R"],
            位置列表=位置列表,
            速度=速度,
            相对=相对,
        )

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
        """3+2 定向加工：先 U/R 定位锁定，再 XYZ 三轴联动加工。

        流程：
          1. 安全闸：准入_运动指令 + 校验所有轴名
          2. U/R 单轴绝对定位 → 等待静止
          3. 沿 xyz路径 逐段做 XYZ 三轴联动直线
        """
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()

        if not xyz路径:
            raise SafetyViolation("xyz路径不能为空")
        for idx, 点 in enumerate(xyz路径):
            if len(点) != 3:
                raise SafetyViolation(f"xyz路径[{idx}] 必须是 [x, y, z] 三元素")

        gate.准入_运动指令(self._状态机.当前)
        gate.校验轴名列表(["X", "Y", "Z", "U", "R"])  # 确保 5 轴齐全

        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.三加二定向加工(
                u角度=u角度, r角度=r角度, xyz路径=xyz路径,
                定位速度=定位速度, 加工速度=加工速度,
                定位等待超时秒=定位等待超时秒, 相对xyz=相对xyz,
            )
            日志.info(
                f"3+2 加工 U={u角度} R={r角度} 路径段数={len(xyz路径)} "
                f"定位速={定位速度} 加工速={加工速度} 相对={相对xyz}"
            )
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    # ------------------------------------------------------------------
    # 连续轨迹合并
    # ------------------------------------------------------------------

    async def 启用连续轨迹(self, 轴名: str) -> None:
        """开 MERGE：相邻 Move 指令缓冲连续执行（不停顿过渡）。

        建议在下发批量 move 之前先开启，并在最后一段 move 之后关闭。
        """
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg = gate.检查合并(self._状态机.当前, 轴名)
        await adapter.设置合并(cfg.axis_no, True)
        日志.info(f"连续轨迹已启用（主轴 {轴名}#{cfg.axis_no}）")

    async def 关闭连续轨迹(self, 轴名: str) -> None:
        """关 MERGE。"""
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg = gate.检查合并(self._状态机.当前, 轴名)
        await adapter.设置合并(cfg.axis_no, False)
        日志.info(f"连续轨迹已关闭（主轴 {轴名}#{cfg.axis_no}）")

    # ==================================================================
    # 暂停 / 继续 / 停止 / 急停
    # ==================================================================

    def 暂停状态采集(self) -> None:
        """暂停 StatusMonitor 状态采集（程序执行时调用，避免与 DLL 竞态）。"""
        if self.监控器 is not None:
            self.监控器.暂停()

    def 恢复状态采集(self) -> None:
        """恢复 StatusMonitor 状态采集。"""
        if self.监控器 is not None:
            self.监控器.恢复()

    async def 暂停(self) -> None:
        """软暂停：保存当前 FEED_OVERRIDE 并设为 0。"""
        self._保证已启动()
        adapter = self._断言adapter()
        self._断言safety().准入_暂停(self._状态机.当前)
        try:
            self._保存的倍率 = await adapter.读_进给倍率()
        except ZMCError as exc:
            日志.warning(f"读取 FEED_OVERRIDE 失败，使用默认值: {exc}")
            self._保存的倍率 = _默认进给倍率
        await adapter.设置进给倍率(0.0)
        self._状态机.触发(状态事件.PAUSE)
        日志.info(f"已暂停（保存倍率={self._保存的倍率}）")
        await self._刷新快照()

    async def 继续(self) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        self._断言safety().准入_继续(self._状态机.当前)
        恢复值 = self._保存的倍率 if self._保存的倍率 > 0 else _默认进给倍率
        await adapter.设置进给倍率(恢复值)
        self._状态机.触发(状态事件.RESUME)
        日志.info(f"已继续（恢复倍率={恢复值}）")
        await self._刷新快照()

    async def 停止运动(self) -> None:
        """软停止：所有轴减速到停（mode=2 取消当前+缓冲）。

        命名上避开 self.停止 与生命周期 停止() 冲突。
        """
        self._保证已启动()
        adapter = self._断言adapter()
        self._断言safety().准入_停止类(self._状态机.当前)
        await adapter.全部停止(取消_全部)
        # 把状态机踢回 IDLE：MOVING/HOMING/PAUSED 都允许 STOP；其它强制
        try:
            self._状态机.触发(状态事件.STOP)
        except RuntimeError:
            self._状态机.触发(状态事件.STOP, 强制=True)
        日志.info("已停止运动")
        await self._刷新快照()

    async def 急停(self) -> None:
        """硬急停：立即中断脉冲。无视状态。

        关键: 调 adapter.急停() 而不是 adapter.全部停止(),前者会先广播中止
        事件,让正在跑的连续插补循环立刻退出 IO worker,Cancel 指令才能
        被尽快执行(否则会排队在 worker 队列后面)。
        """
        self._保证已启动()
        adapter = self._断言adapter()
        try:
            await adapter.急停()
        except ZMCError as exc:
            日志.error(f"急停 DLL 调用失败: {exc}")
            # 急停必须落地状态机
        self._状态机.触发(状态事件.ESTOP, 强制=True)
        日志.warning("已执行急停")
        await self._刷新快照()

    # ==================================================================
    # U / R 业务级旋转（透传到 adapter，外加状态机驱动）
    # ==================================================================

    async def U轴旋转的角度参数(self, 旋转参数: Dict[str, Any]) -> Dict[str, Any]:
        self._保证已启动()
        adapter = self._断言adapter()
        # 业务级方法返回 dict 风格（success/data/message），不打状态机硬转
        # 状态准入由内部的 单轴相对 触发；为了不卡死状态机这里只做温和检查
        try:
            self._断言safety().准入_运动指令(self._状态机.当前)
        except SafetyViolation as exc:
            return {"success": False, "message": str(exc)}
        self._状态机.触发(状态事件.MOVE_START)
        try:
            结果 = await adapter.U轴旋转的角度参数(旋转参数)
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        if not 结果.get("success"):
            self._状态机.触发(状态事件.STOP, 强制=True)
        await self._刷新快照()
        日志.info(f"U轴旋转角度 参数={旋转参数} → {结果.get('message', 'OK')}")
        return 结果

    async def U轴旋转角度(self, 旋转角度: float) -> Dict[str, Any]:
        self._保证已启动()
        adapter = self._断言adapter()
        try:
            self._断言safety().准入_运动指令(self._状态机.当前)
        except SafetyViolation as exc:
            return {"success": False, "message": str(exc)}
        self._状态机.触发(状态事件.MOVE_START)
        try:
            结果 = await adapter.U轴旋转角度(旋转角度)
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        if not 结果.get("success"):
            self._状态机.触发(状态事件.STOP, 强制=True)
        await self._刷新快照()
        日志.info(f"U轴旋转到角度={旋转角度}° → {结果.get('message', 'OK')}")
        return 结果

    async def U轴是否到达旋转角度(self, 旋转角度: float, 容差: float = 0.01, 超时秒: float = 40.0) -> bool:
        """轮询直到 U 轴到达目标角度，暂停/急停/超时返回 False。"""
        self._保证已启动()
        adapter = self._断言adapter()
        截止 = asyncio.get_event_loop().time() + 超时秒
        while True:
            当前状态 = self._状态机.当前
            if 当前状态 == 运动状态.ESTOP:
                return False
            if 当前状态 == 运动状态.PAUSED:
                await asyncio.sleep(0.1)
                continue
            结果 = await adapter.U轴是否到达旋转角度(旋转角度, 容差)
            if 结果:
                日志.info(f"U轴已到达 {旋转角度}°")
                return True
            if asyncio.get_event_loop().time() >= 截止:
                日志.error(f"U轴旋转超时（目标={旋转角度}°）")
                return False
            await asyncio.sleep(0.02)

    async def R轴旋转的圈数(self, 旋转圈数: float, 超时秒: float = 60.0) -> Dict[str, Any]:
        """简化版 R 轴旋转 —— 只传圈数，不改速度，顺时针相对运动，等待到位后返回。"""
        self._保证已启动()
        adapter = self._断言adapter()
        try:
            self._断言safety().准入_运动指令(self._状态机.当前)
        except SafetyViolation as exc:
            return {"success": False, "message": str(exc)}

        # 记录起始圈数，计算目标
        起始圈数 = await adapter.获取R轴的当前位置()
        目标圈数 = 起始圈数 + float(旋转圈数)

        self._状态机.触发(状态事件.MOVE_START)
        try:
            结果 = await adapter.R轴旋转的圈数(旋转圈数)
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        if not 结果.get("success"):
            self._状态机.触发(状态事件.STOP, 强制=True)
            await self._刷新快照()
            return 结果

        # 轮询等待到位
        截止 = asyncio.get_event_loop().time() + 超时秒
        while True:
            当前状态 = self._状态机.当前
            if 当前状态 == 运动状态.ESTOP:
                return {"success": False, "message": "急停，R轴旋转中断"}
            if 当前状态 == 运动状态.PAUSED:
                await asyncio.sleep(0.05)
                continue
            当前圈数 = await adapter.获取R轴的当前位置()
            if abs(当前圈数 - 目标圈数) <= 0.01:
                日志.info(f"R轴已到达目标圈数 {目标圈数:.2f}（当前={当前圈数:.2f}）")
                break
            if asyncio.get_event_loop().time() >= 截止:
                日志.error(f"R轴旋转超时（目标={目标圈数:.2f}，当前={当前圈数:.2f}）")
                return {"success": False, "message": f"R轴旋转超时（目标={目标圈数:.2f}）"}
            await asyncio.sleep(0.02)

        await self._刷新快照()
        日志.info(f"R轴旋转圈数={旋转圈数} → 已到达 {目标圈数:.2f}")
        return {"success": True, "message": f"R轴已旋转到 {目标圈数:.2f} 圈"}

    async def R轴旋转圈数是否到达指定圈数(self, 旋转圈数: float, 超时秒: float = 60.0) -> bool:
        """启动 R 轴持续旋转，轮询直到转够指定圈数或超时。

        - 旋转圈数 >= 目标时返回 True
        - 急停 / 超时返回 False
        - 暂停期间继续等待
        """
        self._保证已启动()
        adapter = self._断言adapter()
        try:
            self._断言safety().准入_运动指令(self._状态机.当前)
        except SafetyViolation:
            return False

        # 记录起始圈数，计算目标
        起始圈数 = await adapter.获取R轴的当前位置()
        目标圈数 = 起始圈数 + float(旋转圈数)

        # 启动持续旋转
        self._状态机.触发(状态事件.MOVE_START)
        try:
            启动结果 = await adapter.R轴一直进行旋转()
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            return False
        if not 启动结果.get("success"):
            self._状态机.触发(状态事件.STOP, 强制=True)
            return False

        # 轮询等待到达目标圈数
        截止 = asyncio.get_event_loop().time() + 超时秒
        while True:
            当前状态 = self._状态机.当前
            if 当前状态 == 运动状态.ESTOP:
                日志.warning("急停，R轴旋转圈数检查中断")
                return False
            if 当前状态 == 运动状态.PAUSED:
                await asyncio.sleep(0.05)
                continue
            当前圈数 = await adapter.获取R轴的当前位置()
            if 当前圈数 >= (目标圈数 - 0.001):
                日志.info(f"R轴已到达目标圈数 {目标圈数:.2f}（当前={当前圈数:.2f}，起始={起始圈数:.2f}）")
                await self._刷新快照()
                return True
            if asyncio.get_event_loop().time() >= 截止:
                日志.error(f"R轴旋转超时（目标={目标圈数:.2f}，当前={当前圈数:.2f}）")
                return False
            await asyncio.sleep(0.02)

    async def R轴旋转的圈数带参数(self, 旋转参数: Dict[str, Any]) -> Dict[str, Any]:
        self._保证已启动()
        adapter = self._断言adapter()
        try:
            self._断言safety().准入_运动指令(self._状态机.当前)
        except SafetyViolation as exc:
            return {"success": False, "message": str(exc)}
        self._状态机.触发(状态事件.MOVE_START)
        try:
            结果 = await adapter.R轴旋转的圈数带参数(旋转参数)
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        if not 结果.get("success"):
            self._状态机.触发(状态事件.STOP, 强制=True)
        await self._刷新快照()
        日志.info(f"R轴旋转圈数 参数={旋转参数} → {结果.get('message', 'OK')}")
        return 结果

    async def R轴一直进行旋转(self, R轴旋转速度: Optional[float] = None) -> Dict[str, Any]:
        self._保证已启动()
        adapter = self._断言adapter()
        try:
            self._断言safety().准入_运动指令(self._状态机.当前)
        except SafetyViolation as exc:
            return {"success": False, "message": str(exc)}
        self._状态机.触发(状态事件.MOVE_START)
        try:
            结果 = await adapter.R轴一直进行旋转(R轴旋转速度)
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        if not 结果.get("success"):
            self._状态机.触发(状态事件.STOP, 强制=True)
        await self._刷新快照()
        日志.info(f"R轴持续旋转 速度={R轴旋转速度} → {结果.get('message', 'OK')}")
        return 结果

    async def 获取R轴的当前位置(self) -> float:
        self._保证已启动()
        值 = await self._断言adapter().获取R轴的当前位置()
        日志.info(f"R轴当前位置: {值}")
        return 值

    # ==================================================================
    # IO（透传 adapter）
    # ==================================================================

    async def 设置输出(self, io号: int, 值: bool) -> None:
        self._保证已启动()
        await self._断言adapter().设置输出(io号, 值)
        日志.info(f"设置输出 OUT[{io号}] = {值}")

    async def 读_输出(self, io号: int) -> bool:
        self._保证已启动()
        结果 = await self._断言adapter().读_输出(io号)
        日志.debug(f"读输出 OUT[{io号}] = {结果}")
        return 结果

    async def 批量读_输出(self, io起: int = 0, io止: int = 8) -> Dict[int, bool]:
        self._保证已启动()
        结果 = await self._断言adapter().批量读_输出(io起, io止)
        日志.debug(f"批量读输出 [{io起}..{io止}) = {结果}")
        return 结果

    async def 读_输入(self, io号: int) -> bool:
        self._保证已启动()
        结果 = await self._断言adapter().读_输入(io号)
        日志.debug(f"读输入 IN[{io号}] = {结果}")
        return 结果

    async def 批量读_输入(self, io起: int = 0, io止: int = 8) -> Dict[int, bool]:
        self._保证已启动()
        结果 = await self._断言adapter().批量读_输入(io起, io止)
        日志.debug(f"批量读输入 [{io起}..{io止}) = {结果}")
        return 结果

    # ==================================================================
    # 轴参数（透传 adapter）
    # ==================================================================

    async def 写入轴参数(self, 轴名: str, **字段: Any) -> None:
        """按轴名下发参数；字段名见 ZMC适配器.写入轴参数 的 kwargs。"""
        self._保证已启动()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        await self._断言adapter().写入轴参数(cfg.axis_no, **字段)
        日志.info(f"写入轴参数 {轴名}#{cfg.axis_no}: {字段}")

    async def 批量设置轴参数(self, 参数表: Dict[str, Dict[str, Any]]) -> None:
        """按轴名批量下发：{轴名: {字段: 值}}。"""
        self._保证已启动()
        gate = self._断言safety()
        adapter = self._断言adapter()
        转换后: Dict[int, Dict[str, Any]] = {}
        for 轴名, 字段们 in 参数表.items():
            cfg = gate.校验轴名(轴名)
            转换后[cfg.axis_no] = 字段们
        await adapter.批量设置轴参数(转换后)
        日志.info(f"批量设置轴参数: {list(参数表.keys())}")

    async def 重新下发所有轴(self) -> None:
        self._保证已启动()
        await self._断言adapter().重新下发所有轴()
        日志.info("所有轴配置已重新下发")

    async def 保存并下发控制器设置(self, data: Dict[str, Any]) -> None:
        """从控制器设置 dict 中提取轴参数并下发到驱动器。

        参数 data 的格式与前端 ControllerParameters 一致：
          { communication: {...}, axes: [{axis_no, units, speed, ...}, ...] }
        """
        映射 = self._配置.axis_no_to_name
        参数表: Dict[str, Dict[str, Any]] = {}
        for a in data.get("axes", []):
            no = a.get("axis_no")
            if no is None or no not in 映射:
                continue
            参数表[映射[no]] = {
                "units": a.get("units"),
                "lspeed": a.get("lspeed"),
                "speed": a.get("speed"),
                "accel": a.get("accel"),
                "decel": a.get("decel"),
                "sramp": a.get("sramp"),
                "atype": a.get("axis_type"),
                "merge": a.get("merge"),
                "fwd_in": a.get("fwd_in"),
                "rev_in": a.get("rev_in"),
                "pulses_per_rev": a.get("pulses_per_rev"),
                "electronic_gear_ratio": a.get("electronic_gear_ratio"),
                "gear_ratio": a.get("gear_ratio"),
                "正软限位": a.get("正软限位"),
                "负软限位": a.get("负软限位"),
            }
        if not 参数表:
            日志.info("保存控制器设置：无可下发的轴参数")
            return
        try:
            adapter = self.适配器
            if adapter is None or not adapter.已连接:
                日志.info("控制器未连接，跳过下发")
                return
            await self.批量设置轴参数(参数表)
            日志.info("控制器设置已保存到文件并下发")
        except Exception as exc:
            日志.warning(f"控制器设置已保存到文件，但下发到驱动器失败: {exc}")

    async def 设置反向间隙(
        self,
        轴名: str,
        启用: bool,
        距离_脉冲: float,
        速度: Optional[float] = None,
        加速度: Optional[float] = None,
    ) -> None:
        self._保证已启动()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        await self._断言adapter().设置反向间隙(
            cfg.axis_no, 启用, 距离_脉冲, 速度, 加速度,
        )
        日志.info(f"反向间隙 {轴名}#{cfg.axis_no} 启用={启用} 距离={距离_脉冲}")

    async def 设置软限位(
        self,
        轴名: str,
        正限位: Optional[float] = None,
        负限位: Optional[float] = None,
    ) -> None:
        self._保证已启动()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        await self._断言adapter().设置软限位(cfg.axis_no, 正限位, 负限位)
        日志.info(f"软限位 {轴名}#{cfg.axis_no} 正={正限位} 负={负限位}")

    async def 清除轴错误(self, 轴名: str) -> None:
        self._保证已启动()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        await self._断言adapter().清除轴错误(cfg.axis_no)
        日志.info(f"轴错误已清除 {轴名}#{cfg.axis_no}")

    async def 轴位置清零(self, 轴名: str) -> None:
        self._保证已启动()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        await self._断言adapter().轴位置清零(cfg.axis_no)
        日志.info(f"位置已清零 {轴名}#{cfg.axis_no}")

    # ==================================================================
    # 状态读取（透传 adapter）
    # ==================================================================

    async def 读_dpos(self, 轴名: str) -> float:
        self._保证已启动()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        值 = await self._断言adapter().读_dpos(cfg.axis_no)
        日志.debug(f"读 DPOS {轴名}#{cfg.axis_no} = {值}")
        return 值

    async def 读_mpos(self, 轴名: str) -> float:
        self._保证已启动()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        值 = await self._断言adapter().读_mpos(cfg.axis_no)
        日志.debug(f"读 MPOS {轴名}#{cfg.axis_no} = {值}")
        return 值

    async def 读_idle(self, 轴名: str) -> bool:
        self._保证已启动()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        值 = await self._断言adapter().读_idle(cfg.axis_no)
        日志.debug(f"读 IDLE {轴名}#{cfg.axis_no} = {值}")
        return 值

    async def 读全部轴状态(self) -> Dict[str, Dict[str, Any]]:
        """对应老 driver.get_axes_status —— 返回 {axis_no: {字段...}} dict。"""
        self._保证已启动()
        数据 = await self._断言adapter().读全部轴状态()
        日志.debug(f"读全部轴状态: {list(数据.keys())}")
        return 数据

    # ==================================================================
    # 等待 / 位置查询（透传 adapter）
    # ==================================================================

    async def 等待静止(
        self, 轴名: str, 超时秒: float = 100.0, 轮询间隔秒: float = 0.05,
    ) -> bool:
        self._保证已启动()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        结果 = await self._断言adapter().等待静止(cfg.axis_no, 超时秒, 轮询间隔秒)
        日志.info(f"等待静止 {轴名}#{cfg.axis_no} 超时={超时秒}s → {'已静止' if 结果 else '超时'}")
        return 结果

    async def 等待轴到位(
        self,
        轴名与位置: list[tuple[str, float]],
        超时秒: float = 100.0,
        轮询间隔秒: float = 0.05,
        容差: float = 0.001,
    ) -> bool:
        """等待全部轴到达目标位置（DPOS），支持多轴。

        参数
            轴名与位置：[(轴名, 目标位置), ...]，如 [("X", 100.0), ("Y", 50.0)]
            容差：|DPOS - 目标位置| ≤ 容差 即视为到位

        返回
            True  全部轴均已到位
            False 超时（任一轴未到位）
        """
        self._保证已启动()
        if not 轴名与位置: return True

        gate = self._断言safety()
        adapter = self._断言adapter()
        轴信息: list[tuple[str, int, float]] = []
        for name, target in 轴名与位置:
            cfg = gate.校验轴名(name)
            轴信息.append((name, cfg.axis_no, float(target)))

        日志.info(f"等待轴到位 目标={[(n, t) for n, _, t in 轴信息]} 超时={超时秒}s 容差={容差}")

        起始 = time.monotonic()
        while time.monotonic() - 起始 < 超时秒:
            全部到位 = True
            for name, axis_no, target in 轴信息:
                当前位置 = await adapter.读_dpos(axis_no)
                if abs(当前位置 - target) > 容差:
                    全部到位 = False
                    break
            if 全部到位:
                日志.info(f"等待轴到位 → 全部到位")
                return True
            await asyncio.sleep(轮询间隔秒)

        # 超时：做一次最终位置快照，记录未到位轴
        未到位快照: list[str] = []
        for name, axis_no, target in 轴信息:
            当前位置 = await adapter.读_dpos(axis_no)
            if abs(当前位置 - target) > 容差:
                未到位快照.append(f"{name}(目标={target}, 当前={当前位置:.4f})")
        日志.warning(f"等待轴到位 → 超时，未到位轴: {未到位快照}")
        return False

    async def 取_xy_实际位置(self) -> tuple[float, float]:
        self._保证已启动()
        x, y = await self._断言adapter().取_xy_实际位置()
        日志.debug(f"XY 实际位置: ({x}, {y})")
        return x, y

    async def 取_z_实际位置(self) -> float:
        self._保证已启动()
        z = await self._断言adapter().取_z_实际位置()
        日志.debug(f"Z 实际位置: {z}")
        return z

    async def 绝对运动并设速度(
        self, 
        轴名: str, 
        位置: float, 
        速度: float,
    ) -> None:
        """先安全闸校验，再调用 adapter 的临时设速度版绝对运动。"""
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg, 速度归一 = gate.检查单轴绝对(
            self._状态机.当前, 轴名, 位置, 速度,
        )
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.绝对运动并设速度(cfg.axis_no, 位置, 速度归一)
            日志.info(f"绝对运动并设速度 {轴名}#{cfg.axis_no} → {位置} @ {速度归一}")
        except SafetyViolation:
            raise
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    # ==================================================================
    # 连续插补（透传 adapter，外加状态机驱动）
    # ==================================================================

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
    ) -> bool:
        self._保证已启动()
        adapter = self._断言adapter()
        self._断言safety().准入_运动指令(self._状态机.当前)
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.连续插补XY(
                路径点=路径点, 速度=速度,
                merge_enable=merge_enable,
                auto_corner_decel=auto_corner_decel,
                auto_small_circle_limit=auto_small_circle_limit,
                auto_corner_angle=auto_corner_angle,
                decel_angle_deg=decel_angle_deg,
                stop_angle_deg=stop_angle_deg,
            )
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()
        日志.info(f"连续插补XY 完成（路径点数={len(路径点)} merge={merge_enable}）")
        return True

    async def 连续插补运动(
        self,
        轴名列表: Sequence[str],
        路径点: Sequence[Any],
        **kwargs: Any,
    ) -> bool:
        """通用多轴连续插补 —— 轴名版（adapter 接收的是轴号）。"""
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfgs = gate.校验轴名列表(轴名列表)
        gate.准入_运动指令(self._状态机.当前)

        轴号列表 = [c.axis_no for c in cfgs]
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.连续插补运动(轴号列表=轴号列表, 路径点=路径点, **kwargs)
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()
        日志.info(f"连续插补 {[c.axis_name for c in cfgs]} 完成（路径点数={len(路径点)}）")
        return True

    # ==================================================================
    # 在线命令透传
    # ==================================================================

    async def 执行命令(self, 命令: str) -> str:
        """ZAux_Execute —— 任意 BAS 表达式，仅在已连接时可用。"""
        self._保证已启动()
        结果 = await self._断言adapter().执行命令(命令)
        日志.info(f"执行命令: {命令} → {结果}")
        return 结果

    # ==================================================================
    # 内部辅助
    # ==================================================================

    def _保证已启动(self) -> None:
        if not self._已启动:
            raise SafetyViolation("MotionService 未启动")

    def _断言adapter(self) -> ZMC适配器:
        assert self.适配器 is not None, "MotionService 未启动"
        return self.适配器

    def _断言safety(self) -> 安全控制器:
        assert self.安全控制器 is not None, "MotionService 未启动"
        return self.安全控制器

    @staticmethod
    def _解析圆弧方向(方向: str) -> int:
        归一 = (方向 or "").strip().lower()
        if 归一 in ("ccw", "0", "anti", "anticlockwise", "counterclockwise"):
            return 圆弧_逆时针
        if 归一 in ("cw", "1", "clockwise"):
            return 圆弧_顺时针
        raise SafetyViolation(f"非法圆弧方向 {方向!r}（应为 'ccw' 或 'cw'）")

    def _取轴当前位置_单(self, 轴名: str) -> Optional[float]:
        """从最新快照里取单轴的指令位置；缺失时返回 None。"""
        ax = self._最新快照.轴.get(轴名)
        return float(ax.指令位置) if ax is not None else None

    def _取轴当前位置(self, 轴名列表: Sequence[str]) -> List[float]:
        """从最新快照里取这些轴的指令位置（用作相对运动的软限位累加）。

        缺失轴用 0.0 兜底（safe_controller 在跳过软限位的 hook 阶段不会真正用到）。
        """
        位置: List[float] = []
        for 名 in 轴名列表:
            ax = self._最新快照.轴.get(名)
            位置.append(float(ax.指令位置) if ax is not None else 0.0)
        return 位置

    def _构造未连接快照(self) -> 状态快照:
        if self._配置 is None:
            return 状态快照.未连接()
        return 状态快照(
            状态=运动状态.DISCONNECTED,
            轴={
                名: 轴快照(名称=名, 轴号=cfg.axis_no)
                for 名, cfg in self._配置.axes.items()
            },
        )
