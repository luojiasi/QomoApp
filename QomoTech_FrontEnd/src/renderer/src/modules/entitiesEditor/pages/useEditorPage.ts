import { ref } from 'vue'

export type MobileTab = 'layers' | '3d' | 'inspector'

export interface MobileTabItem {
  id: MobileTab
  label: string
  icon: string
}

export function useEditorPage() {
  const activeMobileTab = ref<MobileTab>('layers')
  const mobileDrawerOpen = ref(false)

  const mobileTabs: MobileTabItem[] = [
    { id: 'layers', label: '图层', icon: '☰' },
    { id: '3d', label: '3D', icon: '◈' },
    { id: 'inspector', label: '属性', icon: '⋯' },
  ]

  function onMobileTabClick(tab: MobileTab) {
    if (activeMobileTab.value === tab) {
      mobileDrawerOpen.value = !mobileDrawerOpen.value
    } else {
      activeMobileTab.value = tab
      mobileDrawerOpen.value = true
    }
  }

  function closeDrawer() {
    mobileDrawerOpen.value = false
  }

  return {
    activeMobileTab,
    mobileDrawerOpen,
    mobileTabs,
    onMobileTabClick,
    closeDrawer,
  }
}
