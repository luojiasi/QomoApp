// ─────────────────────────────────────────────────────────────
// utils/resolveUpstreamExpr.ts — 上游数据表达式解析
//
// 所有执行器（httpExecutor、本地执行器等）共用。
// 解析 params 中以 $ 开头的表达式，从 upstreamData 取值。
// ─────────────────────────────────────────────────────────────

/**
 * 解析路径表达式，从 upstreamData 取值。
 *
 * 语法：
 *   $main              → upstreamData['main']
 *   $main.pos          → upstreamData['main']['pos']
 *   $main.data.ports[0].name → upstreamData['main']['data']['ports'][0]['name']
 *
 * @returns 解析到的值，失败返回 null
 */
export function resolveExpr(
  expr: string,
  upstreamData: Record<string, Record<string, unknown>>
): unknown {
  const path = expr.slice(1) // 去掉 $
  const segments = path.split('.')
  let current: unknown = upstreamData
  for (const seg of segments) {
    if (current === null || current === undefined) return null
    const m = seg.match(/^(.+?)\[(\d+)\]$/)
    if (m) {
      const arr = (current as Record<string, unknown>)[m[1]]
      if (!Array.isArray(arr)) return null
      current = arr[Number(m[2])]
    } else {
      current = (current as Record<string, unknown>)[seg]
    }
  }
  return current
}

/**
 * 解析 params 中所有 $ 前缀的值。
 * 非 $ 开头的值原样保留。
 */
export function resolveParams(
  params: Record<string, unknown>,
  upstreamData: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && (value as string).startsWith('$')) {
      const result = resolveExpr(value as string, upstreamData)
      if (result === null || result === undefined) {
        resolved[key] = value
      } else if (typeof result === 'object') {
        resolved[key] = result
      } else {
        resolved[key] = String(result)
      }
    } else {
      resolved[key] = value
    }
  }
  return resolved
}
