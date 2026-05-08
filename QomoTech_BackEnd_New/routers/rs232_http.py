"""RS232 串口 REST API 路由。

前缀：/api/rs232
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator

from services.communicate_control.rs232.rs232_service import Rs232Service
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("Rs232HTTP")

路由 = APIRouter(prefix="/api/rs232", tags=["RS232 串口"])


# ------------------------------------------------------------------
# 请求 / 响应模型（对齐前端 rs232Settings）
# ------------------------------------------------------------------


class Rs232PortConfig(BaseModel):
    portName: str
    baudRate: int = Field(ge=300, le=921_600)
    dataBits: Literal[5, 6, 7, 8]
    parity: Literal["none", "odd", "even", "mark", "space"]
    stopBits: float
    flowControl: Literal["none", "xon_xoff", "rts_cts", "dsr_dtr"]
    timeoutMs: int = Field(ge=0, le=600_000)
    encoding: Literal["utf-8", "gbk", "ascii"]

    @model_validator(mode="after")
    def _校验停止位(self):
        if self.stopBits not in (1, 1.5, 2):
            raise ValueError("stopBits 必须为 1、1.5 或 2")
        return self


class Rs232SendConfig(BaseModel):
    mode: Literal["ascii", "hex"]
    payload: str = ""
    appendCr: bool = True
    appendLf: bool = True
    autoSend: bool = False
    autoSendIntervalMs: int = Field(default=1000, ge=50, le=3_600_000)


class Rs232ReceiveConfig(BaseModel):
    mode: Literal["ascii", "hex"]
    maxBufferLines: int = Field(default=500, ge=10, le=10_000)
    showTimestamp: bool = False
    autoScroll: bool = True


class Rs232SessionRequest(BaseModel):
    """打开串口 / 同步工作台参数时使用。"""
    port: Rs232PortConfig
    send: Optional[Rs232SendConfig] = None
    receive: Rs232ReceiveConfig


class Rs232SendRequest(BaseModel):
    """发送数据时使用。"""
    port: Rs232PortConfig
    send: Rs232SendConfig


# ------------------------------------------------------------------
# 辅助
# ------------------------------------------------------------------


def _service() -> Rs232Service:
    return Rs232Service.获取实例()


def _handle_exc(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=str(exc),
    )


# ------------------------------------------------------------------
# 端点
# ------------------------------------------------------------------


@路由.get("/ports", summary="枚举系统可用串口")
async def 枚举串口():
    """返回当前系统中所有可用串口列表。"""
    svc = _service()
    if not svc.pyserial可用():
        return {"success": False, "message": "未安装 pyserial，无法枚举串口", "data": {"ports": []}}
    ports = svc.枚举串口()
    return {"success": True, "message": "OK", "data": {"ports": ports}}


@路由.get("/status", summary="查询串口连接状态")
async def 串口状态():
    """返回当前连接状态、端口名称及 pyserial 可用性。"""
    svc = _service()
    return {
        "success": True,
        "message": "OK",
        "data": {
            "connected": svc.已连接(),
            "portName": svc.当前端口(),
            "pyserial": svc.pyserial可用(),
        },
    }


@路由.post("/open", summary="打开串口会话")
async def 打开串口(req: Rs232SessionRequest):
    """
    打开指定串口并启动后台接收线程。
    若已有连接会先关闭旧连接。
    """
    svc = _service()
    port = req.port.model_dump()
    receive = req.receive.model_dump()
    try:
        ok, msg = svc.打开会话(port, receive)
    except Exception as exc:
        raise _handle_exc(exc)
    return {
        "success": ok,
        "message": msg,
        "data": {"connected": ok, "portName": req.port.portName if ok else None},
    }


@路由.post("/close", summary="关闭当前串口")
async def 关闭串口():
    """停止接收线程并关闭串口。"""
    try:
        _service().关闭()
    except Exception as exc:
        raise _handle_exc(exc)
    return {"success": True, "message": "串口已关闭", "data": {"connected": False}}


@路由.post("/workbench-sync", summary="同步工作台参数（不打开串口）")
async def 同步工作台参数(req: Rs232SessionRequest):
    """
    前端切换到非 RS232 页面时调用，持久化当前工作台配置供后续参考。
    不打开/关闭串口，只是保存参数。
    """
    try:
        _service().同步会话参数(req.model_dump())
    except Exception as exc:
        raise _handle_exc(exc)
    return {
        "success": True,
        "message": "RS232 工作台参数已同步",
        "data": {"portName": req.port.portName},
    }


@路由.post("/send", summary="向串口发送数据")
async def 发送数据(req: Rs232SendRequest):
    """
    向已打开的串口发送 ASCII 或 HEX 数据。
    发送前会校验当前打开端口与请求端口是否一致。
    """
    svc = _service()
    if not svc.已连接():
        return {"success": False, "message": "串口未打开，请先调用 /api/rs232/open", "data": None}
    if svc.当前端口() != req.port.portName:
        return {
            "success": False,
            "message": "请求端口与当前已打开端口不一致",
            "data": {"currentPort": svc.当前端口()},
        }
    try:
        ok, msg = svc.发送(req.send.model_dump())
    except Exception as exc:
        raise _handle_exc(exc)
    ts = datetime.now().isoformat(timespec="milliseconds")
    return {"success": ok, "message": msg, "data": {"timestamp": ts}}


@路由.get("/buffer", summary="读取接收缓冲区")
async def 读取缓冲区(clear: bool = Query(default=False, description="读取后是否清空缓冲区")):
    """返回后台线程已接收到的全部文本行，可选择同时清空缓冲区。"""
    try:
        text = _service().获取缓冲区(清空=clear)
    except Exception as exc:
        raise _handle_exc(exc)
    return {"success": True, "message": "OK", "data": {"text": text}}
