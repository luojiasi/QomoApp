import { ref, shallowRef } from 'vue'
import type { ActionDef } from '../../shares/types'
import { saveOverrides, getResolvedActions, diffAction } from '../../stores/shortcutsStore'

/** 快捷键编辑面板的完整逻辑（原 useSettings 中的快捷键部分）。
 *  与 dialog 壳（useSettings）解耦，独立管理编辑状态与持久化。 */
export function useShortcutSettings() {
  const editingActions = shallowRef<ActionDef[]>(getResolvedActions())
  const capturing = ref<string | null>(null)

  function reload() {
    editingActions.value = getResolvedActions()
  }

  function save() {
    const o: Record<string, Partial<ActionDef>> = {}
    for (const a of editingActions.value) {
      const d = diffAction(a)
      if (d) o[a.id] = d
    }
    saveOverrides(o)
  }

  function startCapture(actionId: string) {
    capturing.value = actionId
  }

  function cancelCapture() {
    capturing.value = null
  }

  function handleCapture(e: KeyboardEvent) {
    if (!capturing.value) return false
    e.preventDefault()
    e.stopPropagation()

    const key = e.key
    if (key === 'Control' || key === 'Meta' || key === 'Shift' || key === 'Alt') return true

    const idx = editingActions.value.findIndex(a => a.id === capturing.value)
    if (idx === -1) { capturing.value = null; return true }

    const a = editingActions.value[idx]
    const updated: ActionDef = {
      ...a,
      key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    }
    const next = [...editingActions.value]
    next[idx] = updated
    editingActions.value = next

    capturing.value = null
    return true
  }

  function clearAction(actionId: string) {
    const idx = editingActions.value.findIndex(a => a.id === actionId)
    if (idx === -1) return
    const next = [...editingActions.value]
    const { key: _k, ctrl: _c, shift: _s, alt: _a, ...rest } = next[idx]
    next[idx] = rest as ActionDef
    editingActions.value = next
  }

  function resetAction(actionId: string) {
    const resolved = getResolvedActions()
    const def = resolved.find(a => a.id === actionId)
    if (!def) return
    const idx = editingActions.value.findIndex(a => a.id === actionId)
    if (idx === -1) return
    const next = [...editingActions.value]
    next[idx] = { ...def }
    editingActions.value = next
  }

  function formatShortcut(a: ActionDef): string {
    const parts: string[] = []
    if (a.ctrl) parts.push('Ctrl')
    if (a.shift) parts.push('Shift')
    if (a.alt) parts.push('Alt')
    if (a.key) parts.push(a.key.length === 1 ? a.key.toUpperCase() : a.key)
    return parts.join('+') || '未设置'
  }

  return {
    editingActions,
    capturing,
    reload,
    save,
    startCapture,
    cancelCapture,
    handleCapture,
    clearAction,
    resetAction,
    formatShortcut,
  }
}
