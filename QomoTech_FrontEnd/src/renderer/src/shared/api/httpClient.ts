/**
 * shared/api/httpClient.ts
 *
 * [已迁移] HTTP 客户端从 core/api/httpClient 重导出。
 * 兼容性：所有旧 import { apiCall } from '@/shared/api/httpClient' 仍然有效。
 */

export {
  apiCall,
  getBackendBaseUrl,
  getBackendApiUrl,
  withApiQuery,
  getCameraStreamUrl,
  type ApiCallResult
} from '@/core/api/httpClient'
