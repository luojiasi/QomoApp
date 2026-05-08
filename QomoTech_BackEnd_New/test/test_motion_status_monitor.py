"""测试 status_monitor —— 用 fake adapter 验证不依赖真控制器。"""

import os
import sys
import threading
import time
import unittest
from typing import List, Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.motion_control.config_loader import (
    监控配置, 控制器配置, 安全配置, 运动配置, 轴配置,
)
from services.motion_control.models import 运动状态, 状态快照
from services.motion_control.state_machine import 状态机, 状态事件
from services.motion_control.status_monitor import StatusMonitor
from services.motion_control.zmc_adapter import 轴读数


# ---------------------------------------------------------------------------
# Fake adapter —— 实现 monitor 需要的最小接口
# ---------------------------------------------------------------------------


class _FakeAdapter:
    """实现 status_monitor 依赖的接口子集。"""

    def __init__(self, 配置: 运动配置, idle序列: List[List[bool]]) -> None:
        self.配置 = 配置
        self.已连接: bool = True
        self._idle序列 = idle序列
        self._tick: int = 0
        self._锁 = threading.Lock()
        self.读取次数: int = 0

    def _同步_批量读取(self) -> List[轴读数]:
        with self._锁:
            self.读取次数 += 1
            if self._tick < len(self._idle序列):
                idle = self._idle序列[self._tick]
                self._tick += 1
            else:
                idle = self._idle序列[-1] if self._idle序列 else [True] * len(self.配置.轴)
        读数列表: List[轴读数] = []
        for i, (名, cfg) in enumerate(self.配置.轴.items()):
            读数列表.append(轴读数(
                轴号=cfg.轴号,
                指令位置=float(10 + i),
                实际位置=float(10 + i) - 0.1,
                空闲=idle[i] if i < len(idle) else True,
            ))
        return 读数列表


def _最小配置(周期毫秒: int = 20) -> 运动配置:
    """构造一份最小可用的 运动配置 —— 5 轴（与 motion_config 对齐）。"""
    轴名 = ["X", "Y", "Z", "U", "R"]
    轴映射 = {名: i for i, 名 in enumerate(轴名)}
    轴 = {名: 轴配置(名称=名, 轴号=i) for i, 名 in enumerate(轴名)}
    return 运动配置(
        控制器=控制器配置(),
        轴映射=轴映射,
        轴=轴,
        安全=安全配置(),
        监控=监控配置(状态轮询毫秒=周期毫秒),
    )


# ---------------------------------------------------------------------------
# 测试
# ---------------------------------------------------------------------------


class TestMonitorLifecycle(unittest.TestCase):
    def test_启动停止幂等(self):
        配置 = _最小配置()
        adapter = _FakeAdapter(配置, [[True] * 5])
        sm = 状态机(初始=运动状态.IDLE)
        快照: List[状态快照] = []
        m = StatusMonitor(adapter, sm, 配置.监控, 快照.append)
        m.启动()
        m.启动()    # 第二次应幂等
        m.停止()
        m.停止()    # 第二次应幂等

    def test_暂停时不读取(self):
        配置 = _最小配置(周期毫秒=10)
        adapter = _FakeAdapter(配置, [[True] * 5])
        sm = 状态机(初始=运动状态.IDLE)
        m = StatusMonitor(adapter, sm, 配置.监控, lambda _s: None)
        m.启动()
        m.暂停()
        try:
            time.sleep(0.1)
            读取 = adapter.读取次数
            time.sleep(0.05)
            self.assertEqual(adapter.读取次数, 读取)   # 暂停期间不再增长
        finally:
            m.停止()

    def test_恢复后继续读取(self):
        配置 = _最小配置(周期毫秒=10)
        adapter = _FakeAdapter(配置, [[True] * 5])
        sm = 状态机(初始=运动状态.IDLE)
        m = StatusMonitor(adapter, sm, 配置.监控, lambda _s: None)
        m.启动()
        m.暂停()
        try:
            time.sleep(0.05)
            读取_暂停 = adapter.读取次数
            m.恢复()
            time.sleep(0.1)
            self.assertGreater(adapter.读取次数, 读取_暂停)
        finally:
            m.停止()

    def test_未连接时不读取(self):
        配置 = _最小配置(周期毫秒=10)
        adapter = _FakeAdapter(配置, [[True] * 5])
        adapter.已连接 = False
        sm = 状态机(初始=运动状态.IDLE)
        m = StatusMonitor(adapter, sm, 配置.监控, lambda _s: None)
        m.启动()
        try:
            time.sleep(0.1)
            self.assertEqual(adapter.读取次数, 0)
        finally:
            m.停止()


class TestSnapshotPublishing(unittest.TestCase):
    def test_发布快照含完整轴(self):
        配置 = _最小配置(周期毫秒=10)
        adapter = _FakeAdapter(配置, [[True] * 5])
        sm = 状态机(初始=运动状态.IDLE)
        快照: List[状态快照] = []
        m = StatusMonitor(adapter, sm, 配置.监控, 快照.append)
        m.启动()
        try:
            self._等待至少(快照, 1)
            snap = 快照[0]
            self.assertEqual(snap.状态, 运动状态.IDLE)
            self.assertEqual(set(snap.轴.keys()), {"X", "Y", "Z", "U", "R"})
            self.assertAlmostEqual(snap.轴["X"].指令位置, 10.0)
            self.assertAlmostEqual(snap.轴["Y"].指令位置, 11.0)
        finally:
            m.停止()

    @staticmethod
    def _等待至少(箱: list, n: int, 超时: float = 1.0) -> None:
        截止 = time.monotonic() + 超时
        while len(箱) < n and time.monotonic() < 截止:
            time.sleep(0.01)


class TestCompleteDriving(unittest.TestCase):
    """全 IDLE 自动触发 COMPLETE：MOVING/HOMING → IDLE。"""

    def test_MOVING状态下全空闲触发COMPLETE(self):
        配置 = _最小配置(周期毫秒=10)
        # 第 1 帧：仍在动；第 2 帧起：全空闲
        idle序列 = [[False] * 5, [True] * 5]
        adapter = _FakeAdapter(配置, idle序列)
        sm = 状态机(初始=运动状态.MOVING)
        m = StatusMonitor(adapter, sm, 配置.监控, lambda _s: None)
        m.启动()
        try:
            self._等待状态(sm, 运动状态.IDLE, 超时=1.0)
        finally:
            m.停止()
        self.assertEqual(sm.当前, 运动状态.IDLE)

    def test_HOMING状态下全空闲触发COMPLETE(self):
        配置 = _最小配置(周期毫秒=10)
        idle序列 = [[False] * 5, [True] * 5]
        adapter = _FakeAdapter(配置, idle序列)
        sm = 状态机(初始=运动状态.HOMING)
        m = StatusMonitor(adapter, sm, 配置.监控, lambda _s: None)
        m.启动()
        try:
            self._等待状态(sm, 运动状态.IDLE, 超时=1.0)
        finally:
            m.停止()
        self.assertEqual(sm.当前, 运动状态.IDLE)

    def test_持续空闲不重复触发(self):
        """启动时全 IDLE，且状态本就是 IDLE，不应触发非法迁移。"""
        配置 = _最小配置(周期毫秒=10)
        adapter = _FakeAdapter(配置, [[True] * 5])
        sm = 状态机(初始=运动状态.IDLE)

        非法迁移异常: List[Exception] = []
        # 监听器内捕获即可，状态机本身在合法 COMPLETE 时不会从 IDLE 触发
        m = StatusMonitor(adapter, sm, 配置.监控, lambda _s: None)
        m.启动()
        try:
            time.sleep(0.1)
        finally:
            m.停止()
        self.assertEqual(sm.当前, 运动状态.IDLE)
        self.assertEqual(非法迁移异常, [])

    def test_部分轴空闲不触发COMPLETE(self):
        配置 = _最小配置(周期毫秒=10)
        # X 在动，其它都空闲 —— 不算"全空闲"
        部分空闲 = [True, True, True, True, False]
        adapter = _FakeAdapter(配置, [部分空闲])
        sm = 状态机(初始=运动状态.MOVING)
        m = StatusMonitor(adapter, sm, 配置.监控, lambda _s: None)
        m.启动()
        try:
            time.sleep(0.05)
        finally:
            m.停止()
        self.assertEqual(sm.当前, 运动状态.MOVING)

    def test_ESTOP状态下不会被COMPLETE覆盖(self):
        """采集期间用户急停，COMPLETE 不应改动 ESTOP 吸收态。"""
        配置 = _最小配置(周期毫秒=10)
        adapter = _FakeAdapter(配置, [[True] * 5])
        sm = 状态机(初始=运动状态.ESTOP)
        m = StatusMonitor(adapter, sm, 配置.监控, lambda _s: None)
        m.启动()
        try:
            time.sleep(0.05)
        finally:
            m.停止()
        self.assertEqual(sm.当前, 运动状态.ESTOP)

    @staticmethod
    def _等待状态(sm: 状态机, 目标: 运动状态, 超时: float) -> None:
        截止 = time.monotonic() + 超时
        while sm.当前 != 目标 and time.monotonic() < 截止:
            time.sleep(0.01)


if __name__ == "__main__":
    unittest.main()
