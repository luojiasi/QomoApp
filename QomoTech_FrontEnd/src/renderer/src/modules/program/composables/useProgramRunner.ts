import { ref, computed } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useQomo5PStore } from '@/modules/editor/useQomo5PStore'
import { useHardwareState } from '@/shared/api/hardware'
import { startProgram } from '../api'
import { useProgramStatus } from './useProgramStatus'
import { useProgramControl } from './useProgramControl'
import { QomoEntityWithSurface } from '@/modules/editor/qomo5pTypes'
import { SurfaceEntity, EditorEntity } from '@/modules/entitiesEditor/commons/types'
import { exportEntitiesWithCalculated } from '@/modules/entitiesEditor/utils/entitiesWithCalculated'

type XYMotionOffset = { x: number; y: number }

const PROGRAM_STARTED_AT_STORAGE_KEY = 'qomo.startProgram.startedAtMs'

  /** 程序运行编排：配方下发、XY 偏移、运行计时、状态同步。 */
export function useProgramRunner() {
  const { error, success } = useNotification()
  const qomo5pStore = useQomo5PStore()  //旧的编辑器
  const { mposition: wsMposition } = useHardwareState()

  const programStartedAtMs = ref<number | null>(null)
  const programElapsedMs = ref(0)
  const currentRunRecipePayload = ref<Record<string, unknown> | null>(null)
  const recipeUpperOpeningMm = ref<number | null>(null)
  const homeXyOffset = ref<XYMotionOffset>({ x: 0, y: 0 })
  const runTrigger = ref(false)

  let programElapsedTimer: ReturnType<typeof setInterval> | null = null

  const {
    programRunning,
    programPaused,
    programTaskCount,
    currentTaskIndex,
    currentTaskJindubaifenbi,
    init: initStatus,
    initSync: initStatusSync,
    cleanup: cleanupStatus
  } = useProgramStatus()

  const afterEstop = () => {
    runTrigger.value = false
    currentTaskIndex.value = 0
    currentTaskJindubaifenbi.value = 0
    stopProgramElapsedTimer()
    if (programStartedAtMs.value)
      programElapsedMs.value = Math.max(0, Date.now() - programStartedAtMs.value)
    programStartedAtMs.value = null
    persistProgramStartedAtToStorage(null)
  }

  const { onPauseToggleClick, onResetAlarmsClick, onEstopClick, onSkipTaskClick } =
    useProgramControl(programRunning, programPaused, programTaskCount, afterEstop)

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
      if (ms === null)
        window.localStorage.removeItem(PROGRAM_STARTED_AT_STORAGE_KEY)
      else
        window.localStorage.setItem(
          PROGRAM_STARTED_AT_STORAGE_KEY,
          String(Math.floor(ms))
        )
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

  function 根据当前轴位置计算实体偏移(entities: SurfaceEntity<EditorEntity>[], dx: number, dy: number): SurfaceEntity<EditorEntity>[] {
    return entities.map((entity) => {
      const k = entity.kind
      if (k === 'LINE') {
        return {
          ...entity,
          start: { X: entity.start.X + dx, Y: entity.start.Y + dy },
          end: { X: entity.end.X + dx, Y: entity.end.Y + dy }
        }
      }
      if (k === 'ARC') {
        return {
          ...entity,
          center: { X: entity.center.X + dx, Y: entity.center.Y + dy },
          ...(entity.startPoint ? { startPoint: { X: entity.startPoint.X + dx, Y: entity.startPoint.Y + dy } } : {}),
          ...(entity.endPoint ? { endPoint: { X: entity.endPoint.X + dx, Y: entity.endPoint.Y + dy } } : {})
        }
      }
      if (k === 'CIRCLE') {
        return {
          ...entity,
          center: { X: entity.center.X + dx, Y: entity.center.Y + dy }
        }
      }
      if (k === 'ELLIPSE') {
        return {
          ...entity,
          center: { X: entity.center.X + dx, Y: entity.center.Y + dy },
          majorAxisEnd: { X: entity.majorAxisEnd.X + dx, Y: entity.majorAxisEnd.Y + dy }
        }
      }
      if (k === 'POLYLINE') {
        return {
          ...entity,
          vertices: entity.vertices.map(v => ({
            ...v,
            point: { X: v.point.X + dx, Y: v.point.Y + dy }
          }))
        }
      }
      if (k === 'BEZIER') {
        return {
          ...entity,
          controlPoints: entity.controlPoints.map(p => ({ X: p.X + dx, Y: p.Y + dy }))
        }
      }
      if (k === 'DIAMOND') {
        return {
          ...entity,
          center: { X: entity.center.X + dx, Y: entity.center.Y + dy },
          ...(entity.contours
            ? { contours: entity.contours.map(ring => ring.map(v => ({ ...v, point: { X: v.point.X + dx, Y: v.point.Y + dy } }))) }
            : {})
        }
      }
      return entity
    })
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

  async function onRunClick(): Promise<void> {
    if (!currentRunRecipePayload.value) {
      error('运行失败：当前没有可下发的配方，请先选择有效主配方。')
      return
    }
    if (programRunning.value) return

    try {
      const xyOffset = resolveXYMotionOffsetFromHardwareState()
      homeXyOffset.value = xyOffset
      runTrigger.value = true
      const offsetEntities = offsetEntitiesByXYMpos(qomo5pStore.exportEntitiesToHomeVue(), xyOffset.x, xyOffset.y)

      const payload = {
        recipe_payload: currentRunRecipePayload.value,
        entities: offsetEntities
      }
      const offsetEditorEntities = 根据当前轴位置计算实体偏移(exportEntitiesWithCalculated(), xyOffset.x, xyOffset.y)
      const editorPayload = {
        recipe_payload: currentRunRecipePayload.value,
        entities: offsetEditorEntities
      }

      const result = await startProgram(editorPayload)
      if (!result?.success) {
        error(result?.message || '运行失败：后端为提供失败参数。')
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

  function init(): void {
    initStatus()
  }

  async function initSync(): Promise<void> {
    await initStatusSync()
    const storedMs = loadProgramStartedAtFromStorage()
    if (storedMs && programRunning.value) {
      programStartedAtMs.value = storedMs
      startProgramElapsedTimer()
    }
  }

  function cleanup(): void {
    cleanupStatus()
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
