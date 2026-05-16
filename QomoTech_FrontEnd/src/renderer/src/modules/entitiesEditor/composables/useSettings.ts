import { ref, shallowRef } from 'vue'
import { ACTIONS, type ActionDef } from '../utils/shortcuts'
import type { TabItem } from '../shares/types'

const STORAGE_KEY = 'qomo:shortcuts'

function loadOverrides(): Record<string, Partial<ActionDef>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveOverrides(overrides: Record<string, Partial<ActionDef>>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

export function useSettings() {
  const isOpen = ref(false)
  const activeTab = ref('shortcuts')
  const overrides = shallowRef<Record<string, Partial<ActionDef>>>(loadOverrides())
  /** 正在捕获按键的 action id，null 表示非捕获状态 */
  const capturing = ref<string | null>(null)
  /** 编辑中的 copy */
  const editingActions = shallowRef<ActionDef[]>(
    ACTIONS.map(a => ({ ...a, ...overrides.value[a.id] })),
  )

  const settingsTabs: TabItem[] = [
    { id: 'shortcuts', label: '快捷键' },
    { id: 'general', label: '通用' },
  ]

  function open() {
    // 每次打开时重新加载
    overrides.value = loadOverrides()
    editingActions.value = ACTIONS.map(a => ({ ...a, ...overrides.value[a.id] }))
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

  /** 接收键盘事件，绑定到正在捕获的 action */
  function handleCapture(e: KeyboardEvent) {
    if (!capturing.value) return false
    e.preventDefault()
    e.stopPropagation()

    const key = e.key
    // 忽略单独的修饰键
    if (key === 'Control' || key === 'Meta' || key === 'Shift' || key === 'Alt') return true

    const idx = editingActions.value.findIndex(a => a.id === capturing.value)
    if (idx === -1) { capturing.value = null; return true }

    const a = editingActions.value[idx]
    const updated = {
      ...a,
      key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    }
    const newActions = [...editingActions.value]
    newActions[idx] = updated
    editingActions.value = newActions

    capturing.value = null
    return true
  }

  function resetAction(actionId: string) {
    const def = ACTIONS.find(a => a.id === actionId)
    if (!def) return
    const idx = editingActions.value.findIndex(a => a.id === actionId)
    if (idx === -1) return
    const newActions = [...editingActions.value]
    newActions[idx] = { ...def }
    editingActions.value = newActions
  }

  function save() {
    const o: Record<string, Partial<ActionDef>> = {}
    for (const a of editingActions.value) {
      const def = ACTIONS.find(d => d.id === a.id)
      if (!def) continue
      // 只保存和默认值不同的字段
      const diff: Partial<ActionDef> = {}
      if (a.key !== def.key) diff.key = a.key
      if (a.ctrl !== def.ctrl) diff.ctrl = a.ctrl
      if (a.shift !== def.shift) diff.shift = a.shift
      if (a.alt !== def.alt) diff.alt = a.alt
      if (Object.keys(diff).length > 0) o[a.id] = diff
    }
    overrides.value = o
    saveOverrides(o)
    close()
  }

  /** 渲染快捷键为可读字符串 */
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
