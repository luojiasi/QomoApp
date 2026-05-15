import { readonly, ref } from 'vue'
import { apiCall } from '@/shared/api/httpClient'
import { getCameraStreamWsUrl } from '@/shared/api/wsClient'
import { WsClient } from '@/shared/api/wsClient'
import { initSdkEnumAndConnectIndex0 } from './useCameraControl'
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
const connected = ref(false)

let started = false
let connecting = false
let ensureTimer: ReturnType<typeof setInterval> | null = null
let displayLoopActive = false
let displayRafId: number | null = null

const loadedFrameQueue: string[] = []
const staleFrameUrlCache: string[] = []
let currentFrameObjectUrl = ''
let lastDisplayTs = 0

/** 确保相机已连接（幂等）。 */
async function ensureCameraConnected(): Promise<void> {
  if (connecting) return
  connecting = true
  try {
    const statusRes = await apiCall<{ connected?: boolean }>('camera/status', 'GET')
    if (statusRes.success && statusRes.data?.connected) {
      connected.value = true
      lastError.value = ''
      return
    }
    connected.value = false

    const connectRes = await initSdkEnumAndConnectIndex0()
    if (!connectRes.success) {
      lastError.value = connectRes.message ?? 'camera connect failed'
      connected.value = false
      return
    }
    connected.value = true
    lastError.value = ''
  } finally {
    connecting = false
  }
}

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
  void ensureCameraConnected().then(() => {
    if (connected.value) {
      connectStreamWs()
      startDisplayLoop()
    }
  })

  if (ensureTimer !== null) clearInterval(ensureTimer)
  ensureTimer = setInterval(() => {
    void ensureCameraConnected().then(() => {
      if (!running.value) return
      if (connected.value) {
        connectStreamWs()
        startDisplayLoop()
      } else {
        stopStreamWs()
        cleanupDisplayFrameState()
      }
    })
  }, 3000)
}

/** 停止全局相机接收器。 */
export function stopGlobalCameraReceiver(): void {
  running.value = false
  if (ensureTimer !== null) {
    clearInterval(ensureTimer)
    ensureTimer = null
  }
  stopStreamWs()
  stopDisplayLoop()
  cleanupDisplayFrameState()
  started = false
}

/** 刷新相机流（重新连接 WS）。 */
export function refreshGlobalCameraStream(): void {
  stopStreamWs()
  if (running.value && connected.value) {
    connectStreamWs()
    startDisplayLoop()
  }
}

/** 获取全局相机接收器状态（用于 Vue 组件绑定）。 */
export function useGlobalCameraReceiverState() {
  return {
    frameUrl: readonly(frameUrl),
    lastError: readonly(lastError),
    connected: readonly(connected)
  }
}
