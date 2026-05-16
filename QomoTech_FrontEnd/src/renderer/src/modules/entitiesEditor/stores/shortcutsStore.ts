// =============================================================================
// 快捷键持久化存储 —— localStorage 读写，与 shortcuts.ts 默认值合并
// =============================================================================

import { ACTIONS } from '../utils/shortcuts'
import type { ActionDef } from '../shares/types'
import { STORAGE_KEY_SHORTCUTS } from '../configs/defaults'

function loadOverrides(): Record<string, Partial<ActionDef>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHORTCUTS)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveOverrides(overrides: Record<string, Partial<ActionDef>>) {
  localStorage.setItem(STORAGE_KEY_SHORTCUTS, JSON.stringify(overrides))
}

/** 合并默认值 + 用户覆盖 → 当前生效的快捷键列表 */
export function getResolvedActions(): ActionDef[] {
  const o = loadOverrides()
  return ACTIONS.map(a => (o[a.id] ? { ...a, ...o[a.id] } : { ...a }))
}

/** 比对单个 action 与默认值的差异，返回仅含变化字段的对象（无变化则返回 null） */
export function diffAction(action: ActionDef): Partial<ActionDef> | null {
  const def = ACTIONS.find(a => a.id === action.id)
  if (!def) return null
  const d: Partial<ActionDef> = {}
  if (action.key !== def.key) d.key = action.key
  if (action.ctrl !== def.ctrl) d.ctrl = action.ctrl
  if (action.shift !== def.shift) d.shift = action.shift
  if (action.alt !== def.alt) d.alt = action.alt
  return Object.keys(d).length > 0 ? d : null
}
