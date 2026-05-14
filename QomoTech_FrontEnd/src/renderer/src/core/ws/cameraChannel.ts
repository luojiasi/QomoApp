/**
 * core/ws/cameraChannel.ts
 *
 * 相机推流 WebSocket 通道。
 * 从 modules/camera/useCameraReceiver.ts 提取 WS 连接 + 帧管理逻辑。
 *
 * 职责：
 *   - 连接 /ws/camera/stream（二进制 JPEG 帧）
 *   - 帧缓冲队列 + requestAnimationFrame 显示循环
 *   - 对外提供 frameUrl ref（Vue 组件直接绑定 <img :src="frameUrl">）
 */
import { readonly, ref } from 'vue'
import { WsClient, getCameraStreamWsUrl } from './WsClient'

// ====================================================================
// 配置
// ====================================================================

const DEFAULT_QUALITY = 85
const DEFAULT_TIMEOUT_MS = 1000
const URL_CACHE_SIZE = 8
const WS_RECONNECT_MS = 1000
const DISPLAY_FRAME_INTERVAL_MS = 33 // ~30fps
const FRAME_QUEUE_SIZE = 4

// ====================================================================
// 单例状态
// ====================================================================

const frameUrl = ref('')
const running = ref(false)
const lastError = ref('')
const connected = ref(false)

let started = false
let displayLoopActive = false
let displayRafId: number | null = null

const loadedFrameQueue: string[] = []
const staleFrameUrlCache: string[] = []
let currentFrameObjectUrl = ''
let lastDisplayTs = 0

// ====================================================================
// 帧管理
// ====================================================================

function clearLoadedFrameQueue(): void {
  while (loadedFrameQueue.length > 0) {
    const url = loadedFrameQueue.shift()
    if (url) URL.revokeObjectURL(url)
  }
  loadedFrameQueue.length = 0
}

function pushStaleObjectUrl(url: string): void {
  if (!url) return
  staleFrameUrlCache.push(url)
  while (staleFrameUrlCache.length > URL_CACHE_SIZE) {
    const stale = staleFrameUrlCache.shift()
    if (stale) URL.revokeObjectURL(stale)
  }
}

function stopDisplayLoop(): void {
  displayLoopActive = false
  if (displayRafId !== null) {
    cancelAnimationFrame(displayRafId)
    displayRafId = null
  }
}

function cleanupDisplayFrameState(): void {
  stopDisplayLoop()
  frameUrl.value = ''
  if (currentFrameObjectUrl) {
    URL.revokeObjectURL(currentFrameObjectUrl)
    currentFrameObjectUrl = ''
  }
  while (staleFrameUrlCache.length > 0) {
    const stale = staleFrameUrlCache.shift()
    if (stale) URL.revokeObjectURL(stale)
  }
  lastDisplayTs = 0
  clearLoadedFrameQueue()
}

function enqueueFrameObjectUrl(url: string): void {
  loadedFrameQueue.push(url)
  while (loadedFrameQueue.length > FRAME_QUEUE_SIZE) {
    const dropped = loadedFrameQueue.shift()
    if (dropped) URL.revokeObjectURL(dropped)
  }
}

function enqueueDecodedFrame(blob: Blob): void {
  const objectUrl = URL.createObjectURL(blob)
  enqueueFrameObjectUrl(objectUrl)
}

function displayLoopTick(ts: number): void {
  if (!displayLoopActive) return

  if (loadedFrameQueue.length > 0 && ts - lastDisplayTs >= DISPLAY_FRAME_INTERVAL_MS) {
    const nextFrameUrl = loadedFrameQueue.shift()
    if (nextFrameUrl) {
      if (currentFrameObjectUrl) {
        pushStaleObjectUrl(currentFrameObjectUrl)
      }
      currentFrameObjectUrl = nextFrameUrl
      frameUrl.value = currentFrameObjectUrl
    }
    lastDisplayTs = ts
  }

  displayRafId = requestAnimationFrame(displayLoopTick)
}

function startDisplayLoop(): void {
  if (displayLoopActive) return
  displayLoopActive = true
  displayRafId = requestAnimationFrame(displayLoopTick)
}

// ====================================================================
// WS 客户端
// ====================================================================

const streamWsClient = new WsClient({
  url: getCameraStreamWsUrl,
  reconnectMs: WS_RECONNECT_MS,
  binaryType: 'blob',
  shouldReconnect: () => running.value && connected.value,
  onOpen: (ws) => {
    lastError.value = ''
    ws.send(JSON.stringify({ cmd: 'set_quality', quality: DEFAULT_QUALITY }))
    ws.send(JSON.stringify({ cmd: 'set_timeout', timeout_ms: DEFAULT_TIMEOUT_MS }))
  },
  onMessage: (evt: MessageEvent<ArrayBuffer | Blob | string>) => {
    if (!running.value) return
    if (typeof evt.data === 'string') {
      try {
        const payload = JSON.parse(evt.data) as { type?: string; message?: string }
        if (payload.type === 'error') {
          lastError.value = payload.message ?? 'camera stream error'
        }
      } catch {
        lastError.value = evt.data
      }
      return
    }

    const blob =
      evt.data instanceof Blob
        ? evt.data
        : new Blob([evt.data as ArrayBuffer], { type: 'image/jpeg' })
    enqueueDecodedFrame(blob)
  },
  onError: (e) => {
    lastError.value =
      e instanceof Error ? (e.message ?? 'websocket stream error') : 'websocket stream error'
  }
})

function connectStreamWs(): void {
  if (!running.value || !connected.value) return
  if (streamWsClient.isOpen) return
  streamWsClient.connect()
}

function stopStreamWs(): void {
  streamWsClient.close()
}

// ====================================================================
// 公开 API
// ====================================================================

/** 启动相机通道（每帧推流 + 显示循环）。业务层负责确保相机已连接后调用。 */
export function startCameraChannel(): void {
  if (started) return
  started = true
  running.value = true
  connected.value = true
  connectStreamWs()
  startDisplayLoop()
}

export function stopCameraChannel(): void {
  started = false
  running.value = false
  connected.value = false
  stopStreamWs()
  stopDisplayLoop()
  cleanupDisplayFrameState()
}

/** 挂起推流（相机断开时），不清除帧队列 */
export function suspendCameraChannel(): void {
  connected.value = false
  stopStreamWs()
}

/** 恢复推流（相机重连后） */
export function resumeCameraChannel(): void {
  connected.value = true
  connectStreamWs()
  startDisplayLoop()
}

export function useCameraChannelState() {
  return {
    frameUrl: readonly(frameUrl),
    running: readonly(running),
    connected: readonly(connected),
    lastError: readonly(lastError)
  }
}
