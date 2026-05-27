// ─────────────────────────────────────────────────────────────
// localExecutors/logExecutor.ts — 日志打印执行器
//
// executeAs === 'log' 时调用。
// 将上游数据输出到日志后原样透传给下游。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../../types/workflowExecution'

export async function executeLog(
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const mainData = upstreamData['main'] as Record<string, unknown> | undefined

  // 将数据发到进度回调 → 日志面板显示
  if (mainData) {
    const msg = `日志打印: ${JSON.stringify(mainData)}`
    callbacks?.onProgress?.(node.id, msg)
  } else {
    callbacks?.onProgress?.(node.id, '日志打印: (无上游数据)')
  }

  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'success',
    output: (mainData ?? {}) as Record<string, unknown>
  }
}
