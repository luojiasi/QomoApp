// ─────────────────────────────────────────────────────────────
// nodes/executor/httpExecutor.ts — HTTP 执行器
//
// 节点蓝图有 routing 时自动走此执行器。
// 从 params 取参数，按 paramLocation 放到 body/query，
// 向 http://127.0.0.1:5000 + endpoint 发请求。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../types/workflowExecution'
import { resolveParams } from '../../utils/resolveUpstreamExpr'
import { validateApiResponse } from './responseValidator'

const BASE_URL = 'http://127.0.0.1:5000'
const REQUEST_TIMEOUT_MS = 15000

/**
 * 将扁平 params 按 bodyGroup 重组为嵌套对象。
 * bodyGroup 元素支持两种格式：
 *   字符串 → param 名与后端字段名相同
 *   二元组 [paramKey, backendField] → 重命名映射
 * 未归入任何组的 key 放在顶层。
 */
function buildBody(
  params: Record<string, unknown>,
  bodyGroup?: Record<string, (string | [string, string])[]>
): Record<string, unknown> {
  if (!bodyGroup) return params

  const grouped: Record<string, unknown> = {}
  const used = new Set<string>()

  for (const [groupKey, entries] of Object.entries(bodyGroup)) {
    grouped[groupKey] = {}
    for (const entry of entries) {
      const [paramKey, backendKey] = Array.isArray(entry) ? entry : [entry, entry]
      if (paramKey in params) {
        ;(grouped[groupKey] as Record<string, unknown>)[backendKey] = params[paramKey]
        used.add(paramKey)
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
    method: string; endpoint: string; paramLocation?: string; bodyGroup?: Record<string, (string | [string, string])[]>
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

    const validated = await validateApiResponse(res, node.type)

    if (!validated.ok) {
      const errMsg = validated.error ?? `HTTP ${validated.httpStatus}`
      return {
        nodeId: node.id, nodeType: node.type, status: 'failure',
        output: { ...(mainData as Record<string, unknown>), httpStatus: validated.httpStatus, error: errMsg },
        error: errMsg
      }
    }

    const output: Record<string, unknown> = { ...(mainData as Record<string, unknown>) }
    if (validated.data && typeof validated.data === 'object') {
      Object.assign(output, validated.data as Record<string, unknown>)
    }
    output.httpStatus = validated.httpStatus
    return {
      nodeId: node.id, nodeType: node.type, status: 'success',
      output
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort')) {
      const errMsg = `请求超时 (${timeout / 1000}s): ${method} ${endpoint}`
      return {
        nodeId: node.id, nodeType: node.type, status: 'failure',
        output: { ...(mainData as Record<string, unknown>), error: errMsg },
        error: errMsg
      }
    }
    const errMsg = `请求失败: ${msg}`
    return {
      nodeId: node.id, nodeType: node.type, status: 'failure',
      output: { ...(mainData as Record<string, unknown>), error: errMsg },
      error: errMsg
    }
  }
}
