// ─────────────────────────────────────────────────────────────
// utils/workflowUtils.ts
//
// 纯工具函数，无 Vue 依赖，无副作用，可直接单元测试。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode, Workflow } from '../types/workflow'
import type { NodeTypeDef } from '../types/nodeDefinition'
import { DEFAULT_NODE_POSITION } from '../constants/workflowCanvas'
import { NODE_REGISTRY } from '../nodes/definitions/index'

// ─── ID / 时间 ────────────────────────────────────────────────

/**
 * 生成一个短 ID（时间戳 base36 + 4位随机），如 'lf3k2abc'。
 * 在单机场景下足够唯一，不需要 UUID 全长。
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `${timestamp}${random}`
}

/** 返回当前时间的 ISO 8601 字符串，用于 createdAt / updatedAt */
export function nowISO(): string {
  return new Date().toISOString()
}

// ─── 数据工厂 ─────────────────────────────────────────────────

/**
 * 根据节点蓝图和默认参数生成描述性默认标签，
 * 避免 label 直接等于 displayName 导致重复。
 */
function makeDefaultLabel(def: NodeTypeDef): string {
  const d = def.defaults

  if (def.type === 'flow.delay') {
    const ms = (d.duration as number) ?? 1000
    if (ms >= 60000) return `等待 ${(ms / 60000).toFixed(1)}分`
    if (ms >= 1000) return `等待 ${ms / 1000}s`
    return `等待 ${ms}ms`
  }

  if (def.type === 'flow.countdown') {
    const min = (d.minutes as number) ?? 0
    const sec = (d.seconds as number) ?? 5
    if (min > 0) return `倒计时 ${min}分${sec}秒`
    return `倒计时 ${sec}秒`
  }

  if (def.type === 'flow.schedule') {
    const date = (d.date as string) ?? ''
    const time = (d.time as string) ?? '00:00'
    return date ? `定时 ${date} ${time}` : '定时 (未设置)'
  }

  if (def.type === 'flow.condition') {
    return 'IF 判断'
  }

  if (def.type === 'data.create') {
    const raw = (d.data as string) ?? '{}'
    try {
      const obj = JSON.parse(raw)
      return `数据 ${JSON.stringify(obj)}`
    } catch {
      return '构造数据'
    }
  }

  return def.displayName
}

/**
 * 创建一个带默认值的节点实例。
 * store.addNode() 内部调用此函数，外部一般不需要直接调用。
 */
export function createNode(type: string, label?: string): WorkflowNode {
  const def = NODE_REGISTRY[type]
  return {
    id: generateId(),
    type,
    label: label ?? (def ? makeDefaultLabel(def) : type),
    position: { ...DEFAULT_NODE_POSITION },
    params: { ...(def?.defaults ?? {}) },
    description: ''
  }
}

/**
 * 创建一个空白流程。
 * store.createWorkflow() 内部调用此函数。
 */
export function createWorkflow(name: string): Workflow {
  return {
    id: generateId(),
    name,
    description: '',
    nodes: [],
    edges: [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
    canvasSettings: {}
  }
}

// ─── 文件路径构建 ─────────────────────────────────────────────
//
// 流程文件存储结构（由 Electron 主进程决定基础路径）：
//   {basePath}/
//     index.json                        ← 所有流程的索引（id + name + updatedAt）
//     workflow_{id}/
//       workflow.json                   ← 单个流程的完整数据

export function workflowDirPath(basePath: string, workflowId: string): string {
  return `${basePath}/workflow_${workflowId}`
}

export function workflowFilePath(basePath: string, workflowId: string): string {
  return `${workflowDirPath(basePath, workflowId)}/workflow.json`
}

export function indexFilePath(basePath: string): string {
  return `${basePath}/index.json`
}
