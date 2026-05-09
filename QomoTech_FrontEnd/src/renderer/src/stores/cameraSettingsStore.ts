import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { CameraSettingsState, SettingsSaveResult } from '../types/settings'
import { cloneSettings } from '../utils/settings'
import { createSettingsSaveResult } from './settingsStoreUtils'
import { CAMERA_SETTINGS_STORAGE_KEY } from '../configs/storageKeys'
import { defaultCameraSettings } from '../configs/settings'
import { LIGHT_SETTINGS_PERSIST_DEBOUNCE_MS as PERSIST_DEBOUNCE_MS } from '../configs/constants'

function isCameraSettingsShape(data: unknown): data is CameraSettingsState {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return (
    typeof o.cameraIndex === 'number' &&
    typeof o.autoExposure === 'boolean' &&
    typeof o.exposureTime === 'number' &&
    typeof o.frameSpeedLevel === 'number' &&
    typeof o.frameSpeedAutoTune === 'boolean' &&
    typeof o.frameSpeedTune === 'number' &&
    typeof o.mirrorHorizontal === 'boolean' &&
    typeof o.mirrorVertical === 'boolean' &&
    typeof o.autoWhiteBalance === 'boolean' &&
    typeof o.whiteBalanceRGain === 'number' &&
    typeof o.whiteBalanceGGain === 'number' &&
    typeof o.whiteBalanceBGain === 'number' &&
    typeof o.frameTimeoutMs === 'number' &&
    typeof o.frameQuality === 'number'
  )
}

function normalizeCameraSettings(data: CameraSettingsState): CameraSettingsState {
  return cloneSettings({
    ...defaultCameraSettings,
    ...data,
    cameraIndex: Math.max(0, Number(data.cameraIndex) || 0),
    exposureTime: Math.min(65535, Math.max(0, Number(data.exposureTime) || defaultCameraSettings.exposureTime)),
    autoExposure: typeof data.autoExposure === 'boolean' ? data.autoExposure : defaultCameraSettings.autoExposure,
    frameSpeedLevel: [0, 1, 2, 3].includes(Number(data.frameSpeedLevel))
      ? (Number(data.frameSpeedLevel) as 0 | 1 | 2 | 3)
      : defaultCameraSettings.frameSpeedLevel,
    frameSpeedAutoTune:
      typeof data.frameSpeedAutoTune === 'boolean'
        ? data.frameSpeedAutoTune
        : defaultCameraSettings.frameSpeedAutoTune,
    frameSpeedTune: Math.min(1, Math.max(0, Number(data.frameSpeedTune) || defaultCameraSettings.frameSpeedTune)),
    mirrorHorizontal:
      typeof data.mirrorHorizontal === 'boolean'
        ? data.mirrorHorizontal
        : defaultCameraSettings.mirrorHorizontal,
    mirrorVertical:
      typeof data.mirrorVertical === 'boolean'
        ? data.mirrorVertical
        : defaultCameraSettings.mirrorVertical,
    autoWhiteBalance:
      typeof data.autoWhiteBalance === 'boolean'
        ? data.autoWhiteBalance
        : defaultCameraSettings.autoWhiteBalance,
    whiteBalanceRGain: Math.min(65535, Math.max(0, Number(data.whiteBalanceRGain) || defaultCameraSettings.whiteBalanceRGain)),
    whiteBalanceGGain: Math.min(65535, Math.max(0, Number(data.whiteBalanceGGain) || defaultCameraSettings.whiteBalanceGGain)),
    whiteBalanceBGain: Math.min(65535, Math.max(0, Number(data.whiteBalanceBGain) || defaultCameraSettings.whiteBalanceBGain)),
    frameTimeoutMs: Math.min(10000, Math.max(1, Number(data.frameTimeoutMs) || defaultCameraSettings.frameTimeoutMs)),
    frameQuality: Math.min(100, Math.max(1, Number(data.frameQuality) || defaultCameraSettings.frameQuality))
  })
}

function loadCameraSettingsFromStorage(): CameraSettingsState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CAMERA_SETTINGS_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isCameraSettingsShape(parsed)) return null
    return normalizeCameraSettings(parsed)
  } catch {
    return null
  }
}

function persistCameraSettingsToStorage(value: CameraSettingsState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CAMERA_SETTINGS_STORAGE_KEY, JSON.stringify(value))
  } catch (e) {
    console.warn('[camera-settings] 写入 localStorage 失败', e)
  }
}

export const useCameraSettingsStore = defineStore('camera-settings', () => {
  const cameraSettings = ref<CameraSettingsState>(
    loadCameraSettingsFromStorage() ?? cloneSettings(defaultCameraSettings)
  )

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  const schedulePersist = (): void => {
    if (persistTimer !== null) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      persistCameraSettingsToStorage(cameraSettings.value)
    }, PERSIST_DEBOUNCE_MS)
  }

  watch(cameraSettings, schedulePersist, { deep: true, flush: 'post' })

  const loadCameraSettings = async (): Promise<SettingsSaveResult<CameraSettingsState>> => {
    const fromStorage = loadCameraSettingsFromStorage()
    if (fromStorage) {
      cameraSettings.value = cloneSettings(fromStorage)
    }
    return createSettingsSaveResult('已从本地存储加载相机参数。', cameraSettings.value)
  }

  const saveToLocalStorageNow = async (): Promise<SettingsSaveResult<CameraSettingsState>> => {
    if (persistTimer !== null) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    cameraSettings.value = cloneSettings(normalizeCameraSettings(cameraSettings.value))
    persistCameraSettingsToStorage(cameraSettings.value)
    return createSettingsSaveResult('相机参数已保存到本地存储。', cameraSettings.value)
  }

  return {
    cameraSettings,
    loadCameraSettings,
    saveToLocalStorageNow
  }
})
