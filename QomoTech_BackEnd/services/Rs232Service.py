"""RS232 串口服务单例编排层。

与 MotionService / CameraService 结构对齐，路由层通过单例调用。

用法：
    svc = Rs232Service.获取实例()
    svc.启动()
    svc.停止()
"""

from __future__ import annotations

import threading
from typing import Any

from configs.rs232_config import 串口配置实例
from services.communicate_control.rs232_adapter import 串口驱动
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("串口服务")


class Rs232Service:
    """RS232 串口服务单例编排器。"""

    _实例: Rs232Service | None = None
    _实例锁 = threading.Lock()

    # ------------------------------------------------------------------
    # 单例
    # ------------------------------------------------------------------

    @classmethod
    def 获取实例(cls) -> Rs232Service:
        with cls._实例锁:
            if cls._实例 is None:
                cls._实例 = cls()
            return cls._实例

    @classmethod
    def 重置实例(cls) -> None:
        with cls._实例锁:
            cls._实例 = None

    def __init__(self) -> None:
        self._驱动: 串口驱动 | None = None

    # ==================================================================
    # 生命周期
    # ==================================================================

    def 启动(self) -> None:
        """初始化驱动实例。"""
        if self._驱动 is not None:
            return
        self._驱动 = 串口驱动(串口配置实例)
        日志.info("Rs232Service 已启动")

    def 停止(self) -> None:
        """关闭串口并清理驱动。"""
        if self._驱动 is not None:
            try:
                self._驱动.关闭()
            except Exception as exc:
                日志.warning("关闭串口异常: %s", exc)
            self._驱动 = None
        日志.info("Rs232Service 已停止")

    # ==================================================================
    # 委托方法（透传至 串口驱动）
    # ==================================================================

    def pyserial是否可用(self) -> bool:
        if self._驱动 is None:
            return False
        return self._驱动.pyserial是否可用()

    def 枚举串口信息(self) -> list[dict[str, str]]:
        结果 = 串口驱动.枚举串口信息()
        日志.debug(f"枚举串口: {[p.get('device') for p in 结果]}")
        return 结果

    def 是否已连接(self) -> bool:
        if self._驱动 is None:
            return False
        return self._驱动.是否已连接()

    def 当前端口名(self) -> str | None:
        if self._驱动 is None:
            return None
        return self._驱动.当前端口名()

    def 打开会话(self, 端口配置: dict[str, Any], 接收配置: dict[str, Any]) -> tuple[bool, str]:
        if self._驱动 is None:
            return False, "Rs232Service 未启动"
        成功, 信息 = self._驱动.打开会话(端口配置, 接收配置)
        日志.info(f"打开串口 {'成功' if 成功 else '失败'}: {信息}")
        return 成功, 信息

    def 关闭(self) -> bool:
        if self._驱动 is None:
            return True
        结果 = self._驱动.关闭()
        日志.info("串口已关闭")
        return 结果

    def 设置首选会话(self, 会话: dict[str, Any]) -> None:
        if self._驱动 is not None:
            self._驱动.设置首选会话(会话)
            日志.debug(f"首选会话已设置: {会话.get('port', {}).get('portName', '?')}")

    def 获取首选会话(self) -> dict[str, Any] | None:
        if self._驱动 is None:
            return None
        return self._驱动.获取首选会话()

    def 发送(self, 发送配置: dict[str, Any]) -> tuple[bool, str]:
        if self._驱动 is None:
            return False, "Rs232Service 未启动"
        成功, 信息 = self._驱动.发送(发送配置)
        日志.info(f"串口发送 {'成功' if 成功 else '失败'}: {信息}")
        return 成功, 信息

    def 获取接收缓冲区(self, *, 清空: bool = False) -> str:
        if self._驱动 is None:
            return ""
        文本 = self._驱动.获取接收缓冲区(清空=清空)
        if 文本:
            日志.debug(f"接收缓冲区: {len(文本)} 字符")
        return 文本

    async def 发送激光数据(
        self,
        串口配置: dict[str, Any] | None,
        功率: str,
        频率: str,
        电流: str,
    ) -> bool:
        """
        激光前确保 RS232 可用并分段发送参数。
        发送顺序：1) pow + power  2) frequency + frequency  3) current + current
        每次发送间隔 0.5 秒
        """
        import asyncio

        if 串口配置 is None:
            return False

        端口配置 = 串口配置.get("port")
        接收配置 = 串口配置.get("receive")
        if not isinstance(端口配置, dict) or not isinstance(接收配置, dict):
            日志.error("rs232_open 缺少有效的 port 或 receive")
            return False

        目标端口名 = str(端口配置.get("portName", "")).strip()
        当前端口名 = self.当前端口名() or ""
        需要重开 = (not self.是否已连接()) or (bool(目标端口名) and 当前端口名 != 目标端口名)
        if 需要重开:
            成功, 消息 = await asyncio.to_thread(self.打开会话, 端口配置, 接收配置)
            if not 成功:
                日志.error("RS232 打开失败: %s", 消息)
                return False

        原始发送配置 = 串口配置.get("send")
        基本发送配置: dict[str, Any] = 原始发送配置.copy() if isinstance(原始发送配置, dict) else {}
        基本发送配置.setdefault("mode", "ascii")
        发送数据列表 = [
            f"POW {功率}",
            f"REPF {频率}",
            f"LD1CS {电流}",
        ]

        for 序号, 数据 in enumerate(发送数据列表):
            发送配置 = 基本发送配置.copy()
            发送配置["payload"] = 数据
            成功2, 消息2 = await asyncio.to_thread(self.发送, 发送配置)
            if not 成功2:
                日志.error("RS232 参数发送失败（payload=%s）: %s", 数据, 消息2)
                return False
            if 序号 < len(发送数据列表) - 1:
                await asyncio.sleep(0.5)
        await asyncio.to_thread(self.关闭)
        return True
