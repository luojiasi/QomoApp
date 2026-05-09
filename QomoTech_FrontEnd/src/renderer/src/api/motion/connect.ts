import { apiCall, type ApiCallResult } from '../core/base'
import type { ControllerParameters } from '../../types/settings'

/** 轴号 → 轴名映射 */
const AXIS_NO_TO_NAME: Record<number, string> = { 0: 'X', 1: 'Y', 2: 'Z', 3: 'U', 4: 'R' }

// ------------------------------------------------------------------
// 连接
// ------------------------------------------------------------------

export function buildMotionConnectRequestPayload(controllerSettings: ControllerParameters): { ip: string } {
  // return { ip: controllerSettings.communication.ipAddress }
  return { ip: '127.0.0.1' }
}

export const connectMotion = async (payload: { ip: string }): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/connect', 'POST', payload as unknown as Record<string, unknown>)

export const connectMotionWithControllerSettings = async (controllerSettings: ControllerParameters): Promise<ApiCallResult<Record<string, unknown>>> =>
  connectMotion(buildMotionConnectRequestPayload(controllerSettings))

// ------------------------------------------------------------------
// 批量更新轴参数
// ------------------------------------------------------------------

export interface MotionAxisParamsPayload {
  units?: number
  lspeed?: number
  speed?: number
  accel?: number
  decel?: number
  sramp?: number
  merge?: number
  fwd_in?: number
  rev_in?: number
}

export interface MotionAllAxesParamsRequestPayload {
  table: Record<string, MotionAxisParamsPayload>
}

export function buildMotionAllAxesParamsRequestPayload(controllerSettings: ControllerParameters): MotionAllAxesParamsRequestPayload {
  const table: Record<string, MotionAxisParamsPayload> = {}

  for (const a of controllerSettings.axes) {
    const axisName = AXIS_NO_TO_NAME[a.axisNo]
    if (!axisName) continue
    table[axisName] = {
      units: a.units,
      lspeed: a.lspeed,
      speed: a.speed,
      accel: a.accel,
      decel: a.decel,
      sramp: a.sramp,
      merge: a.merge,
      fwd_in: a.fwd_in,
      rev_in: a.rev_in
    }
  }

  return { table }
}

export const setMotionAllAxesParams = async (payload: MotionAllAxesParamsRequestPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/axis/params/batch', 'POST', payload as unknown as Record<string, unknown>)

export const setMotionAllAxesParamsWithControllerSettings = async (controllerSettings: ControllerParameters): Promise<ApiCallResult<Record<string, unknown>>> =>
  setMotionAllAxesParams(buildMotionAllAxesParamsRequestPayload(controllerSettings))
