import type { CameraSettingsState } from '@/types/cameraSettings'

export const defaultCameraSettings: CameraSettingsState = {
  cameraIndex: 0,
  autoExposure: true,
  exposureTime: 1000,
  frameSpeedLevel: 1,
  frameSpeedAutoTune: true,
  frameSpeedTune: 1,
  mirrorHorizontal: false,
  mirrorVertical: false,
  autoWhiteBalance: true,
  whiteBalanceRGain: 21,
  whiteBalanceGGain: 22,
  whiteBalanceBGain: 16,
  frameTimeoutMs: 1000,
  frameQuality: 90
}
