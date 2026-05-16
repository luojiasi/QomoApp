import { ref, inject } from 'vue'
import type { TabItem, SettingsState } from '../shares/types'
import { SETTINGS_STATE_KEY } from '../shares/types'

/** 设置弹窗外壳状态 —— 仅管理弹窗显隐与 tab 切换。
 *  各 tab 的具体逻辑在 shortcuts/useShortcutSettings 和 preview/useScene3DSettings 中。 */
export function useSettings() {
  const injected = inject<SettingsState | null>(SETTINGS_STATE_KEY, null)
  const isOpen = injected?.isOpen ?? ref(false)
  const capturing = injected?.capturing ?? ref<string | null>(null)

  const activeTab = ref('general')

  const settingsTabs: TabItem[] = [
    { id: 'general', label: '通用' },
    { id: 'scene3d', label: '3D参数' },
    { id: 'canvas2d', label: '2D画布' },
    { id: 'shortcuts', label: '快捷键' },
  ]

  function open() {
    capturing.value = null
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    capturing.value = null
  }

  return { isOpen, activeTab, settingsTabs, capturing, open, close }
}
