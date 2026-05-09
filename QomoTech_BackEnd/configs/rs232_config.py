"""RS232 串口默认配置 —— Pydantic 硬编码默认值。

设计约束：
  - 仅承载"后端启动时的兜底默认值"；
  - 实际打开端口时以 API 请求体（前端传入的 port/baud/parity 等）为准；
  - 与原 config/rs232_config.py 字段保持一致，方便 Rs232Service 切换。
"""
from __future__ import annotations
from pydantic import BaseModel, Field


class 串口配置(BaseModel):
    """串口运行参数。

    字段说明：
      default_port_name        默认串口名（首次启动若前端未下发会用它）
      default_baud_rate        默认波特率
      read_thread_poll_ms      读取线程的轮询周期，影响接收延迟与 CPU 占用
      max_receive_line_length  单条接收数据的最大字节数，超过即截断保护内存
    """
    default_port_name: str = "COM4"
    default_baud_rate: int = Field(default=115200, ge=300, le=921_600)
    read_thread_poll_ms: float = Field(default=50.0, ge=5.0, le=2000.0)
    max_receive_line_length: int = Field(default=4096, ge=256, le=65_536)

串口配置实例 = 串口配置()
