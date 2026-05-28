// ─────────────────────────────────────────────────────────────
// nodes/executor/httpExecutor.ts — HTTP 执行器
//
// 节点蓝图有 routing 时自动走此执行器。
// 从 params 取参数，按 paramLocation 放到 body/query，
// 向 http://127.0.0.1:5000 + endpoint 发请求。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../types/workflowExecution'

const BASE_URL = 'http://127.0.0.1:5000'
const REQUEST_TIMEOUT_MS = 15000

/**
 * 解析 params 中以 $ 开头的表达式，从 upstreamData 中取值。
 * 语法：$端口名.字段.子字段 或 $端口名.arr[0].key
 */
function resolveParams(
  params: Record<string, unknown>,
  upstreamData: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.startsWith('$')) {
      resolved[key] = resolveExpr(value, upstreamData) ?? value
    } else {
      resolved[key] = value
    }
  }
  return resolved
}

function resolveExpr(
  expr: string,
  upstreamData: Record<string, Record<string, unknown>>
): unknown {
  // 去掉 $, 按 . 分割路径: $main.data.ports[0].name → ['main','data','ports[0]','name']
  const path = expr.slice(1) // remove $
  const segments = path.split('.')
  let current: unknown = upstreamData
  for (const seg of segments) {
    if (current === null || current === undefined) return null
    // 处理数组索引: ports[0]
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
 * 将扁平 params 按 bodyGroup 重组为嵌套对象。
 * 未归入任何组的 key 放在顶层。
 */
function buildBody(
  params: Record<string, unknown>,
  bodyGroup?: Record<string, string[]>
): Record<string, unknown> {
  if (!bodyGroup) return params

  const grouped: Record<string, unknown> = {}
  const used = new Set<string>()

  for (const [groupKey, keys] of Object.entries(bodyGroup)) {
    grouped[groupKey] = {}
    for (const k of keys) {
      if (k in params) {
        ;(grouped[groupKey] as Record<string, unknown>)[k] = params[k]
        used.add(k)
      }
    }
  }

  // 未归组的平铺参数放顶层
  for (const [k, v] of Object.entries(params)) {
    if (!used.has(k)) {
      grouped[k] = v
    }
  }

  return grouped
}

export async function executeHttp(
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const routing = (node as any).__routing as {
    method: string; endpoint: string; paramLocation?: string; bodyGroup?: Record<string, string[]>
  }
  if (!routing) {
    return {
      nodeId: node.id, nodeType: node.type, status: 'failure',
      output: {}, error: '节点缺少 routing 配置'
    }
  }

  const paramLocation = routing.paramLocation ?? 'body'
  const rawParams = { ...node.params }
  const method = ((rawParams.method as string) || routing.method).toUpperCase()
  const endpoint = (rawParams.endpoint as string) || (rawParams.url as string) || routing.endpoint
  const timeout = (rawParams.timeout as number) || REQUEST_TIMEOUT_MS
  const mainData = (upstreamData['main'] as Record<string, unknown>) ?? {}

  // 解析 $ 前缀参数，从上游数据动态取值
  const params = resolveParams(rawParams, upstreamData)

  // 从 params 中剔除自定义字段，避免传到后端
  delete params.method
  delete params.endpoint
  delete params.url
  delete params.timeout

  // 构建请求
  const url = new URL(`${BASE_URL}${endpoint}`)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  let body: string | undefined
  if (method === 'GET' || paramLocation === 'query') {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v))
      }
    }
  } else {
    body = JSON.stringify(buildBody(params, routing.bodyGroup))
  }

  const actionText: Record<string, string> = {
    GET: '正在获取', POST: '正在发送', PUT: '正在修改',
    DELETE: '正在删除', PATCH: '正在修改'
  }
  callbacks?.onProgress?.(node.id, actionText[method] ?? method)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const res = await fetch(url.toString(), {
      method,
      headers,
      body,
      signal: controller.signal
    })
    clearTimeout(timer)

    let data: unknown
    const text = await res.text()
    try { data = JSON.parse(text) } catch { data = text || null }

    if (!res.ok) {
      return {
        nodeId: node.id, nodeType: node.type, status: 'failure',
        output: { ...(mainData as Record<string, unknown>), httpStatus: res.status },
        error: `HTTP ${res.status}: ${JSON.stringify(data)}`
      }
    }

    const output: Record<string, unknown> = { ...(mainData as Record<string, unknown>) }
    if (data && typeof data === 'object') {
      Object.assign(output, data as Record<string, unknown>)
    }
    output.httpStatus = res.status
    return {
      nodeId: node.id, nodeType: node.type, status: 'success',
      output
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort')) {
      return {
        nodeId: node.id, nodeType: node.type, status: 'failure',
        output: { ...(mainData as Record<string, unknown>) },
        error: `请求超时 (${timeout / 1000}s): ${method} ${endpoint}`
      }
    }
    return {
      nodeId: node.id, nodeType: node.type, status: 'failure',
      output: { ...(mainData as Record<string, unknown>) },
      error: `请求失败: ${msg}`
    }
  }
}
