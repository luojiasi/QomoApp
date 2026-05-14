/**
 * core/api/index.ts
 *
 * 统一 API 层导出入口。
 * 所有模块应从此处导入所需 API，而非直接引用各 API 文件。
 */

export {
  apiCall,
  getBackendBaseUrl,
  getBackendApiUrl,
  withApiQuery,
  getCameraStreamUrl,
  type ApiCallResult
} from './httpClient'

export * from './motionApi'
export * from './cameraApi'
export * from './laserApi'
export * from './systemApi'
