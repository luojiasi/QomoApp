from pydantic import BaseModel, Field


class Rs232Config(BaseModel):
    """后端串口默认值；具体开参以 API 请求体为准。"""

    default_port_name: str = "COM4"
    default_baud_rate: int = Field(default=115200, ge=300, le=921_600)
    read_thread_poll_ms: float = Field(default=50.0, ge=5.0, le=2000.0)
    max_receive_line_length: int = Field(default=4096, ge=256, le=65_536)


rs232_config = Rs232Config()


class 串口配置(BaseModel):
    default_port_name: str = "COM4"
    default_baud_rate: int = Field(default=115200, ge=300, le=921_600)
    read_thread_poll_ms: float = Field(default=50.0, ge=5.0, le=2000.0)
    max_receive_line_length: int = Field(default=4096, ge=256, le=65_536)
串口配置实例 = 串口配置()