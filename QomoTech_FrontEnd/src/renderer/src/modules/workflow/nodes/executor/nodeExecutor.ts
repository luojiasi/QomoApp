// ─────────────────────────────────────────────────────────────
// nodes/executor/nodeExecutor.ts — 流程执行引擎
//
// 当前完成：Trigger 节点的解析与验证。
// 后续：沿 edges 逐节点执行（HTTP routing / 本地 executeAs 分派）。
// ─────────────────────────────────────────────────────────────

import type { Workflow, WorkflowNode, WorkflowEdge } from '../../types/workflow'
import type { TriggerEntry, WorkflowRunResult } from '../../types/workflowExecution'
import { NODE_REGISTRY } from '../definitions/index'

// ═══════════════════════════════════════════════════════════════
// 1. Trigger 分类与解析
// ═══════════════════════════════════════════════════════════════

const TRIGGER_SINGLE = 'trigger.single'
const TRIGGER_MULTI  = 'trigger.multi'
// trigger.manual 不参与全局入口解析，仅由节点自身按钮触发

/**
 * 从流程中提取所有 trigger 节点。
 * 未注册蓝图的节点直接跳过（不当作 trigger）。
 */
function findTriggerNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.filter((n) => {
    const def = NODE_REGISTRY[n.type]
    return def && def.category === 'trigger'
  })
}

/**
 * 全局"运行"按钮：决定应该激活哪些 trigger 作为入口。
 *
 * 规则（按优先级）：
 *   single 存在 → 只用 single（manual 不受影响，可从节点单独触发）
 *   multi 存在  → 用所有 multi（同上）
 *   single+multi → 报错，互斥
 *   只有 manual  → 报错，manual 只能从节点自己的按钮触发
 */
function resolveGlobalEntryTriggers(
  triggers: WorkflowNode[]
): { active: WorkflowNode[]; error?: string } {
  const singles = triggers.filter((t) => t.type === TRIGGER_SINGLE)
  const multis  = triggers.filter((t) => t.type === TRIGGER_MULTI)

  if (singles.length > 0 && multis.length > 0) {
    return { active: [], error: '单一入口触发和多入口触发不能同时存在，请只保留一种' }
  }

  if (singles.length > 0) return { active: singles }
  if (multis.length > 0)  return { active: multis }

  // 只剩下 manual：全局运行按钮没有可用入口
  return {
    active: [],
    error: '流程中没有单一入口或多入口触发节点，无法从全局按钮运行。\n请添加 "单一入口触发节点" 或 "多入口触发节点"。'
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. 图谱遍历（从 trigger 找下游）
// ═══════════════════════════════════════════════════════════════

/**
 * 从指定节点的 output 端口出发，找到所有直接下游节点。
 *
 * 本引擎目前只关心 main 端口（trigger 只有 main 输出），
 * 所以固定从 sourceHandle = 'main' 查找。
 */
function findDownstreamNodeIds(
  sourceNodeId: string,
  sourceHandle: string,
  edges: WorkflowEdge[]
): string[] {
  return edges
    .filter((e) => e.source === sourceNodeId && (e.sourceHandle ?? 'main') === sourceHandle)
    .map((e) => e.target)
}

/**
 * 给每个 trigger 条目填充 firstNodeId。
 * 如果 trigger 的 main 端口没有连线，firstNodeId 为 null（流程不完整）。
 */
function buildTriggerEntries(
  triggers: WorkflowNode[],
  edges: WorkflowEdge[]
): TriggerEntry[] {
  return triggers.map((t) => {
    const downstream = findDownstreamNodeIds(t.id, 'main', edges)
    return {
      triggerNodeId: t.id,
      triggerType: t.type,
      firstNodeId: downstream[0] ?? null
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// 3. 主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 全局"运行"按钮点击时调用。
 *
 * 当前阶段只做 trigger 解析 + 下游查找，不执行实际节点。
 * 返回的 result.success 表示流程是否具备可执行条件。
 *
 * 后续会在 resolve 之后追加逐节点执行逻辑。
 */
export function executeWorkflow(workflow: Workflow): WorkflowRunResult {
  const triggers = findTriggerNodes(workflow.nodes)
  if (triggers.length === 0) {
    return {
      success: false,
      results: [],
      error: '流程中没有 trigger 节点，请添加至少一个触发节点'
    }
  }

  // ── 全局入口解析（single / multi）─────────────────────────
  const resolved = resolveGlobalEntryTriggers(triggers)
  if (resolved.error) {
    return { success: false, results: [], error: resolved.error }
  }

  // ── 找到每个入口的下游 ────────────────────────────────────
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

  // TODO: 从这里开始逐节点执行
  // for each entry → BFS/DFS 沿着 edges 执行每个节点

  return {
    success: true,
    results: entries.map((e) => ({
      nodeId: e.triggerNodeId,
      nodeType: e.triggerType,
      status: 'success',
      output: {}
    }))
  }
}

/**
 * 从指定节点独立运行。
 *
 * 不管流程里有没有 single/multi，不管节点类型是 trigger 还是普通节点，
 * 只从该节点出发执行其下游链路。
 *
 * 用于：manual 节点的独立按钮、任一节点的"从这里运行"。
 */
export function executeFromNode(
  workflow: Workflow,
  nodeId: string
): WorkflowRunResult {
  const node = workflow.nodes.find((n) => n.id === nodeId)
  if (!node) {
    return { success: false, results: [], error: '节点不存在' }
  }

  const entries = buildTriggerEntries([node], workflow.edges)
  if (entries[0]?.firstNodeId === null) {
    return { success: false, results: [], error: '该节点未连接下游' }
  }

  // TODO: 从该节点开始逐节点执行

  return {
    success: true,
    results: entries.map((e) => ({
      nodeId: e.triggerNodeId,
      nodeType: e.triggerType,
      status: 'success',
      output: {}
    }))
  }
}

/**
 * 只做验证，不执行节点。
 * 比 executeWorkflow 轻量，适合按钮点击前的预检查。
 */
export function validateWorkflow(workflow: Workflow): { valid: boolean; error?: string } {
  const result = executeWorkflow(workflow)
  return { valid: result.success, error: result.error }
}
