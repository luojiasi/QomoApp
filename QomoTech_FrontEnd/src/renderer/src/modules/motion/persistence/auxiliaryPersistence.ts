import { Product4PCenterRotationPayload, QuickMovePositionPayload } from '@/modules/program/types'
import {
  AUXILIARY_FUNCTION_PANEL_QUICK_MOVE_TO_POSITION_STORAGE_KEY,
  CENTER_ROTATION_STORAGE_KEY
} from '@/shared/constants/storageKeys'
import { isBrowser } from '@/shared/utils/browser'

// --------------------------------------------------------------------
// 快速移动位置（仅保存，读取从后端 API 获取）
// --------------------------------------------------------------------

/** 保存快速移动位置到 localStorage。 */
export function saveQuickMoveToPosition(value: QuickMovePositionPayload): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(
      AUXILIARY_FUNCTION_PANEL_QUICK_MOVE_TO_POSITION_STORAGE_KEY,
      JSON.stringify(value)
    )
  } catch (e) {
    console.warn('[auxiliary-persistence] 写入 localStorage 失败', e)
  }
}

// --------------------------------------------------------------------
// 中心校准偏移（仅保存，读取从后端 API 获取）
// --------------------------------------------------------------------

/** 保存中心校准偏移到 localStorage。 */
export function saveCenterRotation(value: Product4PCenterRotationPayload): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(
      CENTER_ROTATION_STORAGE_KEY,
      JSON.stringify(value)
    )
  } catch (e) {
    console.warn('[auxiliary-persistence] 写入 localStorage 失败', e)
  }
}
