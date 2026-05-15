import type { XYZ } from '../types'
import {
  AUXILIARY_FUNCTION_PANEL_QUICK_MOVE_TO_POSITION_STORAGE_KEY,
  CENTER_ROTATION_STORAGE_KEY
} from '@/shared/constants/storageKeys'
import { isBrowser } from '@/shared/utils/browser'

// --------------------------------------------------------------------
// 快速移动位置
// --------------------------------------------------------------------

/** 从 localStorage 加载快速移动位置。无数据返回 null。 */
export function loadQuickMoveToPosition(): XYZ | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(
      AUXILIARY_FUNCTION_PANEL_QUICK_MOVE_TO_POSITION_STORAGE_KEY
    )
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<{ X: unknown; Y: unknown; Z: unknown }>
    const X = Number(parsed.X)
    const Y = Number(parsed.Y)
    const Z = Number(parsed.Z)
    if (!Number.isFinite(X) || !Number.isFinite(Y) || !Number.isFinite(Z)) return null
    return { X, Y, Z }
  } catch {
    return null
  }
}

/** 保存快速移动位置到 localStorage。 */
export function saveQuickMoveToPosition(value: XYZ): void {
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
// 中心校准偏移
// --------------------------------------------------------------------

/**
 * 从 localStorage 加载中心校准偏移（兼容 Xoffset/Yoffset/Zoffset 历史格式）。
 */
export function loadCenterRotation(): XYZ | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(CENTER_ROTATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<{
      Xoffset: unknown
      Yoffset: unknown
      Zoffset: unknown
    }>
    const X = Number(parsed.Xoffset)
    const Y = Number(parsed.Yoffset)
    const Z = Number(parsed.Zoffset)
    if (!Number.isFinite(X) || !Number.isFinite(Y) || !Number.isFinite(Z)) return null
    return { X, Y, Z }
  } catch {
    return null
  }
}

/** 保存中心校准偏移到 localStorage（使用 Xoffset/Yoffset/Zoffset 历史格式）。 */
export function saveCenterRotation(value: XYZ): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(
      CENTER_ROTATION_STORAGE_KEY,
      JSON.stringify({ Xoffset: value.X, Yoffset: value.Y, Zoffset: value.Z })
    )
  } catch (e) {
    console.warn('[auxiliary-persistence] 写入 localStorage 失败', e)
  }
}
