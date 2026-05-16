import { ref } from 'vue'
import type { TabItem } from '../shares/types'

export type { TabItem }

export function useSwitchableView() {
  const activeTab = ref<string>('layout')

  const rightPanelTabs: TabItem[] = [
    { id: 'layout', label: 'Layout' },
    { id: 'inspector', label: 'Inspector' },
  ]

  return { activeTab, rightPanelTabs }
}
