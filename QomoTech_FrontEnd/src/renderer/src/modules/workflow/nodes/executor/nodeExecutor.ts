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
import { resetLoopState } from './localExecutors/index'

// ═══════════════════════════════════════════════════════════════
// BFS 遍历执行
// ═══════════════════════════════════════════════════════════════

const MAX_EXECUTIONS_PER_NODE = 500

interface QueueEntry {
  nodeId: string
  /** 循环穿行序号，回边时 +1 */
  loopPass: number
}

/**
 * 从 startNodeId 出发，BFS 遍历所有下游节点并逐个执行。
 * 支持 WHILE 循环：loop 端口回边让节点重新入队，loopPass 递增。
 * 每节点执行上限 MAX_EXECUTIONS_PER_NODE 防止死循环。
 */
async function traverseAndExecute(
  startNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult[]> {
  const results: NodeRunResult[] = []
  const executionCount = new Map<string, number>()
  const queue: QueueEntry[] = [{ nodeId: startNodeId, loopPass: 0 }]

  resetLoopState()

  while (queue.length > 0) {
    const { nodeId, loopPass } = queue.shift()!
    const timesExecuted = executionCount.get(nodeId) ?? 0
    if (timesExecuted >= MAX_EXECUTIONS_PER_NODE) continue
    executionCount.set(nodeId, timesExecuted + 1)

    const node = nodes.find(n => n.id === nodeId)
    if (!node || node.disabled) continue

    // 收集上游数据：从已执行节点的输出中，按 edges 的目标端口组合
    // 同一端口有多个来源时合并（浅层），不覆盖
    // 反向查找取最新结果（循环场景下同名节点可能执行多次）
    const upstreamData: Record<string, Record<string, unknown>> = {}
    for (const edge of edges) {
      if (edge.target === nodeId) {
        let sourceResult: NodeRunResult | undefined
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i].nodeId === edge.source) { sourceResult = results[i]; break }
        }
        if (sourceResult) {
          const key = edge.targetHandle ?? 'main'
          upstreamData[key] = { ...upstreamData[key], ...sourceResult.output }
        }
      }
    }

    callbacks?.onNodeStarted?.(nodeId)

    const result = await executeSingleNode(node, upstreamData, callbacks)
    result.iteration = loopPass
    results.push(result)

    callbacks?.onNodeCompleted?.(result)

    // 失败走 error 端口（已连线则继续，未连线则停）；成功/警告按 targetPort 走下游
    if (result.status === 'failure') {
      const errorDownstream = findDownstreamNodeIds(nodeId, 'error', edges)
      for (const downId of errorDownstream) {
        queue.push({ nodeId: downId, loopPass })
      }
    } else {
      const port = result.targetPort ?? 'main'
      const downstream = findDownstreamNodeIds(nodeId, port, edges)
      for (const downId of downstream) {
        // 回边（targetHandle === 'loop'）→ loopPass +1，允许循环节点重新执行
        const backEdge = edges.find(
          e => e.source === nodeId && e.target === downId && (e.sourceHandle ?? 'main') === port
        )
        const isLoopBack = backEdge?.targetHandle === 'loop'
        queue.push({ nodeId: downId, loopPass: isLoopBack ? loopPass + 1 : loopPass })
      }
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
