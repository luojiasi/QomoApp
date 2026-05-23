import { readonly, ref } from 'vue'
import { getCameraStreamWsUrl } from '@/shared/api/wsClient'
import { WsClient } from '@/shared/api/wsClient'
import {
  DEFAULT_QUALITY,
  DEFAULT_TIMEOUT_MS,
  URL_CACHE_SIZE,
  WS_RECONNECT_MS,
  DISPLAY_FRAME_INTERVAL_MS,
  FRAME_QUEUE_SIZE
} from '../config/cameraDefaults'

const frameUrl = ref('')
const running = ref(false)
const lastError = ref('')

let started = false
let displayLoopActive = false
let displayRafId: number | null = null

const loadedFrameQueue: string[] = []
const staleFrameUrlCache: string[] = []
let currentFrameObjectUrl = ''
let lastDisplayTs = 0

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

const streamWsClient = new WsClient({
  url: getCameraStreamWsUrl,
  reconnectMs: WS_RECONNECT_MS,
  binaryType: 'blob',
  shouldReconnect: () => running.value,
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
  if (!running.value) return
  if (streamWsClient.isOpen) return
  streamWsClient.connect()
}

function stopStreamWs(): void {
  streamWsClient.close()
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

/** 启动全局相机接收器（单例）。应用启动时调用一次即可。 */
export function startGlobalCameraReceiver(): void {
  if (started) return
  started = true
  running.value = true
  connectStreamWs()
  startDisplayLoop()
}

/** 停止全局相机接收器。 */
export function stopGlobalCameraReceiver(): void {
  running.value = false
  stopStreamWs()
  stopDisplayLoop()
  cleanupDisplayFrameState()
  started = false
}

/** 刷新相机流（重新连接 WS）。 */
export function refreshGlobalCameraStream(): void {
  stopStreamWs()
  if (running.value) {
    connectStreamWs()
    startDisplayLoop()
  }
}

/** 获取全局相机接收器状态（用于 Vue 组件绑定）。 */
export function useGlobalCameraReceiverState() {
  return {
    frameUrl: readonly(frameUrl),
    lastError: readonly(lastError),
    connected: readonly(running)
  }
}
