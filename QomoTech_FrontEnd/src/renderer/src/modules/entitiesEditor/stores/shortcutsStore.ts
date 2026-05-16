// =============================================================================
// 快捷键持久化存储 —— localStorage 读写，与 shortcuts.ts 默认值合并
// =============================================================================

import { ACTIONS } from '../configs/defaults'
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

/** 合并默认值 + 用户覆盖 → 当前生效的快捷键列表。
 *  覆盖值为 null 表示用户主动清除了该字段。 */
export function getResolvedActions(): ActionDef[] {
  const o = loadOverrides()
  return ACTIONS.map(a => {
    const ov = o[a.id]
    if (!ov) return { ...a }
    const merged: any = { ...a }
    for (const [k, v] of Object.entries(ov)) {
      if (v === null) {
        delete merged[k]
      } else {
        merged[k] = v
      }
    }
    return merged as ActionDef
  })
}

/** 键盘事件 → 匹配已合并用户覆盖的快捷键 */
export function matchAction(event: KeyboardEvent): ActionDef | null {
  const key = event.key
  const ctrl = event.ctrlKey || event.metaKey
  const shift = event.shiftKey
  const alt = event.altKey

  for (const a of getResolvedActions()) {
    if (!a.key) continue
    if (a.key.toLowerCase() !== key.toLowerCase()) continue
    if ((a.ctrl ?? false) !== ctrl) continue
    if ((a.shift ?? false) !== shift) continue
    if ((a.alt ?? false) !== alt) continue
    return a
  }
  return null
}

/** 比对单个 action 与默认值的差异。被清除的字段以 null 标记（JSON 可序列化）。无变化返回 null。 */
export function diffAction(action: ActionDef): Partial<ActionDef> | null {
  const def = ACTIONS.find(a => a.id === action.id)
  if (!def) return null
  const d: Partial<ActionDef> = {}
  const keys: (keyof Pick<ActionDef, 'key' | 'ctrl' | 'shift' | 'alt'>)[] = ['key', 'ctrl', 'shift', 'alt']
  for (const k of keys) {
    if (action[k] !== def[k]) {
      // 用户清除 → undefined → 存 null；用户设置 → 存新值
      ;(d as any)[k] = action[k] ?? null
    }
  }
  return Object.keys(d).length > 0 ? d : null
}
