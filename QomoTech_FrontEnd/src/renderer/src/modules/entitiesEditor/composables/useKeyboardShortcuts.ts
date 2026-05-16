import { onMounted, onUnmounted } from 'vue'
import { getResolvedActions } from '../stores/shortcutsStore'
import { useSettings } from './useSettings'
import type { ActionDef } from '../shares/types'

/**
 * 全局键盘快捷键监听。
 *
 * 流程：
 *   window keydown → 跳过输入框 → 获取用户自定义快捷键(getResolvedActions)
 *   → 逐条匹配 ctrl/shift/alt/key → 匹配成功 → preventDefault → 回调 onAction
 *
 * 当设置弹窗打开且正在捕获按键时，跳过全局快捷键分发。
 */
export function useKeyboardShortcuts(onAction: (action: ActionDef) => void) {
  const { isOpen, capturing } = useSettings()

  function onKeydown(e: KeyboardEvent) {
    // 输入框内不触发快捷键
    const el = e.target as HTMLElement | null
    if (el) {
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return
    }

    // 设置弹窗捕获按键时不触发全局快捷键
    if (isOpen.value && capturing.value) return

    const actions = getResolvedActions()
    const key = e.key
    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    const alt = e.altKey

    for (const a of actions) {
      if (!a.key) continue
      if (a.key.toLowerCase() !== key.toLowerCase()) continue
      if ((a.ctrl ?? false) !== ctrl) continue
      if ((a.shift ?? false) !== shift) continue
      if ((a.alt ?? false) !== alt) continue
      e.preventDefault()
      onAction(a)
      return
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
