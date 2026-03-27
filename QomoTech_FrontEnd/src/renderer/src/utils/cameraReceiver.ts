import { readonly, ref } from 'vue'
import { getBackendApiUrl, getCameraStreamWsUrl } from './toBackendApiCall'
import { initSdkEnumAndConnectIndex0 } from './cameraApi'

const frameUrl = ref('')
const running = ref(false)
const lastError = ref('')
const connected = ref(false)

let started = false
let connecting = false
let ensureTimer: ReturnType<typeof setInterval> | null = null
let displayLoopActive = false
let displayRafId: number | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
let ws: WebSocket | null = null
let frameDecodeBusy = false
let pendingDecodeBlob: Blob | null = null

const DEFAULT_TIMEOUT_MS = 1200
const DEFAULT_QUALITY = 85
const TARGET_DISPLAY_FPS = 60
const DISPLAY_FRAME_INTERVAL_MS = Math.floor(1000 / TARGET_DISPLAY_FPS)
const WS_RECONNECT_MS = 120
const FRAME_QUEUE_SIZE = 3
const URL_CACHE_SIZE = 3

const loadedFrameQueue: string[] = []
const staleFrameUrlCache: string[] = []
let currentFrameObjectUrl = ''
let lastDisplayTs = 0

async function ensureCameraConnected(): Promise<void> {
  if (connecting) return
  connecting = true
  try {
    const statusResp = await fetch(getBackendApiUrl('camera/status'), { method: 'GET' })
    if (statusResp.ok) {
      const statusJson = (await statusResp.json()) as { success?: boolean; data?: { connected?: boolean } }
      if (statusJson?.success && statusJson.data?.connected) {
        connected.value = true
        lastError.value = ''
        return
      }
    }
    connected.value = false

    const connectRes = await initSdkEnumAndConnectIndex0()
    if (!connectRes.success) {
      lastError.value = connectRes.message ?? 'camera connect failed'
      connected.value = false
      return
    }
  //   connected.value = true
  //   lastError.value = ''
  // } catch (e) {
  //   connected.value = false
  //   lastError.value = e instanceof Error ? e.message : 'camera connect failed'
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

function clearWsReconnectTimer(): void {
  if (wsReconnectTimer === null) return
  clearTimeout(wsReconnectTimer)
  wsReconnectTimer = null
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

function stopStreamWs(): void {
  clearWsReconnectTimer()
  if (ws !== null) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    ws.close()
    ws = null
  }
  frameDecodeBusy = false
  pendingDecodeBlob = null
}

function isWsOpen(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN
}

function enqueueFrameObjectUrl(url: string): void {
  loadedFrameQueue.push(url)
  while (loadedFrameQueue.length > FRAME_QUEUE_SIZE) {
    const dropped = loadedFrameQueue.shift()
    if (dropped) URL.revokeObjectURL(dropped)
  }
}

function enqueueDecodedFrame(blob: Blob): void {
  pendingDecodeBlob = blob
  if (frameDecodeBusy) return

  const processOne = () => {
    if (!pendingDecodeBlob) {
      frameDecodeBusy = false
      return
    }
    frameDecodeBusy = true
    const nextBlob = pendingDecodeBlob
    pendingDecodeBlob = null

    const objectUrl = URL.createObjectURL(nextBlob)
    const probe = new Image()
    probe.onload = () => {
      probe.onload = null
      probe.onerror = null
      enqueueFrameObjectUrl(objectUrl)
      processOne()
    }
    probe.onerror = () => {
      probe.onload = null
      probe.onerror = null
      URL.revokeObjectURL(objectUrl)
      lastError.value = 'invalid jpeg frame'
      processOne()
    }
    probe.src = objectUrl
  }

  processOne()
}

function scheduleWsReconnect(delayMs: number): void {
  if (!running.value || !connected.value) return
  if (isWsOpen()) return
  clearWsReconnectTimer()
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    connectStreamWs()
  }, delayMs)
}

function buildWsUrl(): string {
  const wsUrl = new URL(getCameraStreamWsUrl(), window.location.href)
  wsUrl.searchParams.set('timeout_ms', String(DEFAULT_TIMEOUT_MS))
  wsUrl.searchParams.set('quality', String(DEFAULT_QUALITY))
  return wsUrl.toString()
}

function connectStreamWs(): void {
  if (!running.value || !connected.value) return
  if (ws !== null && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  try {
    ws = new WebSocket(buildWsUrl())
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : 'websocket connect failed'
    scheduleWsReconnect(WS_RECONNECT_MS)
    return
  }

  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    lastError.value = ''
  }

  ws.onmessage = (evt: MessageEvent<ArrayBuffer | Blob | string>) => {
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

    const blob = evt.data instanceof Blob ? evt.data : new Blob([evt.data], { type: 'image/jpeg' })
    enqueueDecodedFrame(blob)
  }

  ws.onerror = () => {
    lastError.value = 'websocket stream error'
  }

  ws.onclose = () => {
    ws = null
    if (running.value && connected.value) {
      scheduleWsReconnect(WS_RECONNECT_MS)
    }
  }
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
  }, 2000)
}

export function refreshGlobalCameraStream(): void {
  if (!started) return
  if (!running.value || !connected.value) return
  connectStreamWs()
}

export function useGlobalCameraReceiverState() {
  return {
    frameUrl: readonly(frameUrl),
    running: readonly(running),
    connected: readonly(connected),
    lastError: readonly(lastError)
  }
}
