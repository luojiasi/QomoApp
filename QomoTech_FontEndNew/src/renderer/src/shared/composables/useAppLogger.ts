// ─────────────────────────────────────────────────────────────
// shared/composables/useAppLogger.ts — 前端日志服务
// ─────────────────────────────────────────────────────────────

import { ref, readonly } from 'vue'

// ==================================================================
// 类型
// ==================================================================

/** 日志分类 */
export type LogCategory = 'program' | 'operation'

/** 日志级别 */
export type LogLevel = 'info' | 'warn' | 'error'

/** 单条日志 */
export interface LogEntry {
  id: number
  /** ISO 8601 时间戳 */
  timestamp: string
  /** 日志分类 */
  category: LogCategory
  /** 日志级别 */
  level: LogLevel
  /** 来源模块 */
  source: string
  /** 日志内容 */
  message: string
  /** 附加数据 */
  detail?: Record<string, unknown>
}

// ==================================================================
// 模块级单例
// ==================================================================

let _nextId = 1

const logs = ref<LogEntry[]>([])
const MAX_MEMORY_ENTRIES = 1000

// ==================================================================
// 格式化
// ==================================================================

function formatTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${ms}`
  )
}

// ==================================================================
// 后端写入
// ==================================================================

let _backendLogUrl: string | null = null

function setBackendLogUrl(url: string): void {
  _backendLogUrl = url
}

async function sendToBackend(entry: LogEntry): Promise<void> {
  if (!_backendLogUrl) return
  try {
    await fetch(_backendLogUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    })
  } catch {
    // 静默失败，不影响主流程
  }
}

function pushLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
  const record: LogEntry = {
    ...entry,
    id: _nextId++,
    timestamp: formatTimestamp()
  }
  logs.value.push(record)
  while (logs.value.length > MAX_MEMORY_ENTRIES) {
    logs.value.shift()
  }

  sendToBackend(record)

  const prefix = `[${record.timestamp}] [${record.source}]`
  const msg = `${prefix} ${record.message}`
  switch (entry.level) {
    case 'error':
      console.error(msg, entry.detail ?? '')
      break
    case 'warn':
      console.warn(msg, entry.detail ?? '')
      break
    default:
      console.log(msg, entry.detail ?? '')
  }
}

// ==================================================================
// 对外 API
// ==================================================================

export function useAppLogger() {
  /**
   * 获取指定分类 + 来源的日志写入器
   *
   * 程序日志 (program)：配方下发、程序执行、运动控制、状态变更
   * 操作日志 (operation)：用户点击按钮、修改参数、切换页面等
   */
  function writer(category: LogCategory, source: string) {
    return {
      info(message: string, detail?: Record<string, unknown>) {
        pushLog({ category, level: 'info', source, message, detail })
      },
      warn(message: string, detail?: Record<string, unknown>) {
        pushLog({ category, level: 'warn', source, message, detail })
      },
      error(message: string, detail?: Record<string, unknown>) {
        pushLog({ category, level: 'error', source, message, detail })
      }
    }
  }

  function clear(): void {
    logs.value = []
  }

  return {
    logs: readonly(logs),
    writer,
    clear,
    setBackendLogUrl
  }
}
