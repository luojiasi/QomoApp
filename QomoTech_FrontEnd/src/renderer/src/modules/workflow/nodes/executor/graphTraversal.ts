// ─────────────────────────────────────────────────────────────
// nodes/executor/graphTraversal.ts — 图谱工具（纯函数）
//
// 职责：
//   - 沿 edges 查找下游节点
//   - 为 trigger 构建入口条目
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode, WorkflowEdge } from '../../types/workflow'
import type { TriggerEntry } from '../../types/workflowExecution'

/**
 * 从 sourceNodeId 的指定端口出发，找到所有直接下游节点 ID。
 * 默认从 'main' 端口查找。
 */
export function findDownstreamNodeIds(
  sourceNodeId: string,
  sourceHandle: string,
  edges: WorkflowEdge[]
): string[] {
  return edges
    .filter((e) => e.source === sourceNodeId && (e.sourceHandle ?? 'main') === sourceHandle)
    .map((e) => e.target)
}

/**
 * 与 findDownstreamNodeIds 类似，但额外要求目标端口为 'main'。
 * 非 main 端口（如 data、port）只传递数据，不触发下游节点执行。
 */
export function findExecutableDownstreamNodeIds(
  sourceNodeId: string,
  sourceHandle: string,
  edges: WorkflowEdge[]
): string[] {
  return edges
    .filter((e) =>
      e.source === sourceNodeId &&
      (e.sourceHandle ?? 'main') === sourceHandle &&
      (e.targetHandle ?? 'main') === 'main'
    )
    .map((e) => e.target)
}

/** 给每个 trigger 节点填充 firstNodeId（main 端口的下游） */
export function buildTriggerEntries(
  triggers: WorkflowNode[],
  edges: WorkflowEdge[]
): TriggerEntry[] {
  return triggers.map((t) => {
    const downstream = findDownstreamNodeIds(t.id, 'main', edges)
    return { triggerNodeId: t.id, triggerType: t.type, firstNodeId: downstream[0] ?? null }
  })
}
