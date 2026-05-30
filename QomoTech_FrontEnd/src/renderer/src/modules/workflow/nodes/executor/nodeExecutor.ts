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
//   - 递归并发遍历调度（traverseAndExecute）
//   - 对外 API（executeWorkflow / executeFromNode / validateWorkflow）
// ─────────────────────────────────────────────────────────────

import type { Workflow, WorkflowNode, WorkflowEdge } from '../../types/workflow'
import type { WorkflowRunResult, NodeRunResult, ExecutionCallbacks } from '../../types/workflowExecution'
import { findTriggerNodes, resolveGlobalEntryTriggers } from './triggerService'
import { findDownstreamNodeIds, buildTriggerEntries } from './graphTraversal'
import { executeSingleNode } from './nodeRunner'
import { resetLoopState } from './localExecutors/index'
import { NODE_REGISTRY } from '../definitions/index'

// ═══════════════════════════════════════════════════════════════
// 递归并发遍历执行
// ═══════════════════════════════════════════════════════════════

const MAX_EXECUTIONS_PER_NODE = 500

/**
 * 从 startNodeId 出发，递归遍历下游节点并执行。
 * 节点有多个下游时用 Promise.all 并发分叉，每条分支内顺序执行。
 * 支持 WHILE 循环：loop 端口回边递归调用 runChain，loopPass 递增。
 * 每节点执行上限 MAX_EXECUTIONS_PER_NODE 防止死循环。
 */
async function traverseAndExecute(
  startNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  callbacks?: ExecutionCallbacks,
  initialUpstreamData?: Record<string, Record<string, unknown>>
): Promise<NodeRunResult[]> {
  const results: NodeRunResult[] = []
  const executionCount = new Map<string, number>()

  resetLoopState()

  async function runChain(nodeId: string, loopPass: number, inheritedData?: Record<string, Record<string, unknown>>): Promise<void> {
    const timesExecuted = executionCount.get(nodeId) ?? 0
    if (timesExecuted >= MAX_EXECUTIONS_PER_NODE) return
    executionCount.set(nodeId, timesExecuted + 1)

    const node = nodes.find(n => n.id === nodeId)
    if (!node || node.disabled) return

    // 收集上游数据
    const upstreamData: Record<string, Record<string, unknown>> = { ...inheritedData }
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

    // 检查是否有触发端口收到数据，没有则跳过（纯数据端口不触发执行）
    const hasAnyData = Object.keys(upstreamData).length > 0
    if (hasAnyData) {
      const def = NODE_REGISTRY[node.type]
      const triggerPorts = new Set(
        (def?.inputs ?? []).filter(p => p.triggers !== false).map(p => p.name)
      )
      const hasTrigger = Object.keys(upstreamData).some(k => triggerPorts.has(k))
      if (!hasTrigger) return
    }

    callbacks?.onNodeStarted?.(nodeId)

    const result = await executeSingleNode(node, upstreamData, callbacks)
    result.iteration = loopPass
    results.push(result)

    callbacks?.onNodeCompleted?.(result)

    // 获取下游节点，多个时并发分叉
    // targetPort 为空字符串 '' 表示跳过，不触发任何下游
    if (result.targetPort === '') return

    if (result.status === 'failure') {
      const errorDownstream = findDownstreamNodeIds(nodeId, 'error', edges)
      if (errorDownstream.length > 0) {
        await Promise.all(errorDownstream.map(downId => runChain(downId, loopPass)))
      }
    } else {
      const port = result.targetPort || 'main'
      const downstream = findDownstreamNodeIds(nodeId, port, edges)
      if (downstream.length > 0) {
        const tasks = downstream.map(downId => {
          const backEdge = edges.find(
            e => e.source === nodeId && e.target === downId && (e.sourceHandle ?? 'main') === port
          )
          const isLoopBack = backEdge?.targetHandle === 'loop'
          return runChain(downId, isLoopBack ? loopPass + 1 : loopPass)
        })
        await Promise.all(tasks)
      }
    }
  }

  try {
    await runChain(startNodeId, 0, initialUpstreamData)
    return results
  } finally {
    resetLoopState()
  }
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
 * 从数据源节点（如 rs232.receive）触发下游执行。
 * 不执行 sourceNode 自身，只执行其 main 端口的下游节点。
 *
 * @param sourceOutput — 数据源节点产生的输出，作为下游节点的上游数据（main 端口）
 * @param runMode — 'fullChain' 递归执行整条链路 | 'oneLayer' 仅执行直接下游节点
 */
export async function executeDownstream(
  workflow: Workflow,
  sourceNodeId: string,
  sourceOutput: Record<string, unknown>,
  runMode: 'fullChain' | 'oneLayer',
  callbacks?: ExecutionCallbacks
): Promise<WorkflowRunResult> {
  const downstream = findDownstreamNodeIds(sourceNodeId, 'main', workflow.edges)
  if (downstream.length === 0) {
    return { success: true, results: [] }
  }

  const initialUpstream = { main: sourceOutput }
  const allResults: NodeRunResult[] = []

  for (const downId of downstream) {
    const node = workflow.nodes.find(n => n.id === downId)
    if (!node || node.disabled) continue

    if (runMode === 'fullChain') {
      const chainResults = await traverseAndExecute(
        downId, workflow.nodes, workflow.edges, callbacks, initialUpstream
      )
      allResults.push(...chainResults)
    } else {
      callbacks?.onNodeStarted?.(downId)
      const result = await executeSingleNode(node, initialUpstream, callbacks)
      allResults.push(result)
      callbacks?.onNodeCompleted?.(result)
    }
  }

  return { success: true, results: allResults }
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
