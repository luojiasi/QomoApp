import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { Product4PCenterRotationPayload, StartProgramControlAction } from '../types'

/** 启动配方运行。 */
export const startProgram = async (payload: Record<string, unknown>): Promise<ApiCallResult<Record<string, unknown>>> => 
  apiCall('startProgram', 'POST', payload)

/** 同步 4P 中心旋转偏移到后端。 */
export const syncProduct4PCenterRotation = async (payload: Product4PCenterRotationPayload): Promise<ApiCallResult<Product4PCenterRotationPayload>> =>
  apiCall<Product4PCenterRotationPayload>('product4p/center-rotation','POST',payload as unknown as Record<string, unknown>)

/** 从后端获取 4P 中心旋转偏移。 */
export const getProduct4PCenterRotation =
  async (): Promise<ApiCallResult<Product4PCenterRotationPayload>> =>
    apiCall<Product4PCenterRotationPayload>('product4p/center-rotation', 'GET')

/** 获取程序运行状态。 */
export const getStartProgramStatus = async (): Promise<ApiCallResult<{ running?: boolean; paused?: boolean } & Record<string, unknown>>> => 
  apiCall('startProgram/status', 'GET')

/** 控制程序运行状态：暂停/继续/复位/急停/跳过。 */
export const startProgramControl = async (action: StartProgramControlAction): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('startProgram/control', 'POST', { action } as unknown as Record<string, unknown>)
