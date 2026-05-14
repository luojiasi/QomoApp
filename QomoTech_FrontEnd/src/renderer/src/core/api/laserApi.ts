/**
 * core/api/laserApi.ts
 *
 * 激光/RS232 HTTP API 封装。
 * 合并自: modules/laser/api/{laser, rs232}.ts
 *
 * 职责：激光参数 + RS232 串口操作的所有后端 HTTP 调用。
 */

import { apiCall, type ApiCallResult } from './httpClient'
import type {
  LaserApplyPayload,
  LaserSettingsPayload,
  Rs232PortInfo
} from '@/modules/laser/types/laser'
import type {
  Rs232SendRequest,
  Rs232SerialSessionRequest
} from '@/modules/laser/types/rs232'

// ====================================================================
// 激光参数
// ====================================================================

export const applyLaserParams = async (
  payload: LaserApplyPayload
): Promise<ApiCallResult<unknown>> =>
  apiCall('laser/apply', 'POST', payload as unknown as Record<string, unknown>)

export const getLaserSettings = (): Promise<
  ApiCallResult<LaserSettingsPayload | null>
> => apiCall('rs232/laser/settings', 'GET')

export const saveLaserSettings = async (
  payload: LaserSettingsPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('rs232/laser/settings', 'POST', payload as unknown as Record<string, unknown>)

/** 梅曼激光器开关（后端直接操作 RS232） */
export const controlMMLaser = async (
  on: boolean
): Promise<ApiCallResult<unknown>> =>
  apiCall('rs232/laser/mm-control', 'POST', { on })

// ====================================================================
// RS232 串口
// ====================================================================

export const fetchRs232Ports = (): Promise<
  ApiCallResult<{ ports: Rs232PortInfo[] }>
> => apiCall('rs232/ports', 'GET')

export const openRs232 = (
  payload: Rs232SerialSessionRequest
): Promise<ApiCallResult<{ connected?: boolean; portName?: string | null }>> =>
  apiCall('rs232/open', 'POST', payload as unknown as Record<string, unknown>)

export const closeRs232 = (): Promise<
  ApiCallResult<{ connected?: boolean }>
> => apiCall('rs232/close', 'POST')

export const sendRs232 = (
  payload: Rs232SendRequest
): Promise<ApiCallResult<{ timestamp?: string }>> =>
  apiCall('rs232/send', 'POST', payload as unknown as Record<string, unknown>)

export const syncRs232Workbench = (
  payload: Rs232SerialSessionRequest
): Promise<ApiCallResult<{ portName?: string | null }>> =>
  apiCall(
    'rs232/workbench-sync',
    'POST',
    payload as unknown as Record<string, unknown>
  )

export const fetchRs232Buffer = (
  clear = false
): Promise<ApiCallResult<{ text: string }>> =>
  apiCall('rs232/buffer', 'GET', null, { clear })
