<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CollapsiblePanelHeader from './CollapsiblePanelHeader.vue'
import {moveMotionAxisRel,setMotionIoOutput} from '../utils/motionApi'
import { useNotification } from '../composables/useNotification'
const { error,success } = useNotification()
type AuxiliaryTabId =
  | 'axisCenterCalib'
  | 'quickDot'
  | 'quickFocus'
  | 'quickConcentric'
  | 'userCustom'

const isPanelExpanded = ref(false)
const activeTab = ref<AuxiliaryTabId>('axisCenterCalib')

type QuickFocusPointState = 'pending' | 'done' | 'current'
type QuickFocusPoint = { id: number; state: QuickFocusPointState }

const tabs: { id: AuxiliaryTabId; label: string }[] = [
  { id: 'axisCenterCalib', label: '五轴校准' },
  { id: 'quickDot', label: '快速打点' },
  { id: 'quickFocus', label: '快速找焦' },
  { id: 'quickConcentric', label: '快速调同' },
  { id: 'userCustom', label: '自定功能' },
]

const sectionPlaceholders: Record<AuxiliaryTabId, string> = {
  axisCenterCalib: '五轴中心校准相关控制与流程将放置于此。',
  quickDot: '快速打点相关参数与操作将放置于此。',
  quickFocus: '快速找焦点相关向导与控件将放置于此。',
  quickConcentric: '快速调同心相关步骤将放置于此。',
  userCustom: '用户可配置的自定义功能将放置于此。',
}


const isQuickFocusing = ref(false)
/** XY 每边数量，形成 N×N 矩阵（对应 xCount / yCount） */
const quickFocusGridSize = ref(3)
const quickFocusStep = ref(2)
const quickFocusZStep = ref(0.5)
const quickFocusPoints = ref<QuickFocusPoint[]>([])

const rebuildQuickFocusPoints = () => {
  const n = Math.max(1, Math.floor(quickFocusGridSize.value))
  quickFocusGridSize.value = n
  const total = n * n
  const middleIndex = Math.floor((total - 1) / 2)
  quickFocusPoints.value = Array.from({ length: total }, (_, index) => ({
    id: index,
    state: index === middleIndex ? 'current' : 'pending',
  }))
}

watch(quickFocusGridSize, rebuildQuickFocusPoints, { immediate: true })

const quickFocusDotGridStyle = computed(() => ({gridTemplateColumns: `repeat(${quickFocusGridSize.value}, minmax(0, 1fr))`}))

const getQuickFocusPointClass = (state: QuickFocusPointState) => {
  if (state === 'done') return 'bg-emerald-500/85 ring-emerald-400/60'
  if (state === 'current') return 'bg-yellow-400/90 ring-yellow-300/70'
  return 'bg-red-500/85 ring-red-400/60'
}



const handleQuickFocus = async () => {
  if (isQuickFocusing.value) {
    error('正在快速找焦，请稍等')
    return
  }
  const step = quickFocusStep.value
  const Z_step = quickFocusZStep.value
  if (step <= 0 || Z_step <= 0) {
    error('步长与 Z 步长必须大于 0')
    return
  }
  const xCount = quickFocusGridSize.value
  const yCount = quickFocusGridSize.value
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  quickFocusPoints.value = quickFocusPoints.value.map((point) => ({
    ...point,
    state: 'pending',
  }))
  quickFocusPoints.value[0].state = 'current'
  isQuickFocusing.value = true
  try {
    // 从当前点开始，按矩阵逐点扫描，避免累计偏移导致轨迹变形
    for (let X = 0; X < xCount; X++) {
      if (X > 0) await moveMotionAxisRel(0, step)

      for (let Y = 0; Y < yCount; Y++) {
        if (Y > 0) await moveMotionAxisRel(1, step)
        const pointIndex = X * yCount + Y
        quickFocusPoints.value[pointIndex].state = 'current'

        await moveMotionAxisRel(2, -Z_step)

        await sleep(500)
        setMotionIoOutput(2, true)
        await sleep(1000)
        setMotionIoOutput(2, false)
        quickFocusPoints.value[pointIndex].state = 'done'

        const nextIndex = pointIndex + 1
        if (nextIndex < quickFocusPoints.value.length) quickFocusPoints.value[nextIndex].state = 'current'
        await sleep(500)
      }

      // 每一行结束回到该行起点，确保下一行仍是标准矩阵
      if (yCount > 1) {
        await moveMotionAxisRel(1, -step * (yCount - 1))
      }
    }
  } finally {
    isQuickFocusing.value = false
  }
}

const isQuickConcentric = ref(false)
const handleQuickConcentric = async()=>{
  if (isQuickConcentric.value) {
    error("正在快速找同心度中")
    return
  }
  try{
    isQuickConcentric.value = true
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))


    await sleep(500)
    setMotionIoOutput(2, true)
    await sleep(1000)
    setMotionIoOutput(2, false)

    const result =await moveMotionAxisRel(2,-10)
    if (result.success){
      await sleep(500)
      setMotionIoOutput(2, true)
      await sleep(1000)
      setMotionIoOutput(2, false)
      await moveMotionAxisRel(2,10)
    }

  }
  finally{ 
    isQuickConcentric.value = false
  }
}

const isAxisCenterCalib = ref(false)
const handleAxisCenterCalib = async()=>{
  if (isAxisCenterCalib.value) {
    error("正在五轴中心校准中")
    return
  }
  try{
    isAxisCenterCalib.value = true
  }
  finally{
    isAxisCenterCalib.value = false
    success("五轴中心校准完成")
  }
}
</script>

<template>
  <div
    class="flex min-h-0 shrink-0 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    :class="isPanelExpanded ? 'min-h-[min(220px,44vh)]' : ''"
  >
    <CollapsiblePanelHeader
      v-model:expanded="isPanelExpanded"
      title="辅助功能区"
    />
    <div v-show="isPanelExpanded" class="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <p class="mb-2 text-xs text-(--app-text-muted)">功能入口</p>
        <div class="flex flex-col-5 gap-2">
          <button
            v-for="item in tabs"
            :key="item.id"
            type="button"
            class="rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30"
            :class="
              activeTab === item.id
                ? 'border-sky-500/70 bg-sky-500/10 text-(--app-text-primary)'
                : 'border-(--app-border) bg-(--app-input-bg) text-(--app-text-primary) hover:border-sky-500/35 hover:bg-(--app-card)'
            "
            @click="activeTab = item.id"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <div v-if="activeTab === 'axisCenterCalib'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            @click="handleAxisCenterCalib"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            五轴中心校准
          </button>
        </div>
        <div v-if="activeTab === 'quickFocus'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            @click="handleQuickFocus"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            设定找焦点
          </button>
          <div
            class="grid gap-3 justify-items-center"
            :style="quickFocusDotGridStyle"
          >
            <span
              v-for="point in quickFocusPoints"
              :key="point.id"
              class="h-2.5 w-2.5 rounded-full ring-1"
              :class="getQuickFocusPointClass(point.state)"
            />
          </div>
          <div class="grid grid-cols-3 gap-2">
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              X/Y 数量
              <input
                v-model.number="quickFocusGridSize"
                type="number"
                min="1"
                step="1"
                :disabled="isQuickFocusing"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              step
              <input
                v-model.number="quickFocusStep"
                type="number"
                min="0"
                step="any"
                :disabled="isQuickFocusing"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              Z_step
              <input
                v-model.number="quickFocusZStep"
                type="number"
                min="0"
                step="any"
                :disabled="isQuickFocusing"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          </div>
        </div>
        <div v-if="activeTab === 'quickDot'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            快速打点
          </button>
        </div>
        <div v-if="activeTab === 'quickConcentric'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            @click="handleQuickConcentric"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            快速找同心度
          </button>
        </div>
        <div v-if="activeTab === 'userCustom'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            用户自定义
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
