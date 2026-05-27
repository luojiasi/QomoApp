// ─────────────────────────────────────────────────────────────
// nodes/executor/localExecutors/delayExecutor.ts — 延时执行器
//
// executeAs === 'delay' 时调用，等待指定毫秒数。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult } from '../../../types/workflowExecution'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function executeDelay(node: WorkflowNode): Promise<NodeRunResult> {
  const duration = (node.params.duration as number) ?? 1000
  await sleep(Math.max(10, duration))
  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'success',
    output: { waitedMs: duration }
  }
}
