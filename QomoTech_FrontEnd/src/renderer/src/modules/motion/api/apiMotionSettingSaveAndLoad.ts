import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'

// ------------------------------------------------------------------
// 控制器设置文件持久化（替代 localStorage）
// ------------------------------------------------------------------

export const getControllerSettingsFromFile = async (): Promise<ApiCallResult<Record<string, unknown> | null>> =>
  apiCall('motion/controller-settings', 'GET')

export const saveControllerSettingsToFile = async (payload: Record<string, unknown>): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/controller-settings', 'POST', payload)
