import { apiCall, type ApiCallResult } from '../core/base'
import type { Rs232SendRequest, Rs232SerialSessionRequest } from '../../types/settings'

export interface Rs232PortInfo {
  device: string
  name: string
  description: string
}

export const fetchRs232Ports = (): Promise<ApiCallResult<{ ports: Rs232PortInfo[] }>> =>
  apiCall('rs232/ports', 'GET')

export const openRs232 = (payload: Rs232SerialSessionRequest): Promise<ApiCallResult<{ connected?: boolean; portName?: string | null }>> =>
  apiCall('rs232/open', 'POST', payload as unknown as Record<string, unknown>)

export const closeRs232 = (): Promise<ApiCallResult<{ connected?: boolean }>> =>
  apiCall('rs232/close', 'POST')

export const sendRs232 = (payload: Rs232SendRequest): Promise<ApiCallResult<{ timestamp?: string }>> =>
  apiCall('rs232/send', 'POST', payload as unknown as Record<string, unknown>)

export const syncRs232Workbench = (payload: Rs232SerialSessionRequest): Promise<ApiCallResult<{ portName?: string | null }>> =>
  apiCall('rs232/workbench-sync', 'POST', payload as unknown as Record<string, unknown>)

export const fetchRs232Buffer = (clear = false): Promise<ApiCallResult<{ text: string }>> =>
  apiCall('rs232/buffer', 'GET', null, { clear })
