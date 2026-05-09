"""RS232 数据模型（中文属性名 + 与前端一致的英文 alias）。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class 串口端口配置模型(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    串口名: str = Field(alias="portName")
    波特率: int = Field(alias="baudRate", ge=300, le=921_600)
    数据位: Literal[5, 6, 7, 8] = Field(alias="dataBits")
    校验位: Literal["none", "odd", "even", "mark", "space"] = Field(alias="parity")
    停止位: float = Field(alias="stopBits")
    流控: Literal["none", "xon_xoff", "rts_cts", "dsr_dtr"] = Field(alias="flowControl")
    超时时间: int = Field(alias="timeoutMs", ge=0, le=600_000)
    编码: Literal["utf-8", "gbk", "ascii"] = Field(alias="encoding")

    @model_validator(mode="after")
    def _停止位校验(self):
        if self.停止位 not in (1, 1.5, 2):
            raise ValueError("停止位必须为 1、1.5 或 2")
        return self


class 串口发送配置模型(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    数据类型: Literal["ascii", "hex"] = Field(alias="mode")
    数据: str = Field(default="", alias="payload")
    附加CR: bool = Field(default=False, alias="appendCr")
    附加LF: bool = Field(default=False, alias="appendLf")
    自动发送: bool = Field(default=False, alias="autoSend")
    自动发送间隔: int = Field(
        default=1000, alias="autoSendIntervalMs", ge=50, le=3_600_000
    )


class 串口接收配置模型(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    数据类型: Literal["ascii", "hex"] = Field(alias="mode")
    最大缓冲行数: int = Field(default=500, alias="maxBufferLines", ge=10, le=10_000)
    显示时间戳: bool = Field(default=False, alias="showTimestamp")
    自动滚动: bool = Field(default=True, alias="autoScroll")


class 串口发送接收请求响应模型(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    串口: 串口端口配置模型 = Field(alias="port")
    发送: 串口发送配置模型 | None = Field(default=None, alias="send")
    接收: 串口接收配置模型 = Field(alias="receive")


class 串口仅发送请求模型(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    串口: 串口端口配置模型 = Field(alias="port")
    发送: 串口发送配置模型 = Field(alias="send")
