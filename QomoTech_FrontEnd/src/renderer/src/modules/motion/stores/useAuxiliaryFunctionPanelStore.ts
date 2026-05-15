import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { XYZ } from '../types'
import {
  loadQuickMoveToPosition,
  saveQuickMoveToPosition,
  saveCenterRotation
} from '../persistence/auxiliaryPersistence'
import {
  getProduct4PCenterRotation,
  syncProduct4PCenterRotation
} from '@/modules/program/api'

function round3(value: number): number {
  return Number(value.toFixed(3))
}

export const useAuxiliaryFunctionPanelStore = defineStore('auxiliary-function-panel', () => {
  const AuxiliaryFunctionPanel_quickMoveToPosition = ref<XYZ | null>(
    loadQuickMoveToPosition()
  )
  const axisCenterCalibCenterBasedXYSum = ref<XYZ>({ X: 0, Y: 0, Z: 0 })

  /** 从持久层加载快速移动位置并更新 ref。 */
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

  /** 从后端加载中心校准偏移，无数据则默认 {0,0,0}。 */
  const loadAxisCenterCalibCenterBasedXYSum = async (): Promise<XYZ> => {
    const result = await getProduct4PCenterRotation()
    if (result.success && result.data) {
      const next: XYZ = {
        X: round3(Number(result.data.X ?? 0)),
        Y: round3(Number(result.data.Y ?? 0)),
        Z: round3(Number(result.data.Z ?? 0))
      }
      axisCenterCalibCenterBasedXYSum.value = next
      return next
    }
    return axisCenterCalibCenterBasedXYSum.value
  }

  /** 保存中心校准偏移到后端和 localStorage（四舍五入到 3 位小数）。 */
  const saveAxisCenterCalibCenterBasedXYSum = async (payload: XYZ): Promise<XYZ> => {
    const next: XYZ = { X: round3(payload.X), Y: round3(payload.Y), Z: round3(payload.Z) }
    axisCenterCalibCenterBasedXYSum.value = next
    saveCenterRotation(next)
    const result = await syncProduct4PCenterRotation(next)
    if (!result.success) {
      console.warn('[auxiliary-store] 保存中心旋转偏移到后端失败:', result.message)
    }
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
