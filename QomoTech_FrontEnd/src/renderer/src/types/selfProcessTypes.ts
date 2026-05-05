export type NodeRunStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export type WorkflowRunStatus = 'running' | 'paused' | 'completed' | 'failed' | 'idle'

export type NodeCategory = 'workflowSystem'|'motion' | 'io' | 'flow' | 'camera' | 'laser'

/** 节点参数定义（用于动态表单） */
export interface NodeProperty {
  name: string
  displayName: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'json'
  default: unknown
  required: boolean
  description?: string
  placeholder?: string
  options?: { label: string; value: string }[]
}

/** 节点端口定义 */
export interface NodePort {
  name: string
  displayName: string
  description?: string
}

/** 节点类型完整定义 */
export interface NodeDefinition {
  type: string
  category: NodeCategory
  label: string
  icon: string
  color: string
  description: string
  properties: NodeProperty[]
  inputs: NodePort[]
  outputs: NodePort[]
  defaults: Record<string, unknown>
}

/** 节点分类元数据 */
export interface NodeCategoryMeta {
  category: NodeCategory
  label: string
  icon: string
  color: string
  description: string
}

/** 流程边（对齐 VueFlow Edge 模型） */
export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

/** 流程节点 */
export interface WorkflowNode {
  id: string
  type: string
  label: string
  position: { x: number; y: number }
  config: Record<string, unknown>
  description: string
}

/** 流程定义 */
export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
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

/** Store state */
export interface SelfProcessState {
  workflows: Workflow[]
  currentWorkflowId: string | null
  workflowLogs: WorkflowLog[]
  runContext: WorkflowContext | null
  selectedNodeId: string | null
  isSaving: boolean
}
