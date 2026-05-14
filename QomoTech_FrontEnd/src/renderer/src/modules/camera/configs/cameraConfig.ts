import type { CameraSettingsState } from "../types";

// 默认相机设置
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
// ——————————————————————————————————————————————————————————————————
// 相机接收器默认配置
// ——————————————————————————————————————————————————————————————————
export const DEFAULT_TIMEOUT_MS = 1200 // 单帧抓取超时（ms）
export const DEFAULT_QUALITY = 50 // JPEG 编码质量（1~100）
export const TARGET_DISPLAY_FPS = 120 // 目标显示帧率
export const DISPLAY_FRAME_INTERVAL_MS = Math.floor(1000 / TARGET_DISPLAY_FPS) // 显示帧间隔时间
export const WS_RECONNECT_MS = 120 // WebSocket 重连时间
export const FRAME_QUEUE_SIZE = 3 // 帧队列大小
export const URL_CACHE_SIZE = 32 // URL 缓存大小
  