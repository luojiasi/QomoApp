// ─────────────────────────────────────────────────────────────
// nodes/executor/localExecutors/countdownExecutor.ts — 倒计时执行器
//
// executeAs === 'countdown' 时调用。
// 每秒通过 callbacks.onProgress 报告剩余时间文本，
// 倒计时结束后返回 success。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../../types/workflowExecution'

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function executeCountdown(
  node: WorkflowNode,
  _upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const minutes = (node.params.minutes as number) ?? 0
  const seconds = (node.params.seconds as number) ?? 5
  const totalSeconds = Math.max(1, minutes * 60 + seconds)

  for (let remaining = totalSeconds; remaining >= 0; remaining--) {
    callbacks?.onProgress?.(node.id, formatTime(remaining))
    if (remaining > 0) await sleep(1000)
  }

  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'success',
    output: { totalSeconds, minutes, seconds }
  }
}
