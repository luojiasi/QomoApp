// =============================================================================
// Motion 模块 API 端点
// =============================================================================

import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import { AXIS_NO_TO_NAME } from '../config/controllerDefaults'
import type {
  ControllerParameters,
  MotionAxis,
  MotionAxisParamsPayload,
  MotionAllAxesParamsRequestPayload,
  UAxisRotateRequestPayload,
  RAxisRotateRequestPayload,
  MotionIoOutputState,
  MotionIoInputState
} from '../types'

// -----------------------------------------------------------------------------
// 连接
// -----------------------------------------------------------------------------

/** 后端 ConnectRequest 仅接收 ip。connect_timeout_s 由后端配置层使用。 */
export function buildMotionConnectRequestPayload(
  controllerSettings: ControllerParameters
): { ip: string } {
  return { ip: controllerSettings.communication.controller_ip }
}

/** 连接到 ZMC 控制器。 */
export const connectMotion = async (
  payload: { ip: string }
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/connect', 'POST', payload as unknown as Record<string, unknown>)

/** 使用完整的控制器参数连接 ZMC 控制器（自动构建请求）。 */
export const connectMotionWithControllerSettings = async (
  controllerSettings: ControllerParameters
): Promise<ApiCallResult<Record<string, unknown>>> =>
  connectMotion(buildMotionConnectRequestPayload(controllerSettings))

// -----------------------------------------------------------------------------
// 批量更新轴参数
// -----------------------------------------------------------------------------

/** 从控制器参数构建批量轴参数请求载荷。 */
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

/** 批量下发全部轴参数到控制器。 */
export const setMotionAllAxesParams = async (
  payload: MotionAllAxesParamsRequestPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall(
    'motion/axis/params/batch',
    'POST',
    payload as unknown as Record<string, unknown>
  )

/** 使用控制器参数批量下发轴参数（自动构建请求）。 */
export const setMotionAllAxesParamsWithControllerSettings = async (
  controllerSettings: ControllerParameters
): Promise<ApiCallResult<Record<string, unknown>>> =>
  setMotionAllAxesParams(buildMotionAllAxesParamsRequestPayload(controllerSettings))

// -----------------------------------------------------------------------------
// 轴运动 / 位置
// -----------------------------------------------------------------------------

/** 判断值是否为正有限数。 */
const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/** 从选项中提取轴速度：优先使用显式 speed，其次从控制器设置读取。 */
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

/** 获取指定轴当前机械位置（dpos）。 */
export const getMotionPosition = async (
  axis: MotionAxis
): Promise<ApiCallResult<number>> => apiCall<number>(`motion/dpos/${axis}`, 'GET')

/** 紧急停止所有轴运动。 */
export const emergencyStopMotion = async (): Promise<
  ApiCallResult<Record<string, unknown>>
> => apiCall('motion/estop', 'POST')

/** 将指定轴位置归零。 */
export const zeroMotionAxis = async (
  axisNo: number
): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisName = AXIS_NO_TO_NAME[axisNo]
  if (!axisName) return { success: false, message: `未知轴号: ${axisNo}` }
  return apiCall('motion/axis/zero', 'POST', {
    axis: axisName
  } as unknown as Record<string, unknown>)
}

/** 绝对运动：将指定轴移动到目标位置（mm）。 */
export const moveMotionAxisAbs = async (
  axisNo: number,
  targetMm: number,
  options?: { speed?: number; controllerSettings?: ControllerParameters }
): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisName = AXIS_NO_TO_NAME[Number(axisNo)]
  if (!axisName) return { success: false, message: `未知轴号: ${axisNo}` }
  const body: Record<string, unknown> = {
    axis: axisName,
    position: targetMm
  }
  const selectedSpeed = pickAxisSpeed(Number(axisNo), options)
  if (typeof selectedSpeed === 'number') body.speed = selectedSpeed
  return apiCall('motion/move/abs', 'POST', body as unknown as Record<string, unknown>)
}

/** 相对运动：将指定轴移动指定距离（mm）。 */
export const moveMotionAxisRel = async (
  axisNo: number,
  deltaMm: number,
  options?: { speed?: number; controllerSettings?: ControllerParameters }
): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisName = AXIS_NO_TO_NAME[Number(axisNo)]
  if (!axisName) return { success: false, message: `未知轴号: ${axisNo}` }
  const body: Record<string, unknown> = {
    axis: axisName,
    position: deltaMm
  }
  const selectedSpeed = pickAxisSpeed(Number(axisNo), options)
  if (typeof selectedSpeed === 'number') body.speed = selectedSpeed
  return apiCall('motion/move/rel', 'POST', body as unknown as Record<string, unknown>)
}

/** U 轴按角度旋转。 */
export const rotateUAxisByAngle = async (
  payload: UAxisRotateRequestPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall(
    'motion/u/rotate-by-params',
    'POST',
    { params: payload } as unknown as Record<string, unknown>
  )

/** R 轴按圈数旋转。 */
export const rotateRAxisByTurns = async (
  payload: RAxisRotateRequestPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall(
    'motion/r/rotate-turns',
    'POST',
    { params: payload } as unknown as Record<string, unknown>
  )

// -----------------------------------------------------------------------------
// IO
// -----------------------------------------------------------------------------

/** 设置 IO 输出口状态。 */
export const setMotionIoOutput = async (
  ioNo: number,
  value: boolean
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/io/output', 'POST', {
    io: ioNo,
    value
  } as unknown as Record<string, unknown>)

/** 获取单个 IO 输出口状态。 */
export const getMotionIoOutput = async (
  ioNo: number
): Promise<ApiCallResult<MotionIoOutputState>> => {
  const res = await apiCall<boolean>(`motion/io/output/${Number(ioNo)}`, 'GET')
  return res.success
    ? {
        ...res,
        data: { io_no: ioNo, value: res.data as boolean }
      }
    : (res as unknown as ApiCallResult<MotionIoOutputState>)
}

/** 批量获取 IO 输出口状态（范围）。 */
export const getMotionIoOutputsStatus = async (
  ioStart = 0,
  ioEnd = 8
): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>(
    'motion/io/output',
    'GET',
    null,
    { start: Number(ioStart), end: Number(ioEnd) }
  )

/** 获取单个 IO 输入口状态。 */
export const getMotionIoInput = async (
  ioNo: number
): Promise<ApiCallResult<MotionIoInputState>> => {
  const res = await apiCall<boolean>(`motion/io/input/${Number(ioNo)}`, 'GET')
  return res.success
    ? {
        ...res,
        data: { io_no: ioNo, value: res.data as boolean }
      }
    : (res as unknown as ApiCallResult<MotionIoInputState>)
}

/** 批量获取 IO 输入口状态（范围）。 */
export const getMotionIoInputsStatus = async (
  ioStart = 0,
  ioEnd = 8
): Promise<ApiCallResult<Record<string, boolean>>> =>
  apiCall<Record<string, boolean>>(
    'motion/io/input',
    'GET',
    null,
    { start: Number(ioStart), end: Number(ioEnd) }
  )

// -----------------------------------------------------------------------------
// 控制器设置文件持久化
// -----------------------------------------------------------------------------

/** 从服务端加载控制器参数文件。 */
export const getControllerSettingsFromFile = async (): Promise<
  ApiCallResult<Record<string, unknown> | null>
> => apiCall('motion/controller-settings', 'GET')

/** 保存控制器参数到服务端文件。 */
export const saveControllerSettingsToFile = async (
  payload: Record<string, unknown>
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/controller-settings', 'POST', payload)
