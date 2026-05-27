// ─────────────────────────────────────────────────────────────
// nodes/executor/nodeRunner.ts — 单节点执行分派
//
// 职责：读取节点蓝图，根据 executeAs / routing 转发到：
//   - executeAs  → localExecutors/（本地执行）
//   - routing    → httpExecutor.ts（HTTP 调用，TODO）
//   - 都没有     → 直接通过（success）
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../types/workflow'
import type { NodeRunResult } from '../../types/workflowExecution'
import { NODE_REGISTRY } from '../definitions/index'
import { executeLocal } from './localExecutors/index'

/**
 * 执行单个节点，根据蓝图自动分派执行路径。
 */
export async function executeSingleNode(node: WorkflowNode): Promise<NodeRunResult> {
  const def = NODE_REGISTRY[node.type]

  // ── 本地执行器（executeAs）──────────────────────────────────
  if (def?.executeAs) {
    return executeLocal(node, def.executeAs)
  }

  // ── HTTP routing（TODO）─────────────────────────────────────
  // if (def?.routing) return executeHttp(node, def.routing)

  // 无特殊执行逻辑 → 直接通过
  return { nodeId: node.id, nodeType: node.type, status: 'success', output: {} }
}
