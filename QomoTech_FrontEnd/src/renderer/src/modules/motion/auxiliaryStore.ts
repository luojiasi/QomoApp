import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { XYZ } from '@/types/auxiliaryFunctionPanel'
import { AUXILIARY_FUNCTION_PANEL_QUICK_MOVE_TO_POSITION_STORAGE_KEY, CENTER_ROTATION_STORAGE_KEY } from '@/configs/storageKeys'

function loadQuickMoveToPositionFromStorage(): XYZ | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AUXILIARY_FUNCTION_PANEL_QUICK_MOVE_TO_POSITION_STORAGE_KEY)
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

/** localStorage 存的是 Xoffset/Yoffset/Zoffset（历史格式），代码中用 XYZ 统一处理 */
function loadCenterRotationFromStorage(): XYZ | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CENTER_ROTATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<{ Xoffset: unknown; Yoffset: unknown; Zoffset: unknown }>
    const X = Number(parsed.Xoffset)
    const Y = Number(parsed.Yoffset)
    const Z = Number(parsed.Zoffset)
    if (!Number.isFinite(X) || !Number.isFinite(Y) || !Number.isFinite(Z)) return null
    return { X, Y, Z }
  } catch {
    return null
  }
}

function persistQuickMoveToPositionToStorage(value: XYZ): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
  try {
    window.localStorage.setItem(AUXILIARY_FUNCTION_PANEL_QUICK_MOVE_TO_POSITION_STORAGE_KEY, JSON.stringify(value))
  } catch (e) {
    console.warn('[auxiliary-function-panel] 写入 localStorage 失败', e)
  }
}

function persistCenterRotationToStorage(value: XYZ): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
  try {
    window.localStorage.setItem(CENTER_ROTATION_STORAGE_KEY, JSON.stringify({
      Xoffset: value.X,
      Yoffset: value.Y,
      Zoffset: value.Z
    }))
  } catch (e) {
    console.warn('[auxiliary-function-panel] 写入 localStorage 失败', e)
  }
}

export const useAuxiliaryFunctionPanelStore = defineStore('auxiliary-function-panel', () => {
  const AuxiliaryFunctionPanel_quickMoveToPosition = ref<XYZ | null>(loadQuickMoveToPositionFromStorage())
  const axisCenterCalibCenterBasedXYSum = ref<XYZ>({ X: 0, Y: 0, Z: 0 })

  const loadAuxiliaryFunctionPanelQuickMoveToPosition = (): XYZ | null => {
    const fromStorage = loadQuickMoveToPositionFromStorage()
    AuxiliaryFunctionPanel_quickMoveToPosition.value = fromStorage
    return fromStorage
  }

  const saveAuxiliaryFunctionPanelQuickMoveToPosition = (payload: XYZ): XYZ => {
    const next = {
      X: Number(payload.X.toFixed(3)),
      Y: Number(payload.Y.toFixed(3)),
      Z: Number(payload.Z.toFixed(3)),
    }
    AuxiliaryFunctionPanel_quickMoveToPosition.value = next
    persistQuickMoveToPositionToStorage(next)
    return next
  }

  const loadAxisCenterCalibCenterBasedXYSum = (): XYZ => {
    const fromStorage = loadCenterRotationFromStorage()
    if (fromStorage) axisCenterCalibCenterBasedXYSum.value = fromStorage
    return axisCenterCalibCenterBasedXYSum.value
  }

  const saveAxisCenterCalibCenterBasedXYSum = (payload: XYZ): XYZ => {
    const next = {
      X: Number(payload.X.toFixed(3)),
      Y: Number(payload.Y.toFixed(3)),
      Z: Number(payload.Z.toFixed(3)),
    }
    axisCenterCalibCenterBasedXYSum.value = next
    persistCenterRotationToStorage(next)
    return next
  }

  return {
    AuxiliaryFunctionPanel_quickMoveToPosition,
    axisCenterCalibCenterBasedXYSum,
    loadAuxiliaryFunctionPanelQuickMoveToPosition,
    saveAuxiliaryFunctionPanelQuickMoveToPosition,
    loadAxisCenterCalibCenterBasedXYSum,
    saveAxisCenterCalibCenterBasedXYSum,
  }
})
