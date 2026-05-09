import { apiCall, type ApiCallResult } from '../core/base'
import type { ControllerParameters } from '../../types/settings'

const MAX_AXIS_NO = 5
const AXIS_NOS_3 = [0, 1, 2] as const
const AXIS_NOS_5 = [0, 1, 2, 3, 4] as const

const getAllowedAxisNos = (axisCount: ControllerParameters['communication']['axisCount']): readonly number[] =>
  axisCount === 3 ? AXIS_NOS_3 : AXIS_NOS_5

const isValidAxisNo = (axisNo: number): boolean =>
  Number.isInteger(axisNo) && axisNo >= 0 && axisNo <= MAX_AXIS_NO

// ------------------------------------------------------------------
// 连接
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// 更新驱动器参数
// ------------------------------------------------------------------

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
