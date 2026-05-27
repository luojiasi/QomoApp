// ─────────────────────────────────────────────────────────────
// nodes/executor/localExecutors/scheduleExecutor.ts — 定时执行器
//
// executeAs === 'schedule' 时调用。
// 计算当前时间到目标绝对时间的差值，每秒通过 onProgress
// 报告剩余时间，到达目标时间后返回 success。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../../types/workflowExecution'

function formatTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  if (h > 0) return `${h}h${m}m${s}s`
  if (m > 0) return `${m}m${s}s`
  return `${s}s`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function executeSchedule(
  node: WorkflowNode,
  _upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const date = (node.params.date as string) ?? ''
  const time = (node.params.time as string) ?? '00:00'
  const datetime = `${date}T${time}`
  const targetMs = new Date(datetime).getTime()

  if (!date || isNaN(targetMs)) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'failure',
      output: { message: `无效的日期时间: "${datetime}"` },
      error: `无效的日期时间: "${datetime}"`
    }
  }

  let remainingSec = Math.ceil((targetMs - Date.now()) / 1000)

  if (remainingSec <= 0) {
    return {
      nodeId: node.id,
      nodeType: node.type,
      status: 'warning',
      output: { message: '目标时间已过，直接通过' }
    }
  }

  while (remainingSec > 0) {
    callbacks?.onProgress?.(node.id, formatTime(remainingSec))
    const waitMs = Math.min(remainingSec * 1000, 1000)
    await sleep(waitMs)
    remainingSec = Math.ceil((targetMs - Date.now()) / 1000)
  }

  callbacks?.onProgress?.(node.id, '0s')

  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'success',
    output: { datetime, date, time }
  }
}
