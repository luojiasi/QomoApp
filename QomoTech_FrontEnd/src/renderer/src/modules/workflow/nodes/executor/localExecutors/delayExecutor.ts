// ─────────────────────────────────────────────────────────────
// nodes/executor/localExecutors/delayExecutor.ts — 延时执行器
//
// executeAs === 'delay' 时调用，等待指定毫秒数。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../../types/workflowExecution'

function sleep(ms: number, signal?: AbortSignal): Promise<'timeout' | 'aborted'> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve('timeout'), ms)
    if (signal) {
      signal.addEventListener('abort', () => { clearTimeout(t); resolve('aborted') }, { once: true })
    }
  })
}

export async function executeDelay(
  node: WorkflowNode,
  _upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const duration = (node.params.duration as number) ?? 1000
  const result = await sleep(Math.max(10, duration), callbacks?.signal)

  const aborted = result === 'aborted'
  return {
    nodeId: node.id,
    nodeType: node.type,
    status: aborted ? 'idle' : 'success',
    output: { waitedMs: duration, aborted }
  }
}
