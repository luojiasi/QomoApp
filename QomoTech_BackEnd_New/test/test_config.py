"""测试 config_utils 模块 —— ConfigDict、加载配置、保存配置、路径注入。"""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.config_utils import ConfigDict, 加载配置, 保存配置, 获取配置
from utils.path_utils import 路径工具


class TestConfigDict(unittest.TestCase):
    """测试 ConfigDict 属性访问。"""

    def test_顶层属性访问(self):
        数据 = {"名称": "测试", "版本": "2.0"}
        c = ConfigDict(数据)
        self.assertEqual(c.名称, "测试")
        self.assertEqual(c.版本, "2.0")

    def test_嵌套属性访问(self):
        数据 = {"软件": {"名称": "Qomo", "版本": "1.0"}}
        c = ConfigDict(数据)
        self.assertEqual(c.软件.名称, "Qomo")
        self.assertEqual(c.软件.版本, "1.0")

    def test_多层嵌套(self):
        数据 = {"a": {"b": {"c": {"值": 42}}}}
        c = ConfigDict(数据)
        self.assertEqual(c.a.b.c.值, 42)

    def test_修改叶子值(self):
        数据 = {"日志": {"级别": "DEBUG"}}
        c = ConfigDict(数据)
        c.日志.级别 = "INFO"
        self.assertEqual(c.日志.级别, "INFO")

    def test_不存在的键抛异常(self):
        c = ConfigDict({"名称": "test"})
        with self.assertRaises(AttributeError):
            _ = c.不存在的键

    def test_in操作符(self):
        c = ConfigDict({"名称": "test"})
        self.assertIn("名称", c)
        self.assertNotIn("不存在", c)

    def test_转为字典(self):
        数据 = {"软件": {"名称": "Qomo"}, "日志": {"级别": "DEBUG"}}
        c = ConfigDict(数据)
        d = c.转为字典()
        self.assertEqual(d, 数据)
        self.assertIsInstance(d, dict)
        self.assertIsInstance(d["软件"], dict)


class TestLoadConfig(unittest.TestCase):
    """测试加载配置逻辑。"""

    def setUp(self):
        import utils.config_utils as _mod
        _mod._全局配置 = None

    def tearDown(self):
        import utils.config_utils as _mod
        _mod._全局配置 = None

    def test_无配置文件时使用空配置并注入路径(self):
        配置 = 加载配置(配置文件路径="/不存在的路径/config.json")
        # 空配置时没有 软件/日志 分类，但路径始终注入
        self.assertEqual(配置.路径.日志目录[-4:], "logs")

    def test_从JSON文件加载嵌套配置(self):
        临时数据 = {
            "软件": {"名称": "测试应用", "版本": "3.0"},
            "日志": {"是否开启": False, "级别": "INFO", "保留天数": 30},
        }
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        ) as f:
            json.dump(临时数据, f)
            临时路径 = f.name

        try:
            配置 = 加载配置(配置文件路径=临时路径)
            self.assertEqual(配置.软件.名称, "测试应用")
            self.assertEqual(配置.软件.版本, "3.0")
            self.assertEqual(配置.日志.级别, "INFO")
            self.assertEqual(配置.日志.保留天数, 30)
            self.assertFalse(配置.日志.是否开启)
        finally:
            os.unlink(临时路径)

    def test_JSON解析失败时仍然注入路径(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        ) as f:
            f.write("这不是合法的JSON {{{")
            临时路径 = f.name

        try:
            配置 = 加载配置(配置文件路径=临时路径)
            self.assertTrue(os.path.isabs(配置.路径.应用根目录))
            self.assertTrue(配置.路径.日志目录.endswith("logs"))
        finally:
            os.unlink(临时路径)

    def test_路径字段自动注入(self):
        配置 = 加载配置()
        self.assertIsNotNone(配置.路径.应用根目录)
        self.assertTrue(os.path.isabs(配置.路径.应用根目录))
        self.assertTrue(os.path.isdir(配置.路径.应用根目录))
        self.assertTrue(配置.路径.日志目录.endswith("logs"))

    def test_获取配置返回相同实例(self):
        配置1 = 加载配置()
        配置2 = 获取配置()
        self.assertIs(配置1, 配置2)


class TestSaveConfig(unittest.TestCase):
    """测试配置持久化。"""

    def setUp(self):
        import utils.config_utils as _mod
        _mod._全局配置 = None

    def tearDown(self):
        import utils.config_utils as _mod
        _mod._全局配置 = None

    def test_保存配置写入JSON(self):
        临时目录 = tempfile.mkdtemp()
        临时文件 = os.path.join(临时目录, "config.json")

        try:
            # 先写入初始配置，再加载
            with open(临时文件, "w", encoding="utf-8") as f:
                json.dump({"软件": {"名称": "测试"}, "日志": {"级别": "DEBUG"}}, f)

            配置 = 加载配置(配置文件路径=临时文件)
            配置.日志.级别 = "WARNING"
            保存配置(配置文件路径=临时文件)

            self.assertTrue(os.path.exists(临时文件))
            with open(临时文件, "r", encoding="utf-8") as f:
                数据 = json.load(f)
            self.assertEqual(数据["日志"]["级别"], "WARNING")
        finally:
            import shutil
            shutil.rmtree(临时目录, ignore_errors=True)

    def test_保存时不会写入路径字段(self):
        临时目录 = tempfile.mkdtemp()
        临时文件 = os.path.join(临时目录, "config.json")

        try:
            with open(临时文件, "w", encoding="utf-8") as f:
                json.dump({"软件": {"名称": "测试"}}, f)

            加载配置(配置文件路径=临时文件)
            保存配置(配置文件路径=临时文件)

            with open(临时文件, "r", encoding="utf-8") as f:
                数据 = json.load(f)
            self.assertNotIn("路径", 数据)
        finally:
            import shutil
            shutil.rmtree(临时目录, ignore_errors=True)

    def test_保存配置自动创建目录(self):
        临时目录 = tempfile.mkdtemp()
        子目录 = os.path.join(临时目录, "深层", "目录")
        临时文件 = os.path.join(子目录, "config.json")

        try:
            加载配置(配置文件路径=临时文件)
            保存配置(配置文件路径=临时文件)
            self.assertTrue(os.path.exists(临时文件))
        finally:
            import shutil
            shutil.rmtree(临时目录, ignore_errors=True)


class TestGetAppDir(unittest.TestCase):
    """测试应用根目录解析。"""

    def test_开发模式下返回项目根目录(self):
        if getattr(sys, "frozen", False):
            self.skipTest("当前在 PyInstaller 环境中运行")
        目录 = 路径工具.获取应用根目录()
        self.assertTrue(os.path.isdir(目录))
        self.assertTrue(os.path.isdir(os.path.join(目录, "core")))


if __name__ == "__main__":
    unittest.main()
