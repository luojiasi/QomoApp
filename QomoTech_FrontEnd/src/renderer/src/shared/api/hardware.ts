import { readonly, ref } from 'vue'
import { getBackendWsBaseUrl } from './wsClient'
import { WsClient } from './wsClient'
import { useGlobalCameraReceiverState } from '@/modules/camera/composables/useCameraReceiver'

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
  io_in?: Record<string, boolean>
  io_out?: Record<string, boolean>
  timestamp: number
  error: string | null
}

const HARDWARE_WS_RECONNECT_MS = 1000

const controllerState = ref<string>('DISCONNECTED')
const controllerConnected = ref(false)
const axes = ref<AxisSnapshot[]>([])
const position = ref<Record<string, number>>({})
const mposition = ref<Record<string, number>>({})
const ioIn = ref<Record<string, boolean>>({})
const ioOut = ref<Record<string, boolean>>({})
const wsConnected = ref(false)
const lastError = ref('')
const messageCount = ref(0)

const cameraReceiver = useGlobalCameraReceiverState()

let started = false

function buildWsUrl(): string {
  const base = getBackendWsBaseUrl()
  return base ? `${base}/ws/motion/status` : '/ws/motion/status'
}

const wsClient = new WsClient({
  url: buildWsUrl,
  reconnectMs: HARDWARE_WS_RECONNECT_MS,
  onOpen: () => {
    wsConnected.value = true
    lastError.value = ''
  },
  onMessage: (ev: MessageEvent) => {
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
      ioIn.value = data.io_in || {}
      ioOut.value = data.io_out || {}
    } catch (e: any) {
      lastError.value = `parse error: ${e?.message ?? String(e)}`
    }
  },
  onError: (e: unknown) => {
    if (e instanceof Error) lastError.value = e.message ?? 'WebSocket error'
    else lastError.value = 'WebSocket error'
  },
  onClose: () => {
    wsConnected.value = false
    controllerConnected.value = false
  }
})

///===========================
/// ── 启动/停止 ──
///===========================

export function startHardwareMonitor(): void {
  if (started) return
  started = true
  lastError.value = ''
  wsConnected.value = false
  wsClient.connect()
}

export function stopHardwareMonitor(): void {
  started = false
  wsClient.close()
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
    ioIn: readonly(ioIn),
    ioOut: readonly(ioOut),
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
