import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { ControllerParameters } from '../types/controller'
import type { MotionAxisParamsPayload, MotionAllAxesParamsRequestPayload } from '../types/controller'
import { AXIS_NO_TO_NAME } from '../config/controller'

// ------------------------------------------------------------------
// 连接
// ------------------------------------------------------------------

/** 后端 ConnectRequest 仅接收 ip。connect_timeout_s 由后端配置层使用，不通过此请求传递。 */
export function buildMotionConnectRequestPayload(controllerSettings: ControllerParameters): { ip: string } {
  return { ip: controllerSettings.communication.controller_ip }
}

export const connectMotion = async (payload: { ip: string }): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/connect', 'POST', payload as unknown as Record<string, unknown>)

export const connectMotionWithControllerSettings = async (
  controllerSettings: ControllerParameters
): Promise<ApiCallResult<Record<string, unknown>>> =>
  connectMotion(buildMotionConnectRequestPayload(controllerSettings))

// ------------------------------------------------------------------
// 批量更新轴参数
// ------------------------------------------------------------------

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
