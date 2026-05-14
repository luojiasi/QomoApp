import type { WorkflowNode, Workflow, WorkflowLog, LogLevel } from '../types/selfProcessTypes'

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

/** 创建默认节点 */
export function createDefaultNode(type: string, label?: string): WorkflowNode {
  return {
    id: generateId(),
    type,
    label: label ?? type,
    position: { x: 100, y: 100 },
    config: {},
    description: ''
  }
}

/** 创建新流程 */
export function createNewWorkflow(name: string): Workflow {
  return {
    id: generateId(),
    name,
    description: '',
    nodes: [],
    edges: [],
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