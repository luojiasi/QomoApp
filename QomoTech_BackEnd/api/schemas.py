from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Any = None


class MotionAxisParamsSetRequest(BaseModel):
    axis_no: int = Field(ge=0, le=4)
    units: float | None = Field(default=None, gt=0)
    lspeed: float | None = Field(default=None, ge=0)
    speed: float | None = Field(default=None, gt=0)
    accel: float | None = Field(default=None, gt=0)
    decel: float | None = Field(default=None, gt=0)
    sramp: float | None = Field(default=None, ge=0)


class MotionAxisLimitRequest(BaseModel):
    axis_no: int = Field(ge=0, le=4)
    fs_limit: int | None = None
    rs_limit: int | None = None


class MotionAxisNoRequest(BaseModel):
    axis_no: int = Field(ge=0, le=4)


class MotionAxisMoveAbsRequest(BaseModel):
    axis_no: int = Field(ge=0, le=4)
    target_mm: float
    # 可选：本次绝对运动前临时下发速度
    speed: float | None = Field(default=None, gt=0)


class MotionAxisMoveRelRequest(BaseModel):
    axis_no: int = Field(ge=0, le=4)
    delta_mm: float
    speed: float | None = Field(default=None, gt=0)


class MotionAxisParamsPayload(BaseModel):
    units: float | None = Field(default=None, gt=0)
    lspeed: float | None = Field(default=None, ge=0)
    speed: float | None = Field(default=None, gt=0)
    accel: float | None = Field(default=None, gt=0)
    decel: float | None = Field(default=None, gt=0)
    sramp: float | None = Field(default=None, ge=0)


class MotionAllAxesParamsRequest(BaseModel):
    params_by_axis: dict[int, MotionAxisParamsPayload] = Field(default_factory=dict)

    def to_driver_dict(self) -> dict[int, dict[str, float]]:
        result: dict[int, dict[str, float]] = {}
        for axis_no, payload in self.params_by_axis.items():
            if axis_no < 0 or axis_no > 4:
                continue
            raw = payload.model_dump(exclude_none=True)
            result[int(axis_no)] = {str(k): float(v) for k, v in raw.items()}
        return result


class MotionLinearRequest(BaseModel):
    axis_nos: list[int] = Field(min_length=2, max_length=5)
    positions: list[float] = Field(min_length=2, max_length=5)
    mode: Literal["abs", "rel"] = "abs"
    use_sp: bool = True
    force_speed: float | None = Field(default=None, gt=0)
    units: float | None = Field(default=None, gt=0)
    lspeed: float | None = Field(default=None, ge=0)
    speed: float | None = Field(default=None, gt=0)
    accel: float | None = Field(default=None, gt=0)
    decel: float | None = Field(default=None, gt=0)
    sramp: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _validate_axes_positions(self):
        if len(self.axis_nos) != len(self.positions):
            raise ValueError("axis_nos 和 positions 长度必须一致")
        for axis_no in self.axis_nos:
            if axis_no < 0 or axis_no > 4:
                raise ValueError("axis_no 必须在 0-4 之间")
        if len(set(self.axis_nos)) != len(self.axis_nos):
            raise ValueError("axis_nos 不允许重复")
        return self


class StartProgramControlRequest(BaseModel):
    action: Literal["pause", "resume", "reset", "estop", "skip"]


class MotionIoWriteRequest(BaseModel):
    io_no: int = Field(ge=0)
    value: bool


class MotionIoInvertRequest(BaseModel):
    io_no: int = Field(ge=0)
    invert: bool


class MotionAxisIoMapRequest(BaseModel):
    axis_no: int = Field(ge=0, le=4)
    datum_in: int | None = Field(default=None, ge=0)
    alm_in: int | None = Field(default=None, ge=0)
    fwd_in: int | None = Field(default=None, ge=0)
    rev_in: int | None = Field(default=None, ge=0)


class MotionAxisConnectRequest(BaseModel):
    # 前端 Controller 的 axisNo：0=X, 1=Y, 2=Z（以及可能的 3/4 等）
    axisNo: int
    # 前端 Controller 的 UNITS：等价于脉冲当量 pulse_per_mm
    units: float = Field(gt=0)
    # 连接后下发到驱动器的轴参数（ZAux_Direct_*）
    lspeed: float | None = Field(default=None, ge=0)
    speed: float | None = Field(default=None, ge=0)
    accel: float | None = Field(default=None, ge=0)
    decel: float | None = Field(default=None, ge=0)
    sramp: float | None = Field(default=None, ge=0)
    # 连续插补开关：用于 ZAux_Direct_SetMerge
    merge: int | None = Field(default=None, ge=0)
    # 正/负限位输入选择：允许 -1 表示未启用
    fwd_in: int | None = Field(default=None, ge=-1)
    rev_in: int | None = Field(default=None, ge=-1)
    # 拐角模式：用于 ZAux_Direct_SetCornerMode
    corner_mode: int | None = Field(default=None, ge=0)
    # 轴类型：用于 ZAux_Direct_SetAtype
    axisType: int | None = Field(default=None, ge=0)


class MotionConnectRequest(BaseModel):
    ipAddress: str
    # 轴参数下发。为空则使用后端已配置的默认 axis 参数。
    axes: list[MotionAxisConnectRequest] = Field(default_factory=list)



class LaserApplyRequest(BaseModel):
    laserManufacturer: str | None = None
    laserPower: float | None = None
    laserFrequency: float | None = None
    laserCurrent: float | None = None
    transmissionMode: str | None = None


class CameraConnectRequest(BaseModel):
    index: int = Field(default=0, ge=0)


class CameraExposureRequest(BaseModel):
    auto_exposure: bool | None = None
    exposure_time: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_exposure_payload(self):
        if self.auto_exposure is None and self.exposure_time is None:
            raise ValueError("auto_exposure 和 exposure_time 不能同时为空")
        return self


class CameraFrameSpeedRequest(BaseModel):
    speed_level: Literal[0, 1, 2, 3] | None = None
    auto_tune: bool = True
    tune: float | None = Field(default=None, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _check_speed_payload(self):
        if self.speed_level is None and self.tune is None:
            raise ValueError("speed_level 和 tune 不能同时为空")
        return self


class CameraMirrorRequest(BaseModel):
    horizontal: bool | None = None
    vertical: bool | None = None

    @model_validator(mode="after")
    def _check_mirror_payload(self):
        if self.horizontal is None and self.vertical is None:
            raise ValueError("horizontal 和 vertical 不能同时为空")
        return self


class CameraWhiteBalanceRequest(BaseModel):
    auto_white_balance: bool | None = None
    once: bool = False
    r_gain: int | None = Field(default=None, ge=0)
    g_gain: int | None = Field(default=None, ge=0)
    b_gain: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_wb_payload(self):
        has_manual_gain = any(v is not None for v in (self.r_gain, self.g_gain, self.b_gain))
        if has_manual_gain and not all(v is not None for v in (self.r_gain, self.g_gain, self.b_gain)):
            raise ValueError("手动白平衡增益必须同时提供 r_gain/g_gain/b_gain")
        if self.auto_white_balance is None and not self.once and not has_manual_gain:
            raise ValueError("auto_white_balance/once/r_gain-g_gain-b_gain 至少提供一组")
        return self


# —— RS232（字段名与前端 rs232Settings 对齐）——
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
    def _stop_bits(self):
        if self.stopBits not in (1, 1.5, 2):
            raise ValueError("stopBits 必须为 1、1.5 或 2")
        return self


class Rs232SendConfig(BaseModel):
    mode: Literal["ascii", "hex"]
    payload: str = ""
    appendCr: bool = False
    appendLf: bool = False
    autoSend: bool = False
    autoSendIntervalMs: int = Field(default=1000, ge=50, le=3_600_000)


class Rs232ReceiveConfig(BaseModel):
    mode: Literal["ascii", "hex"]
    maxBufferLines: int = Field(default=500, ge=10, le=10_000)
    showTimestamp: bool = False
    autoScroll: bool = True


class Rs232SerialSessionRequest(BaseModel):
    port: Rs232PortConfig
    send: Rs232SendConfig | None = None
    receive: Rs232ReceiveConfig


class Rs232SendRequest(BaseModel):
    port: Rs232PortConfig
    send: Rs232SendConfig



