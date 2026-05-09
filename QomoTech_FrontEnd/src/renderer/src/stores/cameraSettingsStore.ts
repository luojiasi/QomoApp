import { defineStore } from 'pinia'
import { defaultCameraSettings } from '../configs/settings'
import { CAMERA_SETTINGS_STORAGE_KEY } from '../configs/storageKeys'
import { LIGHT_SETTINGS_PERSIST_DEBOUNCE_MS } from '../configs/constants'
import { isCameraSettingsShape, normalizeCameraSettings } from '../utils/cameraValidation'
import { createPersistedSettings } from './settingsStoreUtils'

export const useCameraSettingsStore = defineStore('camera-settings', () => {
  const persisted = createPersistedSettings({
    storageKey: CAMERA_SETTINGS_STORAGE_KEY,
    defaultValue: defaultCameraSettings,
    validate: isCameraSettingsShape,
    normalize: normalizeCameraSettings,
    debounceMs: LIGHT_SETTINGS_PERSIST_DEBOUNCE_MS,
    loadMessage: '已从本地存储加载相机参数。',
    saveMessage: '相机参数已保存到本地存储。',
    logTag: 'camera-settings'
  })

  return {
    cameraSettings: persisted.state,
    loadCameraSettings: persisted.load,
    saveToLocalStorageNow: persisted.saveNow,
    resetCameraSettings: persisted.reset
  }
})
