import { ref } from 'vue'
import { defineStore } from 'pinia'

export type QuickMoveToPositionXYZ = {
  X: number
  Y: number
  Z: number
}

export type AxisCenterCalibCenterBasedXYSum = {
  Xoffset: number
  Yoffset: number
  Zoffset: number
}

export const AUXILIARY_FUNCTION_PANEL_QUICK_MOVE_TO_POSITION_STORAGE_KEY = 'AuxiliaryFunctionPanel_quickMoveToPosition'
export const AUXILIARY_FUNCTION_PANEL_CENTER_ROTATION_STORAGE_KEY = 'qomotech-4p-center-rotation'

function loadQuickMoveToPositionFromStorage(): QuickMoveToPositionXYZ | null {
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

function loadAxisCenterCalibCenterBasedXYSumFromStorage(): AxisCenterCalibCenterBasedXYSum | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AUXILIARY_FUNCTION_PANEL_CENTER_ROTATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<{ Xoffset: unknown; Yoffset: unknown; Zoffset: unknown }>
    const Xoffset = Number(parsed.Xoffset)
    const Yoffset = Number(parsed.Yoffset)
    const Zoffset = Number(parsed.Zoffset)
    if (!Number.isFinite(Xoffset) || !Number.isFinite(Yoffset) || !Number.isFinite(Zoffset)) return null
    return { Xoffset, Yoffset, Zoffset }
  } catch {
    return null
  }
}

function persistQuickMoveToPositionToStorage(value: QuickMoveToPositionXYZ): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
  try {
    window.localStorage.setItem(AUXILIARY_FUNCTION_PANEL_QUICK_MOVE_TO_POSITION_STORAGE_KEY, JSON.stringify(value))
  } catch (e) {
    console.warn('[auxiliary-function-panel] 写入 localStorage 失败', e)
  }
}

function persistAxisCenterCalibCenterBasedXYSumToStorage(value: AxisCenterCalibCenterBasedXYSum): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
  try {
    window.localStorage.setItem(AUXILIARY_FUNCTION_PANEL_CENTER_ROTATION_STORAGE_KEY, JSON.stringify(value))
  } catch (e) {
    console.warn('[auxiliary-function-panel] 写入 localStorage 失败', e)
  }
}

export const useAuxiliaryFunctionPanelStore = defineStore('auxiliary-function-panel', () => {
  const AuxiliaryFunctionPanel_quickMoveToPosition = ref<QuickMoveToPositionXYZ | null>(loadQuickMoveToPositionFromStorage())
  const axisCenterCalibCenterBasedXYSum = ref<AxisCenterCalibCenterBasedXYSum>({ Xoffset: 0, Yoffset: 0, Zoffset: 0 })

  const loadAuxiliaryFunctionPanelQuickMoveToPosition = (): QuickMoveToPositionXYZ | null => {
    const fromStorage = loadQuickMoveToPositionFromStorage()
    AuxiliaryFunctionPanel_quickMoveToPosition.value = fromStorage
    return fromStorage
  }

  const saveAuxiliaryFunctionPanelQuickMoveToPosition = (payload: QuickMoveToPositionXYZ): QuickMoveToPositionXYZ => {
    const next = {
      X: Number(payload.X.toFixed(3)),
      Y: Number(payload.Y.toFixed(3)),
      Z: Number(payload.Z.toFixed(3)),
    }
    AuxiliaryFunctionPanel_quickMoveToPosition.value = next
    persistQuickMoveToPositionToStorage(next)
    return next
  }

  const loadAxisCenterCalibCenterBasedXYSum = (): AxisCenterCalibCenterBasedXYSum => {
    const fromStorage = loadAxisCenterCalibCenterBasedXYSumFromStorage()
    if (fromStorage) axisCenterCalibCenterBasedXYSum.value = fromStorage
    return axisCenterCalibCenterBasedXYSum.value
  }

  const saveAxisCenterCalibCenterBasedXYSum = (payload: AxisCenterCalibCenterBasedXYSum): AxisCenterCalibCenterBasedXYSum => {
    const next = {
      Xoffset: Number(payload.Xoffset.toFixed(3)),
      Yoffset: Number(payload.Yoffset.toFixed(3)),
      Zoffset: Number(payload.Zoffset.toFixed(3)),
    }
    axisCenterCalibCenterBasedXYSum.value = next
    persistAxisCenterCalibCenterBasedXYSumToStorage(next)
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
