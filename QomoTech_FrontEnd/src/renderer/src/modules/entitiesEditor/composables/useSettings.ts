import { ref, shallowRef } from 'vue'
import type { ActionDef, TabItem } from '../shares/types'
import { saveOverrides, getResolvedActions, diffAction } from '../stores/shortcutsStore'

// ── 模块级单例状态（供 useKeyboardShortcuts 跨组件读取） ──
const isOpen = ref(false)
const capturing = ref<string | null>(null)

export function useSettings() {
  const activeTab = ref('shortcuts')

  const settingsTabs: TabItem[] = [
    { id: 'shortcuts', label: '快捷键' },
    { id: 'general', label: '通用' },
  ]

  const editingActions = shallowRef<ActionDef[]>(getResolvedActions())

  function open() {
    editingActions.value = getResolvedActions()
    capturing.value = null
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    capturing.value = null
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

  function save() {
    const o: Record<string, Partial<ActionDef>> = {}
    for (const a of editingActions.value) {
      const d = diffAction(a)
      if (d) o[a.id] = d
    }
    saveOverrides(o)
    close()
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
    isOpen,
    activeTab,
    settingsTabs,
    editingActions,
    capturing,
    open,
    close,
    save,
    startCapture,
    cancelCapture,
    handleCapture,
    resetAction,
    formatShortcut,
  }
}
