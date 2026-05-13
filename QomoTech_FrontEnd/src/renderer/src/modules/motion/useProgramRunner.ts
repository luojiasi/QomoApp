import { ref, computed } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useQomo5PStore } from '@/modules/editor/useQomo5PStore'
import { useHardwareState } from '@/shared/api/hardware'
import { getStartProgramStatusWsUrl } from '@/shared/api/wsClient'
import {
  startProgram,
  getStartProgramStatus,
  startProgramControl
} from '@/modules/motion'
import type { QomoEntityWithSurface } from '@/modules/editor/qomo5pTypes'

type StartProgramStatusPayload = {
  running?: boolean
  paused?: boolean
  total_tasks?: number
  current_task_index?: number
  进度百分比?: number
}

type XYMotionOffset = { x: number; y: number }

const PROGRAM_STARTED_AT_STORAGE_KEY = 'qomo.startProgram.startedAtMs'

export function useProgramRunner() {
  const { error, success } = useNotification()
  const qomo5pStore = useQomo5PStore()
  const { mposition: wsMposition } = useHardwareState()

  const programRunning = ref(false)
  const programPaused = ref(false)
  const programTaskCount = ref(0)
  const currentTaskIndex = ref(0)
  const currentTaskJindubaifenbi = ref(0)
  const programStartedAtMs = ref<number | null>(null)
  const programElapsedMs = ref(0)
  const currentRunRecipePayload = ref<Record<string, unknown> | null>(null)
  const recipeUpperOpeningMm = ref<number | null>(null)
  const homeXyOffset = ref<XYMotionOffset>({ x: 0, y: 0 })
  const runTrigger = ref(false)

  let programElapsedTimer: ReturnType<typeof setInterval> | null = null
  let programStatusWs: WebSocket | null = null
  let programStatusWsReconnectTimer: ReturnType<typeof setTimeout> | null = null
  let programStatusWsReconnectEnabled = true

  function formatElapsedMs(ms: number): string {
    const safe = Math.max(0, Math.floor(ms))
    const totalSeconds = Math.floor(safe / 1000)
    const hh = Math.floor(totalSeconds / 3600)
    const mm = Math.floor((totalSeconds % 3600) / 60)
    const ss = totalSeconds % 60
    const pad2 = (n: number) => String(n).padStart(2, '0')
    return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`
  }

  const programElapsedText = computed(() => formatElapsedMs(programElapsedMs.value))

  function handleRunRecipeChange(payload: Record<string, unknown> | null): void {
    currentRunRecipePayload.value = payload
  }

  function handleUpperOpeningChange(mm: number | null): void {
    recipeUpperOpeningMm.value = mm
  }

  function loadProgramStartedAtFromStorage(): number | null {
    try {
      const raw = window.localStorage.getItem(PROGRAM_STARTED_AT_STORAGE_KEY)
      if (!raw) return null
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
    } catch {
      return null
    }
  }

  function persistProgramStartedAtToStorage(ms: number | null): void {
    try {
      if (ms === null) window.localStorage.removeItem(PROGRAM_STARTED_AT_STORAGE_KEY)
      else window.localStorage.setItem(PROGRAM_STARTED_AT_STORAGE_KEY, String(Math.floor(ms)))
    } catch {
      // ignore storage errors
    }
  }

  function stopProgramElapsedTimer(): void {
    if (programElapsedTimer !== null) {
      clearInterval(programElapsedTimer)
      programElapsedTimer = null
    }
  }

  function startProgramElapsedTimer(): void {
    stopProgramElapsedTimer()
    programElapsedTimer = setInterval(() => {
      if (!programRunning.value || !programStartedAtMs.value) return
      programElapsedMs.value = Date.now() - programStartedAtMs.value
    }, 1000)
    if (programRunning.value && programStartedAtMs.value) {
      programElapsedMs.value = Date.now() - programStartedAtMs.value
    }
  }

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
      stopProgramElapsedTimer()
      if (programStartedAtMs.value) programElapsedMs.value = Math.max(0, Date.now() - programStartedAtMs.value)
      programStartedAtMs.value = null
      persistProgramStartedAtToStorage(null)
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

    if (data?.running === true) {
      const persisted = loadProgramStartedAtFromStorage()
      if (persisted) {
        programStartedAtMs.value = persisted
      } else {
        programStartedAtMs.value = Date.now()
        persistProgramStartedAtToStorage(programStartedAtMs.value)
      }
      startProgramElapsedTimer()
    }
  }

  function resolveXYMotionOffsetFromHardwareState(): XYMotionOffset {
    const positions = wsMposition.value
    const rawX = positions?.X ?? positions?.x ?? positions?.['0']
    const rawY = positions?.Y ?? positions?.y ?? positions?.['1']
    const x = Number(rawX)
    const y = Number(rawY)
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0
    }
  }

  function offsetEntitiesByXYMpos(entities: QomoEntityWithSurface[], dx: number, dy: number): QomoEntityWithSurface[] {
    return entities.map((entity) => {
      if (entity.type === 'LINE') {
        return {
          ...entity,
          start: { x: entity.start.x + dx, y: entity.start.y + dy },
          end: { x: entity.end.x + dx, y: entity.end.y + dy }
        }
      }
      if (entity.type === 'BEZIER') {
        return {
          ...entity,
          points: entity.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
        }
      }
      if (entity.type === 'ARC') {
        return {
          ...entity,
          center: { x: entity.center.x + dx, y: entity.center.y + dy },
          ...(entity.startPoint
            ? { startPoint: { x: entity.startPoint.x + dx, y: entity.startPoint.y + dy } }
            : {}),
          ...(entity.endPoint
            ? { endPoint: { x: entity.endPoint.x + dx, y: entity.endPoint.y + dy } }
            : {})
        }
      }
      return {
        ...entity,
        center: { x: entity.center.x + dx, y: entity.center.y + dy }
      }
    })
  }

  async function onRunClick(): Promise<void> {
    if (!currentRunRecipePayload.value) {
      error('运行失败：当前没有可下发的配方，请先选择有效主配方。')
      return
    }
    if (programRunning.value) return

    try {
      const entities = qomo5pStore.exportEntitiesToHomeVue()
      const xyOffset = resolveXYMotionOffsetFromHardwareState()
      homeXyOffset.value = xyOffset
      runTrigger.value = true
      const offsetEntities = offsetEntitiesByXYMpos(entities, xyOffset.x, xyOffset.y)
      const payload = {
        recipe_payload: currentRunRecipePayload.value,
        entities: offsetEntities
      }

      const result = await startProgram(payload)
      if (!result?.success) {
        error(result?.message || '运行失败：后端未接受配方。')
        return
      }
      const data = result?.data as { task_count?: number } | undefined
      const tc = typeof data?.task_count === 'number' ? data.task_count : 0
      programTaskCount.value = tc
      programRunning.value = true
      programPaused.value = false
      programStartedAtMs.value = Date.now()
      programElapsedMs.value = 0
      persistProgramStartedAtToStorage(programStartedAtMs.value)
      startProgramElapsedTimer()
      success(result?.message || '运行指令已发送。')
    } catch {
      error('运行失败：无法连接后端。')
    }
  }

  async function onPauseToggleClick(): Promise<void> {
    if (!programRunning.value) {
      error('当前没有运行中的程序。')
      return
    }
    const action = programPaused.value ? 'resume' : 'pause'
    const r = await startProgramControl(action)
    if (!r?.success) {
      error(r?.message || '暂停/继续操作失败。')
      return
    }
    success(r?.message || '已执行。')
  }

  async function onResetAlarmsClick(): Promise<void> {
    const r = await startProgramControl('reset')
    if (!r?.success) {
      error(r?.message || '复位清除报警失败。')
      return
    }
    success(r?.message || '报警已清除。')
  }

  async function onEstopClick(): Promise<void> {
    const r = await startProgramControl('estop')
    if (!r?.success) {
      error(r?.message || '急停指令失败。')
      return
    }
    success(r?.message || '已急停。')
    runTrigger.value = false
    programRunning.value = false
    programPaused.value = false
    currentTaskIndex.value = 0
    currentTaskJindubaifenbi.value = 0
    stopProgramElapsedTimer()
    if (programStartedAtMs.value) programElapsedMs.value = Math.max(0, Date.now() - programStartedAtMs.value)
    programStartedAtMs.value = null
    persistProgramStartedAtToStorage(null)
  }

  async function onSkipTaskClick(): Promise<void> {
    if (programTaskCount.value < 2) return
    const r = await startProgramControl('skip')
    if (!r?.success) {
      error(r?.message || '跳过当前任务失败。')
      return
    }
    success(r?.message || '已请求跳过。')
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
    stopProgramElapsedTimer()
  }

  return {
    programRunning,
    programPaused,
    programTaskCount,
    currentTaskIndex,
    currentTaskJindubaifenbi,
    programElapsedText,
    currentRunRecipePayload,
    recipeUpperOpeningMm,
    homeXyOffset,
    runTrigger,
    handleRunRecipeChange,
    handleUpperOpeningChange,
    onRunClick,
    onPauseToggleClick,
    onResetAlarmsClick,
    onEstopClick,
    onSkipTaskClick,
    init,
    initSync,
    cleanup
  }
}
