import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CameraSettingsState } from '../types'
import type { SettingsSaveResult } from '@/shared/types'
import { cloneSettings } from '@/shared/utils/settings'
import { createSettingsSaveResult } from '@/shared/utils/useSettingsStore'
import { normalizeCameraSettings } from '../validation/cameraValidation'
import { defaultCameraSettings } from '../config/cameraDefaults'
import { loadCameraSettings, saveCameraSettings } from '../persistence/cameraPersistence'

export const useCameraSettingsStore = defineStore('camera-settings', () => {
  const cameraSettings = ref<CameraSettingsState>(
    normalizeCameraSettings(cloneSettings(defaultCameraSettings))
  )

  /** 从服务端加载相机参数。成功更新 store，失败退回默认值。 */
  const loadCameraSettingsFromStore =
    async (): Promise<SettingsSaveResult<CameraSettingsState>> => {
      const loaded = await loadCameraSettings()
      if (loaded) {
        cameraSettings.value = cloneSettings(normalizeCameraSettings(loaded))
        return createSettingsSaveResult('已从服务端加载相机参数。', cameraSettings.value)
      }
      cameraSettings.value = normalizeCameraSettings(cloneSettings(defaultCameraSettings))
      return createSettingsSaveResult('使用默认相机参数。', cameraSettings.value)
    }

  /** 保存相机参数到服务端，同步更新 store。 */
  const saveCameraSettingsFromStore = async (): Promise<
    SettingsSaveResult<CameraSettingsState>
  > => {
    const normalized = normalizeCameraSettings(cameraSettings.value)
    cameraSettings.value = cloneSettings(normalized)
    await saveCameraSettings(normalized)
    return createSettingsSaveResult('相机参数已保存。', cameraSettings.value)
  }

  /** 重置相机参数为默认值。 */
  const resetCameraSettingsFromStore =
    async (): Promise<SettingsSaveResult<CameraSettingsState>> => {
      cameraSettings.value = normalizeCameraSettings(cloneSettings(defaultCameraSettings))
      return createSettingsSaveResult('相机参数已重置为默认值。', cameraSettings.value)
    }

  return {
    cameraSettings,
    loadCameraSettings: loadCameraSettingsFromStore,
    saveToServer: saveCameraSettingsFromStore,
    resetCameraSettings: resetCameraSettingsFromStore
  }
})
