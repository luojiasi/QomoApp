import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'

/** 从服务端加载完整配方状态 JSON 文件。 */
export const getRecipeStateFromFile = async (): Promise<
  ApiCallResult<Record<string, unknown> | null>
> => apiCall('recipe/state', 'GET')

/** 保存完整配方状态到服务端 JSON 文件。 */
export const saveRecipeStateToFile = async (
  payload: Record<string, unknown>
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('recipe/state', 'POST', payload)
