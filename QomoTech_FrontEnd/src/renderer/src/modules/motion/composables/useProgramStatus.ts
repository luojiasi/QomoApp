import { ref } from 'vue'
import { getStartProgramStatusWsUrl } from '@/shared/api/wsClient'
import { getStartProgramStatus } from '../api/program'

type StartProgramStatusPayload = {
  running?: boolean
  paused?: boolean
  total_tasks?: number
  current_task_index?: number
  进度百分比?: number
}

export function useProgramStatus() {
  const programRunning = ref(false)
  const programPaused = ref(false)
  const programTaskCount = ref(0)
  const currentTaskIndex = ref(0)
  const currentTaskJindubaifenbi = ref(0)

  let programStatusWs: WebSocket | null = null
  let programStatusWsReconnectTimer: ReturnType<typeof setTimeout> | null = null
  let programStatusWsReconnectEnabled = true

  function applyStartProgramStatusPayload(data: StartProgramStatusPayload | undefined): void {
    if (!data) return
    if (typeof data.running === 'boolean') {
      programRunning.value = data.running
      programPaused.value = Boolean(data.paused)
    }
    if (typeof data.total_tasks === 'number') programTaskCount.value = Math.max(0, Math.floor(data.total_tasks))
    if (typeof data.current_task_index === 'number') {
      currentTaskIndex.value = Math.max(0, Math.floor(data.current_task_index))
    }
    if (typeof data.进度百分比 === 'number') currentTaskJindubaifenbi.value = Math.max(0, data.进度百分比)

    if (data.running === false) {
      programPaused.value = false
    }
  }

  function stopProgramStatusWebSocket(): void {
    programStatusWsReconnectEnabled = false
    if (programStatusWsReconnectTimer !== null) {
      clearTimeout(programStatusWsReconnectTimer)
      programStatusWsReconnectTimer = null
    }
    if (programStatusWs) {
      programStatusWs.onclose = null
      programStatusWs.onerror = null
      programStatusWs.onmessage = null
      programStatusWs.close()
      programStatusWs = null
    }
  }

  function scheduleProgramStatusWebSocketReconnect(): void {
    if (!programStatusWsReconnectEnabled) return
    if (programStatusWsReconnectTimer !== null) return
    programStatusWsReconnectTimer = setTimeout(() => {
      programStatusWsReconnectTimer = null
      connectProgramStatusWebSocket()
    }, 2000)
  }

  function connectProgramStatusWebSocket(): void {
    if (!programStatusWsReconnectEnabled || typeof WebSocket === 'undefined') return
    if (programStatusWs && programStatusWs.readyState === WebSocket.OPEN) return

    if (programStatusWs) {
      programStatusWs.onclose = null
      programStatusWs.onerror = null
      programStatusWs.onmessage = null
      programStatusWs.close()
      programStatusWs = null
    }

    const url = getStartProgramStatusWsUrl()
    try {
      const ws = new WebSocket(url)
      programStatusWs = ws
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string; data?: unknown }
          if (msg.type !== 'start_program_status') return
          if (!msg.data || typeof msg.data !== 'object') return
          applyStartProgramStatusPayload(msg.data as StartProgramStatusPayload)
        } catch {
          // ignore non-JSON
        }
      }
      ws.onclose = () => {
        programStatusWs = null
        scheduleProgramStatusWebSocketReconnect()
      }
      ws.onerror = () => {
        try { ws.close() } catch { /* ignore */ }
      }
    } catch {
      scheduleProgramStatusWebSocketReconnect()
    }
  }

  async function syncProgramStatusOnEnter(): Promise<void> {
    const st = await getStartProgramStatus()
    if (!st?.success) return
    const data = st.data as StartProgramStatusPayload | undefined
    applyStartProgramStatusPayload(data)
  }

  function init(): void {
    programStatusWsReconnectEnabled = true
  }

  async function initSync(): Promise<void> {
    try {
      await syncProgramStatusOnEnter()
    } catch {
      // ignore enter sync errors
    }
    connectProgramStatusWebSocket()
  }

  function cleanup(): void {
    stopProgramStatusWebSocket()
  }

  return {
    programRunning,
    programPaused,
    programTaskCount,
    currentTaskIndex,
    currentTaskJindubaifenbi,
    init,
    initSync,
    cleanup
  }
}
