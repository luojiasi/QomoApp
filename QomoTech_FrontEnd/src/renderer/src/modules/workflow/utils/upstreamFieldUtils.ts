// ─────────────────────────────────────────────────────────────
// utils/upstreamFieldUtils.ts — 推算上游节点可能输出的字段名
//
// 通过分析 edges 找到连入目标节点的上游节点，
// 再根据节点类型推断其可能输出的数据字段。
// ─────────────────────────────────────────────────────────────

import type { Workflow } from '../types/workflow'
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

    const fields = inferNodeOutputKeys(sourceNode)
    if (fields.length > 0) {
      result[portName] = fields
    }
  }

  return result
}

/** 根据节点类型推断输出字段名 */
function inferNodeOutputKeys(node: Workflow['nodes'][number]): string[] {
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

  // data.transform：输入字段 + targetField
  if (node.type === 'data.transform') {
    const keys: string[] = []
    const field = node.params?.field as string | undefined
    const targetField = node.params?.targetField as string | undefined
    if (field) keys.push(field)
    if (targetField && targetField !== field) keys.push(targetField)
    return keys
  }

  return []
}
