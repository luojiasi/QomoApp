// =============================================================================
// 通用编辑器设置 —— localStorage 持久化
// =============================================================================

import type { GeneralEditorConfig } from '../shares/types'
import {
  STORAGE_KEY_GENERAL,
  DEFAULT_HEIGHT,
  DEFAULT_OPEN_SIZE,
  DEFAULT_TILT_ANGLE,
  PROJECT_DEFAULT_NAME,
} from '../configs/defaults'

export function loadGeneralConfig(): GeneralEditorConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GENERAL)
    if (raw) {
      const saved = JSON.parse(raw)
      return {
        defaultProjectName: saved.defaultProjectName ?? PROJECT_DEFAULT_NAME,
        defaultExtrudeHeight: saved.defaultExtrudeHeight ?? DEFAULT_HEIGHT,
        defaultOpenSize: saved.defaultOpenSize ?? DEFAULT_OPEN_SIZE,
        defaultTiltAngle: saved.defaultTiltAngle ?? DEFAULT_TILT_ANGLE,
      }
    }
  } catch { /* corrupted data, fall through to defaults */ }
  return {
    defaultProjectName: PROJECT_DEFAULT_NAME,
    defaultExtrudeHeight: DEFAULT_HEIGHT,
    defaultOpenSize: DEFAULT_OPEN_SIZE,
    defaultTiltAngle: DEFAULT_TILT_ANGLE,
  }
}

export function saveGeneralConfig(data: GeneralEditorConfig) {
  localStorage.setItem(STORAGE_KEY_GENERAL, JSON.stringify(data))
}
