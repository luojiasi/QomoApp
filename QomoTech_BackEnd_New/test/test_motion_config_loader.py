"""测试运动控制配置加载与校验。"""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.motion_control.config_loader import (
    加载运动配置,
    运动配置,
    控制器配置,
    轴配置,
    安全配置,
    监控配置,
)
from services.motion_control.models import 运动状态, 状态快照, 轴快照


class TestLoadActualConfig(unittest.TestCase):
    """加载项目根目录下的真实 motion_config.json。"""

    def test_加载默认配置成功(self):
        cfg = 加载运动配置()
        self.assertIsInstance(cfg, 运动配置)
        self.assertIsInstance(cfg.控制器, 控制器配置)
        self.assertIsInstance(cfg.安全, 安全配置)
        self.assertIsInstance(cfg.监控, 监控配置)

    def test_轴映射5轴齐全(self):
        cfg = 加载运动配置()
        for 名 in ["X", "Y", "Z", "U", "R"]:
            self.assertIn(名, cfg.轴映射)
            self.assertIn(名, cfg.轴)

    def test_轴号唯一(self):
        cfg = 加载运动配置()
        轴号 = list(cfg.轴映射.values())
        self.assertEqual(len(set(轴号)), len(轴号))

    def test_监控字段已加载(self):
        cfg = 加载运动配置()
        self.assertEqual(cfg.监控.状态轮询毫秒, 50)
        self.assertGreaterEqual(cfg.监控.最大订阅数, 1)


class TestLoadFromTempFile(unittest.TestCase):
    """通过临时文件验证默认值与字段解析。"""

    def _写入临时配置(self, 数据: dict) -> str:
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8")
        json.dump(数据, f, ensure_ascii=False)
        f.close()
        return f.name

    def test_缺失文件抛FileNotFoundError(self):
        with self.assertRaises(FileNotFoundError):
            加载运动配置(路径="/不存在/motion_config.json")

    def test_缺失axis_map抛ValueError(self):
        路径 = self._写入临时配置({"controller": {"ip": "10.0.0.1"}})
        try:
            with self.assertRaises(ValueError):
                加载运动配置(路径=路径)
        finally:
            os.unlink(路径)

    def test_重复轴号抛ValueError(self):
        路径 = self._写入临时配置({
            "axis_map": {"X": 0, "Y": 0},
            "axes": {},
        })
        try:
            with self.assertRaises(ValueError):
                加载运动配置(路径=路径)
        finally:
            os.unlink(路径)

    def test_轴定义缺失时使用默认值(self):
        路径 = self._写入临时配置({
            "axis_map": {"X": 0},
            "axes": {},        # 故意为空，让 axes.X 走默认值
        })
        try:
            cfg = 加载运动配置(路径=路径)
            轴 = cfg.取轴("X")
            self.assertEqual(轴.轴号, 0)
            self.assertEqual(轴.最大速度, 5000.0)
            self.assertEqual(轴.脉冲当量, 1.0)
            self.assertEqual(轴.轴类型, 1)
        finally:
            os.unlink(路径)

    def test_自定义字段被正确加载(self):
        路径 = self._写入临时配置({
            "controller": {"ip": "10.20.30.40", "timeout_ms": 7000},
            "axis_map": {"X": 0},
            "axes": {
                "X": {
                    "max_speed": 8888,
                    "accel": 333,
                    "decel": 222,
                    "soft_limit_pos": 999.0,
                    "soft_limit_neg": -1.0,
                    "pulse_per_unit": 4000.0,
                    "atype": 65,
                    "home_mode": 21,
                }
            },
            "monitor": {"status_poll_ms": 100, "max_subscribers": 4, "queue_size": 2},
        })
        try:
            cfg = 加载运动配置(路径=路径)
            self.assertEqual(cfg.控制器.ip, "10.20.30.40")
            self.assertEqual(cfg.控制器.timeout_ms, 7000)
            轴 = cfg.取轴("X")
            self.assertEqual(轴.最大速度, 8888.0)
            self.assertEqual(轴.加速度, 333.0)
            self.assertEqual(轴.减速度, 222.0)
            self.assertEqual(轴.软限位正, 999.0)
            self.assertEqual(轴.软限位负, -1.0)
            self.assertEqual(轴.脉冲当量, 4000.0)
            self.assertEqual(轴.轴类型, 65)
            self.assertEqual(轴.回零模式, 21)
            self.assertEqual(cfg.监控.状态轮询毫秒, 100)
            self.assertEqual(cfg.监控.最大订阅数, 4)
            self.assertEqual(cfg.监控.队列上限, 2)
        finally:
            os.unlink(路径)

    def test_监控轮询周期下限保护(self):
        路径 = self._写入临时配置({
            "axis_map": {"X": 0},
            "axes": {},
            "monitor": {"status_poll_ms": 1},   # 太低，应被夹到 10
        })
        try:
            cfg = 加载运动配置(路径=路径)
            self.assertGreaterEqual(cfg.监控.状态轮询毫秒, 10)
        finally:
            os.unlink(路径)

    def test_未知轴抛KeyError(self):
        路径 = self._写入临时配置({"axis_map": {"X": 0}, "axes": {}})
        try:
            cfg = 加载运动配置(路径=路径)
            with self.assertRaises(KeyError):
                cfg.取轴("不存在")
        finally:
            os.unlink(路径)


class TestSnapshotSerialization(unittest.TestCase):
    """状态快照 to_dict() 必须与 routers/motion_ws.py 推送契约一致。"""

    def test_未连接快照(self):
        snap = 状态快照.未连接()
        d = snap.to_dict()
        self.assertEqual(d["state"], "DISCONNECTED")
        self.assertEqual(d["position"], {})
        self.assertEqual(d["mposition"], {})

    def test_完整快照含所有约定字段(self):
        snap = 状态快照(
            状态=运动状态.MOVING,
            轴={
                "X": 轴快照(名称="X", 轴号=0, 指令位置=10.5, 实际位置=10.4, 空闲=False),
                "Y": 轴快照(名称="Y", 轴号=1, 指令位置=20.0, 实际位置=20.0, 空闲=True),
            },
        )
        d = snap.to_dict()
        self.assertEqual(d["state"], "MOVING")
        self.assertEqual(d["position"], {"X": 10.5, "Y": 20.0})
        self.assertEqual(d["mposition"], {"X": 10.4, "Y": 20.0})
        self.assertEqual(d["idle"], {"X": False, "Y": True})
        self.assertIn("timestamp", d)
        self.assertEqual(len(d["axes"]), 2)


if __name__ == "__main__":
    unittest.main()
