// ─────────────────────────────────────────────────────────────
// nodes/executor/localExecutors/passthroughExecutor.ts — 数据直通执行器
//
// executeAs === 'passthrough' 时调用。
// 读取节点 params.data（JSON 字符串），解析后原样输出给下游。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult } from '../../../types/workflowExecution'
import { parseJSONish } from '../../../utils/workflowUtils'

export async function executePassthrough(
  node: WorkflowNode,
  _upstreamData: Record<string, Record<string, unknown>>
): Promise<NodeRunResult> {
  const raw = (node.params.data as string) ?? '{}'
  try {
    const data = parseJSONish(raw)
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'success',
      output: data as Record<string, unknown>
    }
  } catch {
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'failure',
      output: {},
      error: `JSON 解析失败: ${raw}`
    }
  }
}
