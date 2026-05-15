import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { Product4PCenterRotationPayload, QuickMovePositionPayload, StartProgramControlAction } from '../types'

/** 启动配方运行。 */
export const startProgram = async (payload: Record<string, unknown>): Promise<ApiCallResult<Record<string, unknown>>> => 
  apiCall('startProgram', 'POST', payload)

/** 同步 系统设置 中心旋转偏移到后端。 */
export const syncProduct4PCenterRotation = async (payload: Product4PCenterRotationPayload): Promise<ApiCallResult<Product4PCenterRotationPayload>> =>
  apiCall<Product4PCenterRotationPayload>('system-setting/center-rotation','POST',payload as unknown as Record<string, unknown>)

/** 从后端获取 系统设置 中心旋转偏移。 */
export const getProduct4PCenterRotation = async (): Promise<ApiCallResult<Product4PCenterRotationPayload>> =>
    apiCall<Product4PCenterRotationPayload>('system-setting/center-rotation', 'GET')

/** 同步 系统设置 快速移动点到后端。 */
export const syncQuickMovePosition = async (payload: QuickMovePositionPayload): Promise<ApiCallResult<QuickMovePositionPayload>> =>
  apiCall<QuickMovePositionPayload>('system-setting/quick-move-position','POST',payload as unknown as Record<string, unknown>)

/** 从后端获取 系统设置 快速移动点。 */
export const getQuickMovePosition = async (): Promise<ApiCallResult<QuickMovePositionPayload>> =>
    apiCall<QuickMovePositionPayload>('system-setting/quick-move-position', 'GET')

/** 获取程序运行状态。 */
export const getStartProgramStatus = async (): Promise<ApiCallResult<{ running?: boolean; paused?: boolean } & Record<string, unknown>>> => 
  apiCall('startProgram/status', 'GET')

/** 控制程序运行状态：暂停/继续/复位/急停/跳过。 */
export const startProgramControl = async (action: StartProgramControlAction): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('startProgram/control', 'POST', { action } as unknown as Record<string, unknown>)
