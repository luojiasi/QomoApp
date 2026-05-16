import { onMounted, onUnmounted, inject } from 'vue'
import { matchAction } from '../../stores/shortcutsStore'
import { SETTINGS_STATE_KEY, type SettingsState } from '../../shares/types'
import type { ActionDef } from '../../shares/types'

/**
 * 全局键盘快捷键监听。
 *
 * settingsState 优先从 inject 获取（子组件场景），其次从参数接收（同组件 provide 场景）。
 */
export function useKeyboardShortcuts(
  onAction: (action: ActionDef) => void,
  settingsState?: SettingsState,
) {
  const settings = settingsState ?? inject<SettingsState | null>(SETTINGS_STATE_KEY, null)

  function onKeydown(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null
    if (el) {
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return
    }

    if (settings?.isOpen.value && settings.capturing.value) return

    const a = matchAction(e)
    if (a) {
      e.preventDefault()
      onAction(a)
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
