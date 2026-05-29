// ─────────────────────────────────────────────────────────────
// nodes/executor/responseValidator.ts — API 响应校验器
//
// 后端 ApiResponse 格式：{ success: bool, message: str, data: any }
// 校验分三层：
//   1. HTTP 状态码（!res.ok → 失败）
//   2. 响应体 success 字段（false → 失败）
//   3. 节点级自定义规则（nodeResponseRules 注册表中命中时执行）
//   三层都通过才返回 ok: true
// ─────────────────────────────────────────────────────────────

import { getNodeResponseRule } from './nodeResponseRules'

export interface ValidatedResponse {
  ok: boolean
  data: unknown
  error?: string
  httpStatus: number
}

/** 第三层校验函数签名：body 为完整响应体，含 httpStatus */
export type NodeResponseRule = (body: unknown) => { ok: boolean; error?: string }

/**
 * 校验后端 API 响应。
 * nodeType 可选 —— 传入后会在第二层通过后执行第三层节点级校验。
 */
export async function validateApiResponse(
  res: Response,
  nodeType?: string
): Promise<ValidatedResponse> {
  const httpStatus = res.status

  let body: unknown
  const text = await res.text()
  try {
    body = JSON.parse(text)
  } catch {
    body = text || null
  }

  // 第一层：HTTP 状态码
  if (!res.ok) {
    const detail =
      body && typeof body === 'object' && 'message' in body
        ? String((body as Record<string, unknown>).message)
        : JSON.stringify(body)
    return { ok: false, data: body, error: `HTTP ${httpStatus}: ${detail}`, httpStatus }
  }

  // 第二层：响应体 success 字段
  if (body && typeof body === 'object' && 'success' in body) {
    const success = (body as Record<string, unknown>).success
    if (success !== true) {
      const message =
        (body as Record<string, unknown>).message ?? '后端返回失败'
      return { ok: false, data: body, error: String(message), httpStatus }
    }
  }

  // 第三层：节点级自定义校验规则
  if (nodeType) {
    const rule = getNodeResponseRule(nodeType)
    if (rule) {
      const result = rule(body)
      if (!result.ok) {
        return { ok: false, data: body, error: result.error, httpStatus }
      }
    }
  }

  return { ok: true, data: body, httpStatus }
}
