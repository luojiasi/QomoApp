"""MotionService 冒烟测试 —— 不依赖真控制器。

验证：
  - 启动/停止 不崩溃
  - 未连接时 获取状态快照 返回 DISCONNECTED 快照（含 5 轴占位）
  - 订阅/取消订阅 队列正确管理
  - 在未启动 / 未连接 时调用运动指令抛 SafetyViolation
"""

import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.motion_control.models import 运动状态
from services.motion_control.motion_service import MotionService
from services.motion_control.safety_controller import SafetyViolation


def _跑(协程):
    return asyncio.run(协程)


class TestServiceLifecycle(unittest.TestCase):
    def setUp(self):
        MotionService.重置实例()

    def tearDown(self):
        async def _停止():
            try:
                await MotionService.获取实例().停止()
            except Exception:
                pass
        _跑(_停止())
        MotionService.重置实例()

    def test_单例(self):
        a = MotionService.获取实例()
        b = MotionService.获取实例()
        self.assertIs(a, b)

    def test_启动后状态为DISCONNECTED(self):
        async def _():
            svc = MotionService.获取实例()
            await svc.启动()
            snap = svc.获取状态快照()
            self.assertEqual(snap.状态, 运动状态.DISCONNECTED)
            self.assertEqual(set(snap.轴.keys()), {"X", "Y", "Z", "U", "R"})
            d = snap.to_dict()
            self.assertEqual(d["state"], "DISCONNECTED")
            self.assertEqual(set(d["position"].keys()), {"X", "Y", "Z", "U", "R"})
        _跑(_())

    def test_重复启动幂等(self):
        async def _():
            svc = MotionService.获取实例()
            await svc.启动()
            await svc.启动()  # 不应抛
        _跑(_())

    def test_未启动时运动指令拒绝(self):
        async def _():
            svc = MotionService.获取实例()
            with self.assertRaises(SafetyViolation):
                await svc.点动("X", 1)
        _跑(_())

    def test_未连接时运动指令拒绝(self):
        async def _():
            svc = MotionService.获取实例()
            await svc.启动()
            with self.assertRaises(SafetyViolation):
                await svc.绝对运动("X", 50.0)
            with self.assertRaises(SafetyViolation):
                await svc.直线插补(["X", "Y"], [10.0, 10.0])
            with self.assertRaises(SafetyViolation):
                await svc.归位()
        _跑(_())


class TestSubscription(unittest.TestCase):
    def setUp(self):
        MotionService.重置实例()

    def tearDown(self):
        async def _停止():
            try:
                await MotionService.获取实例().停止()
            except Exception:
                pass
        _跑(_停止())
        MotionService.重置实例()

    def test_订阅取消订阅(self):
        async def _():
            svc = MotionService.获取实例()
            await svc.启动()
            q = svc.订阅状态(maxsize=3)
            self.assertIsInstance(q, asyncio.Queue)
            svc.取消订阅(q)
            # 重复取消不抛
            svc.取消订阅(q)
        _跑(_())

    def test_发布到订阅者(self):
        async def _():
            svc = MotionService.获取实例()
            await svc.启动()
            q = svc.订阅状态(maxsize=2)
            try:
                # 直接调内部 _发布快照 验证分发
                snap = svc.获取状态快照()
                svc._发布快照(snap)
                received = await asyncio.wait_for(q.get(), timeout=0.5)
                self.assertEqual(received.状态.value, "DISCONNECTED")
            finally:
                svc.取消订阅(q)
        _跑(_())

    def test_队列满时丢旧入新(self):
        async def _():
            svc = MotionService.获取实例()
            await svc.启动()
            q = svc.订阅状态(maxsize=2)
            try:
                snap = svc.获取状态快照()
                # 投递 5 次 —— 队列容量 2，最终留下最后两次
                for _i in range(5):
                    svc._发布快照(snap)
                # 队列大小不超过 maxsize
                self.assertLessEqual(q.qsize(), 2)
            finally:
                svc.取消订阅(q)
        _跑(_())


if __name__ == "__main__":
    unittest.main()
