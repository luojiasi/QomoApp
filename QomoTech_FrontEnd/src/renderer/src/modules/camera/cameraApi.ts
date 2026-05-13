import { apiCall, withApiQuery, type ApiCallResult } from '@/shared/api/httpClient'

export interface CameraDeviceInfo {
  index: number
  name: string
  serial?: string
}

export interface CameraStatusPayload {
  initialized: boolean
  connected: boolean
  streaming: boolean
  selected_index: number | null
  last_error: string | null
  speed_levels?: Record<string, number>
}

export interface CameraConnectPayload {
  index: number
}

export interface CameraBootstrapSettingsPayload {
  auto_exposure?: boolean
  exposure_time?: number
  speed_level?: 0 | 1 | 2 | 3
  auto_tune?: boolean
  tune?: number
  mirror_horizontal?: boolean
  mirror_vertical?: boolean
  auto_white_balance?: boolean
  r_gain?: number
  g_gain?: number
  b_gain?: number
}

export interface CameraExposurePayload {
  auto_exposure?: boolean
  exposure_time?: number
}

export interface CameraFrameSpeedPayload {
  speed_level?: 0 | 1 | 2 | 3
  auto_tune?: boolean
  tune?: number
}

export interface CameraMirrorPayload {
  horizontal?: boolean
  vertical?: boolean
}

export interface CameraWhiteBalancePayload {
  auto_white_balance?: boolean
  once?: boolean
  r_gain?: number
  g_gain?: number
  b_gain?: number
}

export const fetchCameraDevices = async (): Promise<ApiCallResult<{ devices: CameraDeviceInfo[] }>> =>
  apiCall<{ devices: CameraDeviceInfo[] }>('camera/devices', 'GET')

export const connectCamera = async (payload: CameraConnectPayload): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<{ connected: boolean; selected_index: number | null }>('camera/connect', 'POST', payload as unknown as Record<string, unknown>).then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })

export const initSdkEnumAndConnectIndex0 = async (): Promise<ApiCallResult<CameraStatusPayload>> => {
  const devicesRes = await fetchCameraDevices()
  if (!devicesRes.success) {
    return {
      success: false,
      message: devicesRes.message ?? '初始化 SDK / 枚举设备失败'
    }
  }
  const devices = devicesRes.data?.devices ?? []
  if (devices.length <= 0) {
    return {
      success: false,
      message: '未枚举到可用相机设备'
    }
  }
  return connectCamera({ index: 0 })
}

export const disconnectCamera = async (): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<{ connected: boolean }>('camera/disconnect', 'POST').then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })

export const getCameraStatus = async (): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<CameraStatusPayload>('camera/status', 'GET')

export const bootstrapCameraSettings = async (payload: CameraBootstrapSettingsPayload): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>('camera/bootstrap-settings', 'POST', payload as unknown as Record<string, unknown>).then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })

export const setCameraExposure = async (
  payload: CameraExposurePayload
): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>('camera/params/exposure', 'POST', payload as unknown as Record<string, unknown>).then(
    async (res) => {
      if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
      return getCameraStatus()
    }
  )

export const setCameraFrameSpeed = async (
  payload: CameraFrameSpeedPayload
): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>('camera/params/frame-speed', 'POST', payload as unknown as Record<string, unknown>).then(
    async (res) => {
      if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
      return getCameraStatus()
    }
  )

export const setCameraMirror = async (
  payload: CameraMirrorPayload
): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>('camera/params/mirror', 'POST', payload as unknown as Record<string, unknown>).then(
    async (res) => {
      if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
      return getCameraStatus()
    }
  )

export const setCameraWhiteBalance = async (
  payload: CameraWhiteBalancePayload
): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>('camera/params/white-balance', 'POST', payload as unknown as Record<string, unknown>).then(
    async (res) => {
      if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
      return getCameraStatus()
    }
  )

export const getCameraFrameUrl = (timeoutMs = 1000, quality = 90): string =>
  withApiQuery('camera/frame', { timeout_ms: timeoutMs, quality, t: Date.now() })

// ------------------------------------------------------------------
// 设置持久化（文件）
// ------------------------------------------------------------------

export const getCameraSettingsFromFile = async (): Promise<ApiCallResult<Record<string, unknown> | null>> =>
  apiCall('camera/settings', 'GET')

export const saveCameraSettingsToFile = async (
  payload: Record<string, unknown>
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('camera/settings', 'POST', payload)
