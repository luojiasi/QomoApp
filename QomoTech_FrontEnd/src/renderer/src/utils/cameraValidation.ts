import type { CameraSettingsState } from '../types/settings'
import { defaultCameraSettings } from '../configs/settings'
import { cloneSettings } from './settings'

export function isCameraSettingsShape(data: unknown): data is CameraSettingsState {
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

export function normalizeCameraSettings(data: CameraSettingsState): CameraSettingsState {
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
