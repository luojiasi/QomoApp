<script setup lang="ts">
import { computed, nextTick, onMounted, ref, toRaw } from 'vue'
import { useHardwareState } from '@/shared/api/hardware'
import { useNotification } from '@/shared/composables/useNotification'
import { useRecipeSettingsStore } from '@/modules/recipe/useRecipeStore'
import { useProgramRunner } from '@/modules/program/composables/useProgramRunner'
import {
  getTenPlusCutting,
  saveTenPlusCutting,
  moveToTenPlusSlot
} from '@/modules/motion/api'
import { sendTenPlusFreeParams } from '@/modules/program/api'
import { TEN_PLUS_GRID_ORDER } from '../constants/tenPlusCutting'
import {
  useTenPlusTask,
  isDiameterInvalid,
  isAngleInvalid,
  isHeightInvalid,
  isDivisionsInvalid,
  isRecipeInvalid
} from '../composables/useTenPlusTask'
import {
  createEmptyTenPlusConfig,
  normalizeTenPlusConfig,
  formatPointXy
} from '../utils/tenPlusConfig'
import {
  buildTenPlusRowsFromTargets,
  toTenPlusTargetSummary
} from '../utils/tenPlusPayload'
import type { TenPlusCuttingConfig, TenPlusFreeParamPayload, TenPlusSlot, TenPlusTarget } from '../types/tenPlusCutting'
import TenPlusCuttingPage_UrCalibDialog from '../components/TenPlusCuttingPage_UrCalibDialog.vue'

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

function capturePointXy(): void {
  const target = activeTarget.value
  if (!target) return
  const x = formatAxis(mposition.value['X'])
  const y = formatAxis(mposition.value['Y'])
  target.pointXy = `(${x},${y})`
}

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
  if (!target.pointXy || !String(target.pointXy).trim()) return false
  if (!target.rows.length) return false
  return true
}

function targetStartBlockReason(target: TenPlusTarget): string {
  if (target.slotIndex === null || target.slotIndex === undefined) return '未绑定工位'
  if (!target.pointXy || !String(target.pointXy).trim()) return '无点位 XY'
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

async function onSlotClick(index: number): Promise<void> {
  const target = activeTarget.value
  if (!target) return
  const slot = getSlot(index)
  if (!slot) return

  selectedSlotIndex.value = index

  if (!slot.taught) {
    setStatus(`已选中工位 #${index}（未示教，请先示教）`)
    return
  }

  const ok = bindActiveTargetToSlot(index, formatPointXy(slot.x, slot.y))
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
      activeTarget.value.pointXy = formatPointXy(x, y)
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
                <th class="col-no">序号</th>
                <th class="col-num">直径 (mm)</th>
                <th class="col-num">角度 (°)</th>
                <th class="col-num">角度补偿</th>
                <th class="col-num">高度 (mm)</th>
                <th class="col-num">分割数</th>
                <th class="col-num">X补偿</th>
                <th class="col-num">Y补偿</th>
                <th class="col-num">Z补偿</th>
                <th class="col-num">弦长倍率</th>
                <th class="col-num">K</th>
                <th class="col-num">B</th>
                <th class="col-num">X</th>
                <th class="col-recipe">配方</th>
                <th class="col-act" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in taskRows" :key="row.id">
                <td class="col-no muted">{{ row.taskNo }}</td>
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
                  />
                </td>
                <td class="col-num">
                  <input v-model.number="row.compAngle" type="number" class="tpc-input" step="0.01" />
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
                    :title="isHeightInvalid(row.height) ? '高度必须在 0~20 之间' : ''"
                  />
                </td>
                <td class="col-num">
                  <input
                    v-model.number="row.divisions"
                    type="number"
                    class="tpc-input"
                    :class="{ invalid: isDivisionsInvalid(row.divisions) }"
                    :title="isDivisionsInvalid(row.divisions) ? '分割数须为 0 或 3~360' : ''"
                  />
                </td>
                <td class="col-num">
                  <input v-model.number="row.compX" type="number" class="tpc-input" step="0.001" />
                </td>
                <td class="col-num">
                  <input v-model.number="row.compY" type="number" class="tpc-input" step="0.001" />
                </td>
                <td class="col-num">
                  <input v-model.number="row.compZ" type="number" class="tpc-input" step="0.001" />
                </td>
                <td class="col-num">
                  <input v-model.number="row.chordRatio" type="number" class="tpc-input" step="0.1" />
                </td>
                <td class="col-num">
                  <input
                    v-model.number="row.k"
                    type="number"
                    class="tpc-input"
                    step="0.001"
                    title="线性系数 K"
                  />
                </td>
                <td class="col-num">
                  <input
                    v-model.number="row.b"
                    type="number"
                    class="tpc-input"
                    step="0.001"
                    title="线性系数 B"
                  />
                </td>
                <td class="col-num">
                  <input
                    v-model.number="row.x"
                    type="number"
                    class="tpc-input"
                    step="0.001"
                    title="变量 X"
                  />
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
            <div class="tpc-card-title">点位 XY</div>
            <div class="tpc-xy-row">
              <input
                :value="activeTarget.pointXy"
                type="text"
                class="tpc-input tpc-xy"
                placeholder="(x,y)"
                readonly
              />
              <button type="button" class="tpc-btn-sm" title="获取当前机床 XY" @click="capturePointXy">
                获取
              </button>
            </div>

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
.tpc-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: #09090b;
  color: #d4d4d8;
  overflow: hidden;
}

.tpc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #27272a;
  flex-shrink: 0;
}
.tpc-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #e4e4e7;
}
.tpc-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #71717a;
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
  color: #eff6ff;
  background: #1d4ed8;
  border: 1px solid #1d4ed8;
  border-radius: 6px;
  text-decoration: none;
  transition: background 0.15s;
}
.tpc-home-link:hover {
  background: #2563eb;
}
.tpc-mode-btn {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid #27272a;
  border-radius: 6px;
  background: #18181b;
  color: #a1a1aa;
  cursor: pointer;
}
.tpc-mode-btn.active {
  border-color: #3b82f6;
  color: #93c5fd;
  background: #172554;
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
  background: #131316;
  border: 1px solid #27272a;
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
  border-bottom: 1px solid #27272a;
  font-size: 12px;
  color: #a1a1aa;
  flex-shrink: 0;
}
.tpc-kicker {
  font-weight: 600;
  color: #e4e4e7;
  margin-right: 8px;
}
.tpc-active-name {
  color: #93c5fd;
  margin-right: 8px;
}
.tpc-hint {
  font-size: 11px;
  color: #52525b;
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
  border: 1px solid #27272a;
  border-radius: 8px;
  background: #18181b;
  padding: 4px;
  cursor: pointer;
}
.tpc-target-item.active {
  border-color: #3b82f6;
  background: #172554;
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
  color: #71717a;
  font-variant-numeric: tabular-nums;
}
.tpc-target-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.tpc-target-name {
  font-size: 13px;
  color: #e4e4e7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpc-target-meta {
  font-size: 11px;
  color: #71717a;
}
.tpc-target-del,
.tpc-row-del {
  background: none;
  border: none;
  color: #71717a;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
}
.tpc-target-del:hover:not(:disabled),
.tpc-row-del:hover:not(:disabled) {
  color: #f87171;
  background: #27272a;
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
  color: #e4e4e7;
  background: #09090b;
  border: 1px solid #3b82f6;
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
  border-collapse: collapse;
  font-size: 12px;
}
.tpc-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #18181b;
  color: #71717a;
  font-weight: 500;
  padding: 6px 4px;
  border-bottom: 1px solid #27272a;
  white-space: nowrap;
}
.tpc-table td {
  padding: 4px;
  border-bottom: 1px solid #1f1f23;
}
.col-no { width: 40px; text-align: center; }
.col-num { width: 72px; }
.col-recipe { min-width: 110px; }
.col-act { width: 32px; }
.muted { color: #71717a; }

.tpc-input,
.tpc-select {
  width: 100%;
  padding: 4px 6px;
  font-size: 12px;
  font-family: inherit;
  color: #d4d4d8;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 4px;
  outline: none;
}
.tpc-input:focus,
.tpc-select:focus {
  border-color: #3b82f6;
}
.tpc-input.invalid,
.tpc-select.invalid {
  border-color: #ef4444;
  background: rgba(127, 29, 29, 0.25);
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
  color: #52525b;
  font-size: 12px;
}
.tpc-card {
  border: 1px solid #27272a;
  border-radius: 8px;
  background: #18181b;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tpc-card-title {
  font-size: 12px;
  font-weight: 600;
  color: #e4e4e7;
}
.tpc-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #71717a;
}
.tpc-xy-row {
  display: flex;
  gap: 6px;
}
.tpc-xy {
  flex: 1;
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
  color: #a1a1aa;
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
  color: #a1a1aa;
  font-size: 11px;
  white-space: nowrap;
}
.tpc-slot-move input {
  margin: 0;
  accent-color: #4ade80;
}
.tpc-slot-hint {
  margin: 0;
  font-size: 11px;
  color: #f0b429;
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
  padding: 8px 8px 8px 8px;
  border: 1px solid #3f3f46;
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(24, 24, 27, 0.95), rgba(9, 9, 11, 0.95));
  color: #e4e4e7;
  cursor: pointer;
  text-align: left;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.12s;
}
.tpc-ur-entry:hover {
  border-color: rgba(56, 189, 248, 0.45);
  background: linear-gradient(180deg, #1c2430, #111827);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(56, 189, 248, 0.12);
  transform: translateY(-1px);
}
.tpc-ur-entry:active {
  transform: translateY(0);
}
.tpc-ur-entry.ready {
  border-color: rgba(56, 189, 248, 0.55);
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(56, 189, 248, 0.14), transparent 55%),
    linear-gradient(180deg, #152033, #0c1220);
}
.tpc-ur-entry.ready:hover {
  border-color: rgba(125, 211, 252, 0.7);
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
  color: #7dd3fc;
  background: rgba(14, 165, 233, 0.16);
  border: 1px solid rgba(56, 189, 248, 0.4);
}
.tpc-ur-axis.r {
  color: #fcd34d;
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(251, 191, 36, 0.38);
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
  color: #f4f4f5;
  line-height: 1.2;
}
.tpc-ur-meta {
  font-size: 11px;
  color: #71717a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.tpc-ur-entry.ready .tpc-ur-meta {
  color: #7dd3fc;
}
.tpc-ur-go {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.28);
}
.tpc-ur-entry.ready .tpc-ur-go {
  color: #0f172a;
  background: #38bdf8;
  border-color: #38bdf8;
}
.tpc-slot-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 48px;
  padding: 6px 4px;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  background: #09090b;
  color: #a1a1aa;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
}
.tpc-slot-cell.slot-empty {
  opacity: 0.72;
}
.tpc-slot-cell.slot-taught {
  border-color: rgba(74, 222, 128, 0.45);
  background: rgba(74, 222, 128, 0.08);
}
.tpc-slot-cell.slot-selected {
  border-color: rgba(59, 130, 246, 0.55);
  background: rgba(59, 130, 246, 0.12);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18);
}
.tpc-slot-cell.slot-bound {
  border-color: #f0b429;
  background: rgba(240, 180, 41, 0.12);
  box-shadow: 0 0 0 2px rgba(240, 180, 41, 0.22);
  color: #f0b429;
}
.tpc-slot-cell:hover {
  border-color: rgba(59, 130, 246, 0.4);
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
  border: 1px solid #3f3f46;
  background: #18181b;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  color: #e4e4e7;
  font-size: 11px;
  line-height: 1.5;
  pointer-events: none;
  white-space: nowrap;
}
.tpc-slot-tip-title {
  margin-bottom: 2px;
  color: #a1a1aa;
  font-weight: 600;
}
.tpc-slot-tip-empty {
  color: #71717a;
}

.tpc-draw-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #71717a;
  gap: 8px;
}
.tpc-draw-title {
  margin: 0;
  font-size: 16px;
  color: #a1a1aa;
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
  border-top: 1px solid #27272a;
  flex-shrink: 0;
  background: #131316;
}
.tpc-confirm {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #a1a1aa;
  user-select: none;
}
.tpc-status {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #71717a;
}
.tpc-footer-spacer {
  flex: 1;
}
.tpc-file {
  display: none;
}

.tpc-btn,
.tpc-btn-sm {
  border: 1px solid #27272a;
  border-radius: 6px;
  background: #18181b;
  color: #a1a1aa;
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
  background: #27272a;
  color: #e4e4e7;
}
.tpc-btn:disabled,
.tpc-btn-sm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tpc-btn.primary,
.tpc-btn.start {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #eff6ff;
}
.tpc-btn.primary:hover:not(:disabled),
.tpc-btn.start:hover:not(:disabled) {
  background: #2563eb;
}
.tpc-btn-sm.add {
  border-color: #1d4ed8;
  color: #93c5fd;
}

.tpc-dlg-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}
.tpc-dlg-card {
  width: 420px;
  max-width: 92vw;
  background: #131316;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}
.tpc-dlg-wide {
  width: 520px;
}
.tpc-dlg-head {
  font-size: 15px;
  font-weight: 600;
  color: #e4e4e7;
  margin-bottom: 8px;
}
.tpc-dlg-body {
  margin: 0 0 12px;
  font-size: 13px;
  color: #a1a1aa;
}
.tpc-dlg-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: #71717a;
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
  border: 1px solid #27272a;
  border-radius: 8px;
  background: #18181b;
  cursor: pointer;
}
.tpc-start-item.selected {
  border-color: #3b82f6;
  background: #172554;
}
.tpc-start-item.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.tpc-start-index {
  font-size: 11px;
  color: #71717a;
}
.tpc-start-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.tpc-start-name {
  font-size: 13px;
  color: #e4e4e7;
}
.tpc-start-meta {
  font-size: 11px;
  color: #71717a;
}
</style>
