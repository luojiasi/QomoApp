"""RS232 串口 REST API 路由。

前缀：/api/rs232
请求体字段通过 alias 与前端英文 JSON（portName、baudRate 等）对齐；
业务代码中仍可使用中文属性名；传给驱动层时使用 model_dump(by_alias=True)。
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator

from api.dependencies import 获取串口实例
from drivers.driver_rs232 import 串口驱动
from routers.apiresponse import ApiResponse as 返回数据类型模型
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("Rs232HTTP")

路由 = APIRouter(prefix="/api/rs232123", tags=["RS232 串口"])


# ------------------------------------------------------------------
# 请求 / 响应模型（中文属性名 + 与前端一致的英文 alias）
# ------------------------------------------------------------------


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


# ------------------------------------------------------------------
# 依赖（复用同一 Depends 对象，避免重复构造）
# ------------------------------------------------------------------

串口驱动依赖 = Depends(获取串口实例)


# ------------------------------------------------------------------
# 端点
# ------------------------------------------------------------------


@路由.get("/ports", summary="检测端口是否可用", response_model=返回数据类型模型)
def 枚举串口信息(驱动: 串口驱动 = 串口驱动依赖) -> 返回数据类型模型:
    if not 驱动.pyserial是否可用():
        日志.error("pyserial 未安装导致端口不可用")
        return 返回数据类型模型(
            success=False,
            message="pyserial 未安装导致端口不可用",
            data={"ports": []},
        )
    列表 = 驱动.枚举串口信息()
    日志.info("枚举串口信息: %s", 列表)
    return 返回数据类型模型(
        success=True,
        message="枚举串口信息成功",
        data={"ports": 列表},
    )


@路由.get("/status", response_model=返回数据类型模型)
def 串口状态(驱动: 串口驱动 = 串口驱动依赖) -> 返回数据类型模型:
    return 返回数据类型模型(
        success=True,
        message="串口状态查询成功",
        data={
            "connected": 驱动.是否已连接(),
            "portName": 驱动.当前端口名(),
        },
    )


@路由.post("/open", response_model=返回数据类型模型)
def 串口打开(
    请求体: 串口发送接收请求响应模型,
    驱动: 串口驱动 = 串口驱动依赖,
) -> 返回数据类型模型:
    驱动.设置首选会话(请求体.model_dump(by_alias=True))
    串口字典 = 请求体.串口.model_dump(by_alias=True)
    接收字典 = 请求体.接收.model_dump(by_alias=True)
    是否打开会话成功, 错误信息 = 驱动.打开会话(串口字典, 接收字典)
    return 返回数据类型模型(
        success=是否打开会话成功,
        message=错误信息,
        data={
            "connected": 是否打开会话成功,
            "portName": 请求体.串口.串口名 if 是否打开会话成功 else None,
        },
    )


@路由.post("/close", response_model=返回数据类型模型)
def 串口关闭(驱动: 串口驱动 = 串口驱动依赖) -> 返回数据类型模型:
    驱动.关闭()
    return 返回数据类型模型(
        success=True, 
        message="串口已关闭", 
        data={"connected": False}
    )


@路由.post("/workbench-sync", response_model=返回数据类型模型)
def 串口工作台同步(
    请求体: 串口发送接收请求响应模型,
    驱动: 串口驱动 = 串口驱动依赖,
) -> 返回数据类型模型:
    驱动.设置首选会话(请求体.model_dump(by_alias=True))
    return 返回数据类型模型(
        success=True,
        message="RS232 工作台参数已同步",
        data={"portName": 请求体.串口.串口名},
    )


@路由.post("/send", response_model=返回数据类型模型)
def 串口发送(
    请求体: 串口仅发送请求模型,
    驱动: 串口驱动 = 串口驱动依赖,
) -> 返回数据类型模型:
    if not 驱动.是否已连接():
        return 返回数据类型模型(
            success=False,
            message="串口未打开，请先调用 /api/rs232/open",
            data=None,
        )
    if 驱动.当前端口名() != 请求体.串口.串口名:
        return 返回数据类型模型(
            success=False,
            message="请求端口与当前已打开端口不一致",
            data={"currentPort": 驱动.当前端口名()},
        )
    成功, 信息 = 驱动.发送(请求体.发送.model_dump(by_alias=True))
    时间 = datetime.now().isoformat(timespec="milliseconds")
    return 返回数据类型模型(
        success=成功,
        message=信息,
        data={"timestamp": 时间},
    )


@路由.get("/buffer", response_model=返回数据类型模型)
def 串口接收缓冲区(
    是否清空: bool = Query(default=False, alias="clear"),
    驱动: 串口驱动 = 串口驱动依赖,
) -> 返回数据类型模型:
    文本 = 驱动.获取接收缓冲区(清空=是否清空)
    return 返回数据类型模型(success=True, message="OK", data={"text": 文本})
