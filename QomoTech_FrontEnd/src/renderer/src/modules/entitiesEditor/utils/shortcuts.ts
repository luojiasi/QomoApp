// =============================================================================
// 快捷键绑定定义（集中管理）
// =============================================================================

import type { ShortcutBinding } from "@/modules/entitiesEditor/commons/types"

export const SHORTCUTS: ShortcutBinding[] = [
  { key: 'z', ctrl: true, action: 'UNDO', label: '撤销' },
  { key: 'y', ctrl: true, action: 'REDO', label: '重做' },
  { key: 'Z', ctrl: true, shift: true, action: 'REDO', label: '重做' },
  { key: 'Delete', action: 'DELETE_SELECTED', label: '删除选中' },
  { key: 'Backspace', action: 'DELETE_SELECTED', label: '删除选中' },
  { key: 's', ctrl: true, action: 'SAVE', label: '保存' },
  { key: 'o', ctrl: true, action: 'IMPORT_DXF', label: '导入DXF' },
  { key: 'i', ctrl: true, action: 'IMPORT_LJS', label: '导入LJS' },
  { key: 'e', ctrl: true, shift: true, action: 'EXPORT_LJS', label: '导出LJS' },
  { key: 'f', action: 'FOCUS_ENTITY', label: '聚焦实体' },
  { key: '0', action: 'FIT_VIEW', label: '适应视图' },
  { key: 'v', action: 'SET_TOOL', data: { tool: 'SELECT' }, label: '选择工具' },
  { key: 'l', action: 'SET_TOOL', data: { tool: 'DRAW_LINE' }, label: '画线' },
  { key: 'a', action: 'SET_TOOL', data: { tool: 'DRAW_ARC' }, label: '画弧' },
  { key: 'b', action: 'SET_TOOL', data: { tool: 'DRAW_BEZIER' }, label: '画贝塞尔' },
  { key: 'h', action: 'SET_TOOL', data: { tool: 'PAN' }, label: '平移' },
  { key: 'Escape', action: 'SET_TOOL', data: { tool: 'SELECT' }, label: '取消/选择' },
]

export function matchShortcut(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  if (event.key.toLowerCase() !== binding.key.toLowerCase()) return false
  if (binding.ctrl !== undefined && (event.ctrlKey || event.metaKey) !== binding.ctrl) return false
  if (binding.shift !== undefined && event.shiftKey !== binding.shift) return false
  if (binding.alt !== undefined && event.altKey !== binding.alt) return false
  return true
}
