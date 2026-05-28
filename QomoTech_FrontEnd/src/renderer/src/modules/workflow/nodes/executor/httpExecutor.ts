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

export async function executeHttp(
  node: WorkflowNode,
  upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  const routing = (node as any).__routing as { method: string; endpoint: string; paramLocation?: string }
  if (!routing) {
    return {
      nodeId: node.id, nodeType: node.type, status: 'failure',
      output: {}, error: '节点缺少 routing 配置'
    }
  }

  const paramLocation = routing.paramLocation ?? 'body'
  const params = { ...node.params }
  const method = ((params.method as string) || routing.method).toUpperCase()
  const endpoint = (params.endpoint as string) || (params.url as string) || routing.endpoint
  const timeout = (params.timeout as number) || REQUEST_TIMEOUT_MS
  const mainData = (upstreamData['main'] as Record<string, unknown>) ?? {}

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
    body = JSON.stringify(params)
  }

  callbacks?.onProgress?.(node.id, `${method} ${endpoint} ...`)

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
