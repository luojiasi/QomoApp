"""RS232 串口 REST API 路由。

前缀：/api/rs232
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query

from routers.apiresponse import ApiResponse as 返回数据类型模型
from services.Rs232Service import Rs232Service
from services.communicate_control.rs232_models import (
    串口发送接收请求响应模型,
    串口仅发送请求模型,
)
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("Rs232HTTP")

路由 = APIRouter(prefix="/api/rs232", tags=["RS232 串口"])


def _rs232() -> Rs232Service:
    return Rs232Service.获取实例()


@路由.get("/ports", summary="检测端口是否可用", response_model=返回数据类型模型)
def 枚举串口信息() -> 返回数据类型模型:
    if not _rs232().pyserial是否可用():
        日志.error("pyserial 未安装导致端口不可用")
        return 返回数据类型模型(
            success=False,
            message="pyserial 未安装导致端口不可用",
            data={"ports": []},
        )
    列表 = _rs232().枚举串口信息()
    日志.info("枚举串口信息: %s", 列表)
    return 返回数据类型模型(
        success=True,
        message="枚举串口信息成功",
        data={"ports": 列表},
    )


@路由.get("/status", response_model=返回数据类型模型)
def 串口状态() -> 返回数据类型模型:
    return 返回数据类型模型(
        success=True,
        message="串口状态查询成功",
        data={
            "connected": _rs232().是否已连接(),
            "portName": _rs232().当前端口名(),
        },
    )


@路由.post("/open", response_model=返回数据类型模型)
def 串口打开(
    请求体: 串口发送接收请求响应模型,
) -> 返回数据类型模型:
    svc = _rs232()
    svc.设置首选会话(请求体.model_dump(by_alias=True))
    串口字典 = 请求体.串口.model_dump(by_alias=True)
    接收字典 = 请求体.接收.model_dump(by_alias=True)
    是否打开会话成功, 错误信息 = svc.打开会话(串口字典, 接收字典)
    return 返回数据类型模型(
        success=是否打开会话成功,
        message=错误信息,
        data={
            "connected": 是否打开会话成功,
            "portName": 请求体.串口.串口名 if 是否打开会话成功 else None,
        },
    )


@路由.post("/close", response_model=返回数据类型模型)
def 串口关闭() -> 返回数据类型模型:
    _rs232().关闭()
    return 返回数据类型模型(
        success=True,
        message="串口已关闭",
        data={"connected": False}
    )


@路由.post("/workbench-sync", response_model=返回数据类型模型)
def 串口工作台同步(
    请求体: 串口发送接收请求响应模型,
) -> 返回数据类型模型:
    _rs232().设置首选会话(请求体.model_dump(by_alias=True))
    return 返回数据类型模型(
        success=True,
        message="RS232 工作台参数已同步",
        data={"portName": 请求体.串口.串口名},
    )


@路由.post("/send", response_model=返回数据类型模型)
def 串口发送(
    请求体: 串口仅发送请求模型,
) -> 返回数据类型模型:
    svc = _rs232()
    if not svc.是否已连接():
        return 返回数据类型模型(
            success=False,
            message="串口未打开，请先调用 /api/rs232/open",
            data=None,
        )
    if svc.当前端口名() != 请求体.串口.串口名:
        return 返回数据类型模型(
            success=False,
            message="请求端口与当前已打开端口不一致",
            data={"currentPort": svc.当前端口名()},
        )
    成功, 信息 = svc.发送(请求体.发送.model_dump(by_alias=True))
    时间 = datetime.now().isoformat(timespec="milliseconds")
    return 返回数据类型模型(
        success=成功,
        message=信息,
        data={"timestamp": 时间},
    )


@路由.get("/buffer", response_model=返回数据类型模型)
def 串口接收缓冲区(
    是否清空: bool = Query(default=False, alias="clear"),
) -> 返回数据类型模型:
    文本 = _rs232().获取接收缓冲区(清空=是否清空)
    return 返回数据类型模型(success=True, message="OK", data={"text": 文本})
