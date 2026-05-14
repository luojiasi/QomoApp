/**
 * core/api/systemApi.ts
 *
 * 系统级 API 封装：健康检查、日志下载、后端关闭等。
 */

import { apiCall, type ApiCallResult } from './httpClient'

// ====================================================================
// 健康检查
// ====================================================================

export const healthCheck = async (): Promise<
  ApiCallResult<{ status: string; timestamp?: string }>
> => apiCall('health', 'GET')

// ====================================================================
// 后端状态
// ====================================================================

export const getBackendState = async (): Promise<
  ApiCallResult<Record<string, unknown>>
> => apiCall('state', 'GET')

// ====================================================================
// 日志下载
// ====================================================================

export const downloadLogs = async (): Promise<ApiCallResult<string>> =>
  apiCall<string>('logs/download', 'GET')

// ====================================================================
// 优雅关闭
// ====================================================================

export const shutdownBackend = async (): Promise<
  ApiCallResult<{ message?: string }>
> => apiCall('shutdown', 'POST')

// ====================================================================
// 运动诊断
// ====================================================================

export const getMotionDiagnostics = async (): Promise<
  ApiCallResult<Record<string, unknown>>
> => apiCall('motion/diagnostics', 'GET')
