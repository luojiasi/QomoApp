<script setup lang="ts">
import { computed, nextTick, onMounted, ref, toRaw } from 'vue'
import { useHardwareState } from '@/shared/api/hardware'
import { useNotification } from '@/shared/composables/useNotification'
import { useRecipeSettingsStore } from '@/modules/recipe/useRecipeStore'
import { useProgramRunner } from '@/modules/program/composables/useProgramRunner'
import {
  getTenPlusCutting,
  saveTenPlusCutting,
  moveToTenPlusSlot,
  setMotionIoOutput
} from '@/modules/motion/api'
import { sendTenPlusFreeParams } from '@/modules/program/api'
import {
  TEN_PLUS_GRID_ORDER,
  TEN_PLUS_PATH_TYPE_OPTIONS,
  TEN_PLUS_STATION_OUTPUT_PORTS,
  slotIndexToOutputPort
} from '../constants/tenPlusCutting'
import {
  useTenPlusTask,
  isDiameterInvalid,
  isAngleInvalid,
  isHeightInvalid,
  isTableAngle,
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
import type { TenPlusCuttingConfig, TenPlusFreeParamPayload, TenPlusSlot, TenPlusTarget } from '../types/tenPlusCutting'
import TenPlusCuttingPage_UrCalibDialog from '../components/TenPlusCuttingPage_UrCalibDialog.vue'
import TenPlusCuttingPage_CompDialog from '../components/TenPlusCuttingPage_CompDialog.vue'

type WorkMode = 'freeParam' | 'drawImage'

const { warning, success, error } = useNotification()
const recipeStore = useRecipeSettingsStore()
const { mposition, controllerConnected } = useHardwareState()
const {
  programRunning,
  programPaused,
  programTaskCount
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
  removeRow,
  bindActiveTargetToSlot,
  exportToFile,
  loadFromFile
} = useTenPlusTask()

const workMode = ref<WorkMode>('freeParam')
const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const statusMsg = ref('')
const starting = ref(false)
const processConfirmed = ref(false)
const showStartDialog = ref(false)
const dialogSelectedIds = ref<string[]>([])
const tenPlusConfig = ref<TenPlusCuttingConfig>(createEmptyTenPlusConfig())
const selectedSlotIndex = ref<number | null>(null)
const slotBusy = ref(false)
/** 点击已示教工位时是否运动到该点，默认开启 */
const moveOnSlotClick = ref(true)
const showTeachDialog = ref(false)
const teachDialogSlot = ref<number | null>(null)
const showUrCalibDialog = ref(false)
const urCalibSlot = ref<number | null>(null)
const compDialogRow = ref<TenPlusTarget['rows'][number] | null>(null)

function openCompDialog(row: TenPlusTarget['rows'][number]): void {
  compDialogRow.value = row
}

function closeCompDialog(): void {
  compDialogRow.value = null
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

function validateTargetRows(targetName: string, rows: TenPlusTarget['rows']): string | null {
  for (const row of rows) {
    const at = `${targetName} #${row.taskNo}`
    if (isDiameterInvalid(row.diameter)) return `${at}: 直径必须在 0~200 之间`
    if (isAngleInvalid(row.angle)) return `${at}: 角度必须在 -90~90 之间`
    if (isHeightInvalid(row.height)) return `${at}: 高度必须在 0~20 之间`
    if (isDivisionsInvalid(row.divisions)) return `${at}: 分割数须为 0 或 3~360`
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
    rows: buildTenPlusRowsFromTargets(selected)
  }

  starting.value = true
  try {
    const res = await sendTenPlusFreeParams(payload as unknown as Record<string, unknown>)
    if (res.success) {
      const tc = typeof res.data?.task_count === 'number' ? res.data.task_count : payload.rows.length
      programTaskCount.value = tc
      programRunning.value = true
      programPaused.value = false
      localStorage.setItem('qomo.startProgram.startedAtMs', String(Date.now()))
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

    <header class="tpc-top">
      <div class="tpc-top-left">
        <RouterLink to="/home" class="tpc-home-link">返回首页</RouterLink>
        <div>
          <h1 class="tpc-title">十轴切割</h1>
          <p class="tpc-sub">多目标任务参数 · 十工位示教绑定 · 开始切割</p>
        </div>
      </div>
      <div class="tpc-mode" role="tablist">
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
    </header>

    <div v-if="workMode === 'freeParam'" class="tpc-body">
      <!-- 左：目标列表 -->
      <aside class="tpc-targets">
        <div class="tpc-panel-head">
          <span>编程目标</span>
          <button type="button" class="tpc-btn-sm" @click="handleAddTarget">+ 新建</button>
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

      <!-- 中：任务表 -->
      <section class="tpc-workspace">
        <div class="tpc-workspace-head">
          <div>
            <span class="tpc-kicker">任务参数表</span>
            <span class="tpc-active-name">{{ activeTarget?.name ?? '—' }}</span>
            <span class="tpc-hint">双击目标名可重命名</span>
          </div>
          <button type="button" class="tpc-btn-sm add" :disabled="!activeTarget" @click="addRow">
            + 添加任务
          </button>
        </div>
        <div class="tpc-table-wrap">
          <table class="tpc-table">
            <thead>
              <tr>
                <th class="col-path">类型</th>
                <th class="col-no">序号</th>
                <th class="col-num">直径 (mm)</th>
                <th class="col-num">角度 (°)</th>
                <th class="col-num">高度 (mm)</th>
                <th class="col-num">分割数</th>
                <th class="col-num">弦长倍率</th>
                <th class="col-recipe">配方</th>
                <th class="col-comp">补偿</th>
                <th class="col-act" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in taskRows" :key="row.id">
                <td class="col-path">
                  <div class="tpc-path-seg" role="radiogroup" aria-label="类型">
                    <button
                      v-for="item in TEN_PLUS_PATH_TYPE_OPTIONS"
                      :key="item.value"
                      type="button"
                      role="radio"
                      :aria-checked="row.pathType === item.value"
                      :class="{ on: row.pathType === item.value }"
                      :title="item.label"
                      @click="row.pathType = item.value"
                    >
                      {{ item.label }}
                    </button>
                  </div>
                </td>
                <td class="col-no">
                  <span class="tpc-task-no">{{ row.taskNo }}</span>
                </td>
                <td class="col-num">
                  <input
                    v-model.number="row.diameter"
                    type="number"
                    class="tpc-input"
                    :class="{ invalid: isDiameterInvalid(row.diameter) }"
                    step="0.01"
                    min="0"
                    max="200"
                    :title="isDiameterInvalid(row.diameter) ? '直径必须在 0~200 之间' : ''"
                  />
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
                    :class="{ invalid: isHeightInvalid(row.height) }"
                    min="0"
                    max="20"
                    step="0.001"
                    :disabled="isTableAngle(row.angle)"
                    :title="
                      isTableAngle(row.angle)
                        ? '台面行（角度为 0）高度固定为 0'
                        : isHeightInvalid(row.height)
                          ? '高度必须在 0~20 之间'
                          : ''
                    "
                  />
                </td>
                <td class="col-num">
                  <input
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
            <label class="tpc-switch-row" title="是否对该目标做对切">
              <span>是否对切</span>
              <input v-model="activeTarget.oppositeCut" type="checkbox" class="tpc-switch" />
            </label>

            <div class="tpc-slot-block">
              <div class="tpc-slot-head">
                <span>工位选择</span>
                <div class="tpc-slot-head-actions">
                  <label class="tpc-slot-move" title="勾选后，点击已示教工位会运动到该点">
                    <input v-model="moveOnSlotClick" type="checkbox" />
                    <span>点击移动</span>
                  </label>
                  <button
                    type="button"
                    class="tpc-btn-sm"
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
              <div class="tpc-slot-grid">
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
              <button
                type="button"
                class="tpc-ur-entry"
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

    <footer class="tpc-footer">
      <label class="tpc-confirm">
        <input v-model="processConfirmed" type="checkbox" :disabled="starting" />
        <span>已确认可正常加工</span>
      </label>
      <button
        type="button"
        class="tpc-btn start"
        :disabled="starting || !processConfirmed"
        @click="onStart"
      >
        {{ starting ? '启动中…' : '开始任务' }}
      </button>
      <span v-if="statusMsg" class="tpc-status" :title="statusMsg">{{ statusMsg }}</span>
      <div class="tpc-footer-spacer" />
      <input
        ref="fileInputRef"
        type="file"
        accept=".jjs,application/json"
        class="tpc-file"
        @change="onFileChange"
      />
      <button type="button" class="tpc-btn ghost" @click="onLoadClick">读取</button>
      <button type="button" class="tpc-btn ghost" @click="onSave">保存</button>
    </footer>
  </div>
</template>

<style scoped>
.tpc-page,
.tpc-dlg-overlay,
.tpc-slot-tip {
  --tpc-accent: #0ea5e9;
}
.tpc-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--app-bg);
  color: var(--app-text-primary);
  overflow: hidden;
}

.tpc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-border);
  flex-shrink: 0;
  background: var(--app-card);
}
.tpc-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
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
}
.tpc-mode {
  display: flex;
  gap: 6px;
}
.tpc-home-link {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--app-text-muted);
  background: var(--app-card-soft);
  border: 1px solid var(--app-border);
  border-radius: 6px;
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}
.tpc-home-link:hover {
  color: var(--app-text-primary);
  background: var(--app-card);
}
.tpc-mode-btn {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-card-soft);
  color: var(--app-text-secondary);
  cursor: pointer;
}
.tpc-mode-btn.active {
  border-color: var(--tpc-accent);
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--tpc-accent) 14%, var(--app-card));
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
  width: calc(78% / 9);
}
.tpc-table .col-path {
  width: 22%;
}
.col-no { text-align: center; }
.tpc-task-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: #fff;
  background: var(--tpc-accent);
}
.col-comp .tpc-btn-sm {
  width: 100%;
  padding-left: 4px;
  padding-right: 4px;
}
.muted { color: var(--app-text-muted); }

.tpc-path-seg {
  display: flex;
  gap: 2px;
  min-width: 0;
  padding: 2px;
  background: var(--app-input-bg);
  border: 1px solid var(--app-border);
  border-radius: 6px;
}
.tpc-path-seg button {
  flex: 1;
  min-width: 0;
  padding: 3px 5px;
  font-size: 11px;
  line-height: 1.2;
  font-family: inherit;
  color: var(--app-text-muted);
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tpc-path-seg button:hover:not(.on) {
  color: var(--app-text-secondary);
  background: var(--app-card-soft);
}
.tpc-path-seg button.on {
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--tpc-accent) 16%, var(--app-card));
  box-shadow: inset 0 0 0 1px var(--tpc-accent);
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
.tpc-switch {
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
.tpc-switch::after {
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
.tpc-switch:checked {
  background: #16a34a;
}
.tpc-switch:checked::after {
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
  border-top: 1px solid var(--app-border);
  flex-shrink: 0;
  background: var(--app-card);
}
.tpc-confirm {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--app-text-secondary);
  user-select: none;
}
.tpc-status {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--app-text-muted);
}
.tpc-footer-spacer {
  flex: 1;
}
.tpc-file {
  display: none;
}

.tpc-btn,
.tpc-btn-sm {
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-card-soft);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.tpc-btn {
  padding: 6px 14px;
  font-weight: 500;
}
.tpc-btn-sm {
  padding: 4px 10px;
}
.tpc-btn:hover:not(:disabled),
.tpc-btn-sm:hover:not(:disabled) {
  background: var(--app-card);
  color: var(--app-text-primary);
  border-color: var(--tpc-accent);
}
.tpc-btn:disabled,
.tpc-btn-sm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tpc-btn.primary,
.tpc-btn.start {
  background: color-mix(in srgb, var(--tpc-accent) 15%, var(--app-card));
  border-color: color-mix(in srgb, var(--tpc-accent) 50%, var(--app-border));
  color: var(--app-text-primary);
}
.tpc-btn.primary:hover:not(:disabled),
.tpc-btn.start:hover:not(:disabled) {
  background: var(--tpc-accent);
  border-color: var(--tpc-accent);
  color: #fff;
}
.tpc-btn-sm.add {
  border-color: color-mix(in srgb, var(--tpc-accent) 50%, var(--app-border));
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--tpc-accent) 10%, var(--app-card));
}

.tpc-dlg-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--app-text-primary) 35%, transparent);
}
.tpc-dlg-card {
  width: 420px;
  max-width: 92vw;
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 16px 48px color-mix(in srgb, var(--app-text-primary) 18%, transparent);
  color: var(--app-text-primary);
}
.tpc-dlg-wide {
  width: 520px;
}
.tpc-dlg-head {
  font-size: 15px;
  font-weight: 600;
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
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-soft);
  cursor: pointer;
}
.tpc-start-item.selected {
  border-color: var(--tpc-accent);
  background: color-mix(in srgb, var(--tpc-accent) 12%, var(--app-card));
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
