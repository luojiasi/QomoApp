<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import CollapsiblePanelHeader from './CollapsiblePanelHeader.vue'
import { useNotification } from '@renderer/composables/useNotification'
import { useQomo5PStore } from '../stores/qomo5pEditor'
import { storeToRefs } from 'pinia'
import type { Point, QomoArcSurfacesEntity } from '@renderer/types/Qomo5P'
import { useControllerSettingsStore } from '../stores/controllerSettingsStore'
import { getMotionIoInput, moveMotionAxisRel, zeroMotionAxis } from '../utils/motionApi'
const controllerStore = useControllerSettingsStore()

const props = withDefaults(
  defineProps<{
    programRunning?: boolean
    programElapsedText?: string
  }>(),
  {
    programRunning: false,
    programElapsedText: '00:00:00'
  }
)



const isHelpPanelExpanded = ref(true)

const { success, error } = useNotification()
const qomo5pStore = useQomo5PStore()
const { entities, selectedEntityIds, layers } = storeToRefs(qomo5pStore)

const visibleLayerIdSet = computed(() => new Set(layers.value.filter((l) => l.visible).map((l) => l.id)))
const selectableEntities = computed(() => entities.value.filter((e) => visibleLayerIdSet.value.has(e.layerId)))

const importFileInputRef = ref<HTMLInputElement | null>(null)

type CreateWizardStep = 'height' | 'shape' | 'params'
type CreateShapeType = 'LINE' | 'CIRCLE'

const isCreateWizardOpen = ref(false)
const createWizardStep = ref<CreateWizardStep>('height')
const unifyExtrudeHeight = ref(true)
const unifiedExtrudeHeightInput = ref<number>(5)
const createShapeType = ref<CreateShapeType>('LINE')

const createWizardPanelRef = ref<HTMLElement | null>(null)
let lastActiveElementBeforeWizard: Element | null = null

const lineStart = ref<Point>({ x: 0, y: 0 })
const lineEnd = ref<Point>({ x: 10, y: 0 })
const circleCenter = ref<Point>({ x: 0, y: 0 })
const circleRadius = ref<number>(5)
const perEntityExtrudeHeightInput = ref<number>(5)
const isAxisFetching = ref(false)
const newImageHoming = ref(false)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 轴 3（axisNo === 2）在控制器配置中的正限位输入口编号（fwd_in）。
 * 约定：未压限位时为 true，压到上限位后变为 false。
 */
const getAxis3UpperLimitInputNo = (): number | null => {
  const axis = controllerStore.controllerSettings.axes.find((a) => a.axisNo === 2)
  if (!axis) return null
  const n = Number(axis.fwd_in)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

/**
 * 轮询读取轴 3 上限位输入：先确认曾离开限位（值为 true），再等到变为 false 视为到位。
 */
const waitAxis3UpperLimitInputFalse = async (timeoutMs = 6000) => {
  const ioNo = getAxis3UpperLimitInputNo()
  if (ioNo === null) return false

  const startAt = Date.now()
  let seenNotAtLimit = false
  while (Date.now() - startAt < timeoutMs) {
    const res = await getMotionIoInput(ioNo)
    console.log('res', res)
    if (res?.success && res.data && typeof res.data.value === 'boolean') {
      if (res.data.value === true) seenNotAtLimit = true
      if (seenNotAtLimit && res.data.value === false) return true
    }
    await sleep(200)
  }
  return false
}

const resetCreateWizard = () => {
  createWizardStep.value = 'height'
  unifyExtrudeHeight.value = true
  unifiedExtrudeHeightInput.value = 5
  createShapeType.value = 'LINE'
  lineStart.value = { x: 0, y: 0 }
  lineEnd.value = { x: 10, y: 0 }
  circleCenter.value = { x: 0, y: 0 }
  circleRadius.value = 5
  perEntityExtrudeHeightInput.value = 5
}

const openCreateWizard = () => {
  resetCreateWizard()
  isCreateWizardOpen.value = true
}

const closeCreateWizard = () => {
  isCreateWizardOpen.value = false
}

const getFocusableElementsInWizard = (): HTMLElement[] => {
  const root = createWizardPanelRef.value
  if (!root) return []
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button',
        'input',
        'select',
        'textarea',
        '[tabindex]:not([tabindex="-1"])'
      ].join(',')
    )
  )

  return candidates.filter((el) => {
    const disabled = (el as HTMLButtonElement | HTMLInputElement).disabled
    const ariaDisabled = el.getAttribute('aria-disabled') === 'true'
    const hidden = el.getAttribute('aria-hidden') === 'true'
    const style = window.getComputedStyle(el)
    const notVisible = style.display === 'none' || style.visibility === 'hidden'
    return !disabled && !ariaDisabled && !hidden && !notVisible
  })
}

const focusFirstWizardElement = () => {
  const els = getFocusableElementsInWizard()
  if (els.length > 0) {
    els[0].focus()
    return
  }
  createWizardPanelRef.value?.focus()
}

const handleWizardKeydown = (e: KeyboardEvent) => {
  if (!isCreateWizardOpen.value) return
  if (e.key !== 'Tab') return

  const focusables = getFocusableElementsInWizard()
  if (focusables.length === 0) {
    e.preventDefault()
    createWizardPanelRef.value?.focus()
    return
  }

  const active = document.activeElement as HTMLElement | null
  const currentIndex = active ? focusables.indexOf(active) : -1
  const lastIndex = focusables.length - 1

  // 若焦点不在弹窗内，也强制拉回到弹窗第一个
  if (currentIndex === -1) {
    e.preventDefault()
    focusables[0].focus()
    return
  }

  if (!e.shiftKey && currentIndex === lastIndex) {
    e.preventDefault()
    focusables[0].focus()
    return
  }

  if (e.shiftKey && currentIndex === 0) {
    e.preventDefault()
    focusables[lastIndex].focus()
  }
}

watch(
  () => isCreateWizardOpen.value,
  async (open) => {
    if (open) {
      lastActiveElementBeforeWizard = document.activeElement
      await nextTick()
      focusFirstWizardElement()
    } else {
      const el = lastActiveElementBeforeWizard as HTMLElement | null
      lastActiveElementBeforeWizard = null
      if (el?.focus) el.focus()
    }
  }
)

onBeforeUnmount(() => {
  lastActiveElementBeforeWizard = null
})

const handleImportClick = () => {
  importFileInputRef.value?.click()
}

const handleNewImage = async () => {
  if (newImageHoming.value) return
  newImageHoming.value = true
  try {
    // 1) 清零 X/Y（控制器层面的“位置清零”）
    const zx = await zeroMotionAxis(0)
    if (!zx?.success) {
      error(zx?.message || 'X 轴位置清零失败')
      return
    }
    const zy = await zeroMotionAxis(1)
    if (!zy?.success) {
      error(zy?.message || 'Y 轴位置清零失败')
      return
    }

    // 2) Z 轴向上走，直到停止（通常是到限位/到达行程终点）
    const Z_UP_TRAVEL_MM = 3000
    const moveZ = await moveMotionAxisRel(2, Z_UP_TRAVEL_MM, {
      controllerSettings: controllerStore.controllerSettings
    })
    if (!moveZ?.success) {
      error(moveZ?.message || 'Z 轴上升失败')
      return
    }

    if (getAxis3UpperLimitInputNo() === null) {
      error('未配置轴3上限位输入','请在控制器设置中为 axisNo=2 配置有效的正限位输入口')
      return
    }

    const ok = await waitAxis3UpperLimitInputFalse(5000)
    if (!ok) {
      error('等待轴3上限位超时', '请检查 Z 运动方向、限位接线及 fwd_in 编号')
      return
    }

    // 3) 到限位后清零 Z
    const zz = await zeroMotionAxis(2)
    if (!zz?.success) {
      error(zz?.message || 'Z 轴位置清零失败')
      return
    }

    success('已完成新建前回零', 'X/Y 已清零，Z 已上升到位并清零')

    // 4) 新建图像：覆盖掉当前已导入的图形数据，重新开始
    userSelectedNone.value = true
    qomo5pStore.createNewProject(`untitled-${Date.now()}`)
    qomo5pStore.clearSelection()
    openCreateWizard()
  } finally {
    newImageHoming.value = false
  }
}

const handleImportFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  const normalizedName = file.name.trim()
  const lowerName = normalizedName.toLowerCase()

  try {
    if (lowerName.endsWith('.ljs')) {
      const text = await file.text()
      qomo5pStore.importProjectFromLjs(text, normalizedName)
      success('导入成功', `已导入 ${normalizedName}`)
      return
    }

    if (lowerName.endsWith('.dxf')) {
      const text = await file.text()
      qomo5pStore.importProjectFromDxf(text, normalizedName)
      success('导入成功', `已导入 ${normalizedName}`)
      return
    }

    error('不支持的文件类型', '请导入 .ljs 或 .dxf 文件')
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    error('导入失败', message)
  } finally {
    if (input) input.value = ''
  }
}

// 当导入/加载后，store 内如果还没有选中项，则默认选中第一个实体，
// 以便 overlay 高亮 + 本卡片能显示数据。
// 默认不选中任何实体：避免切回首页时自动高亮第一个实体
const userSelectedNone = ref(true)
watch(
  () => [entities.value.length, selectedEntityIds.value.length] as const,
  ([entityLen, selectedLen]) => {
    if (entityLen > 0 && selectedLen === 0) {
      // 用户显式选择了“无”，就不要再自动选回第一个实体
      if (userSelectedNone.value) return
      const first = selectableEntities.value[0]
      if (first?.id) qomo5pStore.selectSingleEntity(first.id)
    }
  },
  { immediate: true }
)

const dropdownSelectedEntityId = computed<string>({
  get: () => selectedEntityIds.value[0] ?? '',
  set: (next) => {
    if (!next) {
      userSelectedNone.value = true
      qomo5pStore.clearSelection()
      return
    }
    userSelectedNone.value = false
    qomo5pStore.selectSingleEntity(next)
  }
})

const selectedEntity = computed(() => {
  const id = dropdownSelectedEntityId.value
  if (!id) return null
  return selectableEntities.value.find((e) => e.id === id) ?? null
})

const formatPoint = (p: { x: number; y: number }) => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`
const formatPointOrDash = (p?: Point | null) =>
  p ? `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})` : '—'

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

const getArcStartPoint = (e: QomoArcSurfacesEntity) => e.startPoint ?? polarToCartesian(e.center.x, e.center.y, e.radius, e.startAngle)
const getArcEndPoint = (e: QomoArcSurfacesEntity) => e.endPoint ?? polarToCartesian(e.center.x, e.center.y, e.radius, e.endAngle)

const clampFiniteNumber = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback)

const applyExtrudeHeightToSelected = (h: number) => {
  const id = selectedEntityIds.value[0]
  if (!id) return
  qomo5pStore.updateEntityParams(id, { extrudeHeight: h })
}

const goToWizardNext = () => {
  if (createWizardStep.value === 'height') {
    if (unifyExtrudeHeight.value) {
      unifiedExtrudeHeightInput.value = clampFiniteNumber(Number(unifiedExtrudeHeightInput.value), 5)
      if (unifiedExtrudeHeightInput.value <= 0) unifiedExtrudeHeightInput.value = 1e-6
    }
    createWizardStep.value = 'shape'
    return
  }
  if (createWizardStep.value === 'shape') {
    createWizardStep.value = 'params'
  }
}

const goToWizardPrev = () => {
  if (createWizardStep.value === 'params') {
    createWizardStep.value = 'shape'
    return
  }
  if (createWizardStep.value === 'shape') {
    createWizardStep.value = 'height'
  }
}

const getExtrudeHeightForEntity = () => {
  if (unifyExtrudeHeight.value) return unifiedExtrudeHeightInput.value
  const raw = clampFiniteNumber(Number(perEntityExtrudeHeightInput.value), 5)
  return raw > 0 ? raw : 1e-6
}

const addEntityFromWizard = () => {
  const extrudeHeight = getExtrudeHeightForEntity()

  if (createShapeType.value === 'LINE') {
    const start = {
      x: clampFiniteNumber(Number(lineStart.value.x), 0),
      y: clampFiniteNumber(Number(lineStart.value.y), 0)
    }
    const end = {
      x: clampFiniteNumber(Number(lineEnd.value.x), 0),
      y: clampFiniteNumber(Number(lineEnd.value.y), 0)
    }
    qomo5pStore.addLineEntity(start, end)
    applyExtrudeHeightToSelected(extrudeHeight)
    success('已添加直线', `高度：${extrudeHeight.toFixed(3)}`)
    return
  }

  const center = {
    x: clampFiniteNumber(Number(circleCenter.value.x), 0),
    y: clampFiniteNumber(Number(circleCenter.value.y), 0)
  }
  const radius = clampFiniteNumber(Number(circleRadius.value), 5)
  const normalizedRadius = radius > 0 ? radius : 1e-6
  qomo5pStore.addCircleEntity(center, normalizedRadius)
  applyExtrudeHeightToSelected(extrudeHeight)
  success('已添加圆', `高度：${extrudeHeight.toFixed(3)}`)
}

const axisMposLabels = computed(() => {
  const axisNames = ['X', 'Y']
  return axisNames.map((name, axisNo) => {
    const axis = controllerStore.controllerSettings.axes.find((a) => a.axisNo === axisNo)
    const mpos = axis ? Number(axis.mpos) : NaN
    return {
      name,
      value: Number.isFinite(mpos) ? mpos.toFixed(3) : '-'
    }
  })
})

const fillPointFromAxis = (target: 'lineStart' | 'lineEnd' | 'circleCenter') => {

  const posX = axisMposLabels.value.find((a) => a.name === "X")?.value
  const posY = axisMposLabels.value.find((a) => a.name === "Y")?.value
  if (!posX || !posY) return
  if (target === 'lineStart') lineStart.value = { x: Number(posX), y: Number(posY) }
  else if (target === 'lineEnd') lineEnd.value = { x: Number(posX), y: Number(posY) }
  else circleCenter.value = { x: Number(posX), y: Number(posY) }
  success('已获取当前轴位置', `(${Number(posX).toFixed(3)}, ${Number(posY).toFixed(3)})`)
}
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    :class="isHelpPanelExpanded ? 'min-h-[min(250px,42vh)]' : ''"
  >
    <CollapsiblePanelHeader
      v-model:expanded="isHelpPanelExpanded"
      title="操作帮助"
    />

    <div
      class="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-xs leading-relaxed text-(--app-text-secondary)"
    >
      <!-- 程序运行状态 / 耗时 -->
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
        aria-label="程序运行状态"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-(--app-text-primary)">程序状态</p>
            <p class="mt-1 text-[11px] text-(--app-text-muted)">
              {{ props.programRunning ? '运行中' : '空闲' }}
            </p>
          </div>
          <div class="shrink-0 text-right">
            <div class="text-[11px] text-(--app-text-muted)">已运行</div>
            <div class="mt-0.5 font-mono text-sm text-(--app-text-primary)">
              {{ props.programRunning ? props.programElapsedText : '00:00:00' }}
            </div>
          </div>
        </div>
      </div>

      <input
        ref="importFileInputRef"
        type="file"
        accept=".ljs,.dxf"
        class="hidden"
        @change="handleImportFileChange"
      />



      <!-- 新建图像（单独一个 card） -->
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <p class="font-medium text-(--app-text-primary)">新建图像</p>
        <div class="mt-3">
          <button
            type="button"
            :disabled="newImageHoming"
            class="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-(--app-text-primary) hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            @click="handleNewImage"
          >
            {{ newImageHoming ? '新建准备中…' : '新建新图像' }}
          </button>
        </div>
      </div>

      <!-- 新建图像向导（统一高度 / 形状 / 参数） -->
      <div v-if="isCreateWizardOpen" class="mt-3" @keydown.capture="handleWizardKeydown">
        <div
          ref="createWizardPanelRef"
          class="w-full max-w-xl rounded-2xl border border-(--app-border) bg-(--app-card) shadow-xl"
          role="region"
          aria-label="新建图像参数向导"
          tabindex="-1"
        >
          <div class="flex items-center justify-between gap-3 border-b border-(--app-border) p-4">
            <div class="min-w-0">
              <div class="text-base font-semibold text-(--app-text-primary)">新建图像 - 参数向导</div>
              <div class="mt-0.5 text-xs text-(--app-text-muted)">
                第 {{
                  createWizardStep === 'height' ? '1' : createWizardStep === 'shape' ? '2' : '3'
                }}/3 步
              </div>
            </div>
            <button
              type="button"
              class="rounded-lg border border-(--app-border) bg-(--app-card-soft) px-3 py-1.5 text-sm text-(--app-text-primary) hover:bg-(--app-card-soft-2)"
              @click="closeCreateWizard"
            >
              关闭
            </button>
          </div>

          <div class="p-4">
            <div v-if="createWizardStep === 'height'" class="space-y-3">
              <div class="text-sm font-medium text-(--app-text-primary)">是否统一高度</div>
              <label class="flex items-center gap-2 text-sm text-(--app-text-secondary)">
                <input v-model="unifyExtrudeHeight" type="checkbox" class="h-4 w-4" />
                统一高度（默认开启）
              </label>

              <div v-if="unifyExtrudeHeight" class="grid grid-cols-1 gap-2">
                <label class="text-xs text-(--app-text-muted)">统一高度（mm）</label>
                <input
                  v-model.number="unifiedExtrudeHeightInput"
                  type="number"
                  step="0.001"
                  class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none"
                />
                <div class="text-[11px] text-(--app-text-muted)">
                  后续新建的实体会使用该高度；若关闭统一高度，则每个实体需单独填写高度。
                </div>
              </div>
            </div>

            <div v-else-if="createWizardStep === 'shape'" class="space-y-3">
              <div class="text-sm font-medium text-(--app-text-primary)">选择形状</div>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="rounded-lg border px-3 py-2 text-sm"
                  :class="createShapeType === 'LINE'
                    ? 'border-sky-400/60 bg-sky-50/80 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200'
                    : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-primary) hover:bg-(--app-card-soft-2)'"
                  @click="createShapeType = 'LINE'"
                >
                  直线
                </button>
                <button
                  type="button"
                  class="rounded-lg border px-3 py-2 text-sm"
                  :class="createShapeType === 'CIRCLE'
                    ? 'border-sky-400/60 bg-sky-50/80 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200'
                    : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-primary) hover:bg-(--app-card-soft-2)'"
                  @click="createShapeType = 'CIRCLE'"
                >
                  圆
                </button>
              </div>
            </div>

            <div v-else class="space-y-4">
              <div class="text-sm font-medium text-(--app-text-primary)">输入参数</div>

              <div v-if="createShapeType === 'LINE'" class="space-y-3">
                <div class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-sm font-medium text-(--app-text-primary)">起点</div>
                    <button
                      type="button"
                      class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-1 text-xs text-(--app-text-primary) hover:bg-(--app-card-soft)"
                      :disabled="isAxisFetching"
                      @click="fillPointFromAxis('lineStart')"
                    >
                      获取当前轴的位置
                    </button>
                  </div>
                  <div class="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-xs text-(--app-text-muted)">X</label>
                      <input v-model.number="lineStart.x" type="number" step="0.001" class="mt-1 w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none" />
                    </div>
                    <div>
                      <label class="text-xs text-(--app-text-muted)">Y</label>
                      <input v-model.number="lineStart.y" type="number" step="0.001" class="mt-1 w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none" />
                    </div>
                  </div>
                </div>

                <div class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-sm font-medium text-(--app-text-primary)">终点</div>
                    <button
                      type="button"
                      class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-1 text-xs text-(--app-text-primary) hover:bg-(--app-card-soft)"
                      :disabled="isAxisFetching"
                      @click="fillPointFromAxis('lineEnd')"
                    >
                      获取当前轴的位置
                    </button>
                  </div>
                  <div class="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-xs text-(--app-text-muted)">X</label>
                      <input v-model.number="lineEnd.x" type="number" step="0.001" class="mt-1 w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none" />
                    </div>
                    <div>
                      <label class="text-xs text-(--app-text-muted)">Y</label>
                      <input v-model.number="lineEnd.y" type="number" step="0.001" class="mt-1 w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none" />
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="space-y-3">
                <div class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-sm font-medium text-(--app-text-primary)">圆心</div>
                    <button
                      type="button"
                      class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-1 text-xs text-(--app-text-primary) hover:bg-(--app-card-soft)"
                      :disabled="isAxisFetching"
                      @click="fillPointFromAxis('circleCenter')"
                    >
                      获取当前轴的位置
                    </button>
                  </div>
                  <div class="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-xs text-(--app-text-muted)">X</label>
                      <input v-model.number="circleCenter.x" type="number" step="0.001" class="mt-1 w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none" />
                    </div>
                    <div>
                      <label class="text-xs text-(--app-text-muted)">Y</label>
                      <input v-model.number="circleCenter.y" type="number" step="0.001" class="mt-1 w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none" />
                    </div>
                  </div>
                </div>

                <div class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3">
                  <div class="text-sm font-medium text-(--app-text-primary)">半径</div>
                  <input
                    v-model.number="circleRadius"
                    type="number"
                    step="0.001"
                    class="mt-2 w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none"
                  />
                </div>
              </div>

              <div v-if="!unifyExtrudeHeight" class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3">
                <div class="text-sm font-medium text-(--app-text-primary)">该图形高度</div>
                <input
                  v-model.number="perEntityExtrudeHeightInput"
                  type="number"
                  step="0.001"
                  class="mt-2 w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-(--app-border) p-4">
            <button
              type="button"
              class="rounded-lg border border-(--app-border) bg-(--app-card-soft) px-4 py-2 text-sm text-(--app-text-primary) hover:bg-(--app-card-soft-2) disabled:opacity-60"
              :disabled="createWizardStep === 'height'"
              @click="goToWizardPrev"
            >
              上一步
            </button>

            <div class="flex items-center gap-2">
              <button
                v-if="createWizardStep !== 'params'"
                type="button"
                class="rounded-lg border border-sky-400/60 bg-sky-50/80 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100/90 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/50"
                @click="goToWizardNext"
              >
                下一步
              </button>

              <button
                v-else
                type="button"
                class="rounded-lg border border-emerald-500/50 bg-emerald-50/80 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                @click="addEntityFromWizard"
              >
                添加实体
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-5 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-(--app-text-primary) text-2xl">图像数据</p>
          </div>

          <div class="flex flex-col items-end gap-2 shrink-0">
            <button
              type="button"
                class="rounded-md border border-slate-700 bg-slate-800/60 px-16 py-1 text-sm text-(--app-text-primary) hover:bg-slate-800"
              @click="handleImportClick"
            >
              导入…
            </button>
          </div>
        </div>

        <div class="mt-4">
          <div class="flex items-center gap-3">
            <select
              v-model="dropdownSelectedEntityId"
              :disabled="selectableEntities.length === 0"
              class="w-full min-w-0 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) shadow-inner shadow-slate-900/5 outline-none transition scheme-light focus:border-sky-500/80 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.15)] focus:ring-2 focus:ring-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-black/40 dark:scheme-dark"
            >
              <option value="">无</option>
              <option v-for="e in selectableEntities" :key="e.id" :value="e.id">
                {{ e.type }} / {{ e.id.slice(0, 8) }} / {{ e.layerName }}
              </option>
            </select>
          </div>
        </div>

        <div class="mt-4">
          <div
            v-if="!selectedEntity"
            class="min-h-[140px] rounded-md border border-dashed border-(--app-border) bg-(--app-card-soft-2) p-3 text-xs text-(--app-text-secondary)"
          >
            当前没有选中实体；请先导入 .ljs / .dxf。
          </div>

          <div
            v-else
            class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-4 text-xs text-(--app-text-secondary) shadow-inner shadow-slate-900/5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="font-semibold text-(--app-text-primary) truncate">
                  {{ selectedEntity.type }} / ID: {{ selectedEntity.id }}
                </div>
                <div class="mt-1 text-[11px] text-(--app-text-muted)">
                  层：{{ selectedEntity.layerName }}
                </div>
              </div>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-(--app-text-muted)">
              <!-- 固定两参数：每行只放两条 -->
              <div>extrudeHeight：{{ selectedEntity.extrudeHeight.toFixed(3) }}</div>
              <div>surfaceAngle：{{ selectedEntity.surfaceAngle.toFixed(3) }}</div>

              <!-- 具有起点/终点的实体：LINE / ARC / BEZIER -->
              <template v-if="selectedEntity.type === 'LINE'">
                <div class="col-span-2">起点：{{ formatPoint(selectedEntity.start) }}</div>
                <div class="col-span-2">终点：{{ formatPoint(selectedEntity.end) }}</div>
              </template>

              <template v-else-if="selectedEntity.type === 'ARC'">
                <div class="col-span-2">起点：{{ formatPointOrDash(getArcStartPoint(selectedEntity)) }}</div>
                <div class="col-span-2">终点：{{ formatPointOrDash(getArcEndPoint(selectedEntity)) }}</div>
                <div class="col-span-2">圆心：{{ formatPoint(selectedEntity.center) }}</div>
                <div class="col-span-2">半径：{{ selectedEntity.radius.toFixed(3) }}</div>
              </template>

              <template v-else-if="selectedEntity.type === 'BEZIER'">
                <div class="col-span-2">
                  起点：{{
                    selectedEntity.points.length > 0 ? formatPointOrDash(selectedEntity.points[0]) : '—'
                  }}
                </div>
                <div class="col-span-2">
                  终点：
                  {{
                    selectedEntity.points.length > 0
                      ? formatPointOrDash(selectedEntity.points[selectedEntity.points.length - 1])
                      : '—'
                  }}
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
      <RouterLink
        to="/help"
        class="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-50/80 px-3 py-2 text-sm font-medium text-sky-800 transition hover:bg-sky-100/90 dark:border-sky-500/35 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/50"
      >
        打开完整帮助界面
        <span aria-hidden="true">→</span>
      </RouterLink>
    </div>
  </div>
</template>
