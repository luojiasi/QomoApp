import { readonly, ref } from 'vue'
import { getBackendApiUrl } from '../core/base'
import { getCameraStreamWsUrl } from '../core/baseWs'
import { bootstrapCameraSettings, initSdkEnumAndConnectIndex0 } from './camera'
import type { CameraSettingsState } from '../../types/settings'

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

const DEFAULT_TIMEOUT_MS = 1200
const DEFAULT_QUALITY = 50
const TARGET_DISPLAY_FPS = 120
const DISPLAY_FRAME_INTERVAL_MS = Math.floor(1000 / TARGET_DISPLAY_FPS)
const WS_RECONNECT_MS = 120
import { CAMERA_SETTINGS_STORAGE_KEY } from '../../configs/storageKeys'

const FRAME_QUEUE_SIZE = 3

const loadedFrameQueue: string[] = []
const staleFrameUrlCache: string[] = []
let currentFrameObjectUrl = ''
let lastDisplayTs = 0

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function loadCameraSettingsFromLocalStorage(): CameraSettingsState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CAMERA_SETTINGS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CameraSettingsState>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      cameraIndex: clampInt(parsed.cameraIndex, 0, 5, 0),
      autoExposure: typeof parsed.autoExposure === 'boolean' ? parsed.autoExposure : true,
      exposureTime: clampInt(parsed.exposureTime, 0, 65535, 1000),
      frameSpeedLevel: clampInt(parsed.frameSpeedLevel, 0, 3, 1) as 0 | 1 | 2 | 3,
      frameSpeedAutoTune: typeof parsed.frameSpeedAutoTune === 'boolean' ? parsed.frameSpeedAutoTune : true,
      frameSpeedTune: clampFloat(parsed.frameSpeedTune, 0, 1, 1),
      mirrorHorizontal: typeof parsed.mirrorHorizontal === 'boolean' ? parsed.mirrorHorizontal : true,
      mirrorVertical: typeof parsed.mirrorVertical === 'boolean' ? parsed.mirrorVertical : true,
      autoWhiteBalance: typeof parsed.autoWhiteBalance === 'boolean' ? parsed.autoWhiteBalance : true,
      whiteBalanceRGain: clampInt(parsed.whiteBalanceRGain, 0, 65535, 21),
      whiteBalanceGGain: clampInt(parsed.whiteBalanceGGain, 0, 65535, 22),
      whiteBalanceBGain: clampInt(parsed.whiteBalanceBGain, 0, 65535, 16),
      frameTimeoutMs: clampInt(parsed.frameTimeoutMs, 1, 10000, 1000),
      frameQuality: clampInt(parsed.frameQuality, 1, 100, 90)
    }
  } catch {
    return null
  }
}

async function pushLocalCameraSettingsBeforeConnect(): Promise<void> {
  const settings = loadCameraSettingsFromLocalStorage()
  if (!settings) return
  const res = await bootstrapCameraSettings({
    auto_exposure: settings.autoExposure,
    exposure_time: settings.exposureTime,
    speed_level: settings.frameSpeedLevel,
    auto_tune: settings.frameSpeedAutoTune,
    tune: settings.frameSpeedTune,
    mirror_horizontal: settings.mirrorHorizontal,
    mirror_vertical: settings.mirrorVertical,
    auto_white_balance: settings.autoWhiteBalance,
    r_gain: settings.whiteBalanceRGain,
    g_gain: settings.whiteBalanceGGain,
    b_gain: settings.whiteBalanceBGain,
  })
  if (!res.success) { lastError.value = res.message ?? '同步相机本地参数失败' }
}

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
    await pushLocalCameraSettingsBeforeConnect()

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
  const objectUrl = URL.createObjectURL(blob)
  enqueueFrameObjectUrl(objectUrl)
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
  return getCameraStreamWsUrl()
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

  ws.binaryType = 'blob'

  ws.onopen = () => {
    lastError.value = ''
    // 新后端不读 URL query 参数，需通过 WS JSON 指令设置推流参数
    ws?.send(JSON.stringify({ cmd: 'set_quality', quality: DEFAULT_QUALITY }))
    ws?.send(JSON.stringify({ cmd: 'set_timeout', timeout_ms: DEFAULT_TIMEOUT_MS }))
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

    const blob =
      evt.data instanceof Blob ? evt.data : new Blob([evt.data as ArrayBuffer], { type: 'image/jpeg' })
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
      connectStreamWs()  // WS 推流
      startDisplayLoop() // 显示循环
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
