// ─────────────────────────────────────────────────────────────
// types/workflowExecution.ts — 流程执行相关类型
// ─────────────────────────────────────────────────────────────

import type { NodeExecutionStatus } from './workflow'

/** 单个节点的执行结果 */
export interface NodeRunResult {
  nodeId: string
  nodeType: string
  /** 执行结果状态：success → 成功，failure → 失败 */
  status: NodeExecutionStatus
  output: Record<string, unknown>
  error?: string
  /** 指定 BFS 走哪个输出端口继续遍历，不设则默认 'main' */
  targetPort?: string
  /** 循环穿行序号（0=首次），loop 节点每迭代一次 +1 */
  iteration?: number
}

/** 一次完整的 Workflow 运行结果 */
export interface WorkflowRunResult {
  success: boolean
  /** 按执行顺序排列的每个节点结果 */
  results: NodeRunResult[]
  error?: string
}

/** 引擎执行回调：每节点开始/完成/进度更新时触发，供外部更新 UI */
export interface ExecutionCallbacks {
  onNodeStarted?: (nodeId: string) => void
  onNodeCompleted?: (result: NodeRunResult) => void
  /** 进度更新（如倒计时每秒刷新），text 为显示内容如 "5s" */
  onProgress?: (nodeId: string, text: string) => void
}

/** 从 trigger 出发的最近下游节点信息 */
export interface TriggerEntry {
  /** 触发节点本身 */
  triggerNodeId: string
  triggerType: string
  /** 触发节点 main 端口连接的第一个下游节点 ID */
  firstNodeId: string | null
}
