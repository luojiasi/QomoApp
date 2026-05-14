/**
 * core/api/motionApi.ts
 *
 * 运动控制 HTTP API 封装。
 * 合并自: modules/motion/api/{apiConnect, apiAxis, apiIo, apiMotionSettingSaveAndLoad}.ts
 *
 * 职责：运动控制器相关的所有后端 HTTP 调用。
 * 类型依赖：暂时从 modules/motion/types 引入（Phase 2 将提取到 core/types/）。
 */

import { apiCall, type ApiCallResult } from './httpClient'
import type {
  ControllerParameters,
  MotionAllAxesParamsRequestPayload,
  MotionAxisParamsPayload
} from '@/modules/motion/types/controller'
import type {
  MotionIoOutputState,
  MotionIoInputState
} from '@/modules/motion/types/io'
import type {
  MotionAxis,
  Product4PCenterRotationPayload,
  StartProgramControlAction,
  UAxisRotateRequestPayload,
  RAxisRotateRequestPayload
} from '@/modules/motion/types'

// ---- 轴号常量（与 backend motion_config 对齐） ----
export const AXIS_NO_TO_NAME: Record<number, string> = {
  0: 'X', 1: 'Y', 2: 'Z', 3: 'U', 4: 'R'
}

// ====================================================================
// 连接
// ====================================================================

export function buildMotionConnectRequestPayload(
  controllerSettings: ControllerParameters
): { ip: string } {
  return { ip: controllerSettings.communication.controller_ip }
}

export const connectMotion = async (
  payload: { ip: string }
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/connect', 'POST', payload as unknown as Record<string, unknown>)

export const connectMotionWithControllerSettings = async (
  controllerSettings: ControllerParameters
): Promise<ApiCallResult<Record<string, unknown>>> =>
  connectMotion(buildMotionConnectRequestPayload(controllerSettings))

// ====================================================================
// 轴参数
// ====================================================================

export function buildMotionAllAxesParamsRequestPayload(
  controllerSettings: ControllerParameters
): MotionAllAxesParamsRequestPayload {
  const table: Record<string, MotionAxisParamsPayload> = {}

  for (const a of controllerSettings.axes) {
    const axisName = AXIS_NO_TO_NAME[a.axis_no]
    if (!axisName) continue
    table[axisName] = {
      units: a.units,
      lspeed: a.lspeed,
      speed: a.speed,
      accel: a.accel,
      decel: a.decel,
      sramp: a.sramp,
      atype: a.axis_type,
      merge: a.merge,
      fwd_in: a.fwd_in,
      rev_in: a.rev_in
    }
  }

  return { table }
}

export const setMotionAllAxesParams = async (
  payload: MotionAllAxesParamsRequestPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/axis/params/batch', 'POST', payload as unknown as Record<string, unknown>)

export const setMotionAllAxesParamsWithControllerSettings = async (
  controllerSettings: ControllerParameters
): Promise<ApiCallResult<Record<string, unknown>>> =>
  setMotionAllAxesParams(buildMotionAllAxesParamsRequestPayload(controllerSettings))

// ====================================================================
// 轴运动
// ====================================================================

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const pickAxisSpeed = (
  axisNo: number,
  options?: { speed?: number; controllerSettings?: ControllerParameters }
): number | undefined => {
  const explicitSpeed = options?.speed
  if (isPositiveFiniteNumber(explicitSpeed)) return explicitSpeed
  const savedSpeed = options?.controllerSettings?.axes.find(
    (a) => a.axis_no === axisNo
  )?.speed
  return isPositiveFiniteNumber(savedSpeed) ? savedSpeed : undefined
}

type MoveMotionAxisAbsOptions = { speed?: number; controllerSettings?: ControllerParameters }
type MoveMotionAxisRelOptions = { speed?: number; controllerSettings?: ControllerParameters }

export const getMotionPosition = async (
  axis: MotionAxis
): Promise<ApiCallResult<number>> =>
  apiCall<number>(`motion/dpos/${axis}`, 'GET')

export const emergencyStopMotion = async (): Promise<
  ApiCallResult<Record<string, unknown>>
> => apiCall('motion/estop', 'POST')

export const zeroMotionAxis = async (
  axisNo: number
): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisName = AXIS_NO_TO_NAME[axisNo]
  if (!axisName) return { success: false, message: `\u672a\u77e5\u8f74\u53f7: ${axisNo}` }
  return apiCall(
    'motion/axis/zero',
    'POST',
    { axis: axisName } as unknown as Record<string, unknown>
  )
}

export const moveMotionAxisAbs = async (
  axisNo: number,
  targetMm: number,
  options?: MoveMotionAxisAbsOptions
): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisNoInt = Number(axisNo)
  const axisName = AXIS_NO_TO_NAME[axisNoInt]
  if (!axisName)
    return { success: false, message: `\u672a\u77e5\u8f74\u53f7: ${axisNoInt}` }

  const body: Record<string, unknown> = { axis: axisName, position: targetMm }
  const selectedSpeed = pickAxisSpeed(axisNoInt, options)
  if (typeof selectedSpeed === 'number') body.speed = selectedSpeed

  return apiCall(
    'motion/move/abs',
    'POST',
    body as unknown as Record<string, unknown>
  )
}

export const moveMotionAxisRel = async (
  axisNo: number,
  deltaMm: number,
  options?: MoveMotionAxisRelOptions
): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisNoInt = Number(axisNo)
  const axisName = AXIS_NO_TO_NAME[axisNoInt]
  if (!axisName)
    return { success: false, message: `\u672a\u77e5\u8f74\u53f7: ${axisNoInt}` }

  const body: Record<string, unknown> = { axis: axisName, position: deltaMm }
  const selectedSpeed = pickAxisSpeed(axisNoInt, options)
  if (typeof selectedSpeed === 'number') body.speed = selectedSpeed

  return apiCall(
    'motion/move/rel',
    'POST',
    body as unknown as Record<string, unknown>
  )
}

export const rotateUAxisByAngle = async (
  payload: UAxisRotateRequestPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall(
    'motion/u/rotate-by-params',
    'POST',
    { params: payload } as unknown as Record<string, unknown>
  )

export const rotateRAxisByTurns = async (
  payload: RAxisRotateRequestPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall(
    'motion/r/rotate-turns',
    'POST',
    { params: payload } as unknown as Record<string, unknown>
  )

// ====================================================================
// IO
// ====================================================================

export const setMotionIoOutput = async (
  ioNo: number,
  value: boolean
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall(
    'motion/io/output',
    'POST',
    { io: ioNo, value } as unknown as Record<string, unknown>
  )

export const getMotionIoOutput = async (
  ioNo: number
): Promise<ApiCallResult<MotionIoOutputState>> => {
  const res = await apiCall<boolean>(`motion/io/output/${Number(ioNo)}`, 'GET')
  return res.success
    ? { ...res, data: { io_no: ioNo, value: res.data as boolean } }
    : (res as unknown as ApiCallResult<MotionIoOutputState>)
}

export const getMotionIoOutputsStatus = async (
  ioStart = 0,
  ioEnd = 8
): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>('motion/io/output', 'GET', null, {
    start: Number(ioStart),
    end: Number(ioEnd)
  })

export const getMotionIoInput = async (
  ioNo: number
): Promise<ApiCallResult<MotionIoInputState>> => {
  const res = await apiCall<boolean>(`motion/io/input/${Number(ioNo)}`, 'GET')
  return res.success
    ? { ...res, data: { io_no: ioNo, value: res.data as boolean } }
    : (res as unknown as ApiCallResult<MotionIoInputState>)
}

export const getMotionIoInputsStatus = async (
  ioStart = 0,
  ioEnd = 8
): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>('motion/io/input', 'GET', null, {
    start: Number(ioStart),
    end: Number(ioEnd)
  })

// ====================================================================
// 程序执行
// ====================================================================

export const startProgram = async (
  payload: Record<string, unknown>
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('startProgram', 'POST', payload)

export const syncProduct4PCenterRotation = async (
  payload: Product4PCenterRotationPayload
): Promise<ApiCallResult<Product4PCenterRotationPayload>> =>
  apiCall<Product4PCenterRotationPayload>(
    'product4p/center-rotation',
    'POST',
    payload as unknown as Record<string, unknown>
  )

export const getProduct4PCenterRotation = async (): Promise<
  ApiCallResult<Product4PCenterRotationPayload>
> => apiCall<Product4PCenterRotationPayload>('product4p/center-rotation', 'GET')

export const getStartProgramStatus = async (): Promise<
  ApiCallResult<{ running?: boolean; paused?: boolean } & Record<string, unknown>>
> => apiCall('startProgram/status', 'GET')

export const startProgramControl = async (
  action: StartProgramControlAction
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall(
    'startProgram/control',
    'POST',
    { action } as unknown as Record<string, unknown>
  )

// ====================================================================
// 设置持久化
// ====================================================================

export const getControllerSettingsFromFile = async (): Promise<
  ApiCallResult<Record<string, unknown> | null>
> => apiCall('motion/controller-settings', 'GET')

export const saveControllerSettingsToFile = async (
  payload: Record<string, unknown>
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/controller-settings', 'POST', payload)
