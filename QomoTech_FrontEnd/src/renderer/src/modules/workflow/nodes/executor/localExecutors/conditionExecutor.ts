// ─────────────────────────────────────────────────────────────
// nodes/executor/localExecutors/conditionExecutor.ts — IF 判断执行器
//
// executeAs === 'condition' 时调用。
// 从上游数据取对应输入端口的值，逐条 AND 评估条件。
// 全部通过 → targetPort='true'，任一失败 → targetPort='false'。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult } from '../../../types/workflowExecution'
import type { IfCondition } from '../../../types/workflow'

function compare(a: unknown, b: unknown, op: string): boolean {
  const numA = Number(a)
  const numB = Number(b)
  const useNum = !isNaN(numA) && !isNaN(numB) && a !== '' && b !== ''

  const left  = useNum ? numA : String(a ?? '')
  const right = useNum ? numB : String(b ?? '')

  switch (op) {
    case 'eq':  return left === right
    case 'neq': return left !== right
    case 'gt':  return left > right
    case 'lt':  return left < right
    case 'gte': return left >= right
    case 'lte': return left <= right
    default:    return false
  }
}

export async function executeCondition(
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>
): Promise<NodeRunResult> {
  const conditions = (node.params.conditions as IfCondition[]) ?? []
  const mode: string = (node.params.conditionMode as string) ?? 'AND'

  if (conditions.length === 0) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'success',
      output: { result: true, reason: '无条件' },
      targetPort: 'true'
    }
  }

  if (mode === 'OR') {
    // OR：任一满足即走 True
    for (const cond of conditions) {
      const inputData = upstreamData[cond.inputName]
      const value = cond.field
        ? (inputData as Record<string, unknown>)?.[cond.field]
        : inputData

      if (compare(value, cond.value, cond.operator)) {
        return {
          nodeId: node.id,
          nodeType: node.type,
          status: 'success',
          output: { result: true, matchedCondition: cond },
          targetPort: 'true'
        }
      }
    }
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'success',
      output: { result: false, reason: '所有条件均不满足' },
      targetPort: 'false'
    }
  }

  // AND（默认）：全部满足才走 True
  for (const cond of conditions) {
    const inputData = upstreamData[cond.inputName]
    const value = cond.field
      ? (inputData as Record<string, unknown>)?.[cond.field]
      : inputData

    if (!compare(value, cond.value, cond.operator)) {
      return {
        nodeId: node.id,
        nodeType: node.type,
        status: 'success',
        output: { result: false, failedCondition: cond },
        targetPort: 'false'
      }
    }
  }

  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'success',
    output: { result: true },
    targetPort: 'true'
  }
}
