import { useAuxiliaryFunctionPanelStore } from '../stores/useAuxiliaryFunctionPanelStore'
import { useHardwareState } from '@/shared/api/hardware'
import { useNotification } from '@/shared/composables/useNotification'
import { axisNameByNo } from './useAxisCenterCalib'

export function useQuickMoveToPosition() {
  const { error, success } = useNotification()
  const { mposition } = useHardwareState()
  const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()

  function getAxisPosition(axisNo: number): number | null {
    const name = axisNameByNo[axisNo]
    const mpos = Number(mposition.value[name] ?? NaN)
    return Number.isFinite(mpos) ? mpos : null
  }

  function displayQuickMoveAxis(axisName: 'X' | 'Y' | 'Z'): string {
    const value = auxiliaryFunctionPanelStore.AuxiliaryFunctionPanel_quickMoveToPosition?.[axisName]
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '-'
  }

  function handleSaveQuickMoveToPosition(): void {
    const X = getAxisPosition(0)
    const Y = getAxisPosition(1)
    const Z = getAxisPosition(2)
    if (X === null || Y === null || Z === null) {
      error('当前 XYZ 位置不可用，保存失败')
      return
    }

    const value = {
      X: Number(X.toFixed(3)),
      Y: Number(Y.toFixed(3)),
      Z: Number(Z.toFixed(3)),
    }
    auxiliaryFunctionPanelStore.saveAuxiliaryFunctionPanelQuickMoveToPosition(value)
    success('已保存当前 XYZ 到确点位置')
  }

  return {
    displayQuickMoveAxis,
    handleSaveQuickMoveToPosition,
  }
}
