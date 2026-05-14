// ------------------------------------------------------------------
// 设置持久化（文件）
// ------------------------------------------------------------------

import { apiCall, type ApiCallResult } from "@/shared/api/httpClient"

export const getCameraSettingsFromFile = async (): Promise<ApiCallResult<Record<string, unknown> | null>> =>
    apiCall('camera/settings', 'GET')
  
export const saveCameraSettingsToFile = async (payload: Record<string, unknown>): Promise<ApiCallResult<Record<string, unknown>>> =>
    apiCall('camera/settings', 'POST', payload)
  