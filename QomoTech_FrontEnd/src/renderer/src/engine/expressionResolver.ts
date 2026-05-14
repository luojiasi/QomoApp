import type { WorkflowContext } from '@/modules/workflow/types/selfProcessTypes'

// ──── 解析上下文 ──────────────────────────────────────────────
export interface ResolverContext {
  ctx: WorkflowContext
  currentNodeId: string
  getPreviousNodeOutput: (nodeId: string, targetHandle?: string) => Record<string, unknown> | undefined
  getNodeOutputByLabel: (label: string) => Record<string, unknown> | undefined
}

// ──── 路径取值 ────────────────────────────────────────────────
function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object' && key in cur) {
      return (cur as Record<string, unknown>)[key]
    }
    return undefined
  }, source)
}

// ──── 值标准化 ────────────────────────────────────────────────
function normalizeValue(val: unknown): unknown {
  if (typeof val === 'string') {
    if (val === 'true') return true
    if (val === 'false') return false
    if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val)
  }
  return val
}

// ──── 表达式求值 ──────────────────────────────────────────────
function evaluateExpression(expr: string, resCtx: ResolverContext): unknown {
  // $var.<name>
  if (expr.startsWith('$var.')) {
    const varName = expr.slice(5)
    return resCtx.ctx.variables[varName]
  }

  // $prev.data.<path>
  if (expr.startsWith('$prev.')) {
    const path = expr.slice(6) // strip "$prev."
    const prevOutput = resCtx.getPreviousNodeOutput(resCtx.currentNodeId)
    if (!prevOutput) return undefined
    if (path === 'data') return prevOutput
    // path starts with "data."
    const dataPath = path.startsWith('data.') ? path.slice(5) : path
    return getByPath(prevOutput, dataPath)
  }

  // $node.<label>.data.<path>
  if (expr.startsWith('$node.')) {
    const rest = expr.slice(6) // strip "$node."
    const dotIdx = rest.indexOf('.')
    if (dotIdx === -1) return undefined
    const label = rest.slice(0, dotIdx)
    const path = rest.slice(dotIdx + 1)
    const output = resCtx.getNodeOutputByLabel(label)
    if (!output) return undefined
    if (path === 'data') return output
    // path starts with "data."
    const dataPath = path.startsWith('data.') ? path.slice(5) : path
    return getByPath(output, dataPath)
  }

  // $input.data.<path>
  if (expr.startsWith('$input.')) {
    const path = expr.slice(7) // strip "$input."
    const prevOutput = resCtx.getPreviousNodeOutput(resCtx.currentNodeId)
    if (!prevOutput) return undefined
    if (path === 'data') return prevOutput
    const dataPath = path.startsWith('data.') ? path.slice(5) : path
    return getByPath(prevOutput, dataPath)
  }

  return expr
}

// ──── 字符串模板插值 ──────────────────────────────────────────
function resolveTemplateString(raw: string, resCtx: ResolverContext): unknown {
  // 整体表达式：整个字符串就是一个 $xxx 表达式
  if (/^\$(node|prev|input|var)\./.test(raw)) {
    return evaluateExpression(raw, resCtx)
  }

  // 混合模板：包含 ${...} 插值
  return raw.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
    const val = evaluateExpression(expr.trim(), resCtx)
    return val === undefined ? '' : String(val)
  })
}

// ──── 递归解析 ────────────────────────────────────────────────
export function resolveValue(raw: unknown, resCtx: ResolverContext): unknown {
  if (typeof raw === 'string') {
    return normalizeValue(resolveTemplateString(raw, resCtx))
  }

  if (Array.isArray(raw)) {
    return raw.map((item) => resolveValue(item, resCtx))
  }

  if (raw !== null && typeof raw === 'object') {
    const resolved: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      resolved[key] = resolveValue(val, resCtx)
    }
    return resolved
  }

  return raw
}
