import { apiCall, type ApiCallResult } from './toBackendApiCall'
import type { LaserTransmissionMode } from '../types/settings'

/** 与配方 `LaserPowerRecipe` 核心字段对齐，用于 POST 下发 */
export interface LaserApplyPayload {
  laserManufacturer?: string
  laserPower?: number
  laserFrequency?: number
  laserCurrent?: number
  transmissionMode?: LaserTransmissionMode
}

export const applyLaserParams = async (
  payload: LaserApplyPayload
): Promise<ApiCallResult<unknown>> =>
  apiCall('laser/apply', 'POST', payload as unknown as Record<string, unknown>)
