"""运动控制 REST API 路由。

前缀：/api/motion
"""

from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.motion_control.motion_service import MotionService
from services.motion_control.zmc_adapter import ZMCError
from services.motion_control.safety_controller import SafetyViolation
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("MotionHTTP")

路由 = APIRouter(prefix="/api/motion", tags=["运动控制"])


# ------------------------------------------------------------------
# 请求 / 响应模型
# ------------------------------------------------------------------


class ConnectRequest(BaseModel):
    ip: str = Field(..., examples=["192.168.0.11"], description="ZMC 控制器 IP 地址")



class JogRequest(BaseModel):
    axis: str = Field(..., examples=["X"], description="轴名称 X/Y/Z/U/R")
    direction: int = Field(..., ge=-1, le=1, description="方向: 1=正向, -1=负向")
    speed: Optional[float] = Field(None, gt=0, description="点动速度（单位/秒），不填则使用配置默认值")


class JogStopRequest(BaseModel):
    axis: str = Field(..., examples=["X"])


class AbsMoveRequest(BaseModel):
    axis: str = Field(..., description="轴名称")
    position: float = Field(..., description="目标绝对位置")
    speed: Optional[float] = Field(None, gt=0)


class LinearMoveRequest(BaseModel):
    axes: List[str] = Field(..., description="轴名称列表，如 ['X','Y','Z']")
    positions: List[float] = Field(..., description="对应目标位置列表")
    speed: Optional[float] = Field(None, gt=0)
    relative: bool = Field(False, description="True=相对运动，False=绝对运动")


class HomeRequest(BaseModel):
    axes: Optional[List[str]] = Field(None, description="要回零的轴，不填则全轴")


class CircleMoveRequest(BaseModel):
    """圆心定 2 点圆弧。axes 必须是 2 个轴。"""
    axes: List[str] = Field(..., examples=[["X", "Y"]], description="参与圆弧的 2 个轴")
    end1: float = Field(..., description="第一个轴终点坐标")
    end2: float = Field(..., description="第二个轴终点坐标")
    center1: float = Field(..., description="第一个轴圆心（相对起始点）")
    center2: float = Field(..., description="第二个轴圆心（相对起始点）")
    direction: str = Field("ccw", description="ccw=逆时针, cw=顺时针")
    speed: Optional[float] = Field(None, gt=0)
    relative: bool = Field(False, description="True=终点为相对位移；False=绝对坐标")


class Circle3PMoveRequest(BaseModel):
    """三点定圆弧（起点 + 中间点 + 终点）。axes 必须是 2 个轴。"""
    axes: List[str] = Field(..., examples=[["X", "Y"]], description="参与圆弧的 2 个轴")
    mid1: float = Field(..., description="第一个轴中间点坐标")
    mid2: float = Field(..., description="第二个轴中间点坐标")
    end1: float = Field(..., description="第一个轴终点坐标")
    end2: float = Field(..., description="第二个轴终点坐标")
    speed: Optional[float] = Field(None, gt=0)
    relative: bool = Field(False, description="True=中点/终点为相对起始点位移")


class SpiralMoveRequest(BaseModel):
    """螺旋插补 —— 3 或 4 轴，全部相对运动。"""
    axes: List[str] = Field(..., examples=[["X", "Y", "Z"]], description="参与的 3 或 4 个轴")
    center1: float = Field(..., description="圆弧主平面第一轴圆心（相对起始点）")
    center2: float = Field(..., description="圆弧主平面第二轴圆心（相对起始点）")
    circles: int = Field(..., ge=1, description="圈数")
    pitch: float = Field(..., description="螺距（每圈第三轴前进距离），不能为 0")
    third_distance: float = Field(0.0, description="第三轴总位移（≈ circles × pitch）")
    fourth_distance: float = Field(0.0, description="第四轴总位移（仅 4 轴模式有效）")
    speed: Optional[float] = Field(None, gt=0)


class MergeRequest(BaseModel):
    """开 / 关 MERGE（连续轨迹合并）。"""
    axis: str = Field(..., examples=["X"], description="主导轴名")


# ------------------------------------------------------------------
# 辅助
# ------------------------------------------------------------------


def _service() -> MotionService:
    return MotionService.获取实例()


def _handle_exc(exc: Exception) -> HTTPException:
    if isinstance(exc, SafetyViolation):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if isinstance(exc, ZMCError):
        return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ------------------------------------------------------------------
# 端点
# ------------------------------------------------------------------


@路由.get("/state", summary="获取当前状态与五轴位置")
async def 获取状态():
    """返回控制器状态、各轴指令位置、实际位置、空闲标志。"""
    snap = _service().获取状态快照()
    return snap.to_dict()


@路由.post("/connect", summary="连接控制器")
async def 连接控制器(req: ConnectRequest):
    try:
        await _service().连接(req.ip)
        return {"message": f"已连接 {req.ip}"}
    except Exception as exc:
        raise _handle_exc(exc)

@路由.post("/disconnect", summary="断开控制器")
async def 断开控制器():
    try:
        await _service().断开()
        return {"message": "已断开"}
    except Exception as exc:
        raise _handle_exc(exc)

@路由.post("/home", summary="指定轴回零")
async def 回零(req: HomeRequest):
    try:
        await _service().归位(req.axes)
        return {"message": "回零完成"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/jog", summary="开始点动")
async def 开始点动(req: JogRequest):
    try:
        await _service().点动(req.axis, req.direction, req.speed)
        return {"message": f"轴 {req.axis} 开始点动，方向 {req.direction}"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/jog/stop", summary="停止点动")
async def 停止点动(req: JogStopRequest):
    try:
        await _service().停止点动(req.axis)
        return {"message": f"轴 {req.axis} 点动已停止"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/move/abs", summary="单轴绝对运动")
async def 绝对运动(req: AbsMoveRequest):
    try:
        await _service().绝对运动(req.axis, req.position, req.speed)
        return {"message": f"轴 {req.axis} 运动至 {req.position}"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/move/linear", summary="多轴直线插补")
async def 直线插补(req: LinearMoveRequest):
    if len(req.axes) != len(req.positions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="axes 与 positions 列表长度必须一致"
        )
    try:
        await _service().直线插补(req.axes, req.positions, req.speed, req.relative)
        return {"message": "直线插补指令已下发"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/move/circle", summary="圆心定 2 点圆弧")
async def 圆弧插补(req: CircleMoveRequest):
    if len(req.axes) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="圆弧插补必须 2 个轴"
        )
    try:
        await _service().圆弧插补(
            req.axes, req.end1, req.end2, req.center1, req.center2,
            方向=req.direction, 速度=req.speed, 相对=req.relative,
        )
        return {"message": "圆弧指令已下发"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/move/circle3p", summary="三点定圆弧")
async def 三点圆弧插补(req: Circle3PMoveRequest):
    if len(req.axes) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="圆弧插补必须 2 个轴"
        )
    try:
        await _service().三点圆弧插补(
            req.axes, req.mid1, req.mid2, req.end1, req.end2,
            速度=req.speed, 相对=req.relative,
        )
        return {"message": "三点圆弧指令已下发"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/move/spiral", summary="螺旋插补")
async def 螺旋插补(req: SpiralMoveRequest):
    if len(req.axes) not in (3, 4):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="螺旋插补需要 3 或 4 个轴"
        )
    try:
        await _service().螺旋插补(
            req.axes, req.center1, req.center2,
            req.circles, req.pitch,
            req.third_distance, req.fourth_distance,
            速度=req.speed,
        )
        return {"message": "螺旋指令已下发"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/merge/enable", summary="启用连续轨迹（MERGE=1）")
async def 启用连续轨迹(req: MergeRequest):
    try:
        await _service().启用连续轨迹(req.axis)
        return {"message": f"连续轨迹已启用（主轴 {req.axis}）"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/merge/disable", summary="关闭连续轨迹（MERGE=0）")
async def 关闭连续轨迹(req: MergeRequest):
    try:
        await _service().关闭连续轨迹(req.axis)
        return {"message": f"连续轨迹已关闭（主轴 {req.axis}）"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/pause", summary="暂停运动")
async def 暂停运动():
    try:
        await _service().暂停()
        return {"message": "运动已暂停"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/resume", summary="继续运动")
async def 继续运动():
    try:
        await _service().继续()
        return {"message": "运动已继续"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/stop", summary="停止运动（减速停止）")
async def 停止运动():
    try:
        await _service().停止()
        return {"message": "运动已停止"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/estop", summary="紧急停止")
async def 紧急停止():
    try:
        await _service().急停()
        return {"message": "急停已执行"}
    except Exception as exc:
        raise _handle_exc(exc)


@路由.post("/reset", summary="清除报警，恢复 IDLE")
async def 清除报警():
    try:
        await _service().复位()
        return {"message": "报警已清除"}
    except Exception as exc:
        raise _handle_exc(exc)
