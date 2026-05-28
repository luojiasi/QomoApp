// ─────────────────────────────────────────────────────────────
// utils/upstreamFieldUtils.ts — 推算上游节点可能输出的字段名
//
// 通过分析 edges 找到连入目标节点的上游节点，
// 再根据节点类型推断其可能输出的数据字段。
// ─────────────────────────────────────────────────────────────

import type { Workflow } from '../types/workflow'
import { NODE_REGISTRY } from '../nodes/definitions/index'
import { parseJSONish } from './workflowUtils'

/**
 * 推算连入目标节点各输入端口的可能字段名。
 *
 * @returns { [portName]: string[] }  如 { main: ['x','y'], input_1: ['name'] }
 */
export function inferUpstreamFields(
  wf: Workflow,
  targetNodeId: string
): Record<string, string[]> {
  const result: Record<string, string[]> = {}

  for (const edge of wf.edges) {
    if (edge.target !== targetNodeId) continue
    const portName = edge.targetHandle ?? 'main'

    const sourceNode = wf.nodes.find(n => n.id === edge.source)
    if (!sourceNode) continue

    const fields = inferNodeOutputKeys(sourceNode, wf)
    if (fields.length > 0) {
      if (!result[portName]) result[portName] = []
      for (const f of fields) {
        if (!result[portName].includes(f)) result[portName].push(f)
      }
    }
  }

  return result
}

// 防止 data.transform → data.transform 链导致无限递归
const _seen = new Set<string>()

/** 根据节点类型 + 上游追溯推断输出字段名 */
function inferNodeOutputKeys(
  node: Workflow['nodes'][number],
  wf: Workflow
): string[] {
  if (_seen.has(node.id)) return []
  _seen.add(node.id)

  try {
    // data.create：解析 params.data JSON 的 key
    if (node.type === 'data.create') {
      const raw = node.params?.data as string | undefined
      if (raw) {
        try {
          const parsed = parseJSONish(raw)
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return Object.keys(parsed)
          }
        } catch { /* ignore */ }
      }
    }

    // data.transform：透传上游全部数据 + 可能新增/覆盖 targetField
    if (node.type === 'data.transform') {
      const keys: string[] = []
      const targetField = node.params?.targetField as string | undefined

      // 追溯上游节点的输出字段（transform 透传了它们）
      for (const edge of wf.edges) {
        if (edge.target === node.id) {
          const src = wf.nodes.find(n => n.id === edge.source)
          if (src) {
            for (const k of inferNodeOutputKeys(src, wf)) {
              if (!keys.includes(k)) keys.push(k)
            }
          }
        }
      }

      // 如果 targetField 是新建字段（不在上游 key 中），也加入
      if (targetField && !keys.includes(targetField)) {
        keys.push(targetField)
      }

      return keys
    }

    // routing 节点：HTTP 请求返回通用 API 响应结构 { success, message, data }
    // 从蓝图 routing 字段判断是否为 routing 节点
    if (isRoutingNode(node)) {
      // routing 节点透传上游数据 + 后端响应合并
      const keys = getBaseRoutingKeys()
      // 也追溯上游
      for (const edge of wf.edges) {
        if (edge.target === node.id) {
          const src = wf.nodes.find(n => n.id === edge.source)
          if (src) {
            for (const k of inferNodeOutputKeys(src, wf)) {
              if (!keys.includes(k)) keys.push(k)
            }
          }
        }
      }
      return keys
    }

    return []
  } finally {
    _seen.delete(node.id)
  }
}

/**
 * routing 节点输出的基础字段（API 通用响应结构）。
 * httpExecutor 合并了上游数据 + 后端响应 data 字段，所以有些字段是动态的。
 */
function getBaseRoutingKeys(): string[] {
  return ['success', 'message', 'data', 'httpStatus']
}

function isRoutingNode(node: Workflow['nodes'][number]): boolean {
  const def = NODE_REGISTRY[node.type]
  return !!def?.routing
}
