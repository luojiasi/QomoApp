"""运动控制编排层 —— 唯一对外门面（单例）。

承接 routers/motion_http.py 与 routers/motion_ws.py 的全部约定 API：
  启动 / 停止 / 连接 / 归位 / 点动 / 停止点动 / 绝对运动 / 直线插补
  暂停 / 继续 / 停止 / 急停 / 复位
  获取状态快照 / 订阅状态 / 取消订阅

协作组件：
  - 安全控制器（指令准入闸）
  - ZMC适配器（DLL 操作）
  - 状态机（合法迁移）
  - StatusMonitor（PR4 接入：50ms 周期采集 + COMPLETE 自动触发 + 报警检测）

PR2 临时取舍：
  - 状态机 COMPLETE 由 PR4 的 StatusMonitor 在轴全空闲时驱动；
  - PR2 阶段，运动指令"立即返回"后状态保持 MOVING，直到下一次同状态指令或外部 STOP；
  - 暂停/继续 走 FEED_OVERRIDE save/restore（适配纯 Direct API，无需 BAS 工程）。
"""

from __future__ import annotations

import asyncio
import threading
from typing import Iterable, List, Optional, Sequence

from services.motion_control.config_loader import 加载运动配置, 运动配置
from services.motion_control.models import 运动状态, 状态快照, 轴快照
from services.motion_control.safety_controller import 安全控制器, SafetyViolation
from services.motion_control.state_machine import 状态机, 状态事件
from services.motion_control.status_monitor import StatusMonitor
from services.motion_control.zmc_adapter import (
    ZMC适配器,
    ZMCError,
    取消_全部,
    取消_立即,
    圆弧_逆时针,
    圆弧_顺时针,
)
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("MotionService")


# 暂停时把 FEED_OVERRIDE 设到 0 实现软暂停；继续时恢复保存值
_默认进给倍率 = 100.0


class MotionService:
    """单例编排器。"""

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
        self._配置: Optional[运动配置] = None
        self._adapter: Optional[ZMC适配器] = None
        self._safety: Optional[安全控制器] = None
        self._状态机: 状态机 = 状态机()
        self._monitor: Optional[StatusMonitor] = None
        self._最新快照: 状态快照 = 状态快照.未连接()
        self._订阅者: List[asyncio.Queue] = []
        self._订阅锁 = threading.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._保存的倍率: float = _默认进给倍率
        self._已启动: bool = False

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    async def 启动(self) -> None:
        """加载配置 + 构建协作组件。不主动连接控制器。"""
        if self._已启动:
            return
        self._loop = asyncio.get_running_loop()

        # 加载配置可能抛异常 —— 让上层 lifespan 包住
        self._配置 = 加载运动配置()
        日志.info(f"运动配置已加载: {self._配置.源文件}")

        self._safety = 安全控制器(self._配置)
        self._adapter = ZMC适配器(self._配置)
        self._最新快照 = self._构造未连接快照()

        # 拉起 status_monitor —— 此时未连接，monitor 会进入空转直到 连接() 后激活
        self._monitor = StatusMonitor(
            adapter=self._adapter,
            状态机_=self._状态机,
            监控cfg=self._配置.监控,
            发布回调=self._发布快照,
        )
        self._monitor.暂停()    # 未连接时不读 DLL
        self._monitor.启动()

        self._已启动 = True
        日志.info(
            f"MotionService 已启动 (轴: {self._配置.轴名列表}, "
            f"控制器: {self._配置.控制器.ip}, "
            f"采集周期: {self._配置.监控.状态轮询毫秒}ms)"
        )

    async def 停止(self) -> None:
        if not self._已启动:
            return
        日志.info("MotionService 停止中...")
        if self._monitor is not None:
            try:
                self._monitor.停止()
            except Exception as exc:
                日志.warning(f"关闭 status_monitor 异常: {exc}")
            self._monitor = None
        if self._adapter is not None:
            try:
                await self._adapter.销毁()
            except Exception as exc:
                日志.warning(f"关闭 ZMC 适配器异常: {exc}")
        self._订阅者.clear()
        self._已启动 = False
        日志.info("MotionService 已停止")

    # ------------------------------------------------------------------
    # 状态快照 / 订阅
    # ------------------------------------------------------------------

    def 获取状态快照(self) -> 状态快照:
        return self._最新快照

    def 订阅状态(self, maxsize: int = 5) -> asyncio.Queue:
        """注册一个 asyncio.Queue 接收推送。

        队列满时自动丢弃最旧元素再入队，保证慢消费者不阻塞采集。
        """
        q: asyncio.Queue = asyncio.Queue(maxsize=maxsize)
        with self._订阅锁:
            if self._配置 and len(self._订阅者) >= self._配置.监控.最大订阅数:
                raise RuntimeError(
                    f"订阅者数量已达上限 {self._配置.监控.最大订阅数}"
                )
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

        若由非 event loop 线程调用（如 PR4 的 status_monitor 线程），
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

    # ------------------------------------------------------------------
    # 连接 / 断开 / 复位
    # ------------------------------------------------------------------

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
        if self._monitor is not None:
            self._monitor.恢复()
        await self._刷新快照()
        日志.info(f"控制器 {ip or self._配置.控制器.ip} 已连接")

    async def 断开(self) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        if self._monitor is not None:
            self._monitor.暂停()
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
        await self._刷新快照()

    # ------------------------------------------------------------------
    # 运动指令
    # ------------------------------------------------------------------

    async def 归位(self, 轴名列表: Optional[Iterable[str]] = None) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfgs = gate.检查回零(self._状态机.当前, 轴名列表)
        self._状态机.触发(状态事件.HOME_START)
        try:
            for cfg in cfgs:
                if cfg.回零速度 > 0:
                    await adapter.设置速度(cfg.轴号, cfg.回零速度)
                await adapter.单轴回零(cfg.轴号, cfg.回零模式)
            日志.info(f"已下发回零指令: {[c.名称 for c in cfgs]}")
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    async def 点动(self, 轴名: str, 方向: int, 速度: Optional[float] = None) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg, 方向归一, 速度归一 = gate.检查点动(self._状态机.当前, 轴名, 方向, 速度)
        await adapter.设置速度(cfg.轴号, 速度归一)
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.单轴连续(cfg.轴号, 方向归一)
            日志.info(f"点动 {轴名}#{cfg.轴号} 方向={方向归一} 速度={速度归一}")
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    async def 停止点动(self, 轴名: str) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg = gate.校验轴名(轴名)
        await adapter.单轴停止(cfg.轴号, 取消_全部)
        # 停止后仍可能有其它轴在动，状态由 monitor 决策；这里仅做硬停
        await self._刷新快照()

    async def 绝对运动(self, 轴名: str, 位置: float, 速度: Optional[float] = None) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg, 速度归一 = gate.检查单轴绝对(self._状态机.当前, 轴名, 位置, 速度)
        await adapter.设置速度(cfg.轴号, 速度归一)
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.单轴绝对(cfg.轴号, 位置)
            日志.info(f"绝对运动 {轴名}#{cfg.轴号} → {位置} @ {速度归一}")
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
            当前位置 = [self._最新快照.轴.get(名, 轴快照(名, -1)).指令位置 for 名 in 轴名列表]

        cfgs, 速度归一 = gate.检查直线插补(
            self._状态机.当前, 轴名列表, 位置列表, 速度, 相对, 当前位置=当前位置,
        )
        # 把进给速度下发到第一个参与轴（ZMC 多轴插补使用首轴 SPEED 作为进给）
        if cfgs:
            await adapter.设置速度(cfgs[0].轴号, 速度归一)

        轴号列表 = [c.轴号 for c in cfgs]
        self._状态机.触发(状态事件.MOVE_START)
        try:
            if 相对:
                await adapter.多轴相对直线(轴号列表, list(位置列表))
            else:
                await adapter.多轴绝对直线(轴号列表, list(位置列表))
            日志.info(
                f"直线插补 {[c.名称 for c in cfgs]} → {list(位置列表)} "
                f"@ {速度归一} (相对={相对})"
            )
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    # ------------------------------------------------------------------
    # 圆弧 / 螺旋 / 连续轨迹
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
        """圆心定 2 点圆弧插补。

        方向: "ccw" = 逆时针, "cw" = 顺时针。
        圆心坐标按 ZMC 约定：始终是相对起始点的偏移。
        """
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()

        方向值 = self._解析圆弧方向(方向)
        当前位置 = self._取轴当前位置(轴名列表) if 相对 else None

        cfgs, 速度归一 = gate.检查圆心圆弧(
            self._状态机.当前, 轴名列表,
            终点1, 终点2, 圆心1, 圆心2, 方向值,
            速度, 相对, 当前位置,
        )
        if cfgs:
            await adapter.设置速度(cfgs[0].轴号, 速度归一)

        轴号列表 = [c.轴号 for c in cfgs]
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.圆心圆弧(
                轴号列表, 终点1, 终点2, 圆心1, 圆心2, 方向值, 绝对=not 相对,
            )
            日志.info(
                f"圆弧 {[c.名称 for c in cfgs]} 终点=({终点1},{终点2}) "
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
        """三点定圆弧（起始点-中间点-终点）。"""
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()

        当前位置 = self._取轴当前位置(轴名列表) if 相对 else None
        cfgs, 速度归一 = gate.检查三点圆弧(
            self._状态机.当前, 轴名列表,
            中点1, 中点2, 终点1, 终点2,
            速度, 相对, 当前位置,
        )
        if cfgs:
            await adapter.设置速度(cfgs[0].轴号, 速度归一)

        轴号列表 = [c.轴号 for c in cfgs]
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.三点圆弧(
                轴号列表, 中点1, 中点2, 终点1, 终点2, 绝对=not 相对,
            )
            日志.info(
                f"三点圆弧 {[c.名称 for c in cfgs]} 中点=({中点1},{中点2}) "
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

        当前位置 = self._取轴当前位置(轴名列表)
        cfgs, 速度归一 = gate.检查螺旋(
            self._状态机.当前, 轴名列表,
            圆心1, 圆心2, 圈数, 螺距, 第三轴距离, 第四轴距离,
            速度, 当前位置,
        )
        if cfgs:
            await adapter.设置速度(cfgs[0].轴号, 速度归一)

        轴号列表 = [c.轴号 for c in cfgs]
        self._状态机.触发(状态事件.MOVE_START)
        try:
            await adapter.螺旋(
                轴号列表, 圆心1, 圆心2, 圈数, 螺距, 第三轴距离, 第四轴距离,
            )
            日志.info(
                f"螺旋 {[c.名称 for c in cfgs]} 圆心=({圆心1},{圆心2}) "
                f"圈数={圈数} 螺距={螺距} z={第三轴距离} w={第四轴距离} @ {速度归一}"
            )
        except Exception:
            self._状态机.触发(状态事件.STOP, 强制=True)
            raise
        await self._刷新快照()

    async def 启用连续轨迹(self, 轴名: str) -> None:
        """开 MERGE：相邻 Move 指令缓冲连续执行（不停顿过渡）。

        建议在下发批量 move 之前先开启，并在最后一段 move 之后关闭。
        """
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg = gate.检查合并(self._状态机.当前, 轴名)
        await adapter.设置合并(cfg.轴号, True)
        日志.info(f"连续轨迹已启用（主轴 {轴名}#{cfg.轴号}）")

    async def 关闭连续轨迹(self, 轴名: str) -> None:
        """关 MERGE。"""
        self._保证已启动()
        adapter = self._断言adapter()
        gate = self._断言safety()
        cfg = gate.检查合并(self._状态机.当前, 轴名)
        await adapter.设置合并(cfg.轴号, False)
        日志.info(f"连续轨迹已关闭（主轴 {轴名}#{cfg.轴号}）")

    # ------------------------------------------------------------------
    # 暂停 / 继续 / 停止 / 急停
    # ------------------------------------------------------------------

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
        await self._刷新快照()

    async def 继续(self) -> None:
        self._保证已启动()
        adapter = self._断言adapter()
        self._断言safety().准入_继续(self._状态机.当前)
        恢复值 = self._保存的倍率 if self._保存的倍率 > 0 else _默认进给倍率
        await adapter.设置进给倍率(恢复值)
        self._状态机.触发(状态事件.RESUME)
        await self._刷新快照()

    async def 停止(self) -> None:
        """软停止：所有轴减速到停（mode=2 取消当前+缓冲）。"""
        self._保证已启动()
        adapter = self._断言adapter()
        self._断言safety().准入_停止类(self._状态机.当前)
        await adapter.全部停止(取消_全部)
        # 把状态机踢回 IDLE：MOVING/HOMING/PAUSED 都允许 STOP；其它强制
        try:
            self._状态机.触发(状态事件.STOP)
        except RuntimeError:
            self._状态机.触发(状态事件.STOP, 强制=True)
        await self._刷新快照()

    async def 急停(self) -> None:
        """硬急停：立即中断脉冲。无视状态。"""
        self._保证已启动()
        adapter = self._断言adapter()
        try:
            await adapter.全部停止(取消_立即)
        except ZMCError as exc:
            日志.error(f"急停 DLL 调用失败: {exc}")
            # 急停必须落地状态机
        self._状态机.触发(状态事件.ESTOP, 强制=True)
        await self._刷新快照()

    # ------------------------------------------------------------------
    # 内部辅助
    # ------------------------------------------------------------------

    def _保证已启动(self) -> None:
        if not self._已启动:
            raise SafetyViolation("MotionService 未启动")

    def _断言adapter(self) -> ZMC适配器:
        assert self._adapter is not None
        return self._adapter

    def _断言safety(self) -> 安全控制器:
        assert self._safety is not None
        return self._safety

    @staticmethod
    def _解析圆弧方向(方向: str) -> int:
        归一 = 方向.strip().lower()
        if 归一 in ("ccw", "0", "anti", "anticlockwise", "counterclockwise"):
            return 圆弧_逆时针
        if 归一 in ("cw", "1", "clockwise"):
            return 圆弧_顺时针
        raise SafetyViolation(
            f"非法圆弧方向 {方向!r}（应为 'ccw' 或 'cw'）"
        )

    def _取轴当前位置(self, 轴名列表: Sequence[str]) -> List[float]:
        """从最新快照里取这些轴的指令位置，用作相对运动的软限位累加。"""
        位置: List[float] = []
        for 名 in 轴名列表:
            轴快照_对象 = self._最新快照.轴.get(名)
            位置.append(轴快照_对象.指令位置 if 轴快照_对象 else 0.0)
        return 位置

    def _构造未连接快照(self) -> 状态快照:
        if self._配置 is None:
            return 状态快照.未连接()
        return 状态快照(
            状态=运动状态.DISCONNECTED,
            轴={名: 轴快照(名称=名, 轴号=cfg.轴号) for 名, cfg in self._配置.轴.items()},
        )

    async def _刷新快照(self) -> None:
        """PR2 快照刷新：仅更新顶层 state；轴位置在 PR4 的 StatusMonitor 接管前为 0。

        若 adapter 已连接，会尝试 批量读取 一次以填充位置（容错处理：失败保留旧值）。
        """
        if self._配置 is None:
            return

        新快照 = self._最新快照
        当前状态 = self._状态机.当前
        adapter = self._adapter

        if adapter is not None and adapter.已连接 and 当前状态 != 运动状态.DISCONNECTED:
            try:
                读数列表 = await adapter.批量读取()
                轴号到名 = {cfg.轴号: 名 for 名, cfg in self._配置.轴.items()}
                轴字典 = {}
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
                # 缺失的轴（读取失败）保留之前的值
                for 名, cfg in self._配置.轴.items():
                    if 名 not in 轴字典:
                        旧 = self._最新快照.轴.get(名, 轴快照(名称=名, 轴号=cfg.轴号))
                        轴字典[名] = 旧
                新快照 = 状态快照(状态=当前状态, 轴=轴字典)
            except ZMCError as exc:
                日志.debug(f"刷新快照读位置失败（已忽略）: {exc}")
                新快照 = 状态快照(状态=当前状态, 轴=self._最新快照.轴)
        else:
            新快照 = 状态快照(状态=当前状态, 轴=self._构造未连接快照().轴)

        self._发布快照(新快照)
