// ─────────────────────────────────────────────────────────────
// localExecutors/notifyExecutor.ts — 弹窗通知执行器
//
// executeAs === 'notify' 时调用。
// 调用全局 notify() 在页面右上角弹出通知弹窗。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../../types/workflowExecution'
import { notifyByType } from '@/shared/composables/useNotification'

export async function executeNotify(
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const type = (node.params.type as string) || 'info'
  const message = (node.params.message as string) || '通知'
  const description = (node.params.description as string) || ''
  const duration = (node.params.duration as number) || 4500

  // 安全校验 type
  const validTypes = new Set(['success', 'error', 'warning', 'info'])
  const safeType = validTypes.has(type) ? type : 'info'

  notifyByType(safeType as 'success' | 'error' | 'warning' | 'info', message, description, duration)

  callbacks?.onProgress?.(node.id, `弹窗通知: ${message}`)

  const mainData = (upstreamData['main'] ?? {}) as Record<string, unknown>
  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'success',
    output: mainData
  }
}
