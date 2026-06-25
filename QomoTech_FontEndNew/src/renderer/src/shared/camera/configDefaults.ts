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
export const WS_RECONNECT_MS = 120
export const FRAME_QUEUE_SIZE = 10
export const URL_CACHE_SIZE = 32

// Adaptive display timing — matches display to actual frame arrival rate
export const DISPLAY_INTERVAL_MIN_MS = 8    // 120fps cap
export const DISPLAY_INTERVAL_MAX_MS = 50   // 20fps floor
export const DISPLAY_INTERVAL_DEFAULT_MS = 16 // ~60fps start
export const ARRIVAL_WINDOW_SIZE = 8        // frames to average for FPS estimation
