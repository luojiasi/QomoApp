import { ref } from 'vue'
import type { TabItem } from '../shares/types'
export function useRightPanel() {
  const activeTab = ref<string>('layout')
  const rightPanelTabs: TabItem[] = [
    { id: 'layout', label: 'Layout' },
    { id: 'inspector', label: 'Inspector' },
    { id: 'debug', label: 'Debug' },
  ]

  return { activeTab, rightPanelTabs }
}
