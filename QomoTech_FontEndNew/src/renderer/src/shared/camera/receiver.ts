// =============================================================================
// Camera WebSocket 帧接收器 — 全局单例
// =============================================================================
import { readonly, ref } from 'vue'
import {
  DEFAULT_QUALITY,
  DEFAULT_TIMEOUT_MS,
  URL_CACHE_SIZE,
  WS_RECONNECT_MS,
  FRAME_QUEUE_SIZE,
  DISPLAY_INTERVAL_MIN_MS,
  DISPLAY_INTERVAL_MAX_MS,
  DISPLAY_INTERVAL_DEFAULT_MS,
  ARRIVAL_WINDOW_SIZE
} from './configDefaults'

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
let displayIntervalMs = DISPLAY_INTERVAL_DEFAULT_MS

// Adaptive timing — track when frames arrive to match display rate to source
const arrivalTimestamps: number[] = []
let lastArrivalTs = 0
let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function getWsUrl(): string {
  const base = '127.0.0.1:5000'
  return `ws://${base}/ws/camera/stream`
}

function clearReconnect() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect() {
  if (!running.value) return
  clearReconnect()
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (!running.value) return
    connectStreamWs()
  }, WS_RECONNECT_MS)
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
  displayIntervalMs = DISPLAY_INTERVAL_DEFAULT_MS
  arrivalTimestamps.length = 0
  lastArrivalTs = 0
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

  // Track arrival for adaptive display timing
  const now = performance.now()
  if (lastArrivalTs > 0) {
    const gap = now - lastArrivalTs
    arrivalTimestamps.push(gap)
    if (arrivalTimestamps.length > ARRIVAL_WINDOW_SIZE) {
      arrivalTimestamps.shift()
    }
    // Compute average inter-frame gap, clamp to min/max bounds
    const avgGap =
      arrivalTimestamps.reduce((s, v) => s + v, 0) / arrivalTimestamps.length
    // Set display interval to roughly match arrival rate (slightly faster to drain queue)
    displayIntervalMs = Math.max(
      DISPLAY_INTERVAL_MIN_MS,
      Math.min(DISPLAY_INTERVAL_MAX_MS, avgGap * 0.9)
    )
  }
  lastArrivalTs = now
}

function displayLoopTick(ts: number): void {
  if (!displayLoopActive) return

  if (loadedFrameQueue.length > 0 && ts - lastDisplayTs >= displayIntervalMs) {
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

function stopStreamWs(): void {
  clearReconnect()
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try { ws.close() } catch { /* ignore */ }
    }
    ws = null
  }
}

function connectStreamWs(): void {
  if (!running.value) return
  stopStreamWs()

  try {
    ws = new WebSocket(getWsUrl())
    ws.binaryType = 'blob'
  } catch {
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    lastError.value = ''
    ws!.send(JSON.stringify({ cmd: 'set_quality', quality: DEFAULT_QUALITY }))
    ws!.send(JSON.stringify({ cmd: 'set_timeout', timeout_ms: DEFAULT_TIMEOUT_MS }))
  }

  ws.onmessage = (ev: MessageEvent) => {
    if (!running.value) return
    if (typeof ev.data === 'string') {
      try {
        const payload = JSON.parse(ev.data) as { type?: string; message?: string }
        if (payload.type === 'error') {
          lastError.value = payload.message ?? 'camera stream error'
        }
      } catch {
        lastError.value = ev.data
      }
      return
    }

    const blob = ev.data instanceof Blob ? ev.data : new Blob([ev.data as ArrayBuffer], { type: 'image/jpeg' })
    enqueueDecodedFrame(blob)
  }

  ws.onerror = () => {
    lastError.value = 'WebSocket error'
  }

  ws.onclose = () => {
    scheduleReconnect()
  }
}

export function startCameraReceiver(): void {
  if (started) return
  started = true
  running.value = true
  connectStreamWs()
  startDisplayLoop()
}

export function stopCameraReceiver(): void {
  running.value = false
  stopStreamWs()
  stopDisplayLoop()
  cleanupDisplayFrameState()
  started = false
}

export function refreshCameraStream(): void {
  stopStreamWs()
  if (running.value) {
    connectStreamWs()
    startDisplayLoop()
  }
}

export function useCameraReceiverState() {
  return {
    frameUrl: readonly(frameUrl),
    lastError: readonly(lastError),
    connected: readonly(running)
  }
}
