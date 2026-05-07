"""路径工具 —— 提供应用根目录解析和路径注册。

所有方法均为静态方法，任何模块可直接导入使用。
"""

import os
import sys


class 路径工具:
    """应用路径解析工具类，全部为静态方法。"""

    @staticmethod
    def 获取应用根目录() -> str:
        """获取应用根目录（兼容 PyInstaller 单文件打包）。

        PyInstaller 单文件模式：sys.frozen=True，exe 所在目录即为应用根目录。
        开发模式：此文件位于 utils/，上级目录即为项目根目录。

        Returns:
            应用根目录的绝对路径。
        """
        if getattr(sys, "frozen", False):
            return os.path.dirname(sys.executable)
        # utils/ 的父目录 = 项目根目录
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    @staticmethod
    def 注册应用路径():
        """将应用根目录加入 sys.path，确保所有模块可导入。

        PyInstaller 打包后，exe 目录默认不在 sys.path 中，
        需要手动注册才能导入同目录下的 core/、utils/ 等模块。

        重复调用安全（不会重复添加）。
        """
        根目录 = 路径工具.获取应用根目录()
        if 根目录 not in sys.path:
            sys.path.insert(0, 根目录)
        return 根目录
