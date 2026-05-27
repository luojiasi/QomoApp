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
import { evaluateConditions } from './conditionUtils'

export async function executeCondition(
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>
): Promise<NodeRunResult> {
  const conditions = (node.params.conditions as IfCondition[]) ?? []
  const mode = ((node.params.conditionMode as string) ?? 'AND') as 'AND' | 'OR'

  if (conditions.length === 0) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'success',
      output: { result: true, reason: '无条件' },
      targetPort: 'true'
    }
  }

  const passed = evaluateConditions(conditions, mode, upstreamData)
  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'success',
    output: { result: passed },
    targetPort: passed ? 'true' : 'false'
  }
}
