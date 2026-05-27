// ─────────────────────────────────────────────────────────────
// nodes/executor/triggerService.ts — Trigger 节点解析
//
// 职责：
//   - 从流程中找出所有 trigger 节点
//   - 解析 single / multi / manual 入口规则
//
// manual 不参与全局入口解析，仅由节点自身按钮触发。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../types/workflow'
import { NODE_REGISTRY } from '../definitions/index'

const TRIGGER_SINGLE = 'trigger.single'
const TRIGGER_MULTI = 'trigger.multi'

/** 从流程中提取所有 trigger 节点（未注册蓝图的跳过） */
export function findTriggerNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.filter((n) => {
    const def = NODE_REGISTRY[n.type]
    return def && def.category === 'trigger'
  })
}

/**
 * 全局"运行"按钮入口解析。
 *
 * 规则（按优先级）：
 *   single 存在 → 只用 single（manual 不受影响，可从节点单独触发）
 *   multi 存在  → 用所有 multi（同上）
 *   single+multi → 报错，互斥
 *   只有 manual  → 报错，manual 只能从节点自己的按钮触发
 */
export function resolveGlobalEntryTriggers(
  triggers: WorkflowNode[]
): { active: WorkflowNode[]; error?: string } {
  const singles = triggers.filter((t) => t.type === TRIGGER_SINGLE)
  const multis  = triggers.filter((t) => t.type === TRIGGER_MULTI)

  if (singles.length > 0 && multis.length > 0) {
    return { active: [], error: '单一入口触发和多入口触发不能同时存在，请只保留一种' }
  }

  if (singles.length > 0) return { active: singles }
  if (multis.length > 0)  return { active: multis }

  return {
    active: [],
    error: '流程中没有单一入口或多入口触发节点，无法从全局按钮运行。\n请添加 "单一入口触发节点" 或 "多入口触发节点"。'
  }
}
