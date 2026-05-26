// ─────────────────────────────────────────────────────────────
// infra/workflowApiBridge.ts
//
// 封装 Electron preload 注入的 window.api 访问。
// 目标：store / composables 不直接接触 window 强转细节。
// ─────────────────────────────────────────────────────────────

import type { WorkflowApi } from '../types/workflowApi'

export function getWorkflowApi(): WorkflowApi | null {
  return (window as unknown as { api?: WorkflowApi }).api ?? null
}

