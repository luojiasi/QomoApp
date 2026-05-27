// ─────────────────────────────────────────────────────────────
// localExecutors/loopExecutor.ts — WHILE 循环执行器
//
// 状态机驱动，避免 BFS 残留 upstreamData 干扰阶段判断。
//
// 单轮迭代流程：
//   main 入口 → [body 副作用链] → loop_end 信号
//            → [compute 计算链] → compute_result 回传
//            → 条件判断 → 继续下一轮 body / 退出 done
//
// 状态扭转：
//   INIT          创建状态，phase='body'      → body 端口
//   LOOP_END      收到 loop_end，切 compute   → compute 端口
//   COMPLETE      收到 compute_result，判断    → body / done 端口
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult } from '../../../types/workflowExecution'
import type { IfCondition } from '../../../types/workflow'
import { evaluateConditions } from './conditionUtils'

// ═══════════════════════════════════════════════════════════════
// 状态定义
// ═══════════════════════════════════════════════════════════════

interface LoopState {
  /** 已完成的计算次数（compute_result 成功回传后 +1） */
  iteration: number
  /** 当前循环持有的数据 */
  data: Record<string, unknown>
  /** 当前等待的信号 */
  phase: 'body' | 'compute'
}

/** 模块级状态存储，key = node.id */
const stateMap = new Map<string, LoopState>()

/** BFS 引擎每次顶层 traverseAndExecute 启动时调用 */
export function resetLoopState(): void {
  stateMap.clear()
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function ok(
  node: WorkflowNode,
  output: Record<string, unknown>,
  port: string
): NodeRunResult {
  return { nodeId: node.id, nodeType: node.type, status: 'success', output, targetPort: port }
}

function done(
  node: WorkflowNode,
  output: Record<string, unknown>
): NodeRunResult {
  return { nodeId: node.id, nodeType: node.type, status: 'success', output, targetPort: 'done' }
}

function fail(node: WorkflowNode, msg: string): NodeRunResult {
  return { nodeId: node.id, nodeType: node.type, status: 'failure', output: {}, error: msg }
}

/** 忽略本次调用（BFS 残留数据触发的冗余调用），不输出任何端口 */
function skip(node: WorkflowNode): NodeRunResult {
  return { nodeId: node.id, nodeType: node.type, status: 'success', output: {}, targetPort: undefined }
}

function hasData(d: Record<string, unknown> | undefined): d is Record<string, unknown> {
  return d !== undefined && Object.keys(d).length > 0
}

// ═══════════════════════════════════════════════════════════════
// 阶段处理
// ═══════════════════════════════════════════════════════════════

/** 首次初始化：main 端口收到数据，创建状态，进入 body 阶段 */
function handleInit(
  node: WorkflowNode,
  mainData: Record<string, unknown>,
  conditions: IfCondition[],
  mode: 'AND' | 'OR'
): NodeRunResult {
  if (conditions.length === 0) {
    return done(node, mainData)
  }

  const passed = evaluateConditions(conditions, mode, { main: mainData })
  if (!passed) {
    return done(node, mainData)
  }

  stateMap.set(node.id, { iteration: 0, data: { ...mainData }, phase: 'body' })
  return ok(node, mainData, 'body')
}

/** body 阶段收到 loop_end 信号 → 切到 compute 阶段 */
function handleLoopEnd(
  node: WorkflowNode,
  state: LoopState
): NodeRunResult {
  state.phase = 'compute'
  stateMap.set(node.id, state)
  return ok(node, state.data, 'compute')
}

/** compute 阶段收到 compute_result → 更新数据、迭代+1、判断 */
function handleComputeResult(
  node: WorkflowNode,
  state: LoopState,
  computedData: Record<string, unknown>,
  conditions: IfCondition[],
  mode: 'AND' | 'OR',
  maxIterations: number
): NodeRunResult {
  state.data = { ...computedData }
  state.iteration++
  state.phase = 'body'
  stateMap.set(node.id, state)

  if (state.iteration >= maxIterations) {
    stateMap.delete(node.id)
    return done(node, state.data)
  }

  const passed = evaluateConditions(conditions, mode, { main: state.data })
  if (!passed) {
    stateMap.delete(node.id)
    return done(node, state.data)
  }

  return ok(node, state.data, 'body')
}

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════

export async function executeLoop(
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>
): Promise<NodeRunResult> {
  const conditions  = (node.params.conditions    as IfCondition[]) ?? []
  const mode        = ((node.params.conditionMode as string) ?? 'AND') as 'AND' | 'OR'
  const maxIter     = (node.params.maxIterations as number) ?? 100

  const mainData       = upstreamData['main']            as Record<string, unknown> | undefined
  const computedData   = upstreamData['compute_result']  as Record<string, unknown> | undefined
  const loopEndSignal  = upstreamData['loop_end']        as Record<string, unknown> | undefined

  // ── 1. 已有状态 → 走状态机 ──────────────────────────────────
  const state = stateMap.get(node.id)
  if (state) {
    if (state.phase === 'body'    && loopEndSignal !== undefined) return handleLoopEnd(node, state)
    if (state.phase === 'compute' && hasData(computedData))      return handleComputeResult(node, state, computedData!, conditions, mode, maxIter)
    return skip(node)
  }

  // ── 2. 无状态 + main 数据 → 首次初始化 ─────────────────────
  if (hasData(mainData)) {
    return handleInit(node, mainData!, conditions, mode)
  }

  // ── 3. 无状态 + 无 main → 错误 ─────────────────────────────
  return fail(node, 'WHILE 节点未收到有效的 main 入口数据')
}
