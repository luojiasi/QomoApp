// ─────────────────────────────────────────────────────────────
// nodes/executor/nodeExecutor.ts — 流程执行引擎（主入口）
//
// 架构：
//   triggerService.ts  → Trigger 解析（findTriggerNodes / resolveGlobalEntryTriggers）
//   graphTraversal.ts  → 图谱工具（findDownstreamNodeIds / buildTriggerEntries）
//   nodeRunner.ts      → 单节点分派（executeSingleNode → localExecutors / httpExecutor）
//   localExecutors/    → 本地执行器注册表（delay / condition / loop ...）
//
// 本文件只负责：
//   - BFS 遍历调度（traverseAndExecute）
//   - 对外 API（executeWorkflow / executeFromNode / validateWorkflow）
// ─────────────────────────────────────────────────────────────

import type { Workflow, WorkflowNode, WorkflowEdge } from '../../types/workflow'
import type { WorkflowRunResult, NodeRunResult, ExecutionCallbacks } from '../../types/workflowExecution'
import { findTriggerNodes, resolveGlobalEntryTriggers } from './triggerService'
import { findDownstreamNodeIds, buildTriggerEntries } from './graphTraversal'
import { executeSingleNode } from './nodeRunner'

// ═══════════════════════════════════════════════════════════════
// BFS 遍历执行
// ═══════════════════════════════════════════════════════════════

/**
 * 从 startNodeId 出发，BFS 遍历所有下游节点并逐个执行。
 * 被禁用的节点跳过。成功的节点继续遍历其下游，failure/warning 则停止。
 * 每节点开始/完成时通过 callbacks 通知外部，实现增量状态更新。
 */
async function traverseAndExecute(
  startNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult[]> {
  const results: NodeRunResult[] = []
  const visited = new Set<string>()
  const queue: string[] = [startNodeId]

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)

    const node = nodes.find(n => n.id === nodeId)
    if (!node || node.disabled) continue

    callbacks?.onNodeStarted?.(nodeId)

    const result = await executeSingleNode(node)
    results.push(result)

    callbacks?.onNodeCompleted?.(result)

    // 成功 → 把 main 端口的下游加入队列
    if (result.status === 'success') {
      const downstream = findDownstreamNodeIds(nodeId, 'main', edges)
      queue.push(...downstream)
    }
  }

  return results
}

// ═══════════════════════════════════════════════════════════════
// 对外 API
// ═══════════════════════════════════════════════════════════════

/**
 * 全局"运行"按钮：激活 single 或 multi trigger，遍历整条链路执行。
 */
export async function executeWorkflow(
  workflow: Workflow,
  callbacks?: ExecutionCallbacks
): Promise<WorkflowRunResult> {
  const triggers = findTriggerNodes(workflow.nodes)
  if (triggers.length === 0) {
    return {
      success: false,
      results: [],
      error: '流程中没有 trigger 节点，请添加至少一个触发节点'
    }
  }

  const resolved = resolveGlobalEntryTriggers(triggers)
  if (resolved.error) {
    return { success: false, results: [], error: resolved.error }
  }

  const entries = buildTriggerEntries(resolved.active, workflow.edges)

  const disconnected = entries.filter((e) => e.firstNodeId === null)
  if (disconnected.length > 0) {
    const names = disconnected.map((e) => e.triggerNodeId).join(', ')
    return {
      success: false,
      results: [],
      error: `以下 trigger 节点未连接下游：${names}`
    }
  }

  const allResults: NodeRunResult[] = []
  for (const entry of entries) {
    const chainResults = await traverseAndExecute(
      entry.triggerNodeId, workflow.nodes, workflow.edges, callbacks
    )
    allResults.push(...chainResults)
  }

  return { success: true, results: allResults }
}

/**
 * 从指定节点独立运行，执行该节点及其所有下游链路。
 */
export async function executeFromNode(
  workflow: Workflow,
  nodeId: string,
  callbacks?: ExecutionCallbacks
): Promise<WorkflowRunResult> {
  const node = workflow.nodes.find((n) => n.id === nodeId)
  if (!node) {
    return { success: false, results: [], error: '节点不存在' }
  }

  const results = await traverseAndExecute(
    nodeId, workflow.nodes, workflow.edges, callbacks
  )

  if (results.length === 0) {
    return {
      success: true,
      results: [{
        nodeId: node.id,
        nodeType: node.type,
        status: 'warning',
        output: {}
      }],
      error: '该节点未连接下游，仅执行当前节点'
    }
  }

  return { success: true, results }
}

/**
 * 只验证流程结构，不执行节点。
 */
export function validateWorkflow(workflow: Workflow): { valid: boolean; error?: string } {
  const triggers = findTriggerNodes(workflow.nodes)
  if (triggers.length === 0) {
    return { valid: false, error: '流程中没有 trigger 节点' }
  }
  const resolved = resolveGlobalEntryTriggers(triggers)
  return { valid: !resolved.error, error: resolved.error }
}
