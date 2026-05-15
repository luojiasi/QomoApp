// =============================================================================
// Camera 模块类型定义
// 先 type（简单别名/字面量），后 interface（复杂对象结构）
// =============================================================================

// ============ type 定义 ============

/** 帧率档位 */
export type CameraFrameSpeedLevel = 0 | 1 | 2 | 3

// ============ interface 定义 ============

/** 相机设置状态 */
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

/** 相机设备信息 */
export interface CameraDeviceInfo {
  index: number
  name: string
  serial?: string
}

/** 相机状态 */
export interface CameraStatusPayload {
  initialized: boolean
  connected: boolean
  streaming: boolean
  selected_index: number | null
  last_error: string | null
  speed_levels?: Record<string, number>
}

/** 相机连接 */
export interface CameraConnectPayload {
  index: number
}

/** 相机引导设置 */
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

/** 相机曝光 */
export interface CameraExposurePayload {
  auto_exposure?: boolean
  exposure_time?: number
}

/** 相机帧率 */
export interface CameraFrameSpeedPayload {
  speed_level?: CameraFrameSpeedLevel
  auto_tune?: boolean
  tune?: number
}

/** 相机镜像 */
export interface CameraMirrorPayload {
  horizontal?: boolean
  vertical?: boolean
}

/** 相机白平衡 */
export interface CameraWhiteBalancePayload {
  auto_white_balance?: boolean
  once?: boolean
  r_gain?: number
  g_gain?: number
  b_gain?: number
}
