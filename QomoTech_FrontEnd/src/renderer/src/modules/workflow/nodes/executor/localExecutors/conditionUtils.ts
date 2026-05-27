// ─────────────────────────────────────────────────────────────
// localExecutors/conditionUtils.ts — 条件判断公共函数
//
// conditionExecutor 和 loopExecutor 共用。
// ─────────────────────────────────────────────────────────────

import type { IfCondition } from '../../../types/workflow'

/** 两个值按运算符比较，自动识别数字/字符串类型 */
export function compare(a: unknown, b: unknown, op: string): boolean {
  const numA = Number(a)
  const numB = Number(b)
  const useNum = !isNaN(numA) && !isNaN(numB) && a !== '' && b !== ''

  const left  = useNum ? numA : String(a ?? '')
  const right = useNum ? numB : String(b ?? '')

  switch (op) {
    case 'eq':  return left === right
    case 'neq': return left !== right
    case 'gt':  return left > right
    case 'lt':  return left < right
    case 'gte': return left >= right
    case 'lte': return left <= right
    default:    return false
  }
}

/**
 * 按条件列表 + 模式评估上游数据。
 * 每条条件按 inputName 从 upstreamData 取对应端口数据，
 * 再按 field 钻取字段，与 value 比较。
 *
 * @returns AND 模式全满足 / OR 模式任一满足 → true
 */
export function evaluateConditions(
  conditions: IfCondition[],
  mode: 'AND' | 'OR',
  upstreamData: Record<string, Record<string, unknown>>
): boolean {
  if (mode === 'OR') {
    for (const cond of conditions) {
      const inputData = upstreamData[cond.inputName]
      const value = cond.field
        ? (inputData as Record<string, unknown>)?.[cond.field]
        : inputData
      if (compare(value, cond.value, cond.operator)) return true
    }
    return false
  }

  // AND（默认）
  for (const cond of conditions) {
    const inputData = upstreamData[cond.inputName]
    const value = cond.field
      ? (inputData as Record<string, unknown>)?.[cond.field]
      : inputData
    if (!compare(value, cond.value, cond.operator)) return false
  }
  return true
}
