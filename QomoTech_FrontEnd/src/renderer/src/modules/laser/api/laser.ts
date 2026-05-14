import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { LaserApplyPayload, LaserSettingsPayload } from '../types/laser'

export const applyLaserParams = async (payload: LaserApplyPayload): Promise<ApiCallResult<unknown>> =>
  apiCall('laser/apply', 'POST', payload as unknown as Record<string, unknown>)

export const getLaserSettings = (): Promise<ApiCallResult<LaserSettingsPayload | null>> =>
  apiCall('rs232/laser/settings', 'GET')

export const saveLaserSettings = async (payload: LaserSettingsPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('rs232/laser/settings', 'POST', payload as unknown as Record<string, unknown>)

/** 梅曼激光器开关（后端直接操作 RS232） */
export const controlMMLaser = async (on: boolean): Promise<ApiCallResult<unknown>> =>
  apiCall('rs232/laser/mm-control', 'POST', { on })
