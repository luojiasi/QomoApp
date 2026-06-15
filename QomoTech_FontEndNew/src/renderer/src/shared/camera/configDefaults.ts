import type { CameraSettingsState } from './types'

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

export const DEFAULT_TIMEOUT_MS = 1200
export const DEFAULT_QUALITY = 50
export const TARGET_DISPLAY_FPS = 120
export const DISPLAY_FRAME_INTERVAL_MS = Math.floor(1000 / TARGET_DISPLAY_FPS)
export const WS_RECONNECT_MS = 120
export const FRAME_QUEUE_SIZE = 3
export const URL_CACHE_SIZE = 32
