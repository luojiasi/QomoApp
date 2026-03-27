import { apiCall, type ApiCallResult } from './toBackendApiCall'
import type { Rs232SendRequest, Rs232SerialSessionRequest } from '../types/settings'

export interface Rs232PortInfo {
  device: string
  name: string
  description: string
}

/** GET /api/rs232/ports */
export const fetchRs232Ports = (): Promise<ApiCallResult<{ ports: Rs232PortInfo[] }>> =>
  apiCall('rs232/ports', 'GET')

/** POST /api/rs232/open */
export const openRs232 = (
  payload: Rs232SerialSessionRequest
): Promise<ApiCallResult<{ connected?: boolean; portName?: string | null }>> =>
  apiCall('rs232/open', 'POST', payload as unknown as Record<string, unknown>)

/** POST /api/rs232/close */
export const closeRs232 = (): Promise<ApiCallResult<{ connected?: boolean }>> =>
  apiCall('rs232/close', 'POST')

/** POST /api/rs232/send */
export const sendRs232 = (
  payload: Rs232SendRequest
): Promise<ApiCallResult<{ timestamp?: string }>> =>
  apiCall('rs232/send', 'POST', payload as unknown as Record<string, unknown>)

/** POST /api/rs232/workbench-sync */
export const syncRs232Workbench = (
  payload: Rs232SerialSessionRequest
): Promise<ApiCallResult<{ portName?: string | null }>> =>
  apiCall('rs232/workbench-sync', 'POST', payload as unknown as Record<string, unknown>)

/** GET /api/rs232/buffer */
export const fetchRs232Buffer = (clear = false): Promise<ApiCallResult<{ text: string }>> =>
  apiCall('rs232/buffer', 'GET', null, { clear })
