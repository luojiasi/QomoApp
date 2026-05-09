import { readonly, ref } from 'vue'
import { getBackendWsBaseUrl } from './core/baseWs'
import { useGlobalCameraReceiverState } from './camera/cameraReceiver'

interface AxisSnapshot {
  name: string
  axis_id: number
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
  timestamp: number
  error: string | null
}

const controllerState = ref<string>('DISCONNECTED')
const controllerConnected = ref(false)
const axes = ref<AxisSnapshot[]>([])
const position = ref<Record<string, number>>({})
const mposition = ref<Record<string, number>>({})
const wsConnected = ref(false)
const lastError = ref('')
const messageCount = ref(0)

const cameraReceiver = useGlobalCameraReceiverState()

let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
let started = false

function buildWsUrl(): string {
  const base = getBackendWsBaseUrl()
  return base ? `${base}/ws/motion/status` : '/ws/motion/status'
}

function clearWsReconnectTimer(): void {
  if (wsReconnectTimer !== null) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
}

function scheduleReconnect(): void {
  clearWsReconnectTimer()
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    connectWs()
  }, 1000)
}

function connectWs(): void {
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    ws.close()
    ws = null
  }

  lastError.value = ''
  wsConnected.value = false

  try {
    ws = new WebSocket(buildWsUrl())
  } catch (e: any) {
    lastError.value = e?.message ?? 'WebSocket connection failed'
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
      if ((data as any).error) {
        lastError.value = (data as any).error
        return
      }
      messageCount.value++
      controllerState.value = data.state
      controllerConnected.value = data.state !== 'DISCONNECTED'
      position.value = data.position || {}
      mposition.value = data.mposition || {}
      axes.value = data.axes || []
    } catch (e: any) {
      lastError.value = `parse error: ${e?.message ?? String(e)}`
    }
  }

  ws.onerror = () => {
    lastError.value = 'WebSocket error'
  }

  ws.onclose = () => {
    wsConnected.value = false
    controllerConnected.value = false
    ws = null
    scheduleReconnect()
  }
}








///===========================
/// ── 启动/停止 ──
///===========================

export function startHardwareMonitor(): void {
  if (started) return
  started = true
  connectWs()
}
export function stopHardwareMonitor(): void {
  started = false
  clearWsReconnectTimer()
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    ws.close()
    ws = null
  }
}
///=================================
/// ── 组件用（返回 readonly ref） ──
///=================================
export function useHardwareState() {
  return {
    controllerState: readonly(controllerState),
    controllerConnected: readonly(controllerConnected),
    wsConnected: readonly(wsConnected),
    axes: readonly(axes),
    position: readonly(position),
    mposition: readonly(mposition),
    cameraConnected: cameraReceiver.connected,
    lastError: readonly(lastError),
    messageCount: readonly(messageCount)
  }
}

///===========================
/// ── 工具方法 ──
///===========================
// 等待控制器就绪
export async function waitControllerConnected(timeoutMs = 15000, pollMs = 300): Promise<boolean> {
  const startAt = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    if (controllerConnected.value) return true
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return false
}
// 同步检查是否已连接
export function isControllerConnected(): boolean {
  return controllerConnected.value
}
// 获取当前 mpos/dpos 快照（Home.vue 算 XY 偏移用）
export function getHardwareStateSnapshot(): {
  mpos: Record<string, number>
  dpos: Record<string, number>
} {
  return {
    mpos: { ...mposition.value },
    dpos: { ...position.value }
  }
}
