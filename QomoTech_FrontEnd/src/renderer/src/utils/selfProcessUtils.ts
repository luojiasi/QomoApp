import type {
  WorkflowNode,
  Workflow,
  NodeType,
  SkipCondition,
  WorkflowLog,
  LogLevel,
  NodeRunStatus
} from '../types/selfProcessTypes'

/** 生成短 UUID */
export function generateId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `${timestamp}${random}`
}

/** 获取当前时间字符串 */
export function nowISO(): string {
  return new Date().toISOString()
}

/** 获取本地时间字符串（用于显示） */
export function nowLocale(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

/** 创建默认的节点配置工厂 */
export function createDefaultNode(type: NodeType, label?: string): WorkflowNode {
  const nodeId = generateId()
  const configs: Record<NodeType, Record<string, unknown>> = {
    task: {
      apiEndpoint: '',
      apiMethod: 'POST',
      apiBody: {},
      timeout: 30,
      retryCount: 0,
      retryDelay: 1
    },
    condition: {
      operator: 'eq',
      compareValue: '',
      expression: ''
    },
    delay: {
      delayType: 'fixed',
      fixedSeconds: 1
    },
    loop: {
      count: 1,
      loopStartNodeId: null,
      loopEndNodeId: null
    }
  }

  return {
    id: nodeId,
    type,
    label: label ?? getDefaultNodeLabel(type),
    position: { x: 100, y: 100 },
    config: configs[type],
    nextNodeId: null,
    skipConditions: [],
    runStatus: 'idle',
    description: ''
  }
}

/** 获取节点类型的默认标签 */
function getDefaultNodeLabel(type: NodeType): string {
  const labels: Record<NodeType, string> = {
    task: '执行任务',
    condition: '条件判断',
    delay: '延时等待',
    loop: '循环操作'
  }
  return labels[type]
}

/** 创建新流程 */
export function createNewWorkflow(name: string): Workflow {
  return {
    id: generateId(),
    name,
    description: '',
    nodes: [],
    firstNodeId: null,
    createdAt: nowISO(),
    updatedAt: nowISO()
  }
}

/** 创建日志条目 */
export function createLog(
  level: LogLevel,
  message: string,
  nodeId: string | null = null,
  data?: Record<string, unknown>
): WorkflowLog {
  return {
    id: generateId(),
    timestamp: nowISO(),
    level,
    nodeId,
    message,
    data
  }
}

/** 创建跳转条件 */
export function createSkipCondition(
  label: string,
  when: SkipCondition['when'],
  targetNodeId: string,
  expression?: string
): SkipCondition {
  return {
    id: generateId(),
    label,
    when,
    targetNodeId,
    expression
  }
}

/** 从上下文中获取指定节点的输出 */
export function getNodeOutputFromContext(
  context: { nodeOutputs: Record<string, { data: Record<string, unknown> }> } | null,
  nodeId: string,
  field?: string
): unknown {
  if (!context) return undefined
  const output = context.nodeOutputs[nodeId]
  if (!output) return undefined
  if (field) return output.data[field]
  return output.data
}

/** 简单模板引擎：将 {{ $node.xxx.output.field }} 替换为实际值 */
export function resolveTemplate(
  template: string,
  context: { nodeOutputs: Record<string, { data: Record<string, unknown> }>; variables: Record<string, unknown> }
): string {
  return template.replace(/\{\{\s*\$node\.(\w+)\.output\.(\w+)\s*\}\}/g, (_match, nodeId, field) => {
    const value = getNodeOutputFromContext(context, nodeId, field)
    return value !== undefined ? String(value) : `{{undefined:${nodeId}.${field}}}`
  }).replace(/\{\{\s*variables\.(\w+)\s*\}\}/g, (_match, key) => {
    const value = context.variables[key]
    return value !== undefined ? String(value) : `{{undefined:var.${key}}}`
  })
}

/** 重置所有节点的运行状态为 idle */
export function resetNodeRunStatus(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((n) => ({ ...n, runStatus: 'idle' as NodeRunStatus }))
}

/** 构建 workflows 目录下的文件路径 */
export function buildWorkflowDirPath(workflowsBasePath: string, workflowId: string): string {
  return `${workflowsBasePath}/workflow_${workflowId}`
}

export function buildWorkflowFilePath(workflowsBasePath: string, workflowId: string): string {
  return `${buildWorkflowDirPath(workflowsBasePath, workflowId)}/workflow.json`
}

export function buildIndexFilePath(workflowsBasePath: string): string {
  return `${workflowsBasePath}/index.json`
}
