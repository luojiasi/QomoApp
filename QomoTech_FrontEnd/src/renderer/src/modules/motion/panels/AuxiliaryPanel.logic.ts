import { provide, ref } from 'vue'
import { useAxisCenterCalib } from '../composables/useAxisCenterCalib'
import { useQuickFocus } from '../composables/useQuickFocus'
import { useQuickConcentric } from '../composables/useQuickConcentric'
import { useQuickMoveToPosition } from '../composables/useQuickMoveToPosition'

export function useAuxiliaryPanelLogic() {
  const isPanelExpanded = ref(false)
  const activeTab = ref<string>('quickMoveToPosition')
  const tabs = [
    { id: 'axisCenterCalib', label: '五轴校准' },
    { id: 'quickMoveToPosition', label: '确点移动' },
    { id: 'quickDot', label: '快速打点' },
    { id: 'quickFocus', label: '快速找焦' },
    { id: 'quickConcentric', label: '快速调同' },
    { id: 'userCustom', label: '自定功能' },
  ]

  const axisCalib = useAxisCenterCalib()
  const quickFocus = useQuickFocus()
  const quickConcentric = useQuickConcentric()
  const quickMove = useQuickMoveToPosition()

  provide('axisCalib', axisCalib)
  provide('quickFocus', quickFocus)
  provide('quickConcentric', quickConcentric)
  provide('quickMove', quickMove)

  return {
    isPanelExpanded,
    activeTab,
    tabs,
    isQuickFocusing: quickFocus.isQuickFocusing,
  }
}
