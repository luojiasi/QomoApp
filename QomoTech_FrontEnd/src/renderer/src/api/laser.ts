import { apiCall, type ApiCallResult } from './base'
import type { LaserTransmissionMode } from '../types/settings'

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
