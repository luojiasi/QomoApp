// =============================================================================
// Motion 硬件状态 — WebSocket 客户端 + 响应式 refs
// =============================================================================
import { readonly, ref } from 'vue'

interface AxisSnapshot {
  name: string
  axis_no: number
  dpos: number
  mpos: number
  idle: boolean
  alarm_code: number
  enabled: boolean
}

interface MotionStatusSnapshot {
  state: string
  position: Record<string, number>
  mposition: Record<string, number>
  idle: Record<string, boolean>
  alarms: Record<string, number>
  enabled: Record<string, boolean>
  axes: AxisSnapshot[]
  io_in?: Record<string, boolean>
  io_out?: Record<string, boolean>
  timestamp: number
  error: string | null
}

const RECONNECT_MS = 1000

const controllerState = ref<string>('DISCONNECTED')
const controllerConnected = ref(false)
const axes = ref<AxisSnapshot[]>([])
const axisIdle = ref<Record<string, boolean>>({})
const position = ref<Record<string, number>>({})
const mposition = ref<Record<string, number>>({})
const ioIn = ref<Record<string, boolean>>({})
const ioOut = ref<Record<string, boolean>>({})
const wsConnected = ref(false)
const lastError = ref('')

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let active = false

function getWsUrl(): string {
  const base = '127.0.0.1:5000'
  return `ws://${base}/ws/motion/status`
}

function clearReconnect() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect() {
  if (!active) return
  clearReconnect()
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (!active) return
    openSocket()
  }, RECONNECT_MS)
}

function openSocket() {
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    try { ws.close() } catch { /* ignore */ }
    ws = null
  }

  try {
    ws = new WebSocket(getWsUrl())
  } catch {
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    wsConnected.value = true
    lastError.value = ''
  }

  ws.onmessage = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data) as MotionStatusSnapshot
      if ((data as Record<string, unknown>).error) {
        lastError.value = String((data as Record<string, unknown>).error)
        return
      }
      controllerState.value = data.state
      controllerConnected.value = data.state !== 'DISCONNECTED'
      position.value = data.position || {}
      mposition.value = data.mposition || {}
      axisIdle.value = data.idle || {}
      axes.value = data.axes || []
      ioIn.value = data.io_in || {}
      ioOut.value = data.io_out || {}
    } catch (e: unknown) {
      lastError.value = `parse error: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  ws.onerror = () => {
    lastError.value = 'WebSocket error'
  }

  ws.onclose = () => {
    if (ws === null) return
    wsConnected.value = false
    controllerConnected.value = false
    scheduleReconnect()
  }
}

export function startHardwareMonitor(): void {
  if (active) return
  active = true
  lastError.value = ''
  wsConnected.value = false
  openSocket()
}

export function stopHardwareMonitor(): void {
  active = false
  clearReconnect()
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    try { ws.close() } catch { /* ignore */ }
    ws = null
  }
  wsConnected.value = false
  controllerConnected.value = false
}

export function useHardwareState() {
  return {
    controllerState: readonly(controllerState),
    controllerConnected: readonly(controllerConnected),
    wsConnected: readonly(wsConnected),
    axes: readonly(axes),
    axisIdle: readonly(axisIdle),
    position: readonly(position),
    mposition: readonly(mposition),
    ioIn: readonly(ioIn),
    ioOut: readonly(ioOut),
    lastError: readonly(lastError)
  }
}
