"""测试 utils.logger 模块 —— 日志初始化、写入、轮转、开关、异常钩子、输出拦截。"""

import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.logger import (
    初始化,
    获取日志记录器,
    设置是否开启,
    拦截标准输出,
)


# ---------------------------------------------------------------------------
# 模块级辅助函数
# ---------------------------------------------------------------------------

def _等待队列排空():
    """等待日志队列排空（异步写入需要短暂等待）。"""
    import utils.logger as _mod
    if _mod._监听器 and _mod._队列:
        time.sleep(0.3)


def _重置日志模块状态():
    """完全重置日志模块的内部状态。"""
    import utils.logger as _mod
    if _mod._监听器:
        _mod._监听器.stop()
        _mod._监听器 = None
    if _mod._文件处理器:
        _mod._文件处理器.close()
        _mod._文件处理器 = None
    _mod._队列 = None
    _mod._根日志记录器 = None
    _mod._拦截已开启 = False
    _mod._全局处理器已安装 = False


class TestLoggerSetup(unittest.TestCase):
    """测试日志系统初始化。"""

    def setUp(self):
        self._临时目录 = tempfile.mkdtemp()
        # 每次测试前重置日志状态
        _重置日志模块状态()

    def tearDown(self):
        _重置日志模块状态()
        # 清理临时目录
        import shutil
        shutil.rmtree(self._临时目录, ignore_errors=True)


    def test_初始化创建日志目录(self):
        初始化(日志目录=self._临时目录)
        self.assertTrue(os.path.isdir(self._临时目录))

    def test_初始化后获取日志记录器(self):
        初始化(日志目录=self._临时目录)
        记录器 = 获取日志记录器("TestModule")
        self.assertIsNotNone(记录器)
        self.assertEqual(记录器.name, "qomo.TestModule")

    def test_关闭状态不写日志文件(self):
        初始化(日志目录=self._临时目录, 日志配置={"是否开启": False})
        记录器 = 获取日志记录器("Test")
        记录器.warning("这条不应该出现")
        _等待队列排空()
        日志文件 = os.path.join(self._临时目录, "qomo_logs.txt")
        self.assertFalse(os.path.exists(日志文件))

    def test_开启状态写入日志文件(self):
        初始化(日志目录=self._临时目录, 日志配置={"是否开启": True})
        记录器 = 获取日志记录器("Test")
        记录器.info("测试日志消息")
        _等待队列排空()
        日志文件 = os.path.join(self._临时目录, "qomo_logs.txt")
        self.assertTrue(os.path.exists(日志文件))
        with open(日志文件, "r", encoding="utf-8") as f:
            内容 = f.read()
        self.assertIn("测试日志消息", 内容)
        self.assertIn("[qomo.Test]", 内容)

    def test_日志格式包含时间戳(self):
        初始化(日志目录=self._临时目录, 日志配置={"是否开启": True})
        记录器 = 获取日志记录器("Format")
        记录器.info("格式测试")
        _等待队列排空()
        日志文件 = os.path.join(self._临时目录, "qomo_logs.txt")
        with open(日志文件, "r", encoding="utf-8") as f:
            内容 = f.read()
        # 格式：[YYYY-MM-DD HH:MM:SS.mmm] [qomo.Format] 格式测试
        import re
        模式 = r"\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] \[qomo\.Format\] 格式测试"
        self.assertRegex(内容.strip(), 模式)


class TestLoggerToggle(unittest.TestCase):
    """测试日志开关。"""

    def setUp(self):
        self._临时目录 = tempfile.mkdtemp()
        _重置日志模块状态()

    def tearDown(self):
        _重置日志模块状态()
        import shutil
        shutil.rmtree(self._临时目录, ignore_errors=True)


    def test_运行时关闭日志(self):
        初始化(日志目录=self._临时目录, 日志配置={"是否开启": True})
        记录器 = 获取日志记录器("Toggle")
        记录器.info("开启时的消息")
        _等待队列排空()

        设置是否开启(False)
        记录器.info("关闭后的消息")
        _等待队列排空()

        日志文件 = os.path.join(self._临时目录, "qomo_logs.txt")
        with open(日志文件, "r", encoding="utf-8") as f:
            内容 = f.read()
        self.assertIn("开启时的消息", 内容)
        self.assertNotIn("关闭后的消息", 内容)

    def test_运行时重新开启日志(self):
        初始化(日志目录=self._临时目录, 日志配置={"是否开启": True})
        记录器 = 获取日志记录器("ReEnable")
        记录器.info("第一条消息")
        _等待队列排空()

        设置是否开启(False)
        设置是否开启(True)
        记录器.info("重新开启后的消息")
        _等待队列排空()

        日志文件 = os.path.join(self._临时目录, "qomo_logs.txt")
        with open(日志文件, "r", encoding="utf-8") as f:
            内容 = f.read()
        self.assertIn("第一条消息", 内容)
        self.assertIn("重新开启后的消息", 内容)


class TestLoggerRotation(unittest.TestCase):
    """测试日志按天轮转。"""

    def setUp(self):
        self._临时目录 = tempfile.mkdtemp()
        _重置日志模块状态()

    def tearDown(self):
        _重置日志模块状态()
        import shutil
        shutil.rmtree(self._临时目录, ignore_errors=True)

    def test_旧日志文件按天轮转(self):
        初始化(日志目录=self._临时目录, 日志配置={"是否开启": True})
        记录器 = 获取日志记录器("Rotation")
        记录器.info("轮转测试消息")
        _等待队列排空()

        日志文件 = os.path.join(self._临时目录, "qomo_logs.txt")
        self.assertTrue(os.path.exists(日志文件))

        # 模拟文件是昨天创建的：先关闭文件句柄，修改时间戳，再重新写入
        设置是否开启(False)  # 关闭释放文件句柄
        昨天时间戳 = time.time() - 86400
        os.utime(日志文件, (昨天时间戳, 昨天时间戳))
        设置是否开启(True)

        # 写一条新日志触发轮转检查
        记录器.info("新一天的消息")
        _等待队列排空()

        # 检查是否有轮转后的文件
        轮转文件列表 = [
            f for f in os.listdir(self._临时目录)
            if f.startswith("qomo_logs_") and f.endswith(".txt")
        ]
        self.assertGreater(len(轮转文件列表), 0, "应该有轮转后的日志文件")


class TestStdoutInterception(unittest.TestCase):
    """测试 stdout/stderr 拦截。"""

    def setUp(self):
        self._临时目录 = tempfile.mkdtemp()
        _重置日志模块状态()

    def tearDown(self):
        # 确保恢复原始 stdout/stderr
        拦截标准输出(False)
        _重置日志模块状态()
        import shutil
        shutil.rmtree(self._临时目录, ignore_errors=True)


    def test_拦截print输出到日志(self):
        初始化(日志目录=self._临时目录, 日志配置={"是否开启": True, "拦截print": True})
        print("通过print输出的消息")
        _等待队列排空()

        日志文件 = os.path.join(self._临时目录, "qomo_logs.txt")
        with open(日志文件, "r", encoding="utf-8") as f:
            内容 = f.read()
        self.assertIn("通过print输出的消息", 内容)
        self.assertIn("[qomo.print]", 内容)

    def test_关闭拦截后恢复正常(self):
        原始stdout = sys.stdout
        初始化(日志目录=self._临时目录, 日志配置={"是否开启": True, "拦截print": True})
        self.assertIsNot(sys.stdout, 原始stdout)
        拦截标准输出(False)
        self.assertIs(sys.stdout, 原始stdout)


if __name__ == "__main__":
    unittest.main()
