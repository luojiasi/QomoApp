import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'

export interface Product4PCenterRotationPayload {
  Xoffset: number
  Yoffset: number
  Zoffset: number
}

export interface StartProgramStatusData { running: boolean; paused: boolean }

export type StartProgramControlAction = 'pause' | 'resume' | 'reset' | 'estop' | 'skip'

export const startProgram = async (payload: Record<string, unknown>): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('startProgram', 'POST', payload)

export const syncProduct4PCenterRotation = async (payload: Product4PCenterRotationPayload): Promise<ApiCallResult<Product4PCenterRotationPayload>> =>
  apiCall<Product4PCenterRotationPayload>('product4p/center-rotation', 'POST', payload as unknown as Record<string, unknown>)

export const getProduct4PCenterRotation = async (): Promise<ApiCallResult<Product4PCenterRotationPayload>> =>
  apiCall<Product4PCenterRotationPayload>('product4p/center-rotation', 'GET')

export const getStartProgramStatus = async (): Promise<ApiCallResult<{ running?: boolean; paused?: boolean } & Record<string, unknown>>> =>
  apiCall('startProgram/status', 'GET')

export const startProgramControl = async (action: StartProgramControlAction): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('startProgram/control', 'POST', { action } as unknown as Record<string, unknown>)
