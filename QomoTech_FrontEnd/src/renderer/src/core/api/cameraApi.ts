/**
 * core/api/cameraApi.ts
 *
 * 相机 HTTP API 封装。
 * 合并自: modules/camera/api/{cameraSettingSetApi, cameraSettingSaveLoadApi}.ts
 *
 * 职责：相机设备管理 + 参数设置 + 设置持久化的所有后端 HTTP 调用。
 */

import { apiCall, withApiQuery, type ApiCallResult } from './httpClient'
import type {
  CameraBootstrapSettingsPayload,
  CameraConnectPayload,
  CameraDeviceInfo,
  CameraExposurePayload,
  CameraFrameSpeedPayload,
  CameraMirrorPayload,
  CameraStatusPayload,
  CameraWhiteBalancePayload
} from '@/modules/camera/types'

// ====================================================================
// 设备管理
// ====================================================================

export const fetchCameraDevices = async (): Promise<
  ApiCallResult<{ devices: CameraDeviceInfo[] }>
> => apiCall<{ devices: CameraDeviceInfo[] }>('camera/devices', 'GET')

export const connectCamera = async (
  payload: CameraConnectPayload
): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<{ connected: boolean; selected_index: number | null }>(
    'camera/connect',
    'POST',
    payload as unknown as Record<string, unknown>
  ).then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })

export const disconnectCamera = async (): Promise<
  ApiCallResult<CameraStatusPayload>
> =>
  apiCall<{ connected: boolean }>('camera/disconnect', 'POST').then(
    async (res) => {
      if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
      return getCameraStatus()
    }
  )

export const getCameraStatus = async (): Promise<
  ApiCallResult<CameraStatusPayload>
> => apiCall<CameraStatusPayload>('camera/status', 'GET')

// ====================================================================
// 参数设置
// ====================================================================

export const setCameraExposure = async (
  payload: CameraExposurePayload
): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>(
    'camera/params/exposure',
    'POST',
    payload as unknown as Record<string, unknown>
  ).then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })

export const setCameraFrameSpeed = async (
  payload: CameraFrameSpeedPayload
): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>(
    'camera/params/frame-speed',
    'POST',
    payload as unknown as Record<string, unknown>
  ).then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })

export const setCameraMirror = async (
  payload: CameraMirrorPayload
): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>(
    'camera/params/mirror',
    'POST',
    payload as unknown as Record<string, unknown>
  ).then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })

export const setCameraWhiteBalance = async (
  payload: CameraWhiteBalancePayload
): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>(
    'camera/params/white-balance',
    'POST',
    payload as unknown as Record<string, unknown>
  ).then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })

/** 获取相机帧 URL（图片流，非 JSON API） */
export const getCameraFrameUrl = (
  timeoutMs = 1000,
  quality = 90
): string =>
  withApiQuery('camera/frame', { timeout_ms: timeoutMs, quality, t: Date.now() })

/** 设置相机引导参数 */
export const bootstrapCameraSettings = async (
  payload: CameraBootstrapSettingsPayload
): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>(
    'camera/bootstrap-settings',
    'POST',
    payload as unknown as Record<string, unknown>
  ).then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })

// ====================================================================
// 设置持久化
// ====================================================================

export const getCameraSettingsFromFile = async (): Promise<
  ApiCallResult<Record<string, unknown> | null>
> => apiCall('camera/settings', 'GET')

export const saveCameraSettingsToFile = async (
  payload: Record<string, unknown>
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('camera/settings', 'POST', payload)
