import type { ApiCallResult } from "@/shared/api/httpClient"
import { connectCamera, fetchCameraDevices } from "../api"
import type { CameraStatusPayload } from "../types"

// 初始化相机并连接指定索引的相机
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