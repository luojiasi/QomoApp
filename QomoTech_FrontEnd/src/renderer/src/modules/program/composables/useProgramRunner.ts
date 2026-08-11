import { ref, computed } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'

import { useHardwareState } from '@/shared/api/hardware'
import { startProgram, startProgram4PTest } from '../api'
import { useProgramStatus } from './useProgramStatus'
import { useProgramControl } from './useProgramControl'
// 旧版 editor
import { useQomo5PStore } from '@/modules/editor/useQomo5PStore'
import type { QomoEntityWithSurface } from '@/modules/editor/qomo5pTypes'
import {
  invertShowImageOffsetX,
  invertShowImageOffsetY,
  resetShowImageOffset,
  showImageOffsetX,
  showImageOffsetY,
  showImageWithAxisOffsetX,
  showImageWithAxisOffsetY
} from '@/modules/editor/showImageOffset'
import { usePositionTable } from '@/shared/composables/usePositionTable'
// 新版 entitiesEditor
import type { EditorEntity, SurfaceEntity } from '@/modules/entitiesEditor/commons/types'
import { exportEntitiesWithCalculated } from '@/modules/entitiesEditor/utils/entitiesWithCalculated'

import { useShow4PTable } from '@/modules/motion/panels/useShow4PTable'
import type { ApiCallResult } from '@/shared/api/httpClient'

type XYMotionOffset = { x: number; y: number }

const PROGRAM_STARTED_AT_STORAGE_KEY = 'qomo.startProgram.startedAtMs'

  /** 程序运行编排：配方下发、XY 偏移、运行计时、状态同步。 */
export function useProgramRunner() {
  const { error, success } = useNotification()
  const qomo5pStore = useQomo5PStore()
  const { mposition: wsMposition } = useHardwareState()
  const { enabledRows, chooseOptionsTypes } = usePositionTable()

  const {
    dialogVisible: show4PDialogVisible,
    isAcquiring: show4PIsAcquiring,
    positioningCount: show4PPositioningCount,
    currentPositioningIndex: show4PCurrentPositioningIndex,
    currentTablePosition: show4PTablePosition,
    currentCenterPosition: show4PCenterPosition,
    tablePositions: show4PTablePositions,
    centerPositions: show4PCenterPositions,
    isCurrentCenterAcquired: show4PIsCurrentCenterAcquired,
    isCurrentTableAcquired: show4PIsCurrentTableAcquired,
    allAcquired: show4PAllAcquired,
    acquireCenterPosition: show4PAcquireCenter,
    acquireTablePosition: show4PAcquireTable,
    goToNextPosition: show4PNextPosition,
    goToPrevPosition: show4PPrevPosition,
    // openDialog: show4POpenDialog,
    closeDialog: show4PCloseDialog,
    buildPayload: show4PBuildPayload,
    resolveXYOffsetFromHardware: show4PResolveXYOffset
  } = useShow4PTable()

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
    programRunning.value = false
    programPaused.value = false
    programTaskCount.value = 0
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

  /** 根据实体来源判断应该走哪条运行路径，返回 null 表示无法运行。 */
  function detectEntitySource(): 'qomo5p' | 'entitiesEditor' | null {
    const qomo5pEntities = qomo5pStore.exportEntitiesToHomeVue()  // 旧编辑器
    const editorEntities = exportEntitiesWithCalculated()         // 新编辑器 (entitiesEditor)
    const hasQomo5p = qomo5pEntities.length > 0
    const hasEditor = editorEntities.length > 0

    if (hasQomo5p && hasEditor) {
      error('运行失败：Qomo5P 编辑器和Qomo5PN 编辑器中同时存在实体，请只保留其中一个编辑器的内容后再运行。')
      return null
    }
    if (hasQomo5p) return 'qomo5p'
    if (hasEditor) return 'entitiesEditor'

    error('运行失败：两个编辑器中都没有实体，请先创建或导入图形。')
    return null
  }

  async function onRunClick(): Promise<void> {
    if (!currentRunRecipePayload.value) {
      error('运行失败：当前没有可下发的配方，请先选择有效主配方。')
      return
    }

    const source = detectEntitySource()
    if (!source) return

    if (chooseOptionsTypes.value === 'matrix-process') {
      await runMatrixProcess()
      return
    }else{
      if (source === 'qomo5p') {
        await runQomo5P()
      } else {
        await runEntitiesEditor()
      }
    }


  }

  async function runMatrixProcess(): Promise<void> {
    const positions = enabledRows.value
    if (positions.length === 0) {
      error('运行失败：矩阵加工模式下至少需要一个启用点位。')
      return
    }

    const source = detectEntitySource()
    if (!source) return

    try {
      runTrigger.value = true

      if (source === 'qomo5p') {
        const rawEntities = qomo5pStore.exportEntitiesToHomeVue()
        const allOffsetEntities: QomoEntityWithSurface[] = []

        for (const pos of positions) {
          const offsetEntity = offsetEntitiesByXYMpos(rawEntities, pos.x, pos.y)
          allOffsetEntities.push(...offsetEntity)
        }

        // const payload = {
        //   recipe_payload: currentRunRecipePayload.value,
        //   entities: allOffsetEntities,
        //   stop_percents: positions.map((p) => p.stopPercent)
        // }
        const payload = {
          recipe_payload: currentRunRecipePayload.value,
          entities: allOffsetEntities,
        }
        const result = await startProgram(payload)
        applyRunResult(result)
      }
    } catch {
      error('运行失败：无法连接后端。')
    }
  }

  async function runQomo5P(): Promise<void> {
    try {
      const xyOffset = resolveXYMotionOffsetFromHardwareState()
      // Shift 只挪图
      const imageOnlyX = showImageOffsetX.value
      const imageOnlyY = showImageOffsetY.value
      // Shift+Ctrl 挪图且动轴
      const imageWithAxisX = showImageWithAxisOffsetX.value
      const imageWithAxisY = showImageWithAxisOffsetY.value
      const signX = invertShowImageOffsetX.value ? -1 : 1
      const signY = invertShowImageOffsetY.value ? -1 : 1
      xyOffset.x += (imageOnlyX + imageWithAxisX) * signX
      xyOffset.y += (imageOnlyY + imageWithAxisY) * signY
      homeXyOffset.value = xyOffset
      runTrigger.value = true
      // 两套展示偏移已并入 xyOffset，清零以免叠加层重复平移
      resetShowImageOffset()
      const offsetEntities = offsetEntitiesByXYMpos(qomo5pStore.exportEntitiesToHomeVue(), xyOffset.x, xyOffset.y)
      const payload = {
        recipe_payload: currentRunRecipePayload.value,
        entities: offsetEntities
      }
      const result = await startProgram(payload)
      applyRunResult(result)
    } catch {
      error('运行失败：无法连接后端。')
    }
  }

  async function runEntitiesEditor(): Promise<void> {
    try {
      const xyOffset = resolveXYMotionOffsetFromHardwareState()
      homeXyOffset.value = xyOffset
      runTrigger.value = true
      const rawEntities = exportEntitiesWithCalculated()
      const offsetEditorEntities = offsetEditorEntitiesByXY(rawEntities, xyOffset.x, xyOffset.y)
      const payload = {
        recipe_payload: currentRunRecipePayload.value,
        entities: offsetEditorEntities
      }
      const result = await startProgram4PTest(payload)
      applyRunResult(result)
    } catch {
      error('运行失败：无法连接后端。')
    }
  }

  function applyRunResult(result: ApiCallResult<Record<string, unknown>>): void {
    if (!result?.success) {
      error(result?.message || '运行失败：后端未提供失败原因。')
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
  }

  /** 对自由编辑器的实体按 XY 轴当前位置进行偏移（{ X, Y } 坐标系）。 */
  function offsetEditorEntitiesByXY(
    entities: SurfaceEntity<EditorEntity>[],
    dx: number,
    dy: number
  ): SurfaceEntity<EditorEntity>[] {
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
          ...(entity.startPoint
            ? { startPoint: { X: entity.startPoint.X + dx, Y: entity.startPoint.Y + dy } }
            : {}),
          ...(entity.endPoint
            ? { endPoint: { X: entity.endPoint.X + dx, Y: entity.endPoint.Y + dy } }
            : {})
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
          vertices: entity.vertices.map((v) => ({
            ...v,
            point: { X: v.point.X + dx, Y: v.point.Y + dy }
          }))
        }
      }
      if (k === 'BEZIER') {
        return {
          ...entity,
          controlPoints: entity.controlPoints.map((p) => ({ X: p.X + dx, Y: p.Y + dy }))
        }
      }
      return entity
    })
  }

  async function on4PTableConfirm(): Promise<void> {
    try {
      const xyOffset = show4PResolveXYOffset()
      homeXyOffset.value = xyOffset
      runTrigger.value = true
      const 参数 = show4PBuildPayload(currentRunRecipePayload.value!, exportEntitiesWithCalculated(), xyOffset)
      await show4PCloseDialog()
      
      const result = await startProgram4PTest(参数)
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

  function on4PTableCancel(): void {
    show4PCloseDialog()
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
    on4PTableConfirm,
    on4PTableCancel,
    show4PDialogVisible,
    show4PIsAcquiring,
    show4PPositioningCount,
    show4PCurrentPositioningIndex,
    show4PTablePosition,
    show4PCenterPosition,
    show4PTablePositions,
    show4PCenterPositions,
    show4PIsCurrentCenterAcquired,
    show4PIsCurrentTableAcquired,
    show4PAllAcquired,
    show4PAcquireCenter,
    show4PAcquireTable,
    show4PNextPosition,
    show4PPrevPosition,
    onPauseToggleClick,
    onResetAlarmsClick,
    onEstopClick,
    onSkipTaskClick,
    init,
    initSync,
    cleanup
  }
}
