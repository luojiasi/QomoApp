<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRaw } from 'vue'
import { useMotionKeyboard } from '@/modules/motion/composables/useMotionKeyboard'
import { useHardwareState } from '@/shared/api/hardware'
import { useNotification } from '@/shared/composables/useNotification'
import { useRecipeSettingsStore } from '@/modules/recipe/useRecipeStore'
import { useProgramRunner } from '@/modules/program/composables/useProgramRunner'
import {
  getTenPlusCutting,
  saveTenPlusCutting,
  moveToTenPlusSlot,
  setMotionIoOutput,
  rotateRAxisCont,
  stopMotionJog
} from '@/modules/motion/api'
import { sendTenPlusFreeParams, getTenRAxisPosition, getTenCameraFocusError } from '@/modules/program/api'
import {
  TEN_PLUS_CORNER_RATIO_RECOMMENDATIONS,
  TEN_PLUS_CURVE_KIND_OPTIONS,
  TEN_PLUS_CURVE_KIND_SUPERELLIPSE,
  TEN_PLUS_CURVE_PATH_TYPE,
  TEN_PLUS_EQUAL_LINE_PATH_TYPE,
  TEN_PLUS_GRID_ORDER,
  TEN_PLUS_LINE_KIND_OPTIONS,
  TEN_PLUS_LINE_PARAM_MODE_MID_LENGTH,
  TEN_PLUS_LINE_PARAM_MODE_OPTIONS,
  TEN_PLUS_PATH_TYPE_BUTTONS,
  TEN_PLUS_STATION_OUTPUT_PORTS,
  isCurvePath,
  isEqualLineGroup,
  isUnequalLinePath,
  isSingleLinePath,
  isLineParamMidLength,
  isRStepPath,
  isSuperellipseCurve,
  resolveTenPlusCurveKind,
  slotIndexToOutputPort,
  tenPlusPathTypeTitle
} from '../constants/tenPlusCutting'
import {
  TEN_PLUS_CUSHION_DEFAULT_EXPONENT,
  TEN_PLUS_QUICK_SHAPE_OPTIONS
} from '../constants/shapePreset'
import {
  useTenPlusTask,
  isDiameterInvalid,
  isSuperellipseNInvalid,
  isAngleInvalid,
  isHeightInvalid,
  isTableDiameterZero,
  isNonTableHeightZero,
  isTableAngle,
  isCornerRatioInvalid,
  isArcAngleInvalid,
  isLineCoordInvalid,
  isSingleLineDegenerate,
  isDivisionsInvalid,
  isRecipeInvalid,
  applyTableAngleLockedFields
} from '../composables/useTenPlusTask'
import {
  createEmptyTenPlusConfig,
  normalizeTenPlusConfig,
  formatPointXyz,
  parsePointXyz
} from '../utils/tenPlusConfig'
import {
  buildTenPlusRowsFromTargets,
  toTenPlusTargetSummary
} from '../utils/tenPlusPayload'
import { buildQuickShapeRowDrafts } from '../utils/tenPlusShapePresets'
import { buildDiamondPresetRowDrafts, diamondCutLabel } from '../utils/tenPlusDiamondPresets'
import type { TenPlusCuttingConfig, TenPlusFreeParamPayload, TenPlusSlot, TenPlusTarget } from '../types/tenPlusCutting'
import type { TenPlusQuickShapeInput } from '../types/shapePreset'
import type { TenPlusDiamondPresetInput } from '../types/diamondPreset'
import TenPlusCuttingPage_UrCalibDialog from '../components/TenPlusCuttingPage_UrCalibDialog.vue'
import TenPlusCuttingPage_CompDialog from '../components/TenPlusCuttingPage_CompDialog.vue'
import TenPlusCuttingPage_ShapePresetDialog from '../components/TenPlusCuttingPage_ShapePresetDialog.vue'
import TenPlusCuttingPage_DiamondPresetDialog from '../components/TenPlusCuttingPage_DiamondPresetDialog.vue'
import TenPlusCuttingPage_TourOverlay from '../components/TenPlusCuttingPage_TourOverlay.vue'
import TenPlusCuttingPage_CameraWindow from '../components/TenPlusCuttingPage_CameraWindow.vue'
import TenPlusCuttingPage_RunControls from '../components/TenPlusCuttingPage_RunControls.vue'
import { useTenPlusPageUi } from '../composables/useTenPlusPageUi'

type WorkMode = 'freeParam' | 'drawImage'

const { warning, success, error } = useNotification()
const recipeStore = useRecipeSettingsStore()
const { mposition, controllerConnected } = useHardwareState()
const {
  programRunning,
  programPaused,
  programTaskCount,
  currentTaskJindubaifenbi,
  programElapsedText,
  onPauseToggleClick,
  onResetAlarmsClick,
  onEstopClick,
  onSkipTaskClick,
  noteProgramStarted,
  initSync: initProgramSync,
  cleanup: cleanupProgramRunner
} = useProgramRunner()

const {
  targets,
  activeTargetId,
  activeTarget,
  taskRows,
  initDefault,
  addTarget,
  selectTarget,
  renameTarget,
  removeTarget,
  addRow,
  appendQuickShapeRows,
  appendRowDrafts,
  removeRow,
  bindActiveTargetToSlot,
  exportToFile,
  loadFromFile
} = useTenPlusTask()

const workMode = ref<WorkMode>('freeParam')
const { keyboardEnabled, cameraVisible, runCameraEnlarge } = useTenPlusPageUi()
useMotionKeyboard(keyboardEnabled)
const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const statusMsg = ref('')
const starting = ref(false)
const processConfirmed = ref(false)
const showManualDialog = ref(false)
const showStartDialog = ref(false)
const dialogSelectedIds = ref<string[]>([])
const tenPlusConfig = ref<TenPlusCuttingConfig>(createEmptyTenPlusConfig())
const selectedSlotIndex = ref<number | null>(null)
const slotBusy = ref(false)
const rAxisBusy = ref(false)
const rAxisSpinning = ref(false)
/** 点击已示教工位时是否运动到该点，默认开启 */
const moveOnSlotClick = ref(true)
const showTeachDialog = ref(false)
const teachDialogSlot = ref<number | null>(null)
const showUrCalibDialog = ref(false)
const urCalibSlot = ref<number | null>(null)
const cameraDockedInWorkspace = computed(
  () =>
    runCameraEnlarge.value &&
    programRunning.value &&
    workMode.value === 'freeParam' &&
    !showUrCalibDialog.value
)
const showCameraWindow = computed(
  () => !showUrCalibDialog.value && (cameraDockedInWorkspace.value || cameraVisible.value)
)
const showQuickShapeDialog = ref(false)
const showDiamondPresetDialog = ref(false)
const compDialogRow = ref<TenPlusTarget['rows'][number] | null>(null)

async function openManualTour(): Promise<void> {
  workMode.value = 'freeParam'
  if (!activeTarget.value && targets[0]) {
    selectTarget(targets[0].id)
  }
  await nextTick()
  showManualDialog.value = true
}

function openCompDialog(row: TenPlusTarget['rows'][number]): void {
  compDialogRow.value = row
}

function closeCompDialog(): void {
  compDialogRow.value = null
}

function openQuickShapeDialog(): void {
  if (!activeTarget.value) {
    warning('请先选择目标')
    return
  }
  showQuickShapeDialog.value = true
}

function closeQuickShapeDialog(): void {
  showQuickShapeDialog.value = false
}

function confirmQuickShape(input: TenPlusQuickShapeInput): void {
  try {
    appendQuickShapeRows(buildQuickShapeRowDrafts(input))
    showQuickShapeDialog.value = false
    const label =
      TEN_PLUS_QUICK_SHAPE_OPTIONS.find((item) => item.value === input.shape)?.label ?? '快捷形状'
    success(`已将${label}写入当前目标`)
  } catch (err) {
    warning(err instanceof Error ? err.message : '生成快捷形状失败')
  }
}

function openDiamondPresetDialog(): void {
  if (!activeTarget.value) {
    warning('请先选择目标')
    return
  }
  showDiamondPresetDialog.value = true
}

function closeDiamondPresetDialog(): void {
  showDiamondPresetDialog.value = false
}

function confirmDiamondPreset(input: TenPlusDiamondPresetInput): void {
  try {
    appendRowDrafts(buildDiamondPresetRowDrafts(input))
    showDiamondPresetDialog.value = false
    success(`已将${diamondCutLabel(input.cut)}（冠/腰/亭）三行写入当前目标`)
  } catch (err) {
    warning(err instanceof Error ? err.message : '生成钻石快捷形状失败')
  }
}

const activeMainRecipes = computed(() =>
  recipeStore.recipeState.mainRecipes.filter((r) => r.status === 'active')
)

function recipeLabel(r: { id: string; name?: string }): string {
  return (r.name && r.name.trim()) || r.id
}

function formatAxis(val: number | undefined | null): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—'
  return val.toFixed(3)
}

function setStatus(msg: string): void {
  statusMsg.value = msg
}

function onRowAngleChange(row: TenPlusTarget['rows'][number], e: Event): void {
  const v = Number((e.target as HTMLInputElement).value)
  if (isTableAngle(v)) applyTableAngleLockedFields(row)
}

function capturePointXyz(): void {
  const target = activeTarget.value
  if (!target) return
  const x = Number(mposition.value['X'])
  const y = Number(mposition.value['Y'])
  const z = Number(mposition.value['Z'])
  if ([x, y, z].some((v) => Number.isNaN(v))) {
    warning('当前坐标无效，无法获取点位')
    return
  }
  target.pointXyz = formatPointXyz(x, y, z)
}

function roundLineCoord(v: number): number {
  return Number(v.toFixed(3))
}

async function captureLinePoint(
  row: TenPlusTarget['rows'][number],
  which: 'start' | 'end' | 'mid'
): Promise<void> {
  const slot = activeTarget.value?.slotIndex
  if (slot == null) {
    warning('请先绑定工位，才能按该工位 R 轴旋转中心获取点位')
    return
  }
  const mx = Number(mposition.value['X'])
  const my = Number(mposition.value['Y'])
  if (!Number.isFinite(mx) || !Number.isFinite(my)) {
    warning('当前坐标无效，无法获取点位')
    return
  }
  const res = await getTenRAxisPosition(slot)
  if (!res.success || !res.data) {
    warning(res.message || `读取工位 ${slot} R 轴旋转中心失败`)
    return
  }
  const cx = Number(res.data.X)
  const cy = Number(res.data.Y)
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
    warning(`工位 ${slot} R 轴旋转中心 XY 无效`)
    return
  }
  const rx = roundLineCoord(mx - cx)
  const ry = roundLineCoord(my - cy)
  if (which === 'start') {
    row.lineStartX = rx
    row.lineStartY = ry
    return
  }
  if (which === 'end') {
    row.lineEndX = rx
    row.lineEndY = ry
    return
  }
  row.lineMidX = rx
  row.lineMidY = ry
}

function applyLineParamMode(row: TenPlusTarget['rows'][number], mode: string): void {
  if (row.lineParamMode === mode) return
  if (mode === TEN_PLUS_LINE_PARAM_MODE_MID_LENGTH) {
    row.lineMidX = roundLineCoord((Number(row.lineStartX) + Number(row.lineEndX)) / 2)
    row.lineMidY = roundLineCoord((Number(row.lineStartY) + Number(row.lineEndY)) / 2)
    row.lineLength = roundLineCoord(
      Math.hypot(Number(row.lineEndX) - Number(row.lineStartX), Number(row.lineEndY) - Number(row.lineStartY))
    )
  } else {
    const half = Number(row.lineLength) / 2
    row.lineStartX = Number(row.lineMidX)
    row.lineStartY = roundLineCoord(Number(row.lineMidY) - half)
    row.lineEndX = Number(row.lineMidX)
    row.lineEndY = roundLineCoord(Number(row.lineMidY) + half)
  }
  row.lineParamMode = mode
}

const activePointAxes = computed(() => parsePointXyz(activeTarget.value?.pointXyz ?? ''))

function handleAddTarget(): void {
  const target = addTarget(`目标 ${targets.length + 1}`)
  void startRename(target.id, target.name)
}

async function startRename(id: string, currentName: string): Promise<void> {
  renamingId.value = id
  renameDraft.value = currentName
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

function commitRename(): void {
  const id = renamingId.value
  if (!id) return
  renameTarget(id, renameDraft.value.trim() || '未命名目标')
  renamingId.value = null
  renameDraft.value = ''
}

function cancelRename(): void {
  renamingId.value = null
  renameDraft.value = ''
}

function applyCurveKind(row: TenPlusTarget['rows'][number], kind: string): void {
  row.pathType = TEN_PLUS_CURVE_PATH_TYPE
  row.curveKind = kind
  if (kind === TEN_PLUS_CURVE_KIND_SUPERELLIPSE && isSuperellipseNInvalid(row.superellipseN)) {
    row.superellipseN = TEN_PLUS_CUSHION_DEFAULT_EXPONENT
  }
}

function onPathTypeChange(row: TenPlusTarget['rows'][number], pathType: string): void {
  if (isCurvePath(pathType)) {
    applyCurveKind(row, resolveTenPlusCurveKind(row.curveKind, row.superellipseN))
    return
  }
  if (pathType === TEN_PLUS_EQUAL_LINE_PATH_TYPE) {
    if (!isEqualLineGroup(row.pathType)) {
      row.pathType = TEN_PLUS_EQUAL_LINE_PATH_TYPE
      row.sameLayer = false
    }
    return
  }
  row.pathType = pathType
  row.sameLayer = false
}

type SubtypePickerMode = 'curve' | 'line'

const subtypePickerRow = ref<TenPlusTarget['rows'][number] | null>(null)
const subtypePickerMode = ref<SubtypePickerMode | null>(null)
const subtypePickerPos = ref({ top: 0, left: 0 })
const subtypePickerOptions = computed(() =>
  subtypePickerMode.value === 'line' ? TEN_PLUS_LINE_KIND_OPTIONS : TEN_PLUS_CURVE_KIND_OPTIONS
)
const subtypePickerCurrent = computed(() => {
  const row = subtypePickerRow.value
  if (!row || !subtypePickerMode.value) return ''
  if (subtypePickerMode.value === 'line') {
    return isEqualLineGroup(row.pathType) ? row.pathType : TEN_PLUS_EQUAL_LINE_PATH_TYPE
  }
  return resolveTenPlusCurveKind(row.curveKind, row.superellipseN)
})
const subtypePickerAria = computed(() =>
  subtypePickerMode.value === 'line' ? '等分线段子类型' : '曲线子类型'
)

function closeSubtypePicker(): void {
  subtypePickerRow.value = null
  subtypePickerMode.value = null
}

function openSubtypePicker(
  row: TenPlusTarget['rows'][number],
  mode: SubtypePickerMode,
  event: MouseEvent
): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  subtypePickerRow.value = row
  subtypePickerMode.value = mode
  subtypePickerPos.value = { top: rect.bottom + 6, left: rect.left }
}

function onPathTypeDblclick(
  row: TenPlusTarget['rows'][number],
  itemValue: string,
  event: MouseEvent
): void {
  if (itemValue === TEN_PLUS_CURVE_PATH_TYPE) {
    applyCurveKind(row, resolveTenPlusCurveKind(row.curveKind, row.superellipseN))
    openSubtypePicker(row, 'curve', event)
    return
  }
  if (itemValue === TEN_PLUS_EQUAL_LINE_PATH_TYPE) {
    if (!isEqualLineGroup(row.pathType)) {
      row.pathType = TEN_PLUS_EQUAL_LINE_PATH_TYPE
      row.sameLayer = false
    }
    openSubtypePicker(row, 'line', event)
  }
}

function selectSubtype(value: string): void {
  const row = subtypePickerRow.value
  if (!row || !subtypePickerMode.value) return
  if (subtypePickerMode.value === 'line') {
    row.pathType = value
    row.sameLayer = false
  } else {
    applyCurveKind(row, value)
  }
  closeSubtypePicker()
}

function isPathTypeButtonOn(row: TenPlusTarget['rows'][number], itemValue: string): boolean {
  if (itemValue === TEN_PLUS_EQUAL_LINE_PATH_TYPE) return isEqualLineGroup(row.pathType)
  return row.pathType === itemValue
}

function validateTargetRows(targetName: string, rows: TenPlusTarget['rows']): string | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const at = `${targetName} #${row.taskNo}`
    if (isUnequalLinePath(row.pathType)) {
      if (isDiameterInvalid(row.length)) return `${at}: 长必须在 0~200 之间`
      if (isDiameterInvalid(row.width)) return `${at}: 宽必须在 0~200 之间`
      if (isCornerRatioInvalid(row.cornerRatio, row.length, row.width)) {
        return `${at}: 切角比例须在 0~50% 之间，且切角量不得超过长的一半`
      }
    } else if (isSingleLinePath(row.pathType)) {
      if (isLineParamMidLength(row.lineParamMode)) {
        if (isLineCoordInvalid(row.lineMidX) || isLineCoordInvalid(row.lineMidY)) {
          return `${at}: 单直线中点须在 ±200 mm 内`
        }
        if (isDiameterInvalid(row.lineLength) || Number(row.lineLength) <= 0) {
          return `${at}: 单直线长度必须在 0 以上、200 以内`
        }
      } else if (isSingleLineDegenerate(row.lineStartX, row.lineStartY, row.lineEndX, row.lineEndY)) {
        return `${at}: 单直线起点与终点须在 ±200 mm 内且不能重合`
      }
      if (row.sameLayer) {
        if (i === 0) return `${at}: 首行不能勾选同层`
        if (isTableAngle(row.angle)) return `${at}: 台面行不能勾选同层`
        const prev = rows[i - 1]
        if (!prev || prev.angle !== row.angle) {
          return `${at}: 同层行的角度必须与上一行相同`
        }
      }
    } else if (isCurvePath(row.pathType)) {
      if (isSuperellipseCurve(row.pathType, row.curveKind, row.superellipseN)) {
        if (isDiameterInvalid(row.length) || Number(row.length) <= 0) return `${at}: 长必须在 0 以上、200 以内`
        if (isDiameterInvalid(row.width) || Number(row.width) <= 0) return `${at}: 宽必须在 0 以上、200 以内`
        if (isSuperellipseNInvalid(row.superellipseN)) return `${at}: 指数 n 须在 1.5–12 之间`
      } else if (isDiameterInvalid(row.diameter) || Number(row.diameter) <= 0) {
        return `${at}: 半径必须在 0 以上、200 以内`
      }
      if (isArcAngleInvalid(row.arcStart, row.arcEnd)) {
        return `${at}: 起始角与结束角须在 ±360° 内且不能相同`
      }
      if (row.sameLayer) {
        if (i === 0) return `${at}: 首行不能勾选同层`
        if (isTableAngle(row.angle)) return `${at}: 台面行不能勾选同层`
        const prev = rows[i - 1]
        if (!prev || prev.angle !== row.angle) {
          return `${at}: 同层行的角度必须与上一行相同`
        }
      }
    } else {
      if (isDiameterInvalid(row.diameter) || isTableDiameterZero(row.diameter, row.angle)) {
        return `${at}: 外接圆直径必须在 0 以上、200 以内`
      }
      if (isDivisionsInvalid(row.divisions)) return `${at}: 分割数须为 0 或 3~360`
    }
    if (isAngleInvalid(row.angle)) return `${at}: 角度必须在 -90~90 之间`
    if (isHeightInvalid(row.height) || isNonTableHeightZero(row.height, row.angle)) {
      return isNonTableHeightZero(row.height, row.angle)
        ? `${at}: 非台面行高度不能为 0`
        : `${at}: 高度必须在 0~20 之间`
    }
    if (isRecipeInvalid(row.recipe)) return `${at}: 未选择配方`
  }
  return null
}

function validateAllTargets(): string | null {
  for (const target of targets) {
    const err = validateTargetRows(target.name, target.rows)
    if (err) return err
  }
  return null
}

function onSave(): void {
  const err = validateAllTargets()
  if (err) {
    warning(err)
    setStatus(err)
    return
  }
  exportToFile()
  success('已保存任务参数文件')
  setStatus('已保存')
}

function isDialogSelected(id: string): boolean {
  return dialogSelectedIds.value.includes(id)
}

function toggleDialogSelected(id: string, checked: boolean): void {
  const set = new Set(dialogSelectedIds.value)
  if (checked) set.add(id)
  else set.delete(id)
  dialogSelectedIds.value = targets.filter((t) => set.has(t.id)).map((t) => t.id)
}

function targetReadyForStart(target: TenPlusTarget): boolean {
  if (target.slotIndex === null || target.slotIndex === undefined) return false
  if (!target.pointXyz || !String(target.pointXyz).trim()) return false
  if (!target.rows.length) return false
  return true
}

function targetStartBlockReason(target: TenPlusTarget): string {
  if (target.slotIndex === null || target.slotIndex === undefined) return '未绑定工位'
  if (!target.pointXyz || !String(target.pointXyz).trim()) return '无点位 XYZ'
  if (!target.rows.length) return '无任务行'
  return ''
}

const dialogSelectedTargets = computed((): TenPlusTarget[] => {
  const map = new Map(targets.map((t) => [t.id, t]))
  return dialogSelectedIds.value.map((id) => map.get(id)).filter((t): t is TenPlusTarget => Boolean(t))
})

const canConfirmStartDialog = computed(() => {
  const list = dialogSelectedTargets.value
  return list.length > 0 && list.every((t) => targetReadyForStart(t))
})

function onStart(): void {
  if (starting.value || !processConfirmed.value) return
  if (targets.length === 0) {
    warning('没有可执行的目标')
    setStatus('没有可执行的目标')
    return
  }
  const readyIds = targets.filter((t) => targetReadyForStart(t)).map((t) => t.id)
  if (activeTargetId.value && readyIds.includes(activeTargetId.value)) {
    dialogSelectedIds.value = [activeTargetId.value]
  } else {
    dialogSelectedIds.value = [...readyIds]
  }
  showStartDialog.value = true
}

function closeStartDialog(): void {
  if (starting.value) return
  showStartDialog.value = false
}

async function confirmStartDialog(): Promise<void> {
  if (starting.value || !canConfirmStartDialog.value) return

  const selected = dialogSelectedTargets.value
  for (const target of selected) {
    const err = validateTargetRows(target.name, target.rows)
    if (err) {
      warning(err)
      setStatus(err)
      return
    }
  }

  const summaries = selected
    .map((t) => toTenPlusTargetSummary(t))
    .filter((t): t is NonNullable<typeof t> => t !== null)
  if (summaries.length !== selected.length) {
    warning('所选目标未就绪（需绑定工位并有点位）')
    return
  }

  const slotSet = new Set<number>()
  for (const target of selected) {
    if (typeof target.slotIndex === 'number') slotSet.add(target.slotIndex)
  }
  const cameraFocusErrorBySlot = new Map<number, number>()
  for (const slot of slotSet) {
    const focusRes = await getTenCameraFocusError(slot)
    if (!focusRes.success || focusRes.data == null) {
      warning(focusRes.message || `读取工位 ${slot} 相机清晰误差失败`)
      setStatus(`读取工位 ${slot} 相机清晰误差失败`)
      return
    }
    const errorMm = Number(focusRes.data.value)
    if (!Number.isFinite(errorMm)) {
      warning(`工位 ${slot} 相机清晰误差无效`)
      setStatus(`工位 ${slot} 相机清晰误差无效`)
      return
    }
    cameraFocusErrorBySlot.set(slot, errorMm)
  }

  const recipeState = toRaw(recipeStore.recipeState)
  const payload: TenPlusFreeParamPayload = {
    recipes: {
      mainRecipes: JSON.parse(JSON.stringify(recipeState.mainRecipes ?? [])),
      machiningRecipes: JSON.parse(JSON.stringify(recipeState.machiningRecipes ?? [])),
      blackeningRecipes: JSON.parse(JSON.stringify(recipeState.blackeningRecipes ?? [])),
      laserPowerRecipes: JSON.parse(JSON.stringify(recipeState.laserPowerRecipes ?? [])),
      horizontalFormulaRecipes: JSON.parse(JSON.stringify(recipeState.horizontalFormulaRecipes ?? [])),
      verticalFormulaRecipes: JSON.parse(JSON.stringify(recipeState.verticalFormulaRecipes ?? []))
    },
    targets: summaries,
    rows: buildTenPlusRowsFromTargets(selected, cameraFocusErrorBySlot)
  }

  starting.value = true
  try {
    const res = await sendTenPlusFreeParams(payload as unknown as Record<string, unknown>)
    if (res.success) {
      const tc = typeof res.data?.task_count === 'number' ? res.data.task_count : payload.rows.length
      noteProgramStarted(tc)
      const names = summaries.map((x) => x.name).join('、')
      success(res.message || '十工位任务已启动')
      setStatus(`已启动：${summaries.length} 个目标（${names}），共 ${tc} 行`)
      showStartDialog.value = false
    } else {
      error(res.message || '启动失败')
      setStatus(`启动失败: ${res.message || ''}`)
    }
  } catch {
    error('启动失败：无法连接后端')
    setStatus('启动失败')
  } finally {
    starting.value = false
  }
}

function onLoadClick(): void {
  fileInputRef.value?.click()
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const ok = loadFromFile(reader.result as string)
    if (ok) {
      success('参数文件已加载')
      setStatus('已加载')
    } else {
      error('加载失败：文件格式不正确')
      setStatus('加载失败')
    }
  }
  reader.onerror = () => {
    error('加载失败：无法读取文件')
    setStatus('加载失败')
  }
  reader.readAsText(file)
  input.value = ''
}

function getSlot(index: number): TenPlusSlot | undefined {
  return tenPlusConfig.value.slots.find((s) => s.index === index)
}

const hoverSlotIndex = ref<number | null>(null)
const hoverTipPos = ref({ top: 0, left: 0 })

const hoverSlot = computed((): TenPlusSlot | undefined => {
  const idx = hoverSlotIndex.value
  return idx === null ? undefined : getSlot(idx)
})

function onSlotHoverEnter(event: MouseEvent, index: number): void {
  const el = event.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  hoverSlotIndex.value = index
  hoverTipPos.value = {
    top: rect.top - 8,
    left: rect.left + rect.width / 2
  }
}

function onSlotHoverLeave(): void {
  hoverSlotIndex.value = null
}

/**
 * 第 5 列的表头：等分线段按「分割数」下刀，非等分直线的轮廓边数固定，
 * 改由「切角 (%)」决定形状，两者不会同时生效，只有混用路径类型时才并列显示。
 */
const divisionColumnLabel = computed((): string => {
  const rows = taskRows.value
  if (rows.length === 0) return '分割数'
  const labels: string[] = []
  if (rows.some((r) => r.pathType === 'equalSegments')) labels.push('分割数')
  if (rows.some((r) => isUnequalLinePath(r.pathType))) labels.push('切角 (%)')
  if (rows.some((r) => isCurvePath(r.pathType))) labels.push('起止角')
  if (labels.length > 0) return labels.join(' / ')
  if (rows.some((r) => isSingleLinePath(r.pathType))) return '—'
  return '分割数'
})

/** 只要有一行走非等分直线，表头就挂上切角比例的推荐值说明 */
const showCornerHelp = computed((): boolean =>
  taskRows.value.some((r) => isUnequalLinePath(r.pathType))
)

const cornerTipVisible = ref(false)
const cornerTipPos = ref({ top: 0, left: 0 })

function onCornerTipEnter(event: Event): void {
  const el = event.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  cornerTipPos.value = {
    top: rect.top - 8,
    left: rect.left + rect.width / 2
  }
  cornerTipVisible.value = true
}

function onCornerTipLeave(): void {
  cornerTipVisible.value = false
}

function boundTargetName(slotIndex: number): string {
  const hit = targets.find((t) => t.slotIndex === slotIndex)
  return hit?.name?.trim() || ''
}

function slotCellClass(index: number): Record<string, boolean> {
  const slot = getSlot(index)
  const taught = Boolean(slot?.taught)
  const isBound = activeTarget.value?.slotIndex === index
  const isSelected = selectedSlotIndex.value === index
  return {
    'slot-taught': taught,
    'slot-empty': !taught,
    'slot-bound': isBound,
    'slot-selected': isSelected && !isBound
  }
}

async function loadTenPlusConfig(): Promise<void> {
  const res = await getTenPlusCutting()
  if (res.success && res.data) {
    tenPlusConfig.value = normalizeTenPlusConfig(res.data)
  } else {
    tenPlusConfig.value = createEmptyTenPlusConfig()
  }
}

async function persistTenPlusConfig(): Promise<boolean> {
  const res = await saveTenPlusCutting(tenPlusConfig.value)
  if (!res.success) {
    error(res.message || '十工位配置保存失败')
    setStatus(res.message || '十工位配置保存失败')
    return false
  }
  if (res.data) {
    tenPlusConfig.value = normalizeTenPlusConfig(res.data)
  }
  return true
}

async function openSlotOutput(slotIndex: number): Promise<void> {
  if (!controllerConnected.value) return
  const port = slotIndexToOutputPort(slotIndex)
  if (port === null) return
  try {
    for (const io of TEN_PLUS_STATION_OUTPUT_PORTS) {
      const res = await setMotionIoOutput(io, io === port)
      if (!res.success) {
        warning(res.message || `设置输出口 ${io} 失败`)
        return
      }
    }
  } catch (e) {
    warning(e instanceof Error ? e.message : `打开工位 #${slotIndex} 输出口失败`)
  }
}

async function onSlotClick(index: number): Promise<void> {
  const target = activeTarget.value
  if (!target) return
  const slot = getSlot(index)
  if (!slot) return

  selectedSlotIndex.value = index
  await openSlotOutput(index)

  if (!slot.taught) {
    setStatus(`已选中工位 #${index}（未示教，请先示教）`)
    return
  }

  const ok = bindActiveTargetToSlot(index)
  if (!ok) {
    warning('绑定工位失败')
    return
  }
  setStatus(`已绑定「${target.name}」→ 工位 #${index}`)

  if (!moveOnSlotClick.value) {
    setStatus(`已绑定「${target.name}」→ 工位 #${index}（未勾选点击移动）`)
    return
  }
  if (!controllerConnected.value) {
    setStatus(`已绑定「${target.name}」→ 工位 #${index}（控制器未连接，跳过运动）`)
    return
  }
  if (slotBusy.value) return

  slotBusy.value = true
  try {
    const moveRes = await moveToTenPlusSlot(slot)
    if (!moveRes.success) {
      setStatus(`已绑定；运动: ${moveRes.message || '失败'}`)
    }
  } finally {
    slotBusy.value = false
  }
}

function onTeachSelectedSlot(): void {
  if (slotBusy.value || !activeTarget.value) return
  const index = selectedSlotIndex.value
  if (index === null) {
    warning('请先选中一个工位格')
    setStatus('请先选中一个工位格')
    return
  }
  if (!controllerConnected.value) {
    warning('请先连接控制器')
    setStatus('请先连接控制器')
    return
  }
  teachDialogSlot.value = index
  showTeachDialog.value = true
}

function closeTeachDialog(): void {
  showTeachDialog.value = false
  teachDialogSlot.value = null
}

function onOpenUrCalib(): void {
  if (selectedSlotIndex.value === null) {
    warning('请先选择工位')
    setStatus('请先选择工位')
    return
  }
  urCalibSlot.value = selectedSlotIndex.value
  showUrCalibDialog.value = true
}

function requireSelectedSlotForRAxis(): number | null {
  const index = selectedSlotIndex.value
  if (index === null) {
    warning('请先选中一个工位格')
    setStatus('请先选中一个工位格')
    return null
  }
  if (!controllerConnected.value) {
    warning('请先连接控制器')
    setStatus('请先连接控制器')
    return null
  }
  return index
}

async function onStartSelectedSlotRSpin(): Promise<void> {
  const index = requireSelectedSlotForRAxis()
  if (index === null || rAxisBusy.value) return
  rAxisBusy.value = true
  try {
    await openSlotOutput(index)
    const res = await rotateRAxisCont()
    if (!res.success) {
      warning(res.message || `工位 #${index} R 轴持续旋转失败`)
      setStatus(res.message || `工位 #${index} R 轴持续旋转失败`)
      return
    }
    rAxisSpinning.value = true
    success(`工位 #${index} R 轴已开始持续旋转`)
    setStatus(`工位 #${index} R 轴持续旋转中`)
  } catch (e) {
    warning(e instanceof Error ? e.message : `工位 #${index} R 轴持续旋转失败`)
  } finally {
    rAxisBusy.value = false
  }
}

async function onPauseSelectedSlotRSpin(): Promise<void> {
  const index = requireSelectedSlotForRAxis()
  if (index === null || rAxisBusy.value) return
  rAxisBusy.value = true
  try {
    const res = await stopMotionJog('R')
    if (!res.success) {
      warning(res.message || `工位 #${index} R 轴暂停失败`)
      setStatus(res.message || `工位 #${index} R 轴暂停失败`)
      return
    }
    rAxisSpinning.value = false
    success(`工位 #${index} R 轴已暂停`)
    setStatus(`工位 #${index} R 轴已暂停旋转`)
  } catch (e) {
    warning(e instanceof Error ? e.message : `工位 #${index} R 轴暂停失败`)
  } finally {
    rAxisBusy.value = false
  }
}

function closeUrCalibDialog(): void {
  showUrCalibDialog.value = false
  urCalibSlot.value = null
}

async function confirmTeachSlot(): Promise<void> {
  const index = teachDialogSlot.value
  if (index === null || !activeTarget.value) {
    closeTeachDialog()
    return
  }
  closeTeachDialog()

  const x = Number(mposition.value['X'])
  const y = Number(mposition.value['Y'])
  const z = Number(mposition.value['Z'])
  const u = Number(mposition.value['U'])
  if ([x, y, z, u].some((v) => Number.isNaN(v))) {
    warning('当前坐标无效，无法示教')
    return
  }

  const slot = getSlot(index)
  if (!slot) return
  slot.x = x
  slot.y = y
  slot.z = z
  slot.u = u
  slot.taught = true

  slotBusy.value = true
  try {
    const saved = await persistTenPlusConfig()
    if (!saved) return
    if (activeTarget.value.slotIndex === index) {
      activeTarget.value.pointXyz = formatPointXyz(x, y, z)
    }
    success(`工位 #${index} 示教已保存`)
    setStatus(`工位 #${index} 示教完成`)
  } finally {
    slotBusy.value = false
  }
}

onMounted(async () => {
  await recipeStore.loadRecipeState()
  initDefault('目标 1')
  await loadTenPlusConfig()
  await initProgramSync()
})

onUnmounted(() => {
  cleanupProgramRunner()
})
</script>

<template>
  <div class="tpc-page">
    <!-- 工位坐标悬浮提示 -->
    <Teleport to="body">
      <div
        v-if="hoverSlotIndex !== null"
        class="tpc-slot-tip"
        :style="{ top: `${hoverTipPos.top}px`, left: `${hoverTipPos.left}px` }"
      >
        <div class="tpc-slot-tip-title">工位 #{{ hoverSlotIndex }}</div>
        <template v-if="hoverSlot?.taught">
          <div>X {{ formatAxis(hoverSlot.x) }}</div>
          <div>Y {{ formatAxis(hoverSlot.y) }}</div>
          <div>Z {{ formatAxis(hoverSlot.z) }}</div>
          <div>U {{ formatAxis(hoverSlot.u) }}</div>
        </template>
        <div v-else class="tpc-slot-tip-empty">未示教</div>
      </div>
    </Teleport>

    <!-- 等分线段 / 曲线子类型选择 -->
    <Teleport to="body">
      <div
        v-if="subtypePickerRow"
        class="tpc-curve-kind-overlay"
        @click="closeSubtypePicker"
      >
        <div
          class="tpc-curve-kind-menu"
          role="menu"
          :aria-label="subtypePickerAria"
          :style="{ top: `${subtypePickerPos.top}px`, left: `${subtypePickerPos.left}px` }"
          @click.stop
        >
          <button
            v-for="item in subtypePickerOptions"
            :key="item.value"
            type="button"
            role="menuitemradio"
            :aria-checked="subtypePickerCurrent === item.value"
            :class="{ on: subtypePickerCurrent === item.value }"
            @click="selectSubtype(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 切角比例推荐值悬浮提示 -->
    <Teleport to="body">
      <div
        v-if="cornerTipVisible"
        class="tpc-slot-tip tpc-corner-tip"
        :style="{ top: `${cornerTipPos.top}px`, left: `${cornerTipPos.left}px` }"
      >
        <div class="tpc-slot-tip-title">切角比例推荐值</div>
        <div
          v-for="item in TEN_PLUS_CORNER_RATIO_RECOMMENDATIONS"
          :key="item.shape"
          class="tpc-corner-tip-row"
        >
          <span class="tpc-corner-tip-shape">{{ item.shape }}</span>
          <span class="tpc-corner-tip-alias">{{ item.alias }}</span>
          <span class="tpc-corner-tip-value">{{ item.value }}%</span>
          <span class="tpc-corner-tip-range">{{ item.range }}</span>
        </div>
        <div class="tpc-corner-tip-note">切角在宽度方向的投影占宽的百分比</div>
      </div>
    </Teleport>

    <!-- 示教确认 -->
    <Teleport to="body">
      <div
        v-if="showTeachDialog && teachDialogSlot !== null"
        class="tpc-dlg-overlay"
        @click.self="closeTeachDialog"
      >
        <div class="tpc-dlg-card" role="dialog" aria-modal="true">
          <div class="tpc-dlg-head">示教确认</div>
          <p class="tpc-dlg-body">
            将当前机床坐标写入工位 #{{ teachDialogSlot }}？
          </p>
          <div class="tpc-dlg-meta">
            <span>X {{ formatAxis(mposition['X']) }}</span>
            <span>Y {{ formatAxis(mposition['Y']) }}</span>
            <span>Z {{ formatAxis(mposition['Z']) }}</span>
            <span>U {{ formatAxis(mposition['U']) }}</span>
          </div>
          <div class="tpc-dlg-btns">
            <button type="button" class="tpc-btn ghost" @click="closeTeachDialog">取消</button>
            <button type="button" class="tpc-btn primary" @click="confirmTeachSlot">确认示教</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 行补偿值 -->
    <Teleport to="body">
      <TenPlusCuttingPage_CompDialog
        v-if="compDialogRow"
        :row="compDialogRow"
        @close="closeCompDialog"
      />
    </Teleport>

    <!-- 快捷形状编辑 -->
    <Teleport to="body">
      <TenPlusCuttingPage_ShapePresetDialog
        v-if="showQuickShapeDialog"
        @close="closeQuickShapeDialog"
        @confirm="confirmQuickShape"
      />
    </Teleport>

    <!-- 钻石快捷形状编辑 -->
    <Teleport to="body">
      <TenPlusCuttingPage_DiamondPresetDialog
        v-if="showDiamondPresetDialog"
        @close="closeDiamondPresetDialog"
        @confirm="confirmDiamondPreset"
      />
    </Teleport>

    <!-- UR 补偿校准 -->
    <Teleport to="body">
      <TenPlusCuttingPage_UrCalibDialog
        v-if="showUrCalibDialog && urCalibSlot !== null"
        :slot-index="urCalibSlot"
        @close="closeUrCalibDialog"
      />
    </Teleport>

    <!-- 开始任务：多选目标 -->
    <Teleport to="body">
      <div v-if="showStartDialog" class="tpc-dlg-overlay" @click.self="closeStartDialog">
        <div class="tpc-dlg-card tpc-dlg-wide" role="dialog" aria-modal="true">
          <div class="tpc-dlg-head">选择要加工的目标</div>
          <p class="tpc-dlg-body">仅可勾选已绑定工位且有点位的目标</p>
          <div class="tpc-start-list">
            <label
              v-for="(target, index) in targets"
              :key="target.id"
              class="tpc-start-item"
              :class="{
                selected: isDialogSelected(target.id),
                disabled: !targetReadyForStart(target)
              }"
            >
              <input
                type="checkbox"
                :checked="isDialogSelected(target.id)"
                :disabled="!targetReadyForStart(target) || starting"
                @change="toggleDialogSelected(target.id, ($event.target as HTMLInputElement).checked)"
              />
              <span class="tpc-start-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="tpc-start-text">
                <span class="tpc-start-name">{{ target.name }}</span>
                <span class="tpc-start-meta">
                  <template v-if="target.slotIndex">#{{ target.slotIndex }} · </template>
                  {{ target.rows.length }} 行
                  <template v-if="!targetReadyForStart(target)">
                    · {{ targetStartBlockReason(target) }}
                  </template>
                </span>
              </span>
            </label>
          </div>
          <div class="tpc-dlg-btns">
            <button type="button" class="tpc-btn ghost" :disabled="starting" @click="closeStartDialog">
              取消
            </button>
            <button
              type="button"
              class="tpc-btn primary"
              :disabled="starting || !canConfirmStartDialog"
              @click="confirmStartDialog"
            >
              {{ starting ? '启动中…' : '确认开始' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 分步操作引导 -->
    <Teleport to="body">
      <TenPlusCuttingPage_TourOverlay
        v-if="showManualDialog"
        @close="showManualDialog = false"
      />
    </Teleport>

    <header class="tpc-top">
      <div class="tpc-top-left">
        <RouterLink to="/home" class="tpc-home-link">返回首页</RouterLink>
        <div>
          <h1 class="tpc-title">十轴切割</h1>
          <p class="tpc-sub">十轴自由参数编辑切割程序</p>
        </div>
      </div>
      <div class="tpc-top-right">
        <button type="button" class="tpc-guide-text-btn" @click="openManualTour">
          <span class="tpc-guide-mark" aria-hidden="true">?</span>
          <span>十轴切割操作指南</span>
        </button>
        <div class="tpc-top-group tpc-top-group-aux" aria-label="页面辅助">
          <button
            type="button"
            class="tpc-kb-toggle"
            role="switch"
            :aria-checked="keyboardEnabled ? 'true' : 'false'"
            title="关闭时方向键不会点动轴，方便填表"
            @click="keyboardEnabled = !keyboardEnabled"
          >
            <span class="tpc-kb-label">键盘操作</span>
            <span class="tpc-kb-switch" :class="{ on: keyboardEnabled }" aria-hidden="true">
              <span class="tpc-kb-knob" />
            </span>
            <span class="tpc-kb-state">{{ keyboardEnabled ? '开' : '关' }}</span>
          </button>
          <button
            type="button"
            class="tpc-kb-toggle"
            role="switch"
            :aria-checked="runCameraEnlarge ? 'true' : 'false'"
            title="开启后，任务运行时相机会放大并替代中间任务参数表，结束后恢复"
            @click="runCameraEnlarge = !runCameraEnlarge"
          >
            <span class="tpc-kb-label">运行时放大</span>
            <span class="tpc-kb-switch" :class="{ on: runCameraEnlarge }" aria-hidden="true">
              <span class="tpc-kb-knob" />
            </span>
            <span class="tpc-kb-state">{{ runCameraEnlarge ? '开' : '关' }}</span>
          </button>
          <button
            type="button"
            class="tpc-aux-btn"
            :class="{ on: cameraVisible }"
            :disabled="showUrCalibDialog"
            :title="showUrCalibDialog ? 'UR 校准打开时相机窗口已关闭' : undefined"
            @click="cameraVisible = !cameraVisible"
          >
            {{ cameraVisible ? '隐藏相机画面' : '显示相机画面' }}
          </button>
        </div>
        <div class="tpc-top-group tpc-top-group-mode" role="tablist" aria-label="工作模式">
          <button
            type="button"
            class="tpc-mode-btn"
            :class="{ active: workMode === 'freeParam' }"
            @click="workMode = 'freeParam'"
          >
            自由参数编程
          </button>
          <button
            type="button"
            class="tpc-mode-btn"
            :class="{ active: workMode === 'drawImage' }"
            @click="workMode = 'drawImage'"
          >
            普通绘制图像
          </button>
        </div>
      </div>
    </header>

    <div v-if="workMode === 'freeParam'" class="tpc-body">
      <!-- 左：目标列表 -->
      <aside class="tpc-targets">
        <div class="tpc-panel-head">
          <span>编程目标</span>
          <button type="button" class="tpc-btn-sm" data-tour="add-target" @click="handleAddTarget">
            + 新建
          </button>
        </div>
        <div class="tpc-targets-list">
          <div
            v-for="(target, index) in targets"
            :key="target.id"
            class="tpc-target-item"
            :class="{ active: target.id === activeTargetId }"
            @click="selectTarget(target.id)"
          >
            <template v-if="renamingId === target.id">
              <input
                ref="renameInputRef"
                v-model="renameDraft"
                class="tpc-rename"
                @click.stop
                @keydown.enter.prevent="commitRename"
                @keydown.esc.prevent="cancelRename"
                @blur="commitRename"
              />
            </template>
            <template v-else>
              <button
                type="button"
                class="tpc-target-main"
                @dblclick.stop="startRename(target.id, target.name)"
              >
                <span class="tpc-target-index">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="tpc-target-text">
                  <span class="tpc-target-name">{{ target.name }}</span>
                  <span class="tpc-target-meta">
                    {{ target.rows.length }} 行
                    <template v-if="target.slotIndex"> · #{{ target.slotIndex }}</template>
                  </span>
                </span>
              </button>
              <button
                type="button"
                class="tpc-target-del"
                :disabled="targets.length <= 1"
                title="删除目标"
                @click.stop="removeTarget(target.id)"
              >
                ✕
              </button>
            </template>
          </div>
        </div>
      </aside>

      <!-- 中：任务表；运行放大时由相机占位 -->
      <section class="tpc-workspace">
        <div v-show="!cameraDockedInWorkspace" class="tpc-workspace-stack">
        <div class="tpc-workspace-head">
          <div>
            <span class="tpc-kicker">任务参数表</span>
            <span class="tpc-active-name">{{ activeTarget?.name ?? '—' }}</span>
            <span class="tpc-hint">双击目标名可重命名</span>
          </div>
          <button
            type="button"
            class="tpc-btn-sm add"
            data-tour="add-row"
            :disabled="!activeTarget"
            @click="addRow"
          >
            + 添加任务
          </button>
        </div>
        <div class="tpc-table-wrap">
          <table class="tpc-table">
            <thead>
              <tr>
                <th class="col-path">
                  <span class="tpc-th-with-help">
                    类型
                    <button
                      type="button"
                      class="tpc-shape-preset-btn"
                      data-tour="diamond-preset"
                      :disabled="!activeTarget"
                      title="按直径与冠/腰/亭高比生成三行等分线段"
                      @click="openDiamondPresetDialog"
                    >
                      钻石快捷形状编辑
                    </button>
                  </span>
                </th>
                <th class="col-no">序号</th>
                <th class="col-same" title="勾选后与上一行同一高度平面，不叠层">同层</th>
                <th class="col-size">
                  <span class="tpc-th-with-help">
                    尺寸 (mm)
                    <button
                      type="button"
                      class="tpc-shape-preset-btn"
                      data-tour="shape-preset"
                      :disabled="!activeTarget"
                      title="按外接尺寸生成垫型等快捷形状到当前目标"
                      @click="openQuickShapeDialog"
                    >
                      快捷形状编辑
                    </button>
                  </span>
                </th>
                <th class="col-num">角度 (°)</th>
                <th class="col-num">高度 (mm)</th>
                <th class="col-num">
                  <span class="tpc-th-with-help">
                    {{ divisionColumnLabel }}
                    <button
                      v-if="showCornerHelp"
                      type="button"
                      class="tpc-corner-help"
                      aria-label="查看切角比例推荐值2"
                      @mouseenter="onCornerTipEnter"
                      @mouseleave="onCornerTipLeave"
                      @focus="onCornerTipEnter"
                      @blur="onCornerTipLeave"
                    >
                      ?
                    </button>
                  </span>
                </th>
                <th class="col-num">弦长倍率</th>
                <th class="col-recipe">配方</th>
                <th class="col-comp">补偿</th>
                <th class="col-act" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in taskRows" :key="row.id">
                <td class="col-path">
                  <div class="tpc-path-seg" role="radiogroup" aria-label="类型">
                    <button
                      v-for="item in TEN_PLUS_PATH_TYPE_BUTTONS"
                      :key="item.value"
                      type="button"
                      role="radio"
                      :aria-checked="isPathTypeButtonOn(row, item.value)"
                      :class="{ on: isPathTypeButtonOn(row, item.value) }"
                      :aria-label="
                        tenPlusPathTypeTitle(
                          item.value,
                          item.label,
                          row.curveKind,
                          row.superellipseN,
                          row.pathType
                        )
                      "
                      :title="
                        item.value === TEN_PLUS_CURVE_PATH_TYPE || item.value === TEN_PLUS_EQUAL_LINE_PATH_TYPE
                          ? `${tenPlusPathTypeTitle(item.value, item.label, row.curveKind, row.superellipseN, row.pathType)}（双击选择子类型）`
                          : item.label
                      "
                      @click="onPathTypeChange(row, item.value)"
                      @dblclick.stop="onPathTypeDblclick(row, item.value, $event)"
                    >
                      {{
                        isPathTypeButtonOn(row, item.value)
                          ? tenPlusPathTypeTitle(
                              item.value,
                              item.label,
                              row.curveKind,
                              row.superellipseN,
                              row.pathType
                            )
                          : item.label
                      }}
                    </button>
                  </div>
                </td>
                <td class="col-no">
                  <span class="tpc-task-no">{{ row.taskNo }}</span>
                </td>
                <td class="col-same">
                  <input
                    v-model="row.sameLayer"
                    type="checkbox"
                    class="tpc-same-layer"
                    :disabled="rowIndex === 0 || !isRStepPath(row.pathType) || isTableAngle(row.angle)"
                    :title="
                      rowIndex === 0
                        ? '首行没有上一行可同层'
                        : !isRStepPath(row.pathType)
                          ? '同层仅用于曲线段 / 单直线编组'
                          : isTableAngle(row.angle)
                            ? '台面行不能同层'
                            : '与上一行同一高度平面，不把上一行高度叠上去'
                    "
                  />
                </td>
                <td class="col-size">
                  <div v-if="isSingleLinePath(row.pathType)" class="tpc-line-size">
                    <div class="tpc-line-mode" role="radiogroup" aria-label="单直线参数形式">
                      <button
                        v-for="item in TEN_PLUS_LINE_PARAM_MODE_OPTIONS"
                        :key="item.value"
                        type="button"
                        role="radio"
                        :aria-checked="row.lineParamMode === item.value"
                        :class="{ on: row.lineParamMode === item.value }"
                        :title="
                          item.value === TEN_PLUS_LINE_PARAM_MODE_MID_LENGTH
                            ? '中点 + 长度（过中点、沿工件 Y）'
                            : '起点 + 终点'
                        "
                        @click="applyLineParamMode(row, item.value)"
                      >
                        {{ item.label }}
                      </button>
                    </div>
                    <template v-if="isLineParamMidLength(row.lineParamMode)">
                      <div class="tpc-line-xy">
                        <span>中点</span>
                        <span>(</span>
                        <input
                          v-model.number="row.lineMidX"
                          type="number"
                          class="tpc-input"
                          :class="{ invalid: isLineCoordInvalid(row.lineMidX) }"
                          step="0.01"
                          title="中点 X，相对该工位 R 轴旋转中心 (mm)"
                        />
                        <span>,</span>
                        <input
                          v-model.number="row.lineMidY"
                          type="number"
                          class="tpc-input"
                          :class="{ invalid: isLineCoordInvalid(row.lineMidY) }"
                          step="0.01"
                          title="中点 Y，相对该工位 R 轴旋转中心 (mm)"
                        />
                        <span>)</span>
                        <button
                          type="button"
                          class="tpc-btn-sm tpc-line-capture"
                          title="获取点位：读当前机床 XY，换成相对该工位 R 轴旋转中心"
                          @click="captureLinePoint(row, 'mid')"
                        >
                          获取点位
                        </button>
                      </div>
                      <label class="tpc-line-len">
                        <span>长度</span>
                        <input
                          v-model.number="row.lineLength"
                          type="number"
                          class="tpc-input"
                          :class="{
                            invalid: isDiameterInvalid(row.lineLength) || Number(row.lineLength) <= 0
                          }"
                          step="0.01"
                          min="0"
                          max="200"
                          title="过中点、沿工件 Y 的长度 (mm)"
                        />
                      </label>
                    </template>
                    <template v-else>
                      <div class="tpc-line-xy">
                        <span>起点</span>
                        <span>(</span>
                        <input
                          v-model.number="row.lineStartX"
                          type="number"
                          class="tpc-input"
                          :class="{ invalid: isLineCoordInvalid(row.lineStartX) }"
                          step="0.01"
                          title="起点 X，相对该工位 R 轴旋转中心 (mm)"
                        />
                        <span>,</span>
                        <input
                          v-model.number="row.lineStartY"
                          type="number"
                          class="tpc-input"
                          :class="{ invalid: isLineCoordInvalid(row.lineStartY) }"
                          step="0.01"
                          title="起点 Y，相对该工位 R 轴旋转中心 (mm)"
                        />
                        <span>)</span>
                        <button
                          type="button"
                          class="tpc-btn-sm tpc-line-capture"
                          title="获取点位：读当前机床 XY，换成相对该工位 R 轴旋转中心"
                          @click="captureLinePoint(row, 'start')"
                        >
                          获取点位
                        </button>
                      </div>
                      <div class="tpc-line-xy">
                        <span>终点</span>
                        <span>(</span>
                        <input
                          v-model.number="row.lineEndX"
                          type="number"
                          class="tpc-input"
                          :class="{
                            invalid:
                              isLineCoordInvalid(row.lineEndX) ||
                              isSingleLineDegenerate(
                                row.lineStartX,
                                row.lineStartY,
                                row.lineEndX,
                                row.lineEndY
                              )
                          }"
                          step="0.01"
                          title="终点 X，相对该工位 R 轴旋转中心 (mm)"
                        />
                        <span>,</span>
                        <input
                          v-model.number="row.lineEndY"
                          type="number"
                          class="tpc-input"
                          :class="{
                            invalid:
                              isLineCoordInvalid(row.lineEndY) ||
                              isSingleLineDegenerate(
                                row.lineStartX,
                                row.lineStartY,
                                row.lineEndX,
                                row.lineEndY
                              )
                          }"
                          step="0.01"
                          title="终点 Y，相对该工位 R 轴旋转中心 (mm)"
                        />
                        <span>)</span>
                        <button
                          type="button"
                          class="tpc-btn-sm tpc-line-capture"
                          title="获取点位：读当前机床 XY，换成相对该工位 R 轴旋转中心"
                          @click="captureLinePoint(row, 'end')"
                        >
                          获取点位
                        </button>
                      </div>
                    </template>
                  </div>
                  <div v-else-if="isUnequalLinePath(row.pathType)" class="tpc-size-pair">
                    <label>
                      <span>长</span>
                      <input
                        v-model.number="row.length"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: isDiameterInvalid(row.length) }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="isDiameterInvalid(row.length) ? '长必须在 0~200 之间' : ''"
                      />
                    </label>
                    <label>
                      <span>宽</span>
                      <input
                        v-model.number="row.width"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: isDiameterInvalid(row.width) }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="isDiameterInvalid(row.width) ? '宽必须在 0~200 之间' : ''"
                      />
                    </label>
                  </div>
                  <div
                    v-else-if="isSuperellipseCurve(row.pathType, row.curveKind, row.superellipseN)"
                    class="tpc-size-pair tpc-size-curve"
                  >
                    <label>
                      <span>长</span>
                      <input
                        v-model.number="row.length"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: isDiameterInvalid(row.length) || Number(row.length) <= 0 }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="'超椭圆外接长 (mm)'"
                      />
                    </label>
                    <label>
                      <span>宽</span>
                      <input
                        v-model.number="row.width"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: isDiameterInvalid(row.width) || Number(row.width) <= 0 }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="'超椭圆外接宽 (mm)'"
                      />
                    </label>
                    <label>
                      <span>n</span>
                      <input
                        v-model.number="row.superellipseN"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: isSuperellipseNInvalid(row.superellipseN) }"
                        step="0.1"
                        min="1.5"
                        max="12"
                        :title="'超椭圆指数 n，2≈椭圆，4=垫型'"
                      />
                    </label>
                  </div>
                  <div v-else-if="isCurvePath(row.pathType)" class="tpc-size-pair tpc-size-curve">
                    <label>
                      <span>半径</span>
                      <input
                        v-model.number="row.diameter"
                        type="number"
                        class="tpc-input"
                        :class="{
                          invalid:
                            isDiameterInvalid(row.diameter) ||
                            isTableDiameterZero(row.diameter, row.angle)
                        }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="
                          isTableDiameterZero(row.diameter, row.angle)
                            ? '台面行半径不能为 0'
                            : isDiameterInvalid(row.diameter)
                              ? '半径必须在 0~200 之间'
                              : '这一段弧自己的半径'
                        "
                      />
                    </label>
                    <label>
                      <span>偏X</span>
                      <input
                        v-model.number="row.arcOffsetX"
                        type="number"
                        class="tpc-input"
                        step="0.01"
                        :title="'圆心相对工位中心的 X 偏移'"
                      />
                    </label>
                    <label>
                      <span>偏Y</span>
                      <input
                        v-model.number="row.arcOffsetY"
                        type="number"
                        class="tpc-input"
                        step="0.01"
                        :title="'圆心相对工位中心的 Y 偏移'"
                      />
                    </label>
                  </div>
                  <div v-else class="tpc-size-pair tpc-size-single">
                    <label>
                      <span>外接圆直径</span>
                      <input
                        v-model.number="row.diameter"
                        type="number"
                        class="tpc-input"
                        :class="{
                          invalid:
                            isDiameterInvalid(row.diameter) ||
                            isTableDiameterZero(row.diameter, row.angle)
                        }"
                        step="0.01"
                        min="0"
                        max="200"
                        :title="
                          isTableDiameterZero(row.diameter, row.angle)
                            ? '台面行直径不能为 0'
                            : isDiameterInvalid(row.diameter)
                              ? '外接圆直径必须在 0~200 之间'
                              : ''
                        "
                      />
                    </label>
                  </div>
                </td>
                <td class="col-num">
                  <input
                    v-model.number="row.angle"
                    type="number"
                    class="tpc-input"
                    :class="{ invalid: isAngleInvalid(row.angle) }"
                    step="0.1"
                    min="-90"
                    max="90"
                    :title="isAngleInvalid(row.angle) ? '角度必须在 -90~90 之间' : ''"
                    @input="onRowAngleChange(row, $event)"
                  />
                </td>
                <td class="col-num">
                  <input
                    v-model.number="row.height"
                    type="number"
                    class="tpc-input"
                    :class="{
                      invalid:
                        isHeightInvalid(row.height) || isNonTableHeightZero(row.height, row.angle)
                    }"
                    min="0"
                    max="20"
                    step="0.001"
                    :disabled="isTableAngle(row.angle)"
                    :title="
                      isTableAngle(row.angle)
                        ? '台面行（角度为 0）高度固定为 0'
                        : isNonTableHeightZero(row.height, row.angle)
                          ? '非台面行高度不能为 0'
                          : isHeightInvalid(row.height)
                            ? '高度必须在 0~20 之间'
                            : ''
                    "
                  />
                </td>
                <td class="col-num">
                  <span v-if="isSingleLinePath(row.pathType)" class="muted">—</span>
                  <div v-else-if="isCurvePath(row.pathType)" class="tpc-size-pair">
                    <label>
                      <span>起</span>
                      <input
                        v-model.number="row.arcStart"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: isArcAngleInvalid(row.arcStart, row.arcEnd) }"
                        step="1"
                        :title="'圆弧起始角 (°)，+X 为 0，逆时针为正'"
                      />
                    </label>
                    <label>
                      <span>终</span>
                      <input
                        v-model.number="row.arcEnd"
                        type="number"
                        class="tpc-input"
                        :class="{ invalid: isArcAngleInvalid(row.arcStart, row.arcEnd) }"
                        step="1"
                        :title="'圆弧结束角 (°)'"
                      />
                    </label>
                  </div>
                  <input
                    v-else-if="isUnequalLinePath(row.pathType)"
                    v-model.number="row.cornerRatio"
                    type="number"
                    class="tpc-input"
                    :class="{ invalid: isCornerRatioInvalid(row.cornerRatio, row.length, row.width) }"
                    step="0.1"
                    min="0"
                    max="50"
                    :title="
                      isCornerRatioInvalid(row.cornerRatio, row.length, row.width)
                        ? '切角比例须在 0~50% 之间，且切角量不得超过长的一半'
                        : '切角在宽度方向的投影占宽的百分比；轮廓固定 8 条边，无需分割数'
                    "
                  />
                  <input
                    v-else
                    v-model.number="row.divisions"
                    type="number"
                    class="tpc-input"
                    :class="{ invalid: isDivisionsInvalid(row.divisions) }"
                    :disabled="isTableAngle(row.angle)"
                    :title="
                      isTableAngle(row.angle)
                        ? '台面行（角度为 0）分割数固定为默认值'
                        : isDivisionsInvalid(row.divisions)
                          ? '分割数须为 0 或 3~360'
                          : ''
                    "
                  />
                </td>
                <td class="col-num">
                  <input v-model.number="row.chordRatio" type="number" class="tpc-input" step="0.1" />
                </td>
                <td class="col-recipe">
                  <select
                    v-model="row.recipe"
                    class="tpc-select"
                    :class="{ invalid: isRecipeInvalid(row.recipe) }"
                    :title="isRecipeInvalid(row.recipe) ? '请选择配方' : ''"
                  >
                    <option value="">—</option>
                    <option v-for="r in activeMainRecipes" :key="r.id" :value="r.id">
                      {{ recipeLabel(r) }}
                    </option>
                  </select>
                </td>
                <td class="col-comp">
                  <button
                    type="button"
                    class="tpc-btn-sm"
                    title="修改角度补偿、XYZ 补偿、K/B/X"
                    @click="openCompDialog(row)"
                  >
                    修改补偿值
                  </button>
                </td>
                <td class="col-act">
                  <button
                    type="button"
                    class="tpc-row-del"
                    :disabled="taskRows.length <= 1"
                    title="删除行"
                    @click="removeRow(row.id)"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
        <div
          v-show="cameraDockedInWorkspace"
          id="tpc-workspace-cam-host"
          class="tpc-workspace-cam-host"
        />
      </section>

      <!-- 右：目标参数 + 十工位 -->
      <aside class="tpc-params">
        <div class="tpc-panel-head"><span>目标参数</span></div>
        <div v-if="activeTarget" class="tpc-params-body">
          <div class="tpc-card">
            <div class="tpc-card-title">圈补偿</div>
            <label class="tpc-field">
              <span>每旋转（圈）</span>
              <input
                v-model.number="activeTarget.rInterval"
                type="number"
                class="tpc-input"
                step="1"
                min="0"
              />
            </label>
            <label class="tpc-field">
              <span>补偿量 (mm)</span>
              <input
                v-model.number="activeTarget.rCompensation"
                type="number"
                class="tpc-input"
                step="0.001"
              />
            </label>
          </div>

          <div class="tpc-card">
            <div class="tpc-xyz-block" data-tour="point-xyz">
              <div class="tpc-card-head">
                <div class="tpc-card-title">点位 XYZ</div>
                <button type="button" class="tpc-btn-sm" title="获取当前机床 XYZ" @click="capturePointXyz">
                  获取
                </button>
              </div>
              <div class="tpc-xyz-grid">
                <div class="tpc-xyz-cell">
                  <span class="tpc-xyz-axis axis-x">X</span>
                  <span class="tpc-xyz-val" :class="{ empty: activePointAxes.x === '—' }">{{
                    activePointAxes.x
                  }}</span>
                </div>
                <div class="tpc-xyz-cell">
                  <span class="tpc-xyz-axis axis-y">Y</span>
                  <span class="tpc-xyz-val" :class="{ empty: activePointAxes.y === '—' }">{{
                    activePointAxes.y
                  }}</span>
                </div>
                <div class="tpc-xyz-cell">
                  <span class="tpc-xyz-axis axis-z">Z</span>
                  <span class="tpc-xyz-val" :class="{ empty: activePointAxes.z === '—' }">{{
                    activePointAxes.z
                  }}</span>
                </div>
              </div>
            </div>
            <label
              class="tpc-switch-row"
              data-tour="opposite-cut"
              title="是否对该目标做对切"
            >
              <span>是否对切</span>
              <input v-model="activeTarget.oppositeCut" type="checkbox" class="tpc-switch" />
            </label>

            <div class="tpc-slot-block">
              <div class="tpc-slot-head">
                <span>工位选择</span>
                <div class="tpc-slot-head-actions">
                  <label
                    class="tpc-slot-move"
                    data-tour="move-on-click"
                    title="勾选后，点击已示教工位会运动到该点"
                  >
                    <input v-model="moveOnSlotClick" type="checkbox" />
                    <span>点击移动</span>
                  </label>
                  <button
                    type="button"
                    class="tpc-btn-sm"
                    data-tour="teach"
                    :disabled="slotBusy || selectedSlotIndex === null"
                    @click="onTeachSelectedSlot"
                  >
                    示教选中格
                  </button>
                </div>
              </div>
              <p v-if="activeTarget.slotIndex" class="tpc-slot-hint">
                当前绑定工位 #{{ activeTarget.slotIndex }}
              </p>
              <div class="tpc-slot-grid" data-tour="slots">
                <button
                  v-for="n in TEN_PLUS_GRID_ORDER"
                  :key="n"
                  type="button"
                  class="tpc-slot-cell"
                  :class="slotCellClass(n)"
                  @click="onSlotClick(n)"
                  @mouseenter="onSlotHoverEnter($event, n)"
                  @mouseleave="onSlotHoverLeave"
                >
                  <span class="tpc-slot-no">{{ n }}</span>
                  <span class="tpc-slot-name">{{ boundTargetName(n) || '—' }}</span>
                </button>
              </div>
              <div
                class="tpc-r-card"
                data-tour="r-spin"
                :class="{ ready: selectedSlotIndex !== null, spinning: rAxisSpinning }"
              >
                <span class="tpc-r-badge" aria-hidden="true">R</span>
                <span class="tpc-r-copy">
                  <span class="tpc-r-title">R 轴旋转</span>
                  <span class="tpc-r-meta">
                    <template v-if="selectedSlotIndex">
                      工位 #{{ selectedSlotIndex }}
                      <template v-if="rAxisSpinning"> · 旋转中</template>
                      <template v-else-if="!controllerConnected"> · 未连接</template>
                    </template>
                    <template v-else>请先点选上方工位</template>
                  </span>
                </span>
                <span class="tpc-r-ops">
                  <button
                    type="button"
                    class="tpc-r-op start"
                    :disabled="slotBusy || rAxisBusy || selectedSlotIndex === null || !controllerConnected"
                    title="选中工位 R 轴持续旋转"
                    @click="onStartSelectedSlotRSpin"
                  >
                    持续旋转
                  </button>
                  <button
                    type="button"
                    class="tpc-r-op pause"
                    :disabled="slotBusy || rAxisBusy || selectedSlotIndex === null || !controllerConnected"
                    title="选中工位 R 轴暂停旋转"
                    @click="onPauseSelectedSlotRSpin"
                  >
                    暂停
                  </button>
                </span>
              </div>
              <button
                type="button"
                class="tpc-ur-entry"
                data-tour="ur-calib"
                :class="{ ready: selectedSlotIndex !== null }"
                @click="onOpenUrCalib"
              >
                <span class="tpc-ur-axes" aria-hidden="true">
                  <span class="tpc-ur-axis u">U</span>
                  <span class="tpc-ur-axis r">R</span>
                </span>
                <span class="tpc-ur-copy">
                  <span class="tpc-ur-title">UR 补偿校准</span>
                  <span class="tpc-ur-meta">
                    <template v-if="selectedSlotIndex">工位 #{{ selectedSlotIndex }} · 相机对中</template>
                    <template v-else>请先点选上方工位</template>
                  </span>
                </span>
                <span class="tpc-ur-go">打开</span>
              </button>
            </div>
          </div>
        </div>
        <div v-else class="tpc-params-empty">请选择一个编程目标</div>
      </aside>
    </div>

    <div v-else class="tpc-draw-empty">
      <p class="tpc-draw-title">普通绘制图像</p>
      <p class="tpc-draw-desc">功能占位，后续接入绘制流程</p>
    </div>

    <Teleport :to="cameraDockedInWorkspace ? '#tpc-workspace-cam-host' : 'body'">
      <TenPlusCuttingPage_CameraWindow
        v-if="showCameraWindow"
        :docked="cameraDockedInWorkspace"
      />
    </Teleport>

    <footer class="tpc-footer">
      <label class="tpc-confirm" data-tour="confirm">
        <input v-model="processConfirmed" type="checkbox" :disabled="starting" />
        <span>已确认可正常加工</span>
      </label>
      <button
        type="button"
        class="tpc-confirm-help"
        aria-label="分步操作引导"
        title="分步操作引导"
        @click="openManualTour"
      >
        ?
      </button>
      <button
        type="button"
        class="tpc-btn start"
        data-tour="start"
        :disabled="starting || !processConfirmed"
        @click="onStart"
      >
        {{ starting ? '启动中…' : '开始任务' }}
      </button>
      <TenPlusCuttingPage_RunControls
        :program-running="programRunning"
        :program-paused="programPaused"
        :program-task-count="programTaskCount"
        :jindubaifenbi="currentTaskJindubaifenbi"
        :elapsed-text="programElapsedText"
        @pause-toggle="onPauseToggleClick"
        @reset-alarms="onResetAlarmsClick"
        @estop="onEstopClick"
        @skip-task="onSkipTaskClick"
      />
      <span v-if="statusMsg" class="tpc-status" :title="statusMsg">{{ statusMsg }}</span>
      <input
        ref="fileInputRef"
        type="file"
        accept=".jjs,application/json"
        class="tpc-file"
        @change="onFileChange"
      />
      <span data-tour="files" class="tpc-file-ops">
        <button type="button" class="tpc-btn ghost" @click="onLoadClick">读取</button>
        <button type="button" class="tpc-btn ghost" @click="onSave">保存</button>
      </span>
    </footer>
  </div>
</template>

<style scoped>
.tpc-page,
.tpc-dlg-overlay,
.tpc-slot-tip {
  --tpc-accent: #007aff;
  --tpc-apple-blue: #007aff;
  --tpc-apple-green: #34c759;
  --tpc-apple-orange: #ff9f0a;
  --tpc-apple-red: #ff3b30;
  --tpc-apple-fill: color-mix(in srgb, var(--app-text-primary) 5.5%, transparent);
}
.tpc-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--app-bg);
  color: var(--app-text-primary);
  overflow: hidden;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'SF Pro Text',
    'Segoe UI Variable Display',
    'Segoe UI',
    system-ui,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  accent-color: var(--tpc-apple-blue);
}

.tpc-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 16px;
  padding: 10px 16px;
  border-bottom: 0.5px solid color-mix(in srgb, #fff 40%, var(--app-border));
  flex-shrink: 0;
  background: color-mix(in srgb, var(--app-card) 72%, transparent);
  backdrop-filter: blur(28px) saturate(1.8);
  -webkit-backdrop-filter: blur(28px) saturate(1.8);
}
.tpc-title {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.03em;
  color: var(--app-text-primary);
}
.tpc-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--app-text-muted);
}
.tpc-top-left {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-self: start;
  min-width: 0;
}
.tpc-top-right {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: end;
  flex-wrap: wrap;
}
.tpc-top-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--tpc-apple-fill);
  border: 0;
}
.tpc-top-group-aux {
  gap: 6px;
  padding: 3px 8px 3px 10px;
}
.tpc-top-group-mode {
  gap: 2px;
}
.tpc-aux-btn {
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 590;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
}
.tpc-aux-btn.on {
  color: var(--tpc-apple-blue);
  background: color-mix(in srgb, var(--app-card) 88%, transparent);
  box-shadow: 0 0.5px 1.5px color-mix(in srgb, #000 12%, transparent);
}
.tpc-aux-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.tpc-kb-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 12px;
  color: var(--app-text-secondary);
  cursor: pointer;
  user-select: none;
}
.tpc-kb-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--tpc-apple-blue) 70%, transparent);
  outline-offset: 3px;
  border-radius: 8px;
}
.tpc-kb-label {
  letter-spacing: 0.01em;
}
.tpc-kb-switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--app-text-muted) 22%, var(--app-card));
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--app-text-primary) 8%, transparent);
  transition: background 0.18s ease;
}
.tpc-kb-switch.on {
  background: var(--tpc-apple-green);
  box-shadow: none;
}
.tpc-kb-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px color-mix(in srgb, #000 22%, transparent);
  transition: transform 0.18s ease;
}
.tpc-kb-switch.on .tpc-kb-knob {
  transform: translateX(16px);
}
.tpc-kb-state {
  min-width: 1.25em;
  font-size: 11px;
  font-weight: 600;
  color: var(--app-text-muted);
}
.tpc-kb-toggle[aria-checked='true'] .tpc-kb-state {
  color: var(--tpc-apple-green);
}
.tpc-home-link {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 590;
  color: var(--tpc-apple-blue);
  background: var(--tpc-apple-fill);
  border: 0;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.tpc-home-link:hover {
  color: var(--tpc-apple-blue);
  background: color-mix(in srgb, var(--app-text-primary) 9%, transparent);
}
.tpc-mode-btn {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 590;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
}
.tpc-mode-btn.active {
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-card) 92%, transparent);
  box-shadow: 0 0.5px 1.5px color-mix(in srgb, #000 14%, transparent);
}

.tpc-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 280px;
  gap: 10px;
  padding: 10px 12px;
}

.tpc-targets,
.tpc-workspace,
.tpc-params {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  overflow: hidden;
}

.tpc-workspace-stack {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tpc-workspace-cam-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tpc-panel-head,
.tpc-workspace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
  color: var(--app-text-secondary);
  flex-shrink: 0;
  background: var(--app-card-soft);
}
.tpc-kicker {
  font-weight: 600;
  color: var(--app-text-primary);
  margin-right: 8px;
}
.tpc-active-name {
  color: color-mix(in srgb, var(--tpc-accent) 72%, var(--app-text-primary));
  margin-right: 8px;
}
.tpc-hint {
  font-size: 11px;
  color: var(--app-text-muted);
}

.tpc-targets-list {
  flex: 1;
  overflow: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tpc-target-item {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-soft);
  padding: 4px;
  cursor: pointer;
}
.tpc-target-item.active {
  border-color: var(--tpc-accent);
  background: color-mix(in srgb, var(--tpc-accent) 12%, var(--app-card));
}
.tpc-target-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
  padding: 4px;
}
.tpc-target-index {
  font-size: 11px;
  color: var(--app-text-muted);
  font-variant-numeric: tabular-nums;
}
.tpc-target-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.tpc-target-name {
  font-size: 13px;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpc-target-meta {
  font-size: 11px;
  color: var(--app-text-muted);
}
.tpc-target-del,
.tpc-row-del {
  background: none;
  border: none;
  color: var(--app-text-muted);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
}
.tpc-target-del:hover:not(:disabled),
.tpc-row-del:hover:not(:disabled) {
  color: #dc2626;
  background: color-mix(in srgb, #dc2626 10%, var(--app-card));
}
.tpc-target-del:disabled,
.tpc-row-del:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.tpc-rename {
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  color: var(--app-text-primary);
  background: var(--app-input-bg);
  border: 1px solid var(--tpc-accent);
  border-radius: 6px;
  outline: none;
}

.tpc-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}
.tpc-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 12px;
}
.tpc-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--app-card-soft);
  color: var(--app-text-muted);
  font-weight: 500;
  padding: 6px 4px;
  border-bottom: 1px solid var(--app-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tpc-table td {
  padding: 4px;
  border-bottom: 1px solid var(--app-border);
  overflow: hidden;
  vertical-align: middle;
}
.tpc-table th,
.tpc-table td {
  width: auto;
}
.tpc-table .col-path {
  width: 24%;
  min-width: 220px;
}
.tpc-table .col-no {
  width: 36px;
  padding-left: 2px;
  padding-right: 2px;
  text-align: center;
}
.tpc-table .col-same {
  width: 32px;
  padding-left: 0;
  padding-right: 2px;
  text-align: center;
}
.tpc-table .col-size {
  width: 18%;
  min-width: 220px;
}
.tpc-table .col-num {
  width: 7%;
}
.tpc-table .col-recipe {
  width: 10%;
}
.tpc-table .col-comp {
  width: 88px;
}
.tpc-table .col-act {
  width: 28px;
  padding-left: 2px;
  padding-right: 2px;
}
.tpc-same-layer {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--tpc-accent);
  cursor: pointer;
}
.tpc-same-layer:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.tpc-size-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  min-width: 0;
}
.tpc-size-curve {
  grid-template-columns: 1.2fr 0.9fr 0.9fr;
}
.tpc-size-pair label {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.tpc-size-pair span {
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--app-text-muted);
}
.tpc-size-single {
  grid-template-columns: 1fr;
}
.tpc-line-size {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.tpc-line-mode {
  display: flex;
  gap: 0;
  padding: 2px;
  background: color-mix(in srgb, var(--app-text-primary) 8%, var(--app-card-soft));
  border-radius: 7px;
}
.tpc-line-mode button {
  flex: 1;
  min-width: 0;
  padding: 3px 4px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  font-family: inherit;
  color: var(--app-text-muted);
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
  user-select: none;
}
.tpc-line-mode button.on {
  color: var(--app-text-primary);
  font-weight: 650;
  background: var(--app-card);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--app-text-primary) 12%, transparent);
}
.tpc-line-xy,
.tpc-line-len {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
.tpc-line-xy > span:first-child,
.tpc-line-len > span:first-child {
  flex: 0 0 28px;
  font-size: 10px;
  font-weight: 500;
  color: var(--app-text-muted);
}
.tpc-line-xy .tpc-input,
.tpc-line-len .tpc-input {
  flex: 1 1 0;
  min-width: 0;
  width: 0;
}
.tpc-line-capture {
  flex: 0 0 auto;
  padding: 3px 6px;
  font-size: 10px;
  white-space: nowrap;
}
.tpc-th-with-help {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.tpc-shape-preset-btn {
  flex: 0 0 auto;
  height: 18px;
  padding: 0 6px;
  border: 0;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  font-family: inherit;
  line-height: 1;
  letter-spacing: 0;
  color: var(--tpc-accent);
  background: color-mix(in srgb, var(--tpc-accent) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tpc-accent) 28%, transparent);
  cursor: pointer;
  white-space: nowrap;
}
.tpc-shape-preset-btn:hover:not(:disabled) {
  color: #fff;
  background: var(--tpc-accent);
  box-shadow: none;
}
.tpc-shape-preset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tpc-corner-help {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  font-size: 10px;
  font-weight: 650;
  font-family: inherit;
  line-height: 1;
  color: var(--app-text-muted);
  background: color-mix(in srgb, var(--app-text-primary) 7%, transparent);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-text-primary) 9%, transparent);
  transition:
    color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}
.tpc-corner-help:hover,
.tpc-corner-help:focus-visible {
  color: #fff;
  background: var(--tpc-accent);
  box-shadow:
    inset 0 0.5px 0 color-mix(in srgb, #fff 45%, transparent),
    0 2px 6px color-mix(in srgb, var(--tpc-accent) 42%, transparent);
  outline: none;
  transform: translateY(-0.5px);
}
.tpc-corner-help:active {
  transform: scale(0.9);
}
.tpc-task-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 22px;
  padding: 0 7px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--app-text-secondary);
  background: color-mix(in srgb, var(--app-text-primary) 7%, var(--app-card));
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--app-text-primary) 10%, var(--app-border));
}
.col-comp .tpc-btn-sm {
  width: 100%;
  padding-left: 4px;
  padding-right: 4px;
}
.muted { color: var(--app-text-muted); }

.tpc-path-seg {
  display: flex;
  gap: 0;
  min-width: 0;
  padding: 3px;
  background: color-mix(in srgb, var(--app-text-primary) 8%, var(--app-card-soft));
  border: 0;
  border-radius: 8px;
}
.tpc-path-seg button {
  flex: 1;
  min-width: 0;
  padding: 4px 3px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  font-family: inherit;
  color: var(--app-text-muted);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease,
    font-weight 0.16s ease;
}
.tpc-path-seg button:hover:not(.on) {
  color: var(--app-text-secondary);
}
.tpc-path-seg button.on {
  color: var(--app-text-primary);
  font-weight: 650;
  background: var(--app-card);
  box-shadow:
    0 0.5px 0 color-mix(in srgb, #fff 55%, transparent) inset,
    0 1px 2px color-mix(in srgb, var(--app-text-primary) 12%, transparent);
}

.tpc-curve-kind-overlay {
  position: fixed;
  inset: 0;
  z-index: 10060;
}
.tpc-curve-kind-menu {
  position: fixed;
  display: flex;
  flex-direction: column;
  min-width: 128px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  background: var(--app-card);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--app-text-primary) 16%, transparent);
}
.tpc-curve-kind-menu button {
  padding: 7px 10px;
  font-size: 12px;
  font-family: inherit;
  text-align: left;
  color: var(--app-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.tpc-curve-kind-menu button:hover {
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-text-primary) 8%, transparent);
}
.tpc-curve-kind-menu button.on {
  color: var(--app-text-primary);
  font-weight: 650;
  background: color-mix(in srgb, var(--app-text-primary) 10%, transparent);
}

.tpc-input,
.tpc-select {
  width: 100%;
  padding: 4px 6px;
  font-size: 12px;
  font-family: inherit;
  color: var(--app-text-primary);
  background: var(--app-input-bg);
  border: 1px solid var(--app-border);
  border-radius: 4px;
  outline: none;
}
.tpc-input[type="number"] {
  text-align: center;
}
.tpc-select {
  appearance: none;
  padding-right: 18px;
  color-scheme: inherit;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath stroke='%2364748b' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' d='m1 1 4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 10px 6px;
  cursor: pointer;
}
.tpc-input:focus,
.tpc-select:focus {
  border-color: var(--tpc-accent);
}
.tpc-input.invalid,
.tpc-select.invalid {
  border-color: #ef4444;
  background: color-mix(in srgb, #ef4444 12%, var(--app-input-bg));
}
.tpc-input::-webkit-outer-spin-button,
.tpc-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.tpc-input {
  appearance: textfield;
  -moz-appearance: textfield;
}
.tpc-input:disabled,
.tpc-select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  color: var(--app-text-muted);
}

.tpc-params-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tpc-params-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--app-text-muted);
  font-size: 12px;
}
.tpc-card {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-soft);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tpc-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-primary);
}
.tpc-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tpc-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--app-text-muted);
}
.tpc-xyz-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}
.tpc-xyz-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 7px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-input-bg);
}
.tpc-xyz-axis {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
}
.tpc-xyz-axis.axis-x {
  color: #d97706;
}
.tpc-xyz-axis.axis-y {
  color: #16a34a;
}
.tpc-xyz-axis.axis-z {
  color: #2563eb;
}
.tpc-xyz-val {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
.tpc-xyz-val.empty {
  color: var(--app-text-muted);
}
.tpc-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-input-bg);
  color: var(--app-text-secondary);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}
.tpc-switch-row .tpc-switch {
  appearance: none;
  width: 32px;
  height: 18px;
  margin: 0;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--app-border);
  position: relative;
  cursor: pointer;
  transition: background 0.15s;
}
.tpc-switch-row .tpc-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--app-card);
  box-shadow: 0 0 0 1px var(--app-border);
  transition: transform 0.15s;
}
.tpc-switch-row .tpc-switch:checked {
  background: #16a34a;
}
.tpc-switch-row .tpc-switch:checked::after {
  transform: translateX(14px);
  box-shadow: none;
  background: #fff;
}
.tpc-slot-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.tpc-slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--app-text-secondary);
}
.tpc-slot-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.tpc-slot-move {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  color: var(--app-text-secondary);
  font-size: 11px;
  white-space: nowrap;
}
.tpc-slot-move input {
  margin: 0;
  accent-color: #16a34a;
}
.tpc-slot-hint {
  margin: 0;
  font-size: 11px;
  color: #d97706;
}
.tpc-slot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.tpc-r-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-card);
}
.tpc-r-card.ready {
  border-color: color-mix(in srgb, #f59e0b 45%, var(--app-border));
  background: color-mix(in srgb, #f59e0b 8%, var(--app-card));
}
.tpc-r-card.spinning {
  border-color: color-mix(in srgb, #16a34a 50%, var(--app-border));
  background: color-mix(in srgb, #16a34a 8%, var(--app-card));
}
.tpc-r-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, #f59e0b 60%, var(--app-text-primary));
  background: color-mix(in srgb, #f59e0b 16%, var(--app-card));
  border: 1px solid color-mix(in srgb, #f59e0b 40%, var(--app-border));
}
.tpc-r-card.spinning .tpc-r-badge {
  color: #fff;
  background: #16a34a;
  border-color: #16a34a;
}
.tpc-r-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.tpc-r-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--app-text-primary);
  line-height: 1.2;
}
.tpc-r-meta {
  font-size: 11px;
  color: var(--app-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.tpc-r-card.ready .tpc-r-meta {
  color: color-mix(in srgb, #f59e0b 55%, var(--app-text-primary));
}
.tpc-r-card.spinning .tpc-r-meta {
  color: color-mix(in srgb, #16a34a 55%, var(--app-text-primary));
}
.tpc-r-ops {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}
.tpc-r-op {
  min-width: 72px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  border: 1px solid var(--app-border);
  background: var(--app-card-soft);
  color: var(--app-text-secondary);
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.tpc-r-op.start {
  color: color-mix(in srgb, #16a34a 55%, var(--app-text-primary));
  background: color-mix(in srgb, #16a34a 12%, var(--app-card));
  border-color: color-mix(in srgb, #16a34a 28%, var(--app-border));
}
.tpc-r-op.start:hover:not(:disabled) {
  color: #fff;
  background: #16a34a;
  border-color: #16a34a;
}
.tpc-r-op.pause {
  color: color-mix(in srgb, #d97706 55%, var(--app-text-primary));
  background: color-mix(in srgb, #d97706 12%, var(--app-card));
  border-color: color-mix(in srgb, #d97706 28%, var(--app-border));
}
.tpc-r-op.pause:hover:not(:disabled) {
  color: #fff;
  background: #d97706;
  border-color: #d97706;
}
.tpc-r-op:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tpc-ur-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-card);
  color: var(--app-text-primary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.12s;
}
.tpc-ur-entry:hover {
  border-color: color-mix(in srgb, #0ea5e9 55%, var(--app-border));
  background: color-mix(in srgb, #0ea5e9 8%, var(--app-card));
  transform: translateY(-1px);
}
.tpc-ur-entry:active {
  transform: translateY(0);
}
.tpc-ur-entry.ready {
  border-color: color-mix(in srgb, #0ea5e9 50%, var(--app-border));
  background: color-mix(in srgb, #0ea5e9 10%, var(--app-card));
}
.tpc-ur-entry.ready:hover {
  border-color: #0ea5e9;
}
.tpc-ur-axes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  flex-shrink: 0;
  width: 40px;
}
.tpc-ur-axis {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.tpc-ur-axis.u {
  color: color-mix(in srgb, #0ea5e9 55%, var(--app-text-primary));
  background: color-mix(in srgb, #0ea5e9 16%, var(--app-card));
  border: 1px solid color-mix(in srgb, #0ea5e9 40%, var(--app-border));
}
.tpc-ur-axis.r {
  color: color-mix(in srgb, #f59e0b 55%, var(--app-text-primary));
  background: color-mix(in srgb, #f59e0b 16%, var(--app-card));
  border: 1px solid color-mix(in srgb, #f59e0b 40%, var(--app-border));
}
.tpc-ur-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.tpc-ur-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--app-text-primary);
  line-height: 1.2;
}
.tpc-ur-meta {
  font-size: 11px;
  color: var(--app-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.tpc-ur-entry.ready .tpc-ur-meta {
  color: color-mix(in srgb, #0ea5e9 55%, var(--app-text-primary));
}
.tpc-ur-go {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: color-mix(in srgb, #0ea5e9 55%, var(--app-text-primary));
  background: color-mix(in srgb, #0ea5e9 12%, var(--app-card));
  border: 1px solid color-mix(in srgb, #0ea5e9 28%, var(--app-border));
}
.tpc-ur-entry.ready .tpc-ur-go {
  color: #fff;
  background: #0ea5e9;
  border-color: #0ea5e9;
}
.tpc-slot-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 48px;
  padding: 6px 4px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-input-bg);
  color: var(--app-text-secondary);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
}
.tpc-slot-cell.slot-empty {
  opacity: 0.72;
}
.tpc-slot-cell.slot-taught {
  border-color: color-mix(in srgb, #16a34a 45%, var(--app-border));
  background: color-mix(in srgb, #16a34a 10%, var(--app-card));
}
.tpc-slot-cell.slot-selected {
  border-color: color-mix(in srgb, var(--tpc-accent) 55%, var(--app-border));
  background: color-mix(in srgb, var(--tpc-accent) 12%, var(--app-card));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--tpc-accent) 18%, transparent);
}
.tpc-slot-cell.slot-bound {
  border-color: #d97706;
  background: color-mix(in srgb, #d97706 12%, var(--app-card));
  box-shadow: 0 0 0 2px color-mix(in srgb, #d97706 22%, transparent);
  color: color-mix(in srgb, #d97706 50%, var(--app-text-primary));
}
.tpc-slot-cell:hover {
  border-color: color-mix(in srgb, var(--tpc-accent) 40%, var(--app-border));
}
.tpc-slot-no {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.1;
}
.tpc-slot-name {
  font-size: 10px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.tpc-slot-tip {
  position: fixed;
  z-index: 10050;
  transform: translate(-50%, -100%);
  min-width: 108px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  background: var(--app-card);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--app-text-primary) 16%, transparent);
  color: var(--app-text-primary);
  font-size: 11px;
  line-height: 1.5;
  pointer-events: none;
  white-space: nowrap;
}
.tpc-slot-tip-title {
  margin-bottom: 2px;
  color: var(--app-text-secondary);
  font-weight: 600;
}
.tpc-slot-tip-empty {
  color: var(--app-text-muted);
}
.tpc-corner-tip {
  min-width: 200px;
}
.tpc-corner-tip-row {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: baseline;
  gap: 6px;
}
.tpc-corner-tip-shape {
  font-weight: 600;
}
.tpc-corner-tip-alias {
  color: var(--app-text-muted);
  font-size: 10px;
}
.tpc-corner-tip-value {
  color: var(--tpc-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.tpc-corner-tip-range {
  color: var(--app-text-muted);
  font-variant-numeric: tabular-nums;
}
.tpc-corner-tip-note {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--app-border);
  color: var(--app-text-muted);
  font-size: 10px;
}

.tpc-draw-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
  gap: 8px;
}
.tpc-draw-title {
  margin: 0;
  font-size: 16px;
  color: var(--app-text-secondary);
}
.tpc-draw-desc {
  margin: 0;
  font-size: 12px;
}

.tpc-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-top: 0.5px solid color-mix(in srgb, #fff 40%, var(--app-border));
  flex-shrink: 0;
  background: color-mix(in srgb, var(--app-card) 72%, transparent);
  backdrop-filter: blur(28px) saturate(1.8);
  -webkit-backdrop-filter: blur(28px) saturate(1.8);
}
.tpc-guide-text-btn {
  justify-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: auto;
  padding: 2px 4px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
}
.tpc-guide-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
  color: inherit;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-text-primary) 14%, transparent);
}
.tpc-guide-text-btn:hover,
.tpc-guide-text-btn:focus-visible {
  color: var(--tpc-accent);
  background: transparent;
  border-color: transparent;
  outline: none;
}
.tpc-guide-text-btn:hover .tpc-guide-mark,
.tpc-guide-text-btn:focus-visible .tpc-guide-mark {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tpc-accent) 45%, transparent);
}
.tpc-confirm {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 510;
  letter-spacing: -0.01em;
  color: var(--app-text-secondary);
  user-select: none;
}
.tpc-confirm input {
  accent-color: var(--tpc-apple-green);
}
.tpc-confirm-help {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: -4px;
  padding: 0;
  font-size: 12px;
  font-weight: 650;
  font-family: inherit;
  line-height: 1;
  color: var(--app-text-muted);
  background: color-mix(in srgb, var(--app-text-primary) 7%, transparent);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-text-primary) 9%, transparent);
}
.tpc-confirm-help:hover,
.tpc-confirm-help:focus-visible {
  color: var(--tpc-apple-blue);
  background: color-mix(in srgb, var(--tpc-apple-blue) 12%, transparent);
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--tpc-apple-blue) 40%, transparent);
  outline: none;
}
.tpc-status {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--app-text-muted);
  flex-shrink: 1;
  min-width: 0;
}
.tpc-file-ops {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.tpc-file {
  display: none;
}

.tpc-btn,
.tpc-btn-sm {
  border: 0;
  border-radius: 8px;
  background: var(--tpc-apple-fill);
  color: var(--tpc-apple-blue);
  cursor: pointer;
  font-size: 12px;
  font-weight: 590;
  letter-spacing: -0.01em;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}
.tpc-btn {
  padding: 6px 14px;
}
.tpc-btn-sm {
  padding: 4px 10px;
  border-radius: 7px;
}
.tpc-btn:hover:not(:disabled),
.tpc-btn-sm:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tpc-apple-blue) 12%, transparent);
  color: var(--tpc-apple-blue);
}
.tpc-btn:disabled,
.tpc-btn-sm:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
.tpc-btn.ghost {
  color: var(--app-text-secondary);
}
.tpc-btn.ghost:hover:not(:disabled) {
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-text-primary) 9%, transparent);
}
.tpc-btn.primary,
.tpc-btn.start {
  border: 0;
  background: var(--tpc-apple-blue);
  color: #fff;
  font-weight: 650;
  border-radius: 8px;
  box-shadow: none;
}
.tpc-btn.primary:hover:not(:disabled),
.tpc-btn.start:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tpc-apple-blue) 88%, #000);
  color: #fff;
}
.tpc-btn-sm.add {
  color: var(--tpc-apple-blue);
  background: color-mix(in srgb, var(--tpc-apple-blue) 12%, transparent);
}

.tpc-dlg-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #000 28%, transparent);
  backdrop-filter: blur(28px) saturate(1.4);
  -webkit-backdrop-filter: blur(28px) saturate(1.4);
}
.tpc-dlg-card {
  width: 420px;
  max-width: 92vw;
  background: color-mix(in srgb, var(--app-card) 78%, transparent);
  border: 0.5px solid color-mix(in srgb, #fff 55%, var(--app-border));
  border-radius: 16px;
  padding: 18px 16px 16px;
  box-shadow:
    0 0 0 0.5px color-mix(in srgb, #fff 28%, transparent) inset,
    0 18px 50px color-mix(in srgb, #000 16%, transparent);
  backdrop-filter: blur(40px) saturate(1.6);
  -webkit-backdrop-filter: blur(40px) saturate(1.6);
  color: var(--app-text-primary);
}
.tpc-dlg-wide {
  width: 520px;
}
.tpc-dlg-head {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.03em;
  color: var(--app-text-primary);
  margin-bottom: 8px;
}
.tpc-dlg-body {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--app-text-secondary);
}
.tpc-dlg-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--app-text-muted);
  margin-bottom: 14px;
  font-variant-numeric: tabular-nums;
}
.tpc-dlg-btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.tpc-start-list {
  max-height: 280px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.tpc-start-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 0.5px solid color-mix(in srgb, #fff 28%, var(--app-border));
  border-radius: 10px;
  background: var(--tpc-apple-fill);
  cursor: pointer;
}
.tpc-start-item.selected {
  border-color: color-mix(in srgb, var(--tpc-apple-blue) 45%, var(--app-border));
  background: color-mix(in srgb, var(--tpc-apple-blue) 12%, transparent);
}
.tpc-start-item.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.tpc-start-index {
  font-size: 11px;
  color: var(--app-text-muted);
}
.tpc-start-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.tpc-start-name {
  font-size: 13px;
  color: var(--app-text-primary);
}
.tpc-start-meta {
  font-size: 11px;
  color: var(--app-text-muted);
}
</style>
