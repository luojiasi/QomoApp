// ─────────────────────────────────────────────────────────────
// nodes/executor/localExecutors/transformExecutor.ts — 数据变换执行器
//
// executeAs === 'transform' 时调用。
// 从上游数据取指定字段，应用数学/字符串操作后输出。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult } from '../../../types/workflowExecution'

export async function executeTransform(
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>
): Promise<NodeRunResult> {
  const field     = (node.params.field as string) ?? ''
  const operation = (node.params.operation as string) ?? 'add'
  const operand   = (node.params.operand as string) ?? ''
  const targetField = (node.params.targetField as string) || field
  const inputData = upstreamData['main']

  if (!inputData) {
    return {
      nodeId: node.id, nodeType: node.type, status: 'failure',
      output: {}, error: '上游无数据，无法进行变换'
    }
  }

  const rawValue = field ? (inputData as Record<string, unknown>)[field] : inputData
  const output   = { ...(inputData as Record<string, unknown>) }

  function fail(msg: string): NodeRunResult {
    return { nodeId: node.id, nodeType: node.type, status: 'failure', output: {}, error: msg }
  }

  let result: unknown

  switch (operation) {
    // ── 数值运算 ──
    case 'add':
      result = Number(rawValue) + Number(operand); break
    case 'subtract':
      result = Number(rawValue) - Number(operand); break
    case 'multiply':
      result = Number(rawValue) * Number(operand); break
    case 'divide': {
      const d = Number(operand)
      if (d === 0) return fail('除数不能为 0')
      result = Number(rawValue) / d; break
    }
    case 'modulo':
      result = Number(rawValue) % Number(operand); break

    // ── 字符串运算 ──
    case 'concat_before':
      result = String(operand) + String(rawValue ?? ''); break
    case 'concat_after':
      result = String(rawValue ?? '') + String(operand); break
    case 'to_upper':
      result = String(rawValue ?? '').toUpperCase(); break
    case 'to_lower':
      result = String(rawValue ?? '').toLowerCase(); break
    case 'replace': {
      const idx = operand.indexOf('→')
      const search = idx >= 0 ? operand.slice(0, idx) : operand
      const replacement = idx >= 0 ? operand.slice(idx + 1) : ''
      result = String(rawValue ?? '').split(search).join(replacement); break
    }

    default:
      return fail(`不支持的操作: ${operation}`)
  }

  if (Number.isNaN(Number(result)) && ['add','subtract','multiply','divide','modulo'].includes(operation)) {
    return fail(`非数值类型无法进行数学运算（字段="${field}", 值=${JSON.stringify(rawValue)}, 操作数="${operand}", 上游数据=${JSON.stringify(inputData)}）`)
  }

  if (targetField) {
    output[targetField] = result as Record<string, unknown>[string]
  }

  return {
    nodeId: node.id, nodeType: node.type,
    status: 'success',
    output: output as Record<string, unknown>
  }
}
