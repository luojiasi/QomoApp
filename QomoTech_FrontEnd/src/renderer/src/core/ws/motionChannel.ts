/**
 * core/ws/motionChannel.ts
 *
 * 运动状态 WebSocket 通道。
 * 从 shared/api/hardware.ts 提取状态订阅逻辑。
 *
 * 职责：
 *   - 连接 /ws/motion/status
 *   - 解析 MotionStatusSnapshot JSON → reactive state
 *   - 对外提供 readonly refs
 */

import { readonly, ref } from 'vue'
import { WsClient, getMotionStatusWsUrl } from './WsClient'

// ====================================================================
// 类型
// ====================================================================

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

// ====================================================================
// 单例状态
// ====================================================================

const RECONNECT_MS = 1000

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

let started = false

const wsClient = new WsClient({
  url: getMotionStatusWsUrl,
  reconnectMs: RECONNECT_MS,
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

// ====================================================================
// 公开 API
// ====================================================================

export function startMotionChannel(): void {
  if (started) return
  started = true
  lastError.value = ''
  wsConnected.value = false
  wsClient.connect()
}

export function stopMotionChannel(): void {
  started = false
  wsClient.close()
}

/** 组件用：返回 readonly refs */
export function useMotionChannelState() {
  return {
    controllerState: readonly(controllerState),
    controllerConnected: readonly(controllerConnected),
    wsConnected: readonly(wsConnected),
    axes: readonly(axes),
    position: readonly(position),
    mposition: readonly(mposition),
    ioIn: readonly(ioIn),
    ioOut: readonly(ioOut),
    lastError: readonly(lastError),
    messageCount: readonly(messageCount)
  }
}

export async function waitControllerConnected(
  timeoutMs = 15000,
  pollMs = 300
): Promise<boolean> {
  const startAt = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    if (controllerConnected.value) return true
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return false
}

export function isControllerConnected(): boolean {
  return controllerConnected.value
}

export function getMotionStateSnapshot(): {
  mpos: Record<string, number>
  dpos: Record<string, number>
} {
  return {
    mpos: { ...mposition.value },
    dpos: { ...position.value }
  }
}
