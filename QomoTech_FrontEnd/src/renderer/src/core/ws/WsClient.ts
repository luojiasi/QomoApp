/**
 * core/ws/WsClient.ts
 *
 * 通用 WebSocket 客户端封装。
 * 从 shared/api/wsClient.ts 迁移至 core 层。
 *
 * 设计原则：
 *   - 不绑定具体业务消息格式，由上层 Channel 自行解析
 *   - 支持自动重连（条件控制）
 *   - 统一 connect/close 生命周期管理
 */
import { getBackendBaseUrl } from '../api/httpClient'

// ====================================================================
// URL 工具
// ====================================================================

export const getBackendWsBaseUrl = () => {
  const baseUrl = getBackendBaseUrl()

  if (!baseUrl) {
    if (typeof window === 'undefined') return ''
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}`
  }

  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace(/^https:\/\//, 'wss://')
  }

  if (baseUrl.startsWith('http://')) {
    return baseUrl.replace(/^http:\/\//, 'ws://')
  }

  return baseUrl
}

export const getMotionStatusWsUrl = () => {
  const baseUrl = getBackendWsBaseUrl()
  return baseUrl ? `${baseUrl}/ws/motion/status` : '/ws/motion/status'
}

export const getCameraStreamWsUrl = () => {
  const baseUrl = getBackendWsBaseUrl()
  return baseUrl ? `${baseUrl}/ws/camera/stream` : '/ws/camera/stream'
}

export const getProgramStatusWsUrl = () => {
  const baseUrl = getBackendWsBaseUrl()
  return baseUrl ? `${baseUrl}/ws/program/status` : '/ws/program/status'
}

// ====================================================================
// WsClient 类
// ====================================================================

export interface WsClientOptions {
  url: () => string
  reconnectMs: number
  binaryType?: BinaryType
  onOpen?: (ws: WebSocket) => void
  onMessage?: (event: MessageEvent) => void
  onError?: (error: unknown) => void
  onClose?: () => void
  shouldReconnect?: () => boolean
}

export class WsClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private active = false

  constructor(private readonly options: WsClientOptions) {}

  get isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  connect(): void {
    this.active = true
    this.openSocket()
  }

  close(): void {
    this.active = false
    this.clearReconnectTimer()
    this.detachSocket()
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): boolean {
    if (!this.isOpen || this.ws === null) return false
    try {
      this.ws.send(data)
      return true
    } catch (e) {
      this.options.onError?.(e)
      return false
    }
  }

  private openSocket(): void {
    this.detachSocket()

    let next: WebSocket
    try {
      next = new WebSocket(this.options.url())
    } catch (e) {
      this.options.onError?.(e)
      this.scheduleReconnect()
      return
    }

    if (this.options.binaryType) next.binaryType = this.options.binaryType

    next.onopen = () => {
      this.options.onOpen?.(next)
    }

    next.onmessage = (event: MessageEvent) => {
      this.options.onMessage?.(event)
    }

    next.onerror = (event: Event) => {
      this.options.onError?.(event)
    }

    next.onclose = () => {
      if (this.ws === next) this.ws = null
      this.options.onClose?.()
      this.scheduleReconnect()
    }

    this.ws = next
  }

  private detachSocket(): void {
    const current = this.ws
    if (!current) return
    current.onopen = null
    current.onmessage = null
    current.onerror = null
    current.onclose = null
    try {
      current.close()
    } catch {
      // ignore
    }
    this.ws = null
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private scheduleReconnect(): void {
    if (!this.active) return
    if (this.options.reconnectMs <= 0) return
    if (this.options.shouldReconnect && !this.options.shouldReconnect()) return

    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.active) return
      this.openSocket()
    }, this.options.reconnectMs)
  }
}
