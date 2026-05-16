// =============================================================================
// 中央 Action 注册表 —— 工具栏按钮 & 键盘快捷键统一在此编辑
// =============================================================================

import type { ActionDef ,ActionGroup } from '../shares/types'

export const ACTIONS: ActionDef[] = [
  // ── 文件 ──
  { id: 'UNDO', label: '撤销', group: 'file', key: 'z', ctrl: true },
  { id: 'REDO', label: '重做', group: 'file', key: 'y', ctrl: true },
  { id: 'SAVE', label: '保存', group: 'file', key: 's', ctrl: true },
  { id: 'IMPORT_DXF', label: '导入DXF', group: 'file', key: 'o', ctrl: true },
  { id: 'EXPORT_LJS', label: '导出', group: 'file', key: 'e', ctrl: true },

  // ── 图形 ──
  { id: 'DRAW_LINE', label: '线', group: 'shape', key: 'l' },
  { id: 'DRAW_ARC', label: '弧', group: 'shape', key: 'a' },
  { id: 'DRAW_BEZIER', label: '曲线', group: 'shape', key: 'b' },

  // ── 工具 ──
  { id: 'SELECT', label: '选择', group: 'tool', key: 'v' },
  { id: 'PAN', label: '平移', group: 'tool', key: 'h' },
  { id: 'DELETE_SELECTED', label: '删除', group: 'tool', key: 'Delete' },
  { id: 'FIT_VIEW', label: '适应', group: 'tool', key: '0' },

  // ── 设置 ──
  { id: 'SETTINGS', label: '设置', group: 'settings' },
]

/** 按 group 过滤 */
export function actionsByGroup(group: ActionGroup): ActionDef[] {return ACTIONS.filter(a => a.group === group)}

/** 按 id 查找 */
export function getAction(id: string): ActionDef | undefined {return ACTIONS.find(a => a.id === id)}

/** 键盘事件匹配 Action */
export function matchAction(event: KeyboardEvent): ActionDef | null {
  const key = event.key
  const ctrl = event.ctrlKey || event.metaKey
  const shift = event.shiftKey
  const alt = event.altKey

  for (const a of ACTIONS) {
    if (!a.key) continue
    if (a.key.toLowerCase() !== key.toLowerCase()) continue
    if ((a.ctrl ?? false) !== ctrl) continue
    if ((a.shift ?? false) !== shift) continue
    if ((a.alt ?? false) !== alt) continue
    return a
  }
  return null
}

/** 生成 title 提示文本 */
export function toolTitle(a: ActionDef): string {
  const parts: string[] = []
  if (a.ctrl) parts.push('Ctrl')
  if (a.shift) parts.push('Shift')
  if (a.alt) parts.push('Alt')
  if (a.key) parts.push(a.key.length === 1 ? a.key.toUpperCase() : a.key)
  const shortcut = parts.join('+')
  return shortcut ? `${a.label} (${shortcut})` : a.label
}
