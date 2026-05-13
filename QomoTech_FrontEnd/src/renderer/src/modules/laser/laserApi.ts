import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { LaserTransmissionMode } from '@/types/settings'

export interface LaserApplyPayload {
  laserManufacturer?: string
  laserPower?: number
  laserFrequency?: number
  laserCurrent?: number
  transmissionMode?: LaserTransmissionMode
}

export const applyLaserParams = async (payload: LaserApplyPayload): Promise<ApiCallResult<unknown>> =>
  apiCall('laser/apply', 'POST', payload as unknown as Record<string, unknown>)

// ------------------------------------------------------------------
// 激光参数文件持久化
// ------------------------------------------------------------------

export interface LaserSettingsPayload {
  manufacturer: string
  port: string
  power: string
  frequency: string
  current: string
}

export const getLaserSettings = (): Promise<ApiCallResult<LaserSettingsPayload | null>> =>
  apiCall('rs232/laser/settings', 'GET')

export const saveLaserSettings = async (payload: LaserSettingsPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('rs232/laser/settings', 'POST', payload as unknown as Record<string, unknown>)

/** 梅曼激光器开关（后端直接操作 RS232） */
export const controlMMLaser = async (on: boolean): Promise<ApiCallResult<unknown>> =>
  apiCall('rs232/laser/mm-control', 'POST', { on })
