// ─────────────────────────────────────────────────────────────
// localExecutors/waitAllExecutor.ts — 等待所有分支完成执行器
//
// executeAs === 'wait_all' 时调用。
// 节点有多个输入端口（in_1, in_2, ...），每次有分支完成时被触发。
// 等所有输入端口都收到数据后，合并输出并继续下游。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../../types/workflowExecution'

/** 返回 skip 信号，不触发下游 */
function skip(node: WorkflowNode): NodeRunResult {
  return { nodeId: node.id, nodeType: node.type, status: 'success', output: {}, targetPort: '' }
}

export async function executeWaitAll(
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const extraCount = (node.params.extraInputCount as number) ?? 0
  const totalInputs = 2 + extraCount
  const expectedPorts = Array.from({ length: totalInputs }, (_, i) => `in_${i + 1}`)

  const received = expectedPorts.filter(p => upstreamData[p] !== undefined)

  if (received.length < totalInputs) {
    callbacks?.onProgress?.(node.id, `等待中 (${received.length}/${totalInputs})`)
    return skip(node)
  }

  // 所有端口到齐，合并数据
  const merged: Record<string, unknown> = {}
  for (const port of expectedPorts) {
    Object.assign(merged, upstreamData[port])
  }

  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'success',
    output: merged
  }
}
