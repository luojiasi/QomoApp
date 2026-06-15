// =============================================================================
// Camera 模块类型定义
// =============================================================================

export type CameraFrameSpeedLevel = 0 | 1 | 2 | 3

export interface CameraSettingsState {
  cameraIndex: number
  autoExposure: boolean
  exposureTime: number
  frameSpeedLevel: CameraFrameSpeedLevel
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

export interface CameraDeviceInfo {
  index: number
  name: string
  serial?: string
}

export interface CameraStatusPayload {
  initialized: boolean
  connected: boolean
  streaming: boolean
  selected_index: number | null
  last_error: string | null
  speed_levels?: Record<string, number>
}

export interface CameraExposurePayload {
  auto_exposure?: boolean
  exposure_time?: number
}

export interface CameraFrameSpeedPayload {
  speed_level?: CameraFrameSpeedLevel
  auto_tune?: boolean
  tune?: number
}

export interface CameraMirrorPayload {
  horizontal?: boolean
  vertical?: boolean
}

export interface CameraWhiteBalancePayload {
  auto_white_balance?: boolean
  once?: boolean
  r_gain?: number
  g_gain?: number
  b_gain?: number
}

export interface CameraBootstrapSettingsPayload {
  auto_exposure?: boolean
  exposure_time?: number
  speed_level?: CameraFrameSpeedLevel
  auto_tune?: boolean
  tune?: number
  mirror_horizontal?: boolean
  mirror_vertical?: boolean
  auto_white_balance?: boolean
  r_gain?: number
  g_gain?: number
  b_gain?: number
}
