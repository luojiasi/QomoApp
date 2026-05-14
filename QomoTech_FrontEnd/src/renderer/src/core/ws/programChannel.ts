/**
 * core/ws/programChannel.ts
 *
 * 程序执行状态 WebSocket 通道。
 * 从 modules/motion/composables/program/useProgramStatus.ts 提取。
 *
 * 职责：
 *   - 连接 /ws/program/status
 *   - 解析程序运行状态 JSON → reactive state
 *   - 对外提供 readonly refs
 */

import { readonly, ref } from 'vue'
import { WsClient, getProgramStatusWsUrl } from './WsClient'

// ====================================================================
// 类型
// ====================================================================

type StartProgramStatusPayload = {
  running?: boolean
  paused?: boolean
  total_tasks?: number
  current_task_index?: number
  进度百分比?: number
}

// ====================================================================
// 单例状态
// ====================================================================

const RECONNECT_MS = 2000

const programRunning = ref(false)
const programPaused = ref(false)
const programTaskCount = ref(0)
const currentTaskIndex = ref(0)
const currentTaskJindubaifenbi = ref(0)
const wsConnected = ref(false)
const lastError = ref('')

let started = false

function applyStatusPayload(data: StartProgramStatusPayload | undefined): void {
  if (!data) return
  if (typeof data.running === 'boolean') {
    programRunning.value = data.running
    programPaused.value = Boolean(data.paused)
  }
  if (typeof data.total_tasks === 'number')
    programTaskCount.value = Math.max(0, Math.floor(data.total_tasks))
  if (typeof data.current_task_index === 'number')
    currentTaskIndex.value = Math.max(0, Math.floor(data.current_task_index))
  if (typeof data.进度百分比 === 'number')
    currentTaskJindubaifenbi.value = Math.max(0, data.进度百分比)

  if (data.running === false) {
    programPaused.value = false
  }
}

const wsClient = new WsClient({
  url: getProgramStatusWsUrl,
  reconnectMs: RECONNECT_MS,
  onOpen: () => {
    wsConnected.value = true
    lastError.value = ''
  },
  onMessage: (ev: MessageEvent) => {
    try {
      const msg = JSON.parse(String(ev.data)) as { type?: string; data?: unknown }
      if (msg.type !== 'start_program_status') return
      if (!msg.data || typeof msg.data !== 'object') return
      applyStatusPayload(msg.data as StartProgramStatusPayload)
    } catch (e: any) {
      lastError.value = `program status parse error: ${e?.message ?? String(e)}`
    }
  },
  onError: (e: unknown) => {
    lastError.value =
      e instanceof Error ? e.message ?? 'program WS error' : 'program WS error'
  },
  onClose: () => {
    wsConnected.value = false
  }
})

// ====================================================================
// 公开 API
// ====================================================================

export function startProgramChannel(): void {
  if (started) return
  started = true
  wsClient.connect()
}

export function stopProgramChannel(): void {
  started = false
  wsClient.close()
  // 重置状态
  programRunning.value = false
  programPaused.value = false
  programTaskCount.value = 0
  currentTaskIndex.value = 0
  currentTaskJindubaifenbi.value = 0
}

export function useProgramChannelState() {
  return {
    programRunning: readonly(programRunning),
    programPaused: readonly(programPaused),
    programTaskCount: readonly(programTaskCount),
    currentTaskIndex: readonly(currentTaskIndex),
    currentTaskJindubaifenbi: readonly(currentTaskJindubaifenbi),
    wsConnected: readonly(wsConnected),
    lastError: readonly(lastError)
  }
}
