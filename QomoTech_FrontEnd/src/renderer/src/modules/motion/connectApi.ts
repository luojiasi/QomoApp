import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { ControllerParameters } from '@/types/settings'

/** 轴号 → 轴名映射（与后端 motion_config.MotionConfig.axis_no_to_name 对齐） */
const AXIS_NO_TO_NAME: Record<number, string> = { 0: 'X', 1: 'Y', 2: 'Z', 3: 'U', 4: 'R' }

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

/**
 * 后端 zmc_adapter.写入轴参数 接受的 kwargs。
 * merge_params（corner_mode/decel_angle/stop_angle/zxmooth）不在此接口范围内，由后端在
 * 连接初始化时按 motion_config.merge_params 单独下发。
 */
export interface MotionAxisParamsPayload {
  units?: number
  lspeed?: number
  speed?: number
  accel?: number
  decel?: number
  sramp?: number
  atype?: number
  merge?: number
  fwd_in?: number
  rev_in?: number
}

export interface MotionAllAxesParamsRequestPayload {
  table: Record<string, MotionAxisParamsPayload>
}

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

// ------------------------------------------------------------------
// 控制器设置文件持久化（替代 localStorage）
// ------------------------------------------------------------------

export const getControllerSettingsFromFile = async (): Promise<ApiCallResult<Record<string, unknown> | null>> =>
  apiCall('motion/controller-settings', 'GET')

export const saveControllerSettingsToFile = async (
  payload: Record<string, unknown>
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/controller-settings', 'POST', payload)
