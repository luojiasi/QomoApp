// =============================================================================
// Laser 模块 API 端点
// =============================================================================

import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { LaserApplyPayload, LaserSettingsPayload, Rs232PortInfo, Rs232SendRequest, Rs232SerialSessionRequest } from '../types'

// ─── 激光 ───

/** 应用激光参数。 */
export const applyLaserParams = async (
  payload: LaserApplyPayload
): Promise<ApiCallResult<unknown>> =>
  apiCall('laser/apply', 'POST', payload as unknown as Record<string, unknown>)

/** 获取激光设置。 */
export const getLaserSettings = (): Promise<ApiCallResult<LaserSettingsPayload | null>> =>
  apiCall('rs232/laser/settings', 'GET')

/** 保存激光设置。 */
export const saveLaserSettings = async (
  payload: LaserSettingsPayload
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('rs232/laser/settings', 'POST', payload as unknown as Record<string, unknown>)

/** mm激光器开关（后端直接操作 RS232）。 */
export const controlMMLaser = async (
  on: boolean
): Promise<ApiCallResult<unknown>> =>
  apiCall('rs232/laser/mm-control', 'POST', { on })

// ─── RS232 ───

/** 获取可用串口列表。 */
export const fetchRs232Ports =
  (): Promise<ApiCallResult<{ ports: Rs232PortInfo[] }>> => apiCall('rs232/ports', 'GET')

/** 打开串口连接。 */
export const openRs232 = (
  payload: Rs232SerialSessionRequest
): Promise<ApiCallResult<{ connected?: boolean; portName?: string | null }>> =>
  apiCall('rs232/open', 'POST', payload as unknown as Record<string, unknown>)

/** 关闭串口连接。 */
export const closeRs232 = (): Promise<ApiCallResult<{ connected?: boolean }>> =>
  apiCall('rs232/close', 'POST')

/** 发送串口数据。 */
export const sendRs232 = (
  payload: Rs232SendRequest
): Promise<ApiCallResult<{ timestamp?: string }>> =>
  apiCall('rs232/send', 'POST', payload as unknown as Record<string, unknown>)

/** 同步串口工作台配置到后端。 */
export const syncRs232Workbench = (
  payload: Rs232SerialSessionRequest
): Promise<ApiCallResult<{ portName?: string | null }>> =>
  apiCall('rs232/workbench-sync', 'POST', payload as unknown as Record<string, unknown>)

/** 获取接收缓冲区内容。 */
export const fetchRs232Buffer = (
  clear = false
): Promise<ApiCallResult<{ text: string }>> =>
  apiCall('rs232/buffer', 'GET', null, { clear })
