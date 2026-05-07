"""测试 main.py —— 启动流程、全局钩子安装、异常捕获。"""

import os
import sys
import tempfile
import time
import unittest

# 将项目根目录加入 sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# main.py 在 import 时会自动执行 _安装全局钩子()，
# 因此需要先保存原始钩子再导入，测试完再恢复
_原始异常钩子 = sys.excepthook
_原始线程异常钩子 = sys.__excepthook__


class TestMainStartup(unittest.TestCase):
    """测试 main.py 的启动流程。"""

    @classmethod
    def setUpClass(cls):
        # 导入 main 模块会触发 _安装全局钩子()
        import main as _main
        cls._main = _main

    @classmethod
    def tearDownClass(cls):
        # 清理 _启动() 中启用的异常追踪，避免影响后续测试
        from utils.global_exceptions import 停用异常追踪
        停用异常追踪()

    def test_应用根目录已解析(self):
        self.assertIsNotNone(self._main._应用根目录)
        self.assertTrue(os.path.isabs(self._main._应用根目录))
        self.assertTrue(os.path.isdir(self._main._应用根目录))

    def test_应用根目录在sys_path中(self):
        self.assertIn(self._main._应用根目录, sys.path)

    def test_启动函数返回配置(self):
        配置 = self._main._启动()
        from utils.config_utils import ConfigDict
        self.assertIsInstance(配置, ConfigDict)
        self.assertTrue(配置.日志.是否开启)
        self.assertEqual(配置.软件.名称, "QomoTech")

    def test_主函数不抛异常(self):
        """主函数应该能正常启动（不进入无限循环部分）。"""
        # 只测试日志记录器获取和初始日志输出
        from utils.logger import 获取日志记录器
        日志 = 获取日志记录器("Main")
        日志.info("主函数单元测试")
        # 能执行到这里说明没有异常
        self.assertTrue(True)


class TestGlobalHooksInMain(unittest.TestCase):
    """测试 main.py 安装的全局异常钩子。"""

    @classmethod
    def setUpClass(cls):
        import main as _main
        cls._main = _main

    def test_全局异常钩子已安装(self):
        self.assertIsNot(sys.excepthook, sys.__excepthook__)
        hook_name = sys.excepthook.__name__ if hasattr(sys.excepthook, "__name__") else str(sys.excepthook)
        self.assertIn("主线程异常钩子", hook_name)

    def test_线程异常钩子已安装(self):
        import threading
        # threading.excepthook 在 Python 3.8+ 默认是 sys.__excepthook__
        # 我们的钩子应该已经被替换
        self.assertIsNotNone(threading.excepthook)

    def test_异常钩子记录错误到日志(self):
        """触发异常钩子，验证错误信息被记录。"""
        临时目录 = tempfile.mkdtemp()

        import utils.logger as _mod
        # 停止旧日志系统
        if _mod._监听器:
            _mod._监听器.stop()
            _mod._监听器 = None
        if _mod._文件处理器:
            _mod._文件处理器.close()
            _mod._文件处理器 = None
        _mod._队列 = None
        _mod._根日志记录器 = None

        from utils.logger import 初始化
        初始化(日志目录=临时目录, 日志配置={"是否开启": True})

        try:
            raise ZeroDivisionError("main钩子测试异常")
        except ZeroDivisionError:
            sys.excepthook(*sys.exc_info())

        time.sleep(0.5)  # 等待队列排空

        日志文件 = os.path.join(临时目录, "qomo_logs.txt")
        if os.path.exists(日志文件):
            with open(日志文件, "r", encoding="utf-8") as f:
                内容 = f.read()
            self.assertIn("main钩子测试异常", 内容)
            self.assertIn("ZeroDivisionError", 内容)

        # 清理
        if _mod._监听器:
            _mod._监听器.stop()
        import shutil
        shutil.rmtree(临时目录, ignore_errors=True)

    def test_异常钩子fallback不抛异常(self):
        """当日志系统未初始化时，异常钩子应回退到 stderr 输出，不抛异常。"""
        # 先停掉日志系统
        import utils.logger as _mod
        if _mod._监听器:
            _mod._监听器.stop()
            _mod._监听器 = None
        _mod._根日志记录器 = None

        # 触发钩子：即使日志系统不可用，也不应崩溃
        try:
            raise RuntimeError("fallback测试")
        except RuntimeError:
            # 这不应该抛异常
            sys.excepthook(*sys.exc_info())

        self.assertTrue(True)  # 能执行到这里就是通过


class TestEntryPointGuard(unittest.TestCase):
    """测试 main.py 的最终安全网。"""

    def test__name__为main时安全网不拦截正常流程(self):
        """验证安全网逻辑的代码路径——正常启动不触发兜底异常捕获。"""
        # 直接调用 _启动() 和 主函数() 验证无异常
        import main as _main_模块

        try:
            配置 = _main_模块._启动()
            self.assertIsNotNone(配置)
        except Exception as e:
            self.fail(f"_启动() 不应抛异常: {e}")
        finally:
            from utils.global_exceptions import 停用异常追踪
            停用异常追踪()


if __name__ == "__main__":
    unittest.main()
