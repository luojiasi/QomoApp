import { apiCall, ApiCallResult, withApiQuery } from "@/shared/api/httpClient";
import type { 
  CameraBootstrapSettingsPayload,
    CameraConnectPayload, 
    CameraDeviceInfo, 
    CameraExposurePayload, 
    CameraFrameSpeedPayload, 
    CameraMirrorPayload, 
    CameraStatusPayload, 
    CameraWhiteBalancePayload 
} from "../types";

// ------------------------------------------------------------------
// 相机设备管理
// ------------------------------------------------------------------

// 获取设备
export const fetchCameraDevices = async (): Promise<ApiCallResult<{ devices: CameraDeviceInfo[] }>> =>
    apiCall<{ devices: CameraDeviceInfo[] }>('camera/devices', 'GET')
// 连接相机
export const connectCamera = async (payload: CameraConnectPayload): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<{ connected: boolean; selected_index: number | null }>('camera/connect', 'POST', payload as unknown as Record<string, unknown>).then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })
// 断开相机连接
export const disconnectCamera = async (): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<{ connected: boolean }>('camera/disconnect', 'POST').then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })
// 获取相机状态
export const getCameraStatus = async (): Promise<ApiCallResult<CameraStatusPayload>> =>
    apiCall<CameraStatusPayload>('camera/status', 'GET')



// 设置曝光参数
export const setCameraExposure = async (payload: CameraExposurePayload): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>('camera/params/exposure', 'POST', payload as unknown as Record<string, unknown>).then(
    async (res) => {
      if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
      return getCameraStatus()
    }
  )

// 设置帧率参数
export const setCameraFrameSpeed = async (payload: CameraFrameSpeedPayload): Promise<ApiCallResult<CameraStatusPayload>> =>
    apiCall<unknown>('camera/params/frame-speed', 'POST', payload as unknown as Record<string, unknown>).then(
      async (res) => {
        if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
        return getCameraStatus()
      }
    )

// 设置镜像参数
export const setCameraMirror = async (payload: CameraMirrorPayload): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>('camera/params/mirror', 'POST', payload as unknown as Record<string, unknown>).then(
    async (res) => {
      if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
      return getCameraStatus()
    }
  )

// 设置白平衡参数
export const setCameraWhiteBalance = async (payload: CameraWhiteBalancePayload): Promise<ApiCallResult<CameraStatusPayload>> =>
    apiCall<unknown>('camera/params/white-balance', 'POST', payload as unknown as Record<string, unknown>).then(
      async (res) => {
        if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
        return getCameraStatus()
      }
    )

// 获取相机帧率URL
export const getCameraFrameUrl = (timeoutMs = 1000, quality = 90): string =>
  withApiQuery('camera/frame', { timeout_ms: timeoutMs, quality, t: Date.now() })

// 设置引导参数
export const bootstrapCameraSettings = async (payload: CameraBootstrapSettingsPayload): Promise<ApiCallResult<CameraStatusPayload>> =>
  apiCall<unknown>('camera/bootstrap-settings', 'POST', payload as unknown as Record<string, unknown>).then(async (res) => {
    if (!res.success) return res as unknown as ApiCallResult<CameraStatusPayload>
    return getCameraStatus()
  })
