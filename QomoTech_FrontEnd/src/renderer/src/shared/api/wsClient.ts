import { getBackendBaseUrl } from './httpClient'

// ════════════════════════════════════════════
// WebSocket URL helpers (from baseWs)
// ════════════════════════════════════════════

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

export const getCameraStreamWsUrl = () => {
  const baseUrl = getBackendWsBaseUrl()
  return baseUrl ? `${baseUrl}/ws/camera/stream` : '/ws/camera/stream'
}

export const getStartProgramStatusWsUrl = () => {
  const baseUrl = getBackendWsBaseUrl()
  return baseUrl ? `${baseUrl}/ws/program/status` : '/ws/program/status'
}

// ════════════════════════════════════════════
// WsClient (from wsClient)
// ════════════════════════════════════════════

/**
 * 通用 WebSocket 客户端：统一连接、重连、清理生命周期。
 *
 * 设计目标：
 * - 收纳 hardware.ts / cameraReceiver.ts 中重复出现的 connect/clear/reconnect 模板
 * - 不绑定具体业务消息格式，由调用方在 onMessage 内自行解析
 * - 支持「条件重连」：调用方提供 shouldReconnect()，例如「仅在 running 且 connected 时重连」
 *
 * 不做的事（保持裸 WS 的灵活性）：
 * - 不实现心跳（不同后端策略不同，按需在 onOpen 内 send）
 * - 不实现订阅多路复用（当前两处使用都是单连接）
 */

export interface WsClientOptions {
  /** 每次 connect 时调用，返回当前应连接的 URL */
  url: () => string
  /** 失败/断开后的重连延迟（毫秒）。设为 0 或负数禁用自动重连 */
  reconnectMs: number
  /** 二进制消息类型，可选 */
  binaryType?: BinaryType
  /** 连接打开后的回调；可在此 send 初始指令 */
  onOpen?: (ws: WebSocket) => void
  /** 收到消息时的回调 */
  onMessage?: (event: MessageEvent) => void
  /** 任意错误时的回调（含连接构造异常、ws.onerror） */
  onError?: (error: unknown) => void
  /** 连接关闭后的回调（在重连排程之前触发） */
  onClose?: () => void
  /** 返回 true 才会自动重连。默认始终为 true */
  shouldReconnect?: () => boolean
}

export class WsClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private active = false

  constructor(private readonly options: WsClientOptions) {}

  /** 是否已 open */
  get isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /** 启动连接（连接断开时会自动按 reconnectMs 重连，除非 shouldReconnect 返回 false） */
  connect(): void {
    this.active = true
    this.openSocket()
  }

  /** 关闭连接并停止重连 */
  close(): void {
    this.active = false
    this.clearReconnectTimer()
    this.detachSocket()
  }

  /** 直接发送一条消息；连接未 open 时静默忽略 */
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
      // ignore — close 在已关闭状态下也允许调用，但部分浏览器实现可能抛错
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
