import { getCameraSettingsFromFile, saveCameraSettingsToFile } from '../api'
import type { CameraSettingsState } from '../types'
import { isCameraSettingsShape, normalizeCameraSettings } from '../validation/cameraValidation'

/** 从服务端加载相机参数。成功返回规范化参数，失败返回 null。 */
export async function loadCameraSettings(): Promise<CameraSettingsState | null> {
  const res = await getCameraSettingsFromFile()
  if (res?.success && res.data) {
    const data = res.data as Record<string, unknown>
    if (isCameraSettingsShape(data)) {
      return normalizeCameraSettings(data as CameraSettingsState)
    }
  }
  return null
}

/** 保存相机参数到服务端。返回是否成功。 */
export async function saveCameraSettings(
  payload: CameraSettingsState
): Promise<boolean> {
  const res = await saveCameraSettingsToFile(payload as unknown as Record<string, unknown>)
  if (!res?.success) {
    console.warn('[camera-persistence] 保存到服务端失败', res?.message)
    return false
  }
  return true
}
