"""运动控制 REST API 路由。

前缀：``/api/motion``

按业务分组覆盖 ``MotionService`` 的全部公开方法：

1. 生命周期：connect / disconnect / reset
2. 状态查询：state / axes / dpos / mpos / idle / position
3. 单轴运动：home / jog / jog-stop / move-abs / move-rel / move-abs-with-speed
4. 多轴插补：linear / circle / circle3p / spiral / 5axis / 3p2 / contour / contour-xy
5. 连续轨迹合并：merge enable / disable
6. 暂停停止：pause / resume / stop / estop
7. U / R 业务旋转：u-rotate / r-rotate / r-position
8. IO：output / input
9. 轴参数：params / backlash / soft-limit / clear-error / zero
10. 工具：wait-idle / cmd

约定：
- 成功返回 ``{"success": True, "message": "...", "data": ...}``。
- ``SafetyViolation`` → ``HTTP 400``；``ZMCError`` → ``HTTP 502``；其它 → ``HTTP 500``。
- 所有写指令为 POST + JSON Body；纯查询为 GET（路径或 query 参数）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from fastapi import APIRouter, HTTPException, Path, Query, Request, status
from pydantic import BaseModel, Field

from services.MotionService import MotionService
from services.motion_control.config_persistence import 保存到文件, 从文件加载
from services.motion_control.safe_controller import SafetyViolation
from services.motion_control.zmc_adapter import ZMCError
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("运动HTTP")

路由 = APIRouter(prefix="/api/motion", tags=["运动控制"])


# ==================================================================
# 请求模型
# ==================================================================


class 连接设备请求模型(BaseModel):
    ip: Optional[str] = Field(
        default=None,
        examples=["192.168.0.11"],
        description="ZMC 控制器 IP 地址；不填则使用配置默认 IP",
    )


class 回零请求模型(BaseModel):
    axes: Optional[List[str]] = Field(
        default=None, description="要回零的轴名，不填则全轴"
    )


class 点动请求模型(BaseModel):
    axis: str = Field(..., examples=["X"], description="轴名 X/Y/Z/U/R")
    direction: int = Field(..., ge=-1, le=1, description="方向：1=正向，-1=负向")
    speed: Optional[float] = Field(
        default=None, gt=0, description="点动速度，不填使用配置默认"
    )


class 点动暂停请求模型(BaseModel):
    axis: str = Field(..., examples=["X"])


class 轴运动请求模型(BaseModel):
    axis: str = Field(..., description="轴名")
    position: float = Field(..., description="目标位置")
    speed: Optional[float] = Field(default=None, gt=0)


class 轴运动带速度请求模型(BaseModel):
    axis: str = Field(..., description="轴名")
    position: float = Field(..., description="目标绝对位置")
    speed: float = Field(..., gt=0, description="本次运动速度（必填）")


class 直线插补请求模型(BaseModel):
    axes: List[str] = Field(..., description="轴名列表，如 ['X','Y','Z']")
    positions: List[float] = Field(..., description="对应目标位置列表")
    speed: Optional[float] = Field(default=None, gt=0)
    relative: bool = Field(False, description="True=相对位移，False=绝对位置")


class 圆心定圆弧请求模型(BaseModel):
    """圆心定 2 点圆弧。axes 必须是 2 个轴。"""

    axes: List[str] = Field(..., examples=[["X", "Y"]])
    end1: float = Field(..., description="第一个轴终点坐标")
    end2: float = Field(..., description="第二个轴终点坐标")
    center1: float = Field(..., description="第一个轴圆心相对起点的偏移")
    center2: float = Field(..., description="第二个轴圆心相对起点的偏移")
    direction: str = Field("ccw", description="ccw=逆时针，cw=顺时针")
    speed: Optional[float] = Field(default=None, gt=0)
    relative: bool = Field(False, description="True=终点为相对偏移；False=绝对坐标")


class 三点圆弧请求模型(BaseModel):
    """三点圆弧（起点+中间点+终点）。axes 必须是 2 个轴。"""

    axes: List[str] = Field(..., examples=[["X", "Y"]])
    mid1: float = Field(..., description="第一个轴中间点")
    mid2: float = Field(..., description="第二个轴中间点")
    end1: float = Field(..., description="第一个轴终点")
    end2: float = Field(..., description="第二个轴终点")
    speed: Optional[float] = Field(default=None, gt=0)
    relative: bool = Field(False, description="True=中点/终点为相对偏移")


class 螺旋插补请求模型(BaseModel):
    """螺旋插补 —— 3 或 4 轴，全部相对运动。"""

    axes: List[str] = Field(..., examples=[["X", "Y", "Z"]])
    center1: float = Field(..., description="主平面第一轴圆心相对偏移")
    center2: float = Field(..., description="主平面第二轴圆心相对偏移")
    circles: int = Field(..., ge=1, description="圈数")
    pitch: float = Field(..., description="螺距，每圈第三轴前进距离，不能为 0")
    third_distance: float = Field(0.0, description="第三轴总位移（≈ circles × pitch）")
    fourth_distance: float = Field(0.0, description="第四轴总位移（仅 4 轴模式）")
    speed: Optional[float] = Field(default=None, gt=0)


class 五轴联动直线请求模型(BaseModel):
    """五轴联动直线。positions 长度必须为 5（X/Y/Z/U/R 顺序）。"""

    positions: List[float] = Field(..., min_length=5, max_length=5)
    speed: Optional[float] = Field(default=None, gt=0)
    relative: bool = Field(False)


class 二轴先动和三轴联动请求模型(BaseModel):
    """3+2 定向加工：U/R 锁定 + XYZ 三轴联动。"""

    u_angle: float = Field(..., description="U 轴目标角度")
    r_angle: float = Field(..., description="R 轴目标角度")
    xyz_path: List[List[float]] = Field(..., description="XYZ 路径段列表，每段 3 元素")
    locate_speed: Optional[float] = Field(default=None, gt=0, description="U/R 定位速度")
    machining_speed: Optional[float] = Field(
        default=None, gt=0, description="XYZ 加工速度"
    )
    locate_wait_timeout_s: float = Field(30.0, gt=0, description="U/R 定位等待超时秒")
    relative_xyz: bool = Field(False, description="True=XYZ 路径为相对位移")


class XY连续插补请求模型(BaseModel):
    """连续插补 XY —— 路径点为 dict / list 任一形式。

    注:整条路径使用单一 speed,路径点中的 speed 字段会被后端忽略
    (向前兼容老前端,但实际生效的只有顶层 speed)。
    """

    path: List[Any] = Field(..., description="路径点列表（dict 或 list，speed 字段已忽略）")
    speed: Optional[float] = Field(default=None, gt=0, description="整条路径统一速度(None=用 motion_config.speed)")
    merge_enable: bool = Field(True)
    auto_corner_decel: bool = Field(True)
    auto_small_circle_limit: bool = Field(True)
    auto_corner_angle: bool = Field(False)
    decel_angle_deg: float = Field(15.0, gt=0, le=181, description="开始减速的拐角阈值(度)")
    stop_angle_deg: float = Field(45.0, gt=0, le=181, description="强制停止的拐角阈值(度)")


class ContourMultiRequest(BaseModel):
    """通用连续插补 —— 任意轴名集合。

    注:整条路径使用单一 speed,路径点中的 speed 字段会被后端忽略。
    """

    axes: List[str] = Field(..., min_length=1)
    path: List[Any] = Field(..., description="路径点列表（speed 字段已忽略）")
    speed: Optional[float] = Field(default=None, gt=0, description="整条路径统一速度")
    merge_enable: bool = Field(True)
    auto_corner_decel: bool = Field(True)
    decel_angle_deg: float = Field(15.0, gt=0, le=181)
    stop_angle_deg: float = Field(45.0, gt=0, le=181)


class 连续轨迹请求模型(BaseModel):
    axis: str = Field(..., examples=["X"], description="主导轴名")


class UR轴参数请求模型(BaseModel):
    """U/R 参数化旋转 —— 透传业务级参数 dict。"""

    params: Dict[str, Any] = Field(..., description="业务参数字典")


class U轴角度请求模型(BaseModel):
    angle: float = Field(..., description="目标角度（度）")


class R轴持续旋转请求模型(BaseModel):
    speed: Optional[float] = Field(default=None, gt=0, description="R 轴持续旋转速度")


class IO值请求模型(BaseModel):
    io: int = Field(..., ge=0, description="输出口编号")
    value: bool = Field(..., description="True=ON / False=OFF")


class 轴参数请求模型(BaseModel):
    axis: str = Field(..., description="轴名")
    fields: Dict[str, Any] = Field(..., description="参数字段表")


class 批量设置轴参数请求模型(BaseModel):
    """批量设置：{轴名: {字段: 值}}。"""

    table: Dict[str, Dict[str, Any]] = Field(..., description="按轴名分组的参数表")


class 反向间隙请求模型(BaseModel):
    axis: str = Field(..., description="轴名")
    enable: bool = Field(..., description="是否启用反向间隙补偿")
    distance: float = Field(..., description="补偿距离（脉冲）")
    speed: Optional[float] = Field(default=None, gt=0)
    accel: Optional[float] = Field(default=None, gt=0)


class 软限位请求模型(BaseModel):
    axis: str = Field(..., description="轴名")
    max: Optional[float] = Field(default=None, description="正限位（不填=不修改）")
    min: Optional[float] = Field(default=None, description="负限位（不填=不修改）")


class 单个轴名请求模型(BaseModel):
    axis: str = Field(..., description="轴名")


class 等待轴状态请求模型(BaseModel):
    axis: str = Field(..., description="轴名")
    timeout_s: float = Field(100.0, gt=0)
    poll_interval_s: float = Field(0.05, gt=0)


class CommandRequest(BaseModel):
    command: str = Field(..., min_length=1, description="ZAux_Execute 表达式")


# ==================================================================
# 辅助
# ==================================================================


def _service() -> MotionService:
    return MotionService.获取实例()


def _ok(message: str = "OK", data: Any = None) -> Dict[str, Any]:
    return {"success": True, "message": message, "data": data}


def _handle_exc(exc: Exception) -> HTTPException:
    if isinstance(exc, SafetyViolation):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )
    if isinstance(exc, ZMCError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        )
    日志.exception(f"未分类异常: {exc}")
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
    )


# ==================================================================
# 1. 生命周期
# ==================================================================


@路由.post("/connect", summary="连接控制器")
async def 连接(req: 连接设备请求模型):
    try:
        await _service().连接(req.ip)
        return _ok(f"已连接 {req.ip or '配置默认 IP'}")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/disconnect", summary="断开控制器")
async def 断开():
    try:
        await _service().断开()
        return _ok("已断开")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/reset", summary="复位（清除报警/恢复 IDLE）")
async def 复位():
    try:
        await _service().复位()
        return _ok("已复位")
    except Exception as exc:
        raise _handle_exc(exc) from exc


# ==================================================================
# 2. 状态查询
# ==================================================================


@路由.get("/state", summary="获取整机状态快照")
async def 获取状态():
    snap = _service().获取状态快照()
    return _ok("OK", snap.to_dict())


@路由.get("/axes", summary="读全部轴的实时状态（按轴号分组的 dict）")
async def 读全部轴状态():
    try:
        data = await _service().读全部轴状态()
        return _ok("OK", data)
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/dpos/{axis}", summary="读单轴指令位置")
async def 读_dpos(axis: str = Path(..., description="轴名")):
    try:
        return _ok("OK", await _service().读_dpos(axis))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/mpos/{axis}", summary="读单轴实际位置")
async def 读_mpos(axis: str = Path(..., description="轴名")):
    try:
        return _ok("OK", await _service().读_mpos(axis))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/idle/{axis}", summary="读单轴是否空闲")
async def 读_idle(axis: str = Path(..., description="轴名")):
    try:
        return _ok("OK", await _service().读_idle(axis))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/position/xy", summary="取 XY 双轴实际位置")
async def 取xy位置():
    try:
        x, y = await _service().取_xy_实际位置()
        return _ok("OK", {"x": x, "y": y})
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/position/z", summary="取 Z 轴实际位置")
async def 取z位置():
    try:
        return _ok("OK", await _service().取_z_实际位置())
    except Exception as exc:
        raise _handle_exc(exc) from exc


# ==================================================================
# 3. 单轴运动
# ==================================================================


@路由.post("/home", summary="指定轴回零（不填=全轴）")
async def 回零(req: 回零请求模型):
    try:
        await _service().归位(req.axes)
        return _ok("回零完成")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/jog", summary="开始点动")
async def 点动(req: 点动请求模型):
    try:
        await _service().点动(req.axis, req.direction, req.speed)
        return _ok(f"轴 {req.axis} 点动 dir={req.direction}")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/jog/stop", summary="停止点动")
async def 停止点动(req: 点动暂停请求模型):
    try:
        await _service().停止点动(req.axis)
        return _ok(f"轴 {req.axis} 点动已停止")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/move/abs", summary="单轴绝对运动")
async def 绝对运动(req: 轴运动请求模型):
    try:
        await _service().绝对运动(req.axis, req.position, req.speed)
        return _ok(f"轴 {req.axis} → {req.position}")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/move/rel", summary="单轴相对运动")
async def 相对运动(req: 轴运动请求模型):
    try:
        await _service().相对运动(req.axis, req.position, req.speed)
        return _ok(f"轴 {req.axis} 相对 {req.position}")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/move/abs-with-speed", summary="单轴绝对运动并临时设速度")
async def 绝对运动并设速度(req: 轴运动带速度请求模型):
    try:
        await _service().绝对运动并设速度(req.axis, req.position, req.speed)
        return _ok(f"轴 {req.axis} → {req.position} @ {req.speed}")
    except Exception as exc:
        raise _handle_exc(exc) from exc


# ==================================================================
# 4. 多轴 / 插补
# ==================================================================


@路由.post("/move/linear", summary="多轴直线插补")
async def 直线插补(req: 直线插补请求模型):
    if len(req.axes) != len(req.positions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="axes 与 positions 列表长度必须一致",
        )
    try:
        await _service().直线插补(req.axes, req.positions, req.speed, req.relative)
        return _ok("直线插补已下发")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/move/circle", summary="圆心定 2 点圆弧")
async def 圆弧插补(req: 圆心定圆弧请求模型):
    if len(req.axes) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="圆弧插补必须 2 个轴"
        )
    try:
        await _service().圆弧插补(
            req.axes, req.end1, req.end2, req.center1, req.center2,
            方向=req.direction, 速度=req.speed, 相对=req.relative,
        )
        return _ok("圆弧已下发")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/move/circle3p", summary="三点圆弧")
async def 三点圆弧插补(req: 三点圆弧请求模型):
    if len(req.axes) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="圆弧插补必须 2 个轴"
        )
    try:
        await _service().三点圆弧插补(
            req.axes, req.mid1, req.mid2, req.end1, req.end2,
            速度=req.speed, 相对=req.relative,
        )
        return _ok("三点圆弧已下发")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/move/spiral", summary="螺旋插补")
async def 螺旋插补(req: 螺旋插补请求模型):
    if len(req.axes) not in (3, 4):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="螺旋插补需要 3 或 4 个轴"
        )
    try:
        await _service().螺旋插补(
            req.axes, req.center1, req.center2,
            req.circles, req.pitch, req.third_distance, req.fourth_distance,
            速度=req.speed,
        )
        return _ok("螺旋已下发")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/move/5axis", summary="五轴联动直线插补（X/Y/Z/U/R 顺序）")
async def 五轴联动直线(req: 五轴联动直线请求模型):
    try:
        await _service().五轴联动直线(req.positions, req.speed, req.relative)
        return _ok("五轴联动直线已下发")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/move/3p2", summary="3+2 定向加工（U/R 锁定 + XYZ 联动）")
async def 三加二定向加工(req: 二轴先动和三轴联动请求模型):
    for idx, 段 in enumerate(req.xyz_path):
        if len(段) != 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"xyz_path[{idx}] 必须是 [x, y, z]",
            )
    try:
        await _service().三加二定向加工(
            u角度=req.u_angle, r角度=req.r_angle, xyz路径=req.xyz_path,
            定位速度=req.locate_speed, 加工速度=req.machining_speed,
            定位等待超时秒=req.locate_wait_timeout_s, 相对xyz=req.relative_xyz,
        )
        return _ok("3+2 定向加工已完成")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/move/contour-xy", summary="连续插补 XY")
async def 连续插补XY(req: XY连续插补请求模型):
    try:
        await _service().连续插补XY(
            路径点=req.path, 速度=req.speed,
            merge_enable=req.merge_enable,
            auto_corner_decel=req.auto_corner_decel,
            auto_small_circle_limit=req.auto_small_circle_limit,
            auto_corner_angle=req.auto_corner_angle,
            decel_angle_deg=req.decel_angle_deg,
            stop_angle_deg=req.stop_angle_deg,
        )
        return _ok("连续插补 XY 已完成")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/move/contour", summary="通用多轴连续插补")
async def 连续插补运动(req: ContourMultiRequest):
    # 字段名对齐 adapter 签名:decel_angle_deg → first_corner_angle_deg、
    # stop_angle_deg → end_corner_angle_deg(原有透传字段名不一致的 bug)
    kwargs: Dict[str, Any] = {
        "default_speed": req.speed,
        "merge_enable": req.merge_enable,
        "auto_corner_decel": req.auto_corner_decel,
        "auto_small_circle_limit": True,                 # 默认开启小圆限速
        "first_corner_angle_deg": req.decel_angle_deg,
        "end_corner_angle_deg": req.stop_angle_deg,
    }
    try:
        await _service().连续插补运动(req.axes, req.path, **kwargs)
        return _ok("连续插补已完成")
    except Exception as exc:
        raise _handle_exc(exc) from exc


# ==================================================================
# 5. 连续轨迹合并
# ==================================================================


@路由.post("/merge/enable", summary="启用 MERGE（连续轨迹）")
async def 启用连续轨迹(req: 连续轨迹请求模型):
    try:
        await _service().启用连续轨迹(req.axis)
        return _ok(f"MERGE 已启用（主轴 {req.axis}）")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/merge/disable", summary="关闭 MERGE")
async def 关闭连续轨迹(req: 连续轨迹请求模型):
    try:
        await _service().关闭连续轨迹(req.axis)
        return _ok(f"MERGE 已关闭（主轴 {req.axis}）")
    except Exception as exc:
        raise _handle_exc(exc) from exc


# ==================================================================
# 6. 暂停 / 继续 / 停止 / 急停
# ==================================================================


@路由.post("/pause", summary="软暂停（FEED_OVERRIDE=0）")
async def 暂停():
    try:
        await _service().暂停()
        return _ok("已暂停")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/resume", summary="继续运动")
async def 继续():
    try:
        await _service().继续()
        return _ok("已继续")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/stop", summary="减速停止")
async def 停止运动():
    try:
        await _service().停止运动()
        return _ok("已停止")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/estop", summary="紧急停止")
async def 急停():
    try:
        await _service().急停()
        return _ok("已急停")
    except Exception as exc:
        raise _handle_exc(exc) from exc


# ==================================================================
# 7. U / R 业务旋转
# ==================================================================


@路由.post("/u/rotate-by-params", summary="U 轴按业务参数旋转角度")
async def U轴旋转的角度参数(req: UR轴参数请求模型):
    try:
        return _ok("OK", await _service().U轴旋转的角度参数(req.params))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/u/rotate-angle", summary="U 轴直接旋转到目标角度")
async def U轴旋转角度(req: U轴角度请求模型):
    try:
        return _ok("OK", await _service().U轴旋转角度(req.angle))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/u/at-angle", summary="U 轴是否到达目标角度")
async def U轴是否到达旋转角度(
    angle: float = Query(..., description="目标角度"),
    tolerance: float = Query(0.001, gt=0, description="角度容差"),
):
    try:
        return _ok("OK", await _service().U轴是否到达旋转角度(angle, tolerance))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/r/rotate-turns", summary="R 轴按业务参数旋转圈数")
async def R轴旋转的圈数(req: UR轴参数请求模型):
    try:
        return _ok("OK", await _service().R轴旋转的圈数(req.params))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/r/rotate-cont", summary="R 轴持续旋转")
async def R轴一直进行旋转(req: R轴持续旋转请求模型):
    try:
        return _ok("OK", await _service().R轴一直进行旋转(req.speed))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/r/position", summary="获取 R 轴当前位置")
async def 获取R轴的当前位置():
    try:
        return _ok("OK", await _service().获取R轴的当前位置())
    except Exception as exc:
        raise _handle_exc(exc) from exc


# ==================================================================
# 8. IO
# ==================================================================


@路由.post("/io/output", summary="设置数字输出")
async def 设置输出(req: IO值请求模型):
    try:
        await _service().设置输出(req.io, req.value)
        return _ok(f"OUT[{req.io}] = {req.value}")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/io/output/{io}", summary="读单个输出口")
async def 读_输出(io: int = Path(..., ge=0)):
    try:
        return _ok("OK", await _service().读_输出(io))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/io/output", summary="批量读输出口（含起止区间）")
async def 批量读_输出(
    start: int = Query(0, ge=0, description="起始 IO 号（含）"),
    end: int = Query(8, ge=1, description="结束 IO 号（不含）"),
):
    if end <= start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="end 必须大于 start"
        )
    try:
        return _ok("OK", await _service().批量读_输出(start, end))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/io/input/{io}", summary="读单个输入口")
async def 读_输入(io: int = Path(..., ge=0)):
    try:
        return _ok("OK", await _service().读_输入(io))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.get("/io/input", summary="批量读输入口（含起止区间）")
async def 批量读_输入(
    start: int = Query(0, ge=0),
    end: int = Query(8, ge=1),
):
    if end <= start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="end 必须大于 start"
        )
    try:
        return _ok("OK", await _service().批量读_输入(start, end))
    except Exception as exc:
        raise _handle_exc(exc) from exc


# ==================================================================
# 9. 轴参数
# ==================================================================


@路由.post("/axis/params", summary="写入单轴参数")
async def 写入轴参数(req: 轴参数请求模型):
    try:
        await _service().写入轴参数(req.axis, **req.fields)
        return _ok(f"轴 {req.axis} 参数已下发", req.fields)
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/axis/params/batch", summary="批量写入轴参数")
async def 批量设置轴参数(req: 批量设置轴参数请求模型):
    try:
        await _service().批量设置轴参数(req.table)
        return _ok("批量参数已下发", list(req.table.keys()))
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/axis/params/reload", summary="重新下发所有轴的配置")
async def 重新下发所有轴():
    try:
        await _service().重新下发所有轴()
        return _ok("所有轴配置已重新下发")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/axis/backlash", summary="设置反向间隙补偿")
async def 设置反向间隙(req: 反向间隙请求模型):
    try:
        await _service().设置反向间隙(
            req.axis, req.enable, req.distance, req.speed, req.accel,
        )
        return _ok(f"轴 {req.axis} 反向间隙已设置")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/axis/soft-limit", summary="设置软限位（任填一/二）")
async def 设置软限位(req: 软限位请求模型):
    if req.max is None and req.min is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="max/min 至少填一个"
        )
    try:
        await _service().设置软限位(req.axis, req.max, req.min)
        return _ok(f"轴 {req.axis} 软限位已设置")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/axis/clear-error", summary="清除单轴错误")
async def 清除轴错误(req: 单个轴名请求模型):
    try:
        await _service().清除轴错误(req.axis)
        return _ok(f"轴 {req.axis} 错误已清除")
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/axis/zero", summary="单轴位置清零（DPOS=MPOS=0）")
async def 轴位置清零(req: 单个轴名请求模型):
    try:
        await _service().轴位置清零(req.axis)
        return _ok(f"轴 {req.axis} 位置已清零")
    except Exception as exc:
        raise _handle_exc(exc) from exc


# ==================================================================
# 10. 工具
# ==================================================================


@路由.post("/wait-idle", summary="阻塞等待轴静止")
async def 等待静止(req: 等待轴状态请求模型):
    try:
        ok = await _service().等待静止(req.axis, req.timeout_s, req.poll_interval_s)
        return _ok("已静止" if ok else "等待超时", ok)
    except Exception as exc:
        raise _handle_exc(exc) from exc


@路由.post("/cmd", summary="ZAux_Execute 透传任意 BAS 表达式")
async def 执行命令(req: CommandRequest):
    try:
        return _ok("OK", await _service().执行命令(req.command))
    except Exception as exc:
        raise _handle_exc(exc) from exc


# ==================================================================
# 11. 控制器设置持久化
# ==================================================================


@路由.get("/controller-settings", summary="读取控制器设置文件")
async def 读取控制器设置():
    data = 从文件加载()
    return _ok("OK" if data else "无已保存的设置文件", data)


@路由.post("/controller-settings", summary="保存控制器设置到文件并下发驱动器")
async def 保存控制器设置(req: Request):
    body = await req.json()
    保存到文件(body)
    try:
        await _service().保存并下发控制器设置(body)
        return _ok("控制器设置已保存并下发到驱动器")
    except Exception:
        return _ok("控制器设置已保存到文件，但下发驱动器失败（控制器可能未连接）")
