export type NodeType = 'task' | 'condition' | 'delay' | 'loop'

export type NodeRunStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped'

export type NodeRunStatusColor = 'idle' | 'running' | 'success' | 'failed' | 'skipped'

export type SkipConditionWhen = 'always' | 'on_success' | 'on_failure' | 'expression'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export type WorkflowRunStatus = 'running' | 'paused' | 'completed' | 'failed' | 'idle'

/** 条件跳转规则 */
export interface SkipCondition {
  id: string
  label: string
  when: SkipConditionWhen
  expression?: string
  targetNodeId: string
}

/** 节点输入输出字段定义 */
export interface NodeIOField {
  name: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'
  required: boolean
  defaultValue?: unknown
  description?: string
}

/** 节点 IO schema */
export interface NodeIOSchema {
  inputs: NodeIOField[]
  outputs: NodeIOField[]
}

/** 流程节点 */
export interface WorkflowNode {
  id: string
  type: NodeType
  label: string
  position: { x: number; y: number }
  config: Record<string, unknown>
  nextNodeId: string | null
  skipConditions: SkipCondition[]
  runStatus: NodeRunStatus
  description: string
}

/** 流程定义 */
export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  firstNodeId: string | null
  createdAt: string
  updatedAt: string
}

/** 节点运行时输出 */
export interface NodeOutput {
  status: NodeRunStatus
  data: Record<string, unknown>
  startedAt: string
  endedAt: string
  error?: string
}

/** 运行上下文 */
export interface WorkflowContext {
  workflowId: string
  runId: string
  nodeOutputs: Record<string, NodeOutput>
  variables: Record<string, unknown>
  currentNodeId: string | null
  status: WorkflowRunStatus
  startTime: string
}

/** 日志条目 */
export interface WorkflowLog {
  id: string
  timestamp: string
  level: LogLevel
  nodeId: string | null
  message: string
  data?: Record<string, unknown>
}

/** 流程索引条目（用于 index.json） */
export interface WorkflowIndexEntry {
  id: string
  name: string
  updatedAt: string
}

/** 各节点类型的元数据 */
export interface NodeTypeMeta {
  type: NodeType
  label: string
  icon: string
  color: string
  description: string
  io: NodeIOSchema
}

/** Store state */
export interface SelfProcessState {
  workflows: Workflow[]
  currentWorkflowId: string | null
  workflowLogs: WorkflowLog[]
  runContext: WorkflowContext | null
  selectedNodeId: string | null
  isRunning: boolean
  isSaving: boolean
}
