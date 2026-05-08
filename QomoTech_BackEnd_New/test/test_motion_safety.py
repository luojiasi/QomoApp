"""测试运动控制安全控制器。"""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.motion_control.config_loader import 加载运动配置
from services.motion_control.models import 运动状态
from services.motion_control.safety_controller import 安全控制器, SafetyViolation


def _临时配置(数据: dict) -> str:
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8")
    json.dump(数据, f, ensure_ascii=False)
    f.close()
    return f.name


def _基础配置(**axes_overrides) -> dict:
    """生成一份最小可加载配置，调用方按需覆盖单轴字段。"""
    return {
        "axis_map": {"X": 0, "Y": 1},
        "axes": {
            "X": {
                "max_speed": 1000.0,
                "soft_limit_pos": 100.0,
                "soft_limit_neg": -10.0,
                **axes_overrides.get("X", {}),
            },
            "Y": {
                "max_speed": 500.0,
                "soft_limit_pos": 200.0,
                "soft_limit_neg": 0.0,
                **axes_overrides.get("Y", {}),
            },
        },
        "safety": {"min_feed_override": 0, "max_feed_override": 200},
    }


class TestStaticChecks(unittest.TestCase):
    def setUp(self):
        路径 = _临时配置(_基础配置())
        self.addCleanup(lambda: os.unlink(路径))
        self.cfg = 加载运动配置(路径=路径)
        self.gate = 安全控制器(self.cfg)

    def test_合法轴名通过(self):
        self.gate.校验轴名("X")
        self.gate.校验轴名("Y")

    def test_非法轴名抛SafetyViolation(self):
        with self.assertRaises(SafetyViolation):
            self.gate.校验轴名("Z")

    def test_空轴列表拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.校验轴名列表([])

    def test_重复轴名拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.校验轴名列表(["X", "X"])

    def test_长度不匹配抛异常(self):
        with self.assertRaises(SafetyViolation):
            self.gate.校验长度匹配(["X", "Y"], [1.0], "位置")

    def test_方向必须为正负1(self):
        self.gate.校验方向(1)
        self.gate.校验方向(-1)
        for 非法 in (0, 2, -2):
            with self.subTest(非法=非法):
                with self.assertRaises(SafetyViolation):
                    self.gate.校验方向(非法)


class TestSoftLimit(unittest.TestCase):
    def setUp(self):
        路径 = _临时配置(_基础配置())
        self.addCleanup(lambda: os.unlink(路径))
        self.gate = 安全控制器(加载运动配置(路径=路径))

    def test_合法范围通过(self):
        self.gate.校验软限位("X", 50.0)
        self.gate.校验软限位("X", -10.0)
        self.gate.校验软限位("X", 100.0)

    def test_超正限位拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.校验软限位("X", 100.001)

    def test_超负限位拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.校验软限位("X", -10.001)

    def test_相对位移叠加后校验(self):
        self.gate.校验相对位移("X", 当前位置=50.0, 距离=40.0)
        with self.assertRaises(SafetyViolation):
            self.gate.校验相对位移("X", 当前位置=80.0, 距离=30.0)


class TestSpeedNormalization(unittest.TestCase):
    def setUp(self):
        路径 = _临时配置(_基础配置())
        self.addCleanup(lambda: os.unlink(路径))
        self.gate = 安全控制器(加载运动配置(路径=路径))

    def test_None取最大速度(self):
        self.assertEqual(self.gate.归一化速度("X", None), 1000.0)

    def test_合法速度原样返回(self):
        self.assertEqual(self.gate.归一化速度("X", 500.0), 500.0)

    def test_超过max_speed被clamp(self):
        self.assertEqual(self.gate.归一化速度("X", 9999.0), 1000.0)

    def test_负速度拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.归一化速度("X", -1.0)

    def test_零速度拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.归一化速度("X", 0.0)

    def test_多轴速度按最低max_speed上限(self):
        # X.max=1000, Y.max=500 → 上限为 500
        self.assertEqual(self.gate.归一化多轴速度(["X", "Y"], 9999.0), 500.0)
        self.assertEqual(self.gate.归一化多轴速度(["X", "Y"], None), 500.0)
        self.assertEqual(self.gate.归一化多轴速度(["X", "Y"], 300.0), 300.0)


class TestStateAdmission(unittest.TestCase):
    def setUp(self):
        路径 = _临时配置(_基础配置())
        self.addCleanup(lambda: os.unlink(路径))
        self.gate = 安全控制器(加载运动配置(路径=路径))

    def test_准入运动_未连接拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.准入_运动指令(运动状态.DISCONNECTED)

    def test_准入运动_报警急停拒绝(self):
        for s in [运动状态.ESTOP, 运动状态.ALARM]:
            with self.subTest(状态=s):
                with self.assertRaises(SafetyViolation):
                    self.gate.准入_运动指令(s)

    def test_准入运动_暂停拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.准入_运动指令(运动状态.PAUSED)

    def test_准入运动_IDLE和MOVING允许(self):
        self.gate.准入_运动指令(运动状态.IDLE)
        self.gate.准入_运动指令(运动状态.MOVING)

    def test_准入点动_必须从IDLE开始(self):
        self.gate.准入_点动(运动状态.IDLE)
        for s in [运动状态.MOVING, 运动状态.PAUSED, 运动状态.ESTOP]:
            with self.subTest(状态=s):
                with self.assertRaises(SafetyViolation):
                    self.gate.准入_点动(s)

    def test_准入暂停_只能MOVING(self):
        self.gate.准入_暂停(运动状态.MOVING)
        for s in [运动状态.IDLE, 运动状态.PAUSED]:
            with self.subTest(状态=s):
                with self.assertRaises(SafetyViolation):
                    self.gate.准入_暂停(s)

    def test_准入继续_只能PAUSED(self):
        self.gate.准入_继续(运动状态.PAUSED)
        for s in [运动状态.IDLE, 运动状态.MOVING]:
            with self.subTest(状态=s):
                with self.assertRaises(SafetyViolation):
                    self.gate.准入_继续(s)

    def test_准入停止类_PAUSED和ESTOP都允许(self):
        for s in [运动状态.IDLE, 运动状态.MOVING, 运动状态.PAUSED,
                  运动状态.ESTOP, 运动状态.ALARM, 运动状态.HOMING]:
            with self.subTest(状态=s):
                self.gate.准入_停止类(s)


class TestCompositeChecks(unittest.TestCase):
    def setUp(self):
        路径 = _临时配置(_基础配置())
        self.addCleanup(lambda: os.unlink(路径))
        self.gate = 安全控制器(加载运动配置(路径=路径))

    def test_检查单轴绝对_完整通过(self):
        cfg, 速 = self.gate.检查单轴绝对(运动状态.IDLE, "X", 50.0, 200.0)
        self.assertEqual(cfg.名称, "X")
        self.assertEqual(速, 200.0)

    def test_检查单轴绝对_未连接被拒(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查单轴绝对(运动状态.DISCONNECTED, "X", 50.0, 200.0)

    def test_检查单轴绝对_超限被拒(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查单轴绝对(运动状态.IDLE, "X", 200.0, None)

    def test_检查直线插补_绝对模式(self):
        cfgs, 速 = self.gate.检查直线插补(
            运动状态.IDLE, ["X", "Y"], [50.0, 100.0], 速度=400.0, 相对=False,
        )
        self.assertEqual(len(cfgs), 2)
        self.assertEqual(速, 400.0)

    def test_检查直线插补_绝对越界被拒(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查直线插补(
                运动状态.IDLE, ["X", "Y"], [50.0, 999.0], 速度=None, 相对=False,
            )

    def test_检查直线插补_相对模式_附带当前位置(self):
        # X 当前 80，相对走 30 → 110 超正限位 100 ⇒ 拒绝
        with self.assertRaises(SafetyViolation):
            self.gate.检查直线插补(
                运动状态.IDLE, ["X", "Y"], [30.0, 50.0],
                速度=None, 相对=True, 当前位置=[80.0, 100.0],
            )

    def test_检查直线插补_长度不一致(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查直线插补(
                运动状态.IDLE, ["X", "Y"], [10.0], 速度=None, 相对=False,
            )

    def test_检查点动_完整通过(self):
        cfg, 方向, 速 = self.gate.检查点动(运动状态.IDLE, "Y", -1, None)
        self.assertEqual(cfg.名称, "Y")
        self.assertEqual(方向, -1)
        self.assertEqual(速, 500.0)

    def test_检查回零_默认全轴(self):
        cfgs = self.gate.检查回零(运动状态.IDLE, None)
        self.assertEqual([c.名称 for c in cfgs], ["X", "Y"])

    def test_检查回零_指定子集(self):
        cfgs = self.gate.检查回零(运动状态.IDLE, ["Y"])
        self.assertEqual([c.名称 for c in cfgs], ["Y"])

    def test_归一化进给倍率(self):
        self.assertEqual(self.gate.归一化进给倍率(100.0), 100.0)
        with self.assertRaises(SafetyViolation):
            self.gate.归一化进给倍率(-1.0)
        with self.assertRaises(SafetyViolation):
            self.gate.归一化进给倍率(300.0)


class TestCircularChecks(unittest.TestCase):
    """圆弧 / 三点圆弧检查。"""

    def setUp(self):
        路径 = _临时配置(_基础配置())
        self.addCleanup(lambda: os.unlink(路径))
        self.gate = 安全控制器(加载运动配置(路径=路径))

    # 圆心圆弧 ----------------------------------------------------------

    def test_圆心圆弧_合法(self):
        cfgs, 速 = self.gate.检查圆心圆弧(
            运动状态.IDLE, ["X", "Y"],
            终点1=50.0, 终点2=100.0, 圆心1=25.0, 圆心2=50.0,
            方向=0, 速度=300.0, 绝对=True,
        )
        self.assertEqual(len(cfgs), 2)
        self.assertEqual(速, 300.0)

    def test_圆心圆弧_必须2轴(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查圆心圆弧(
                运动状态.IDLE, ["X"],
                终点1=10, 终点2=10, 圆心1=5, 圆心2=5,
                方向=0, 速度=None, 绝对=True,
            )
        with self.assertRaises(SafetyViolation):
            self.gate.检查圆心圆弧(
                运动状态.IDLE, ["X", "Y", "Z"],
                终点1=10, 终点2=10, 圆心1=5, 圆心2=5,
                方向=0, 速度=None, 绝对=True,
            )

    def test_圆心圆弧_方向校验(self):
        for 非法 in (-1, 2, 3):
            with self.subTest(方向=非法):
                with self.assertRaises(SafetyViolation):
                    self.gate.检查圆心圆弧(
                        运动状态.IDLE, ["X", "Y"],
                        终点1=10, 终点2=10, 圆心1=5, 圆心2=5,
                        方向=非法, 速度=None, 绝对=True,
                    )

    def test_圆心圆弧_绝对终点超限拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查圆心圆弧(
                运动状态.IDLE, ["X", "Y"],
                终点1=999.0, 终点2=10, 圆心1=5, 圆心2=5,
                方向=0, 速度=None, 绝对=True,
            )

    def test_圆心圆弧_相对叠加超限拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查圆心圆弧(
                运动状态.IDLE, ["X", "Y"],
                终点1=50.0, 终点2=10.0, 圆心1=10, 圆心2=10,
                方向=0, 速度=None, 绝对=False,
                当前位置=[80.0, 100.0],   # X: 80+50=130 > 100 软限位
            )

    def test_圆心圆弧_未连接拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查圆心圆弧(
                运动状态.DISCONNECTED, ["X", "Y"],
                终点1=10, 终点2=10, 圆心1=5, 圆心2=5,
                方向=0, 速度=None, 绝对=True,
            )

    # 三点圆弧 ----------------------------------------------------------

    def test_三点圆弧_合法(self):
        cfgs, 速 = self.gate.检查三点圆弧(
            运动状态.IDLE, ["X", "Y"],
            中点1=25.0, 中点2=50.0, 终点1=50.0, 终点2=100.0,
            速度=300.0, 绝对=True,
        )
        self.assertEqual(len(cfgs), 2)

    def test_三点圆弧_中间点超限被拒(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查三点圆弧(
                运动状态.IDLE, ["X", "Y"],
                中点1=999.0, 中点2=50.0, 终点1=50.0, 终点2=100.0,
                速度=None, 绝对=True,
            )

    def test_三点圆弧_终点超限被拒(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查三点圆弧(
                运动状态.IDLE, ["X", "Y"],
                中点1=25.0, 中点2=50.0, 终点1=999.0, 终点2=100.0,
                速度=None, 绝对=True,
            )

    def test_三点圆弧_必须2轴(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查三点圆弧(
                运动状态.IDLE, ["X"],
                中点1=10, 中点2=10, 终点1=10, 终点2=10,
                速度=None, 绝对=True,
            )


class TestSpiralChecks(unittest.TestCase):
    def setUp(self):
        # 螺旋需要 ≥ 3 个轴，扩展配置到 3 轴
        路径 = _临时配置({
            "axis_map": {"X": 0, "Y": 1, "Z": 2},
            "axes": {
                "X": {"max_speed": 1000, "soft_limit_pos": 100, "soft_limit_neg": -10},
                "Y": {"max_speed": 1000, "soft_limit_pos": 100, "soft_limit_neg": -10},
                "Z": {"max_speed": 500,  "soft_limit_pos": 50,  "soft_limit_neg": 0},
            },
        })
        self.addCleanup(lambda: os.unlink(路径))
        self.gate = 安全控制器(加载运动配置(路径=路径))

    def test_螺旋_合法3轴(self):
        cfgs, 速 = self.gate.检查螺旋(
            运动状态.IDLE, ["X", "Y", "Z"],
            圆心1=10.0, 圆心2=10.0, 圈数=3, 螺距=5.0,
            第三轴距离=15.0, 第四轴距离=0.0,
            速度=400.0, 当前位置=[10.0, 10.0, 10.0],
        )
        self.assertEqual(len(cfgs), 3)
        self.assertEqual(速, 400.0)

    def test_螺旋_轴数不合法(self):
        for 轴名 in (["X"], ["X", "Y"], ["X", "Y", "Z", "U", "R"]):
            with self.subTest(轴=轴名):
                with self.assertRaises(SafetyViolation):
                    self.gate.检查螺旋(
                        运动状态.IDLE, 轴名,
                        圆心1=1, 圆心2=1, 圈数=1, 螺距=1.0,
                        第三轴距离=1, 第四轴距离=1, 速度=None,
                    )

    def test_螺旋_圈数不能为0(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查螺旋(
                运动状态.IDLE, ["X", "Y", "Z"],
                圆心1=10, 圆心2=10, 圈数=0, 螺距=5.0,
                第三轴距离=10, 第四轴距离=0, 速度=None,
            )

    def test_螺旋_螺距不能为0(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查螺旋(
                运动状态.IDLE, ["X", "Y", "Z"],
                圆心1=10, 圆心2=10, 圈数=2, 螺距=0.0,
                第三轴距离=10, 第四轴距离=0, 速度=None,
            )

    def test_螺旋_第三轴累加超限被拒(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查螺旋(
                运动状态.IDLE, ["X", "Y", "Z"],
                圆心1=10, 圆心2=10, 圈数=3, 螺距=5.0,
                第三轴距离=100.0,    # Z 当前 0 + 100 > 50 软限位
                第四轴距离=0, 速度=None,
                当前位置=[10.0, 10.0, 0.0],
            )


class TestMergeCheck(unittest.TestCase):
    def setUp(self):
        路径 = _临时配置(_基础配置())
        self.addCleanup(lambda: os.unlink(路径))
        self.gate = 安全控制器(加载运动配置(路径=路径))

    def test_合并_IDLE允许(self):
        cfg = self.gate.检查合并(运动状态.IDLE, "X")
        self.assertEqual(cfg.名称, "X")

    def test_合并_MOVING允许(self):
        self.gate.检查合并(运动状态.MOVING, "Y")

    def test_合并_未连接拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查合并(运动状态.DISCONNECTED, "X")

    def test_合并_报警拒绝(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查合并(运动状态.ALARM, "X")

    def test_合并_非法轴(self):
        with self.assertRaises(SafetyViolation):
            self.gate.检查合并(运动状态.IDLE, "Z")


if __name__ == "__main__":
    unittest.main()
