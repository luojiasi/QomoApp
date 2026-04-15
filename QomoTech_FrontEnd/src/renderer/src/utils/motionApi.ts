import { apiCall, type ApiCallResult } from './toBackendApiCall'
import type { ControllerParameters } from '../types/settings'

export type MotionAxis = 'X' | 'Y' | 'Z' | 'U' | 'R'
const MAX_AXIS_NO = 5
const AXIS_NOS_3 = [0, 1, 2] as const
const AXIS_NOS_5 = [0, 1, 2, 3, 4] as const

const getAllowedAxisNos = (axisCount: ControllerParameters['communication']['axisCount']): readonly number[] =>
  axisCount === 3 ? AXIS_NOS_3 : AXIS_NOS_5

const isValidAxisNo = (axisNo: number): boolean =>
  Number.isInteger(axisNo) && axisNo >= 0 && axisNo <= MAX_AXIS_NO

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const pickAxisSpeed = (axisNo: number,options?: { speed?: number; controllerSettings?: ControllerParameters }): number | undefined => {
  const explicitSpeed = options?.speed
  if (isPositiveFiniteNumber(explicitSpeed)) return explicitSpeed
  const savedSpeed = options?.controllerSettings?.axes.find((a) => a.axisNo === axisNo)?.speed
  return isPositiveFiniteNumber(savedSpeed) ? savedSpeed : undefined
}

// ---------------------------
// 控制器（Motion）API
// ---------------------------

export const getMotionPosition = async (axis: MotionAxis): Promise<ApiCallResult<{ axis: MotionAxis; position_mm: number }>> =>
  apiCall(`motion/position/${axis}`, 'GET')

// ---------------------------
// /api/motion/connect payload 构造
// ---------------------------

export interface MotionAxisConnectPayload {
  axisNo: number
  units: number
  lspeed?: number
  speed?: number
  accel?: number
  decel?: number
  sramp?: number
  merge?: number
  fwd_in?: number
  rev_in?: number
  corner_mode?: number
  axisType?: number
  backlash?: number
  backlash_enable?: boolean
}

export interface MotionConnectRequestPayload {
  ipAddress: string
  axes: MotionAxisConnectPayload[]
}


/**
 * 根据“三轴/五轴”选择，只发送对应轴的 { axisNo, units } 给后端。
 * 后端在 /api/motion/connect 中会将 units 作为轴输入单位重新配置运动驱动。
 */
export function buildMotionConnectRequestPayload(controllerSettings: ControllerParameters): MotionConnectRequestPayload {
  const allowedAxisNos = getAllowedAxisNos(controllerSettings.communication.axisCount)

  const axes: MotionAxisConnectPayload[] = controllerSettings.axes
    .filter((a) => allowedAxisNos.includes(a.axisNo))
    .map((a) => ({
      axisNo: a.axisNo,
      units: a.units,
      lspeed: a.lspeed,
      speed: a.speed,
      accel: a.accel,
      decel: a.decel,
      sramp: a.sramp,
      merge: a.merge,
      fwd_in: a.fwd_in,
      rev_in: a.rev_in,
      corner_mode: a.corner_mode,
      axisType: a.axisType,
      backlash: a.backlash,
      backlash_enable: Boolean(a.backlash_enable)
    }))

  return {
    ipAddress: controllerSettings.communication.ipAddress,
    axes
  }
}

export const connectMotion = async (payload: MotionConnectRequestPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/connect', 'POST', payload as unknown as Record<string, unknown>)

export const connectMotionWithControllerSettings = async (controllerSettings: ControllerParameters): Promise<ApiCallResult<Record<string, unknown>>> =>
  connectMotion(buildMotionConnectRequestPayload(controllerSettings))



// 用于更新驱动器参数的接口
export interface MotionAxisParamsPayload {
  units?: number
  lspeed?: number
  speed?: number
  accel?: number
  decel?: number
  sramp?: number
  fwd_in?: number
  rev_in?: number
  backlash?: number
  backlash_enable?: boolean
}

export interface MotionAllAxesParamsRequestPayload {
  params_by_axis: Record<number, MotionAxisParamsPayload>
}


export function buildMotionAllAxesParamsRequestPayload(controllerSettings: ControllerParameters): MotionAllAxesParamsRequestPayload {
  const allowedAxisNos = getAllowedAxisNos(controllerSettings.communication.axisCount)
  const paramsByAxis: Record<number, MotionAxisParamsPayload> = {}

  controllerSettings.axes
    .filter((a) => allowedAxisNos.includes(a.axisNo) && isValidAxisNo(a.axisNo))
    .forEach((a) => {
      paramsByAxis[a.axisNo] = {
        units: a.units,
        lspeed: a.lspeed,
        speed: a.speed,
        accel: a.accel,
        decel: a.decel,
        sramp: a.sramp,
        fwd_in: a.fwd_in,
        rev_in: a.rev_in,
        backlash: a.backlash,
        backlash_enable: Boolean(a.backlash_enable)
      }
    })

  return {
    params_by_axis: paramsByAxis
  }
}

export const setMotionAllAxesParams = async (payload: MotionAllAxesParamsRequestPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/axes/params', 'POST', payload as unknown as Record<string, unknown>)

export const setMotionAllAxesParamsWithControllerSettings = async (controllerSettings: ControllerParameters): Promise<ApiCallResult<Record<string, unknown>>> =>
  setMotionAllAxesParams(buildMotionAllAxesParamsRequestPayload(controllerSettings))





// ---------------------------
// 硬件连接（Motion 单例相关）
// ---------------------------

export const connectHardware = async (): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('hardware/connect', 'POST')

export const disconnectHardware = async (): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('hardware/disconnect', 'POST')

export const reconnectHardware = async (payload?: Record<string, unknown> | null): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('hardware/reconnect', 'POST', payload ?? null)

export const startProgram = async (payload: Record<string, unknown>): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('startProgram', 'POST', payload)

export interface StartProgramStatusData {running: boolean;paused: boolean}

export const getStartProgramStatus = async (): Promise<ApiCallResult<{ running?: boolean; paused?: boolean } & Record<string, unknown>>> => apiCall('startProgram/status', 'GET')

export type StartProgramControlAction = 'pause' | 'resume' | 'reset' | 'estop' | 'skip'

export const startProgramControl = async ( action: StartProgramControlAction): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('startProgram/control', 'POST', { action } as unknown as Record<string, unknown>)

// ---------------------------
// Motion IO 输出
// ---------------------------

export const setMotionIoOutput = async (ioNo: number,value: boolean,): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/io/output', 'POST', { io_no: ioNo, value } as unknown as Record<string, unknown>)

/** 单个数字量输出口状态（对应后端 GET /api/motion/io/output/{io_no}） */
export interface MotionIoOutputState { io_no: number;value: boolean }

export const getMotionIoOutput = async (ioNo: number): Promise<ApiCallResult<MotionIoOutputState>> =>
  apiCall<MotionIoOutputState>(`motion/io/output/${Number(ioNo)}`, 'GET')

/**
 * 批量读取输出口状态（对应后端 GET /api/motion/io/outputs）
 * data 为 { "0": true, "1": false, ... } 形式的 Record
 */
export const getMotionIoOutputsStatus = async (ioStart = 0,ioEnd = 8): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>('motion/io/outputs', 'GET', null, {
    io_start: Number(ioStart),
    io_end: Number(ioEnd)
  })

// ---------------------------
// Motion IO 输入
// ---------------------------

/** 单个数字量输入口状态（对应后端 GET /api/motion/io/input/{io_no}） */
export interface MotionIoInputState {io_no: number;value: boolean}

export const getMotionIoInput = async (ioNo: number): Promise<ApiCallResult<MotionIoInputState>> =>
  apiCall<MotionIoInputState>(`motion/io/input/${Number(ioNo)}`, 'GET')

/**
 * 批量读取输入口状态（对应后端 GET /api/motion/io/inputs）
 * data 为 { "0": true, "1": false, ... } 形式的 Record
 */
export const getMotionIoInputsStatus = async (ioStart = 0,ioEnd = 8): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>('motion/io/inputs', 'GET', null, {io_start: Number(ioStart),io_end: Number(ioEnd)})

// ---------------------------
// 单个 Motion Axis 急停
// ---------------------------
export const emergencyStopMotion = async (axisNo: number): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/emergency-stop', 'POST', { axis_no: axisNo } as unknown as Record<string, unknown>)

// ---------------------------
// 单个 Motion Axis 位置清零
// ---------------------------
export const zeroMotionAxis = async (axisNo: number): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/axis/zero', 'POST', { axis_no: Number(axisNo) } as unknown as Record<string, unknown>)
// ---------------------------
// 单个 Motion Axis 绝对运动
// ---------------------------
type MoveMotionAxisAbsOptions = { speed?: number; controllerSettings?: ControllerParameters }

const pushAxisSpeed = async (axisNo: number, speed: number): Promise<ApiCallResult<Record<string, unknown>>> =>
  setMotionAllAxesParams({params_by_axis: {[axisNo]: {speed}}})

export const moveMotionAxisAbs = async (axisNo: number,targetMm: number,options?: MoveMotionAxisAbsOptions,): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisNoInt = Number(axisNo)
  const selectedSpeed = pickAxisSpeed(axisNoInt, options)

  // 若提供了 speed，或能从本地设置按轴找到 speed，则先下发该轴速度
  if (typeof selectedSpeed === 'number') {
    const speedRes = await pushAxisSpeed(axisNoInt, selectedSpeed)
    if (!speedRes?.success) return speedRes as ApiCallResult<Record<string, unknown>>
  }

  return apiCall('motion/axis/move-abs', 'POST', {
    axis_no: axisNoInt,
    target_mm: targetMm,
  } as unknown as Record<string, unknown>)
}

// ---------------------------
// 单个 Motion Axis 相对运动
// ---------------------------
type MoveMotionAxisRelOptions = { speed?: number; controllerSettings?: ControllerParameters }

export const moveMotionAxisRel = async (axisNo: number,deltaMm: number,options?: MoveMotionAxisRelOptions,): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisNoInt = Number(axisNo)
  const selectedSpeed = pickAxisSpeed(axisNoInt, options)

  return apiCall('motion/axis/move-rel', 'POST', {
    axis_no: axisNoInt,
    delta_mm: deltaMm,
    ...(typeof selectedSpeed === 'number'
      ? { speed: selectedSpeed }
      : {}),
  } as unknown as Record<string, unknown>)
}

export interface UAxisRotateRequestPayload {
  旋转角度: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 'relative' | 'absolute'
}

export interface RAxisRotateRequestPayload {
  旋转圈数: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 'relative' | 'absolute'
}

export const rotateUAxisByAngle = async (
  payload: UAxisRotateRequestPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/axis/U轴旋转的角度', 'POST', payload as unknown as Record<string, unknown>)

export const rotateRAxisByTurns = async (
  payload: RAxisRotateRequestPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/axis/R轴旋转的圈数', 'POST', payload as unknown as Record<string, unknown>)




// ---------------------------
// 硬件快照状态轮询（推荐）
// ---------------------------
// 好像有很多重复的要清理TODO
export interface HardwareStatusPayload {
  state?: {
    hardware_connected?: boolean
    motion_connected?: boolean
    motion_axis_feedback?: Record<string, Record<string, unknown>>
    motion_io_map?: Array<{
      digitalIn?: boolean
      digitalOut?: boolean
    }>
    motion_positions?: Record<string, number>
    motion_driver_mode?: string
    motion_last_error?: string | null
    motion_last_error_code?: number | null
  }
  motion_driver_status?: {
    axis_status?: Record<string, Record<string, unknown>>
    io?: {
      inputs?: Record<string, boolean>
      outputs?: Record<string, boolean>
    }
    driver_mode?: string
    last_error?: string | null
    last_error_code?: number | null
  }
}

export const getHardwareStatus = async (): Promise<ApiCallResult<HardwareStatusPayload>> =>
  apiCall<HardwareStatusPayload>('hardware/status', 'GET')

export type HardwareStatusListener = (result: ApiCallResult<HardwareStatusPayload>) => void

let hardwareStatusPollingTimer: ReturnType<typeof setInterval> | null = null
let hardwareStatusPollingInFlight = false
let hardwareStatusPollingIntervalMs = 200
let latestHardwareStatusResult: ApiCallResult<HardwareStatusPayload> | null = null
const hardwareStatusListeners = new Set<HardwareStatusListener>()

const notifyHardwareStatusListeners = (result: ApiCallResult<HardwareStatusPayload>): void => {
  hardwareStatusListeners.forEach((listener) => {
    listener(result)
  })
}

export const pollHardwareStatusOnce = async (): Promise<ApiCallResult<HardwareStatusPayload> | null> => {
  if (hardwareStatusPollingInFlight) return null
  hardwareStatusPollingInFlight = true
  try {
    const result = await getHardwareStatus()
    latestHardwareStatusResult = result
    notifyHardwareStatusListeners(result)
    return result
  } finally {
    hardwareStatusPollingInFlight = false
  }
}

export const startHardwareStatusPolling = (intervalMs = 200, runImmediately = true): void => {
  const nextInterval = Number(intervalMs)
  if (Number.isFinite(nextInterval) && nextInterval > 0) {
    hardwareStatusPollingIntervalMs = nextInterval
  }

  if (hardwareStatusPollingTimer) {
    clearInterval(hardwareStatusPollingTimer)
    hardwareStatusPollingTimer = null
  }

  hardwareStatusPollingTimer = setInterval(() => {
    void pollHardwareStatusOnce()
  }, hardwareStatusPollingIntervalMs)

  if (runImmediately) {
    void pollHardwareStatusOnce()
  }
}

export const stopHardwareStatusPolling = (): void => {
  if (!hardwareStatusPollingTimer) return
  clearInterval(hardwareStatusPollingTimer)
  hardwareStatusPollingTimer = null
}

export const subscribeHardwareStatus = (
  listener: HardwareStatusListener,
  options?: {autoStart?: boolean,emitLatest?: boolean,intervalMs?: number,runImmediately?: boolean}): (() => void) => {
  hardwareStatusListeners.add(listener)

  if (options?.emitLatest !== false && latestHardwareStatusResult) {
    listener(latestHardwareStatusResult)
  }

  if (options?.autoStart !== false && !hardwareStatusPollingTimer) {
    startHardwareStatusPolling(options?.intervalMs ?? 200, options?.runImmediately ?? true)
  }

  return () => {
    hardwareStatusListeners.delete(listener)
    if (hardwareStatusListeners.size === 0) stopHardwareStatusPolling()
  }
}