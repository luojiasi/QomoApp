/**
 * /ws/motion/status 单连接广播封装
 *
 * - 全局只维护一条 WebSocket
 * - 引用计数自动启停
 * - 断线 1.5s 自动重连
 * - 新订阅者可选立即收到 latest snapshot
 */

import { getBackendWsBaseUrl } from './toBackendApiCall'

export type MotionAxis = 'X' | 'Y' | 'Z' | 'U' | 'R'

export interface AxisSnapshot {
  name: string
  axis_id: number
  dpos: number
  mpos: number
  idle: boolean
  alarm_code: number
  enabled: boolean
}

export interface MotionStatusSnapshot {
  state: string
  position: Record<string, number>
  mposition: Record<string, number>
  idle: Record<string, boolean>
  alarms: Record<string, number>
  enabled: Record<string, boolean>
  axes: AxisSnapshot[]
  timestamp: number
  error: string | null
}

export type MotionStatusListener = (snapshot: MotionStatusSnapshot) => void

export interface MotionStatusSubscribeOptions {
  emitLatest?: boolean
  autoStart?: boolean
}

let ws: WebSocket | null = null
let latestSnapshot: MotionStatusSnapshot | null = null
const listeners = new Set<MotionStatusListener>()
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let intentionalClose = false

function getUrl(): string {
  const base = getBackendWsBaseUrl()
  return base ? `${base}/ws/motion/status` : '/ws/motion/status'
}

function notifyAll(snapshot: MotionStatusSnapshot): void {
  listeners.forEach((l) => {
    try {
      l(snapshot)
    } catch {
      // 防止单个监听器异常影响其他
    }
  })
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return
  }

  intentionalClose = false
  const url = getUrl()
  ws = new WebSocket(url)

  ws.onopen = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  ws.onmessage = (event: MessageEvent) => {
    try {
      const parsed: MotionStatusSnapshot = JSON.parse(event.data as string)
      latestSnapshot = parsed
      notifyAll(parsed)
    } catch {
      // 忽略解析失败的消息
    }
  }

  ws.onclose = () => {
    ws = null
    if (!intentionalClose && listeners.size > 0) {
      scheduleReconnect()
    }
  }

  ws.onerror = () => {
    // onclose 会紧随其后，由 onclose 统一处理重连
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (listeners.size > 0) {
      connect()
    }
  }, 1500)
}

function disconnect(): void {
  intentionalClose = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
}

export const subscribeMotionStatus = (
  listener: MotionStatusListener,
  options?: MotionStatusSubscribeOptions
): (() => void) => {
  listeners.add(listener)

  if (options?.emitLatest !== false && latestSnapshot) {
    listener(latestSnapshot)
  }

  if (options?.autoStart !== false) {
    connect()
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      disconnect()
    }
  }
}

export const getLatestMotionStatus = (): MotionStatusSnapshot | null => latestSnapshot

export const sendMotionWsCmd = (
  cmd: 'jog_start' | 'jog_stop' | 'pause' | 'resume' | 'estop',
  extra?: Record<string, unknown>
): void => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ cmd, ...(extra ?? {}) }))
}
