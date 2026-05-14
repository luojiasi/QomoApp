import { defineStore } from 'pinia'
import { ref } from 'vue'
import { defaultCameraSettings } from '../configs/cameraConfig'
import { isCameraSettingsShape, normalizeCameraSettings } from '../composables/cameraValidation'
import { cloneSettings } from '@/shared/utils/settings'
import { getCameraSettingsFromFile, saveCameraSettingsToFile } from '../api/cameraSettingSaveLoadApi'
import type { CameraSettingsState } from '../types'
import { createSettingsSaveResult } from '@/shared/utils/useSettingsStore'
import type { SettingsSaveResult } from '@/shared/types'


export const useCameraSettingsStore = defineStore('camera-settings', () => {
    const cameraSettings = ref<CameraSettingsState>(
      normalizeCameraSettings(cloneSettings(defaultCameraSettings))
    )
  
    const loadCameraSettings = async (): Promise<SettingsSaveResult<CameraSettingsState>> => {
      const res = await getCameraSettingsFromFile()
      if (res?.success && res.data) {
        const data = res.data as Record<string, unknown>
        if (isCameraSettingsShape(data)) {
          cameraSettings.value = cloneSettings(normalizeCameraSettings(data as CameraSettingsState))
          return createSettingsSaveResult('已从服务端加载相机参数。', cameraSettings.value)
        }
      }
      cameraSettings.value = normalizeCameraSettings(cloneSettings(defaultCameraSettings))
      return createSettingsSaveResult('使用默认相机参数。', cameraSettings.value)
    }
  
    const saveToLocalStorageNow = async (): Promise<SettingsSaveResult<CameraSettingsState>> => {
      const normalized = normalizeCameraSettings(cameraSettings.value)
      cameraSettings.value = cloneSettings(normalized)
      const res = await saveCameraSettingsToFile(normalized as unknown as Record<string, unknown>)
      if (!res?.success) {
        console.warn('[camera-settings] 保存到服务端失败', res?.message)
      }
      return createSettingsSaveResult('相机参数已保存。', cameraSettings.value)
    }
  
    const resetCameraSettings = async (): Promise<SettingsSaveResult<CameraSettingsState>> => {
      cameraSettings.value = normalizeCameraSettings(cloneSettings(defaultCameraSettings))
      return createSettingsSaveResult('相机参数已重置为默认值。', cameraSettings.value)
    }
  
    return {
      cameraSettings,
      loadCameraSettings,
      saveToLocalStorageNow,
      resetCameraSettings
    }
  })