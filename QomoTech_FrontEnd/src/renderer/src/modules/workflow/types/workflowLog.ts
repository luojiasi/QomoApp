// ─────────────────────────────────────────────────────────────
// types/workflowLog.ts — 流程执行日志类型
// ─────────────────────────────────────────────────────────────

import type { NodeExecutionStatus } from './workflow'

/** 单条执行日志 */
export interface LogEntry {
  id: string
  /** ISO 8601 时间戳 */
  timestamp: string
  /** 关联节点 ID（可为空，表示全局事件） */
  nodeId: string | null
  /** 节点名称 */
  nodeName: string
  /** 日志级别（复用执行状态枚举） */
  status: NodeExecutionStatus
  /** 日志内容 */
  message: string
}
