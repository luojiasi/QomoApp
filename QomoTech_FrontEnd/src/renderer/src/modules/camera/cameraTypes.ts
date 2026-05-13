export interface CameraSettingsState {
  cameraIndex: number
  autoExposure: boolean
  exposureTime: number
  frameSpeedLevel: 0 | 1 | 2 | 3
  frameSpeedAutoTune: boolean
  frameSpeedTune: number
  mirrorHorizontal: boolean
  mirrorVertical: boolean
  autoWhiteBalance: boolean
  whiteBalanceRGain: number
  whiteBalanceGGain: number
  whiteBalanceBGain: number
  frameTimeoutMs: number
  frameQuality: number
}
