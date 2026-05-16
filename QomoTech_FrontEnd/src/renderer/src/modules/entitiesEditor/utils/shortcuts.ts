// =============================================================================
// 中央 Action 注册表 —— 工具栏按钮 & 键盘快捷键统一在此编辑
// =============================================================================

import { ACTIONS } from '../configs/defaults'
import type { ActionDef ,ActionGroup } from '../shares/types'



/** 按 group 过滤 */
export function actionsByGroup(group: ActionGroup): ActionDef[] {return ACTIONS.filter(a => a.group === group)}

/** 按 id 查找 */
export function getAction(id: string): ActionDef | undefined {return ACTIONS.find(a => a.id === id)}

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
