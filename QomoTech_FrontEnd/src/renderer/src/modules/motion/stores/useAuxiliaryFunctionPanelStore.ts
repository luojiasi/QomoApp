import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { XYZ } from '../types'
import {
  loadQuickMoveToPosition,
  saveQuickMoveToPosition,
  loadCenterRotation,
  saveCenterRotation
} from '../persistence/auxiliaryPersistence'

function round3(value: number): number {
  return Number(value.toFixed(3))
}

export const useAuxiliaryFunctionPanelStore = defineStore('auxiliary-function-panel', () => {
  const AuxiliaryFunctionPanel_quickMoveToPosition = ref<XYZ | null>(
    loadQuickMoveToPosition()
  )
  const axisCenterCalibCenterBasedXYSum = ref<XYZ>({ X: 0, Y: 0, Z: 0 })

    /** 从 persistence 加载快速移动位置并更新 ref。 */
  const loadAuxiliaryFunctionPanelQuickMoveToPosition = (): XYZ | null => {
    const fromStorage = loadQuickMoveToPosition()
    AuxiliaryFunctionPanel_quickMoveToPosition.value = fromStorage
    return fromStorage
  }

    /** 保存快速移动位置（四舍五入到 3 位小数）。 */
  const saveAuxiliaryFunctionPanelQuickMoveToPosition = (payload: XYZ): XYZ => {
    const next: XYZ = { X: round3(payload.X), Y: round3(payload.Y), Z: round3(payload.Z) }
    AuxiliaryFunctionPanel_quickMoveToPosition.value = next
    saveQuickMoveToPosition(next)
    return next
  }

    /** 从 persistence 加载中心校准偏移并更新 ref。 */
  const loadAxisCenterCalibCenterBasedXYSum = (): XYZ => {
    const fromStorage = loadCenterRotation()
    if (fromStorage) axisCenterCalibCenterBasedXYSum.value = fromStorage
    return axisCenterCalibCenterBasedXYSum.value
  }

    /** 保存中心校准偏移（四舍五入到 3 位小数）。 */
  const saveAxisCenterCalibCenterBasedXYSum = (payload: XYZ): XYZ => {
    const next: XYZ = { X: round3(payload.X), Y: round3(payload.Y), Z: round3(payload.Z) }
    axisCenterCalibCenterBasedXYSum.value = next
    saveCenterRotation(next)
    return next
  }

  return {
    AuxiliaryFunctionPanel_quickMoveToPosition,
    axisCenterCalibCenterBasedXYSum,
    loadAuxiliaryFunctionPanelQuickMoveToPosition,
    saveAuxiliaryFunctionPanelQuickMoveToPosition,
    loadAxisCenterCalibCenterBasedXYSum,
    saveAxisCenterCalibCenterBasedXYSum
  }
})
