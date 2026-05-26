// ─────────────────────────────────────────────────────────────
// types/workflowApi.ts
//
// store/useWorkflowStore.ts 依赖的 Electron preload API 类型。
// 注意：按边界规则，类型全部集中放到 types/ 目录中。
// ─────────────────────────────────────────────────────────────

export type FileResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export type WorkflowApi = {
  getWorkflowsPath: () => Promise<string>
  readFile: (path: string) => Promise<FileResult<string>>
  writeFile: (path: string, content: string) => Promise<FileResult<null>>
  deleteFile: (path: string) => Promise<FileResult<null>>
}
