"""运动状态采集线程。

设计要点：
  1. 独立 daemon 线程，按 状态轮询毫秒 周期调用 adapter._同步_批量读取
  2. 与 adapter IO 线程共享同一把 RLock —— 不会与运动指令并发踩内存
  3. 检测全部轴 IDLE 时，自动触发状态机 COMPLETE，把 MOVING/HOMING 归位到 IDLE
  4. 每 tick 构造 状态快照 通过回调发布（MotionService._发布快照），
     回调内部走 loop.call_soon_threadsafe 切回事件循环再分发到订阅 Queue

调用方协议：
  - 启动() 仅在 adapter 已连接后调用；连接断开时调 暂停() 即可
  - 重新连接后无需新建实例，调 恢复() 重新激活循环
  - 进程退出时 停止() 等待线程退出（join 超时 1s）

注意：
  configs/motion_config.py 当前没有 monitor 子模型，所以采集周期 / 队列上限
  等参数走构造参数硬编码默认值；后续若要可配置，在 MotionConfig 里加
  MotionMonitorConfig 子模型，再把这里的默认值替换为读配置。
"""
from __future__ import annotations

import threading
import time
from typing import Callable, Dict, List, Optional

from services.motion_control.models import 运动状态, 状态快照, 轴快照
from services.motion_control.state_machine import 状态机, 状态事件
from services.motion_control.zmc_adapter import ZMC适配器, ZMCError, 轴读数
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("StatusMonitor")


# 发布回调签名：status_monitor 把每次构造好的快照交给 MotionService 分发
发布回调类型 = Callable[[状态快照], None]


class StatusMonitor:
    """运动状态采集线程。"""

    def __init__(
        self,
        adapter: ZMC适配器,
        状态机_: 状态机,
        发布回调: 发布回调类型,
        *,
        状态轮询毫秒: int = 50,
    ) -> None:
        self._adapter = adapter
        self._状态机 = 状态机_
        self._发布 = 发布回调
        self._周期秒 = max(0.01, float(状态轮询毫秒) / 1000.0)

        self._线程: Optional[threading.Thread] = None
        self._停止事件 = threading.Event()
        self._采集开关 = threading.Event()    # set = 正在采集；clear = 暂停
        # 上一帧 IDLE 状态：判定"刚刚结束运动"用，避免连续触发 COMPLETE
        self._上次全空闲: bool = True

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    def 启动(self) -> None:
        """启动采集线程（守护线程）。重复调用幂等。"""
        if self._线程 and self._线程.is_alive():
            return
        self._停止事件.clear()
        self._采集开关.set()
        self._线程 = threading.Thread(
            target=self._循环, daemon=True, name="MotionStatusMonitor",
        )
        self._线程.start()
        日志.info(f"状态采集线程已启动（周期 {self._周期秒 * 1000:.0f}ms）")

    def 停止(self, 超时: float = 1.0) -> None:
        """终止采集线程，等待退出。"""
        self._停止事件.set()
        self._采集开关.set()    # 如果正在 wait()，唤醒之
        if self._线程 is not None:
            self._线程.join(timeout=超时)
            self._线程 = None
        日志.info("状态采集线程已停止")

    def 暂停(self) -> None:
        """暂停采集（断开连接时调用），线程仍存活但不读 DLL。"""
        self._采集开关.clear()

    def 恢复(self) -> None:
        """恢复采集（连接成功后调用）。"""
        self._上次全空闲 = True
        self._采集开关.set()

    # ------------------------------------------------------------------
    # 内部循环
    # ------------------------------------------------------------------

    def _循环(self) -> None:
        while not self._停止事件.is_set():
            tick起 = time.monotonic()
            try:
                self._tick()
            except Exception as exc:
                # 采集异常绝不能让线程死掉
                日志.warning(f"状态采集 tick 异常: {exc}")

            # 按周期等待，被 停止事件 唤醒会立即退出循环
            已用 = time.monotonic() - tick起
            剩余 = max(0.0, self._周期秒 - 已用)
            if 剩余 > 0:
                self._停止事件.wait(剩余)

    def _tick(self) -> None:
        if not self._采集开关.is_set():
            return
        if not self._adapter.已连接:
            return

        try:
            读数列表 = self._adapter._同步_批量读取()
        except ZMCError as exc:
            日志.warning(f"批量读取失败: {exc}")
            return

        if not 读数列表:
            return

        快照 = self._构造快照(读数列表)
        self._检查完成事件(读数列表)

        try:
            self._发布(快照)
        except Exception as exc:
            日志.warning(f"快照发布异常: {exc}")

    # ------------------------------------------------------------------
    # 快照构造 / 状态机驱动
    # ------------------------------------------------------------------

    def _构造快照(self, 读数列表: List[轴读数]) -> 状态快照:
        轴号到名 = self._adapter.配置.axis_no_to_name
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
        return 状态快照(状态=self._状态机.当前, 轴=轴字典)

    def _检查完成事件(self, 读数列表: List[轴读数]) -> None:
        """全部轴空闲 → 触发状态机 COMPLETE 把 MOVING/HOMING 归位 IDLE。

        判定"刚刚结束"是为了避免 IDLE 连续帧反复触发：
          上一帧 不全空闲 + 本帧 全空闲 → 一次 COMPLETE
          连续多帧全空闲 → 不再触发
        """
        全空闲 = bool(读数列表) and all(r.空闲 for r in 读数列表)
        刚结束 = 全空闲 and not self._上次全空闲
        self._上次全空闲 = 全空闲

        if not 刚结束:
            return

        当前 = self._状态机.当前
        if 当前 in (运动状态.MOVING, 运动状态.HOMING):
            try:
                self._状态机.触发(状态事件.COMPLETE)
                日志.debug(f"采集驱动完成: {当前.value} → IDLE")
            except RuntimeError as exc:
                # 状态机被并发触发到不允许 COMPLETE 的状态（如 ESTOP），忽略
                日志.debug(f"COMPLETE 触发被忽略: {exc}")
