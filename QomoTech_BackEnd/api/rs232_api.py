from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from api.dependencies import get_rs232_driver
from api.schemas import ApiResponse, Rs232SendRequest, Rs232SerialSessionRequest
from drivers.rs232_driver import Rs232Driver


router = APIRouter(prefix="/api/rs232", tags=["rs232"])


@router.get("/ports", response_model=ApiResponse)
def list_serial_ports(driver: Rs232Driver = Depends(get_rs232_driver)) -> ApiResponse:
    if not driver.pyserial_available():
        return ApiResponse(
            success=False,
            message="未安装 pyserial，无法枚举串口",
            data={"ports": []},
        )
    ports = driver.list_ports_info()
    return ApiResponse(success=True, message="OK", data={"ports": ports})


@router.get("/status", response_model=ApiResponse)
def rs232_status(driver: Rs232Driver = Depends(get_rs232_driver)) -> ApiResponse:
    return ApiResponse(
        success=True,
        message="OK",
        data={
            "connected": driver.is_connected(),
            "portName": driver.current_port_name(),
            "pyserial": driver.pyserial_available(),
        },
    )


@router.post("/open", response_model=ApiResponse)
def rs232_open(
    payload: Rs232SerialSessionRequest,
    driver: Rs232Driver = Depends(get_rs232_driver),
) -> ApiResponse:
    payload_dict = payload.model_dump()
    driver.set_preferred_session(payload_dict)
    port = payload.port.model_dump()
    receive = payload.receive.model_dump()
    ok, msg = driver.open_session(port, receive)
    return ApiResponse(
        success=ok,
        message=msg,
        data={"connected": ok, "portName": payload.port.portName if ok else None},
    )


@router.post("/close", response_model=ApiResponse)
def rs232_close(driver: Rs232Driver = Depends(get_rs232_driver)) -> ApiResponse:
    driver.close()
    return ApiResponse(success=True, message="串口已关闭", data={"connected": False})


@router.post("/workbench-sync", response_model=ApiResponse)
def rs232_workbench_sync(
    payload: Rs232SerialSessionRequest,
    driver: Rs232Driver = Depends(get_rs232_driver),
) -> ApiResponse:
    payload_dict = payload.model_dump()
    driver.set_preferred_session(payload_dict)
    return ApiResponse(
        success=True,
        message="RS232 工作台参数已同步",
        data={"portName": payload.port.portName},
    )


@router.post("/send", response_model=ApiResponse)
def rs232_send(
    payload: Rs232SendRequest,
    driver: Rs232Driver = Depends(get_rs232_driver),
) -> ApiResponse:
    if not driver.is_connected():
        return ApiResponse(success=False, message="串口未打开，请先调用 /api/rs232/open", data=None)
    if driver.current_port_name() != payload.port.portName:
        return ApiResponse(
            success=False,
            message="请求端口与当前已打开端口不一致",
            data={"currentPort": driver.current_port_name()},
        )
    ok, msg = driver.send(payload.send.model_dump())
    ts = datetime.now().isoformat(timespec="milliseconds")
    return ApiResponse(
        success=ok,
        message=msg,
        data={"timestamp": ts},
    )


@router.get("/buffer", response_model=ApiResponse)
def rs232_buffer(
    clear: bool = Query(default=False),
    driver: Rs232Driver = Depends(get_rs232_driver),
) -> ApiResponse:
    text = driver.get_receive_buffer(clear=clear)
    return ApiResponse(success=True, message="OK", data={"text": text})
