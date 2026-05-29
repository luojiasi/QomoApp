// ─────────────────────────────────────────────────────────────
// nodes/executor/nodeResponseRules.ts — 节点级响应校验规则
//
// 第三层校验：某类节点对后端响应体有特殊的字段值要求。
// 校验函数签名：(body) => { ok, error? }
//   ok: true  → 通过
//   ok: false → 失败，error 为失败原因
//
// body 为后端 ApiResponse 的完整响应体，已含 httpStatus 字段。
//
// 新增规则：在下方 rules 中按 type 注册即可。
// ─────────────────────────────────────────────────────────────

import type { NodeResponseRule } from './responseValidator'

/**
 * 节点 type → 自定义响应校验规则的注册表。
 * 只有需要额外校验的节点才需要在此注册。
 */
const rules: Record<string, NodeResponseRule> = {
  // 示例 —— 当某节点需要额外校验时取消注释并填写：
  // 'rs232.connect': (body) => {
  //   const data = (body as Record<string, unknown>).data as Record<string, unknown> | undefined
  //   if (data?.connected !== true) {
  //     return { ok: false, error: '串口未成功连接' }
  //   }
  //   return { ok: true }
  // },
}

export function getNodeResponseRule(nodeType: string): NodeResponseRule | null {
  return rules[nodeType] ?? null
}
