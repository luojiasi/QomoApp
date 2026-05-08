"""测试运动控制状态机 —— 合法/非法迁移、急停吸收、监听器。"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.motion_control.models import 运动状态
from services.motion_control.state_machine import 状态机, 状态事件


class TestLegalTransitions(unittest.TestCase):
    """测试设计文档中列出的合法迁移路径。"""

    def test_初始状态为DISCONNECTED(self):
        sm = 状态机()
        self.assertEqual(sm.当前, 运动状态.DISCONNECTED)

    def test_可指定初始状态(self):
        sm = 状态机(初始=运动状态.IDLE)
        self.assertEqual(sm.当前, 运动状态.IDLE)

    def test_DISCONNECTED经CONNECT到IDLE(self):
        sm = 状态机()
        sm.触发(状态事件.CONNECT)
        self.assertEqual(sm.当前, 运动状态.IDLE)

    def test_IDLE经HOME_START到HOMING再COMPLETE回IDLE(self):
        sm = 状态机(初始=运动状态.IDLE)
        sm.触发(状态事件.HOME_START)
        self.assertEqual(sm.当前, 运动状态.HOMING)
        sm.触发(状态事件.COMPLETE)
        self.assertEqual(sm.当前, 运动状态.IDLE)

    def test_IDLE经MOVE_START到MOVING再COMPLETE回IDLE(self):
        sm = 状态机(初始=运动状态.IDLE)
        sm.触发(状态事件.MOVE_START)
        self.assertEqual(sm.当前, 运动状态.MOVING)
        sm.触发(状态事件.COMPLETE)
        self.assertEqual(sm.当前, 运动状态.IDLE)

    def test_MOVING可暂停继续(self):
        sm = 状态机(初始=运动状态.MOVING)
        sm.触发(状态事件.PAUSE)
        self.assertEqual(sm.当前, 运动状态.PAUSED)
        sm.触发(状态事件.RESUME)
        self.assertEqual(sm.当前, 运动状态.MOVING)

    def test_PAUSED可STOP回IDLE(self):
        sm = 状态机(初始=运动状态.PAUSED)
        sm.触发(状态事件.STOP)
        self.assertEqual(sm.当前, 运动状态.IDLE)

    def test_MOVING同状态MOVE_START不抛异常(self):
        """运动中允许下发新指令（如缓冲合并），状态保持 MOVING。"""
        sm = 状态机(初始=运动状态.MOVING)
        sm.触发(状态事件.MOVE_START)
        self.assertEqual(sm.当前, 运动状态.MOVING)


class TestAbsorbingStates(unittest.TestCase):
    """ESTOP/ALARM 是吸收态：任意状态都能进入，必须 RESET 才能离开。"""

    def test_任意状态可被ESTOP吸收(self):
        for 起点 in [运动状态.IDLE, 运动状态.HOMING, 运动状态.MOVING, 运动状态.PAUSED]:
            with self.subTest(起点=起点):
                sm = 状态机(初始=起点)
                sm.触发(状态事件.ESTOP)
                self.assertEqual(sm.当前, 运动状态.ESTOP)

    def test_任意状态可被ALARM吸收(self):
        for 起点 in [运动状态.IDLE, 运动状态.MOVING, 运动状态.PAUSED]:
            with self.subTest(起点=起点):
                sm = 状态机(初始=起点)
                sm.触发(状态事件.ALARM)
                self.assertEqual(sm.当前, 运动状态.ALARM)

    def test_ESTOP经RESET回IDLE(self):
        sm = 状态机(初始=运动状态.ESTOP)
        sm.触发(状态事件.RESET)
        self.assertEqual(sm.当前, 运动状态.IDLE)

    def test_ALARM经RESET回IDLE(self):
        sm = 状态机(初始=运动状态.ALARM)
        sm.触发(状态事件.RESET)
        self.assertEqual(sm.当前, 运动状态.IDLE)

    def test_DISCONNECTED不能直接到MOVING(self):
        sm = 状态机()
        with self.assertRaises(RuntimeError):
            sm.触发(状态事件.MOVE_START)


class TestForceMode(unittest.TestCase):
    """非法迁移在 强制=True 时不抛异常。"""

    def test_非法迁移默认抛RuntimeError(self):
        sm = 状态机(初始=运动状态.IDLE)
        with self.assertRaises(RuntimeError):
            sm.触发(状态事件.RESUME)   # IDLE 不能 RESUME

    def test_强制模式下保持当前状态(self):
        sm = 状态机(初始=运动状态.IDLE)
        新状态 = sm.触发(状态事件.RESUME, 强制=True)
        self.assertEqual(新状态, 运动状态.IDLE)
        self.assertEqual(sm.当前, 运动状态.IDLE)


class TestQueryMethods(unittest.TestCase):
    def test_是否能_合法事件返回True(self):
        sm = 状态机(初始=运动状态.IDLE)
        self.assertTrue(sm.是否能(状态事件.MOVE_START))
        self.assertTrue(sm.是否能(状态事件.HOME_START))
        self.assertTrue(sm.是否能(状态事件.ESTOP))

    def test_是否能_非法事件返回False(self):
        sm = 状态机(初始=运动状态.IDLE)
        self.assertFalse(sm.是否能(状态事件.RESUME))
        self.assertFalse(sm.是否能(状态事件.COMPLETE))


class TestListeners(unittest.TestCase):
    def test_监听器在迁移后被调用(self):
        sm = 状态机(初始=运动状态.IDLE)
        记录 = []

        def 回调(源, 目标, 事件):
            记录.append((源, 目标, 事件))

        sm.添加监听器(回调)
        sm.触发(状态事件.MOVE_START)
        self.assertEqual(len(记录), 1)
        self.assertEqual(记录[0], (运动状态.IDLE, 运动状态.MOVING, 状态事件.MOVE_START))

    def test_同状态迁移不通知监听器(self):
        sm = 状态机(初始=运动状态.MOVING)
        记录 = []
        sm.添加监听器(lambda *a: 记录.append(a))
        sm.触发(状态事件.MOVE_START)   # MOVING -> MOVING
        self.assertEqual(记录, [])

    def test_监听器抛异常不影响后续监听器(self):
        sm = 状态机(初始=运动状态.IDLE)
        记录 = []

        def 抛异常(*a):
            raise RuntimeError("故意")

        sm.添加监听器(抛异常)
        sm.添加监听器(lambda *a: 记录.append(a))
        sm.触发(状态事件.MOVE_START)
        self.assertEqual(len(记录), 1)

    def test_移除监听器(self):
        sm = 状态机(初始=运动状态.IDLE)
        记录 = []
        cb = lambda *a: 记录.append(a)
        sm.添加监听器(cb)
        sm.移除监听器(cb)
        sm.触发(状态事件.MOVE_START)
        self.assertEqual(记录, [])


if __name__ == "__main__":
    unittest.main()
