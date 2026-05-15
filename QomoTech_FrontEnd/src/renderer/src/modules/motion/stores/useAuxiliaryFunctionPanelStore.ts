import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  saveQuickMoveToPosition,
  saveCenterRotation
} from '../persistence/auxiliaryPersistence'
import {
  getProduct4PCenterRotation,
  syncProduct4PCenterRotation,
  getQuickMovePosition,
  syncQuickMovePosition
} from '@/modules/program/api'
import { Product4PCenterRotationPayload, QuickMovePositionPayload } from '@/modules/program/types'

function round3(value: number): number {
  return Number(value.toFixed(3))
}

export const useAuxiliaryFunctionPanelStore = defineStore('auxiliary-function-panel', () => {
  const AuxiliaryFunctionPanel_quickMoveToPosition = ref<QuickMovePositionPayload | null>(null)
  const axisCenterCalibCenterBasedXYSum = ref<Product4PCenterRotationPayload | null>(null)

  /** 从后端加载快速移动位置，无数据则默认 null。 */
  const loadAuxiliaryFunctionPanelQuickMoveToPosition = async (): Promise<QuickMovePositionPayload | null> => {
    const result = await getQuickMovePosition()
    if (result.success && result.data) {
      const next: QuickMovePositionPayload = {
        X: round3(Number(result.data.X ?? 0)),
        Y: round3(Number(result.data.Y ?? 0)),
        Z: round3(Number(result.data.Z ?? 0))
      }
      AuxiliaryFunctionPanel_quickMoveToPosition.value = next
      return next
    }
    return AuxiliaryFunctionPanel_quickMoveToPosition.value
  }

  /** 保存快速移动位置到 localStorage 和后端（四舍五入到 3 位小数）。 */
  const saveAuxiliaryFunctionPanelQuickMoveToPosition = async (payload: QuickMovePositionPayload): Promise<QuickMovePositionPayload> => {
    const next: QuickMovePositionPayload = { X: round3(payload.X), Y: round3(payload.Y), Z: round3(payload.Z) }
    AuxiliaryFunctionPanel_quickMoveToPosition.value = next
    saveQuickMoveToPosition(next)
    const result = await syncQuickMovePosition(next)
    if (!result.success) {
      console.warn('[auxiliary-store] 保存快速移动点到后端失败:', result.message)
    }
    return next
  }

  /** 从后端加载中心校准偏移，无数据则默认 {0,0,0}。 */
  const loadAxisCenterCalibCenterBasedXYSum = async (): Promise<Product4PCenterRotationPayload | null> => {
    const result = await getProduct4PCenterRotation()
    if (result.success && result.data) {
      const next: Product4PCenterRotationPayload = {
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
  const saveAxisCenterCalibCenterBasedXYSum = async (payload: Product4PCenterRotationPayload): Promise<Product4PCenterRotationPayload> => {
    const next: Product4PCenterRotationPayload = { X: round3(payload.X), Y: round3(payload.Y), Z: round3(payload.Z) }
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
