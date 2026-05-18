import { ref } from 'vue'
import type { TabItem } from '../shares/types'
export function useRightPanel() {
  const activeTab = ref<string>('layout')
  const rightPanelTabs: TabItem[] = [
    { id: 'inspector', label: 'Inspector' },
    { id: 'layout', label: 'Layout' },
    { id: 'debug', label: 'Debug' },
  ]

  return { activeTab, rightPanelTabs }
}
