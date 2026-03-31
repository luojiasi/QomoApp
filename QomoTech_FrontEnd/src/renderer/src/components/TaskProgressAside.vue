<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    taskCount: number
    currentTaskIndex: number
    jindubaifenbi: number
    running?: boolean
  }>(),
  {
    running: false
  }
)

const safeTaskCount = computed(() => Math.max(0, Math.floor(props.taskCount || 0)))

const safeCurrentTaskIndex = computed(() => {
  if (safeTaskCount.value <= 0) return 0
  return Math.min(safeTaskCount.value, Math.max(0, Math.floor(props.currentTaskIndex || 0)))
})

const currentTaskRatio = computed(() => {
  const percent = Number(props.jindubaifenbi)
  if (!Number.isFinite(percent)) return 0
  return Math.max(0, Math.min(1, percent / 100))
})

const segmentFillRatios = computed(() => {
  const count = safeTaskCount.value
  const current = safeCurrentTaskIndex.value
  const ratio = currentTaskRatio.value
  return Array.from({ length: count }, (_, idx) => {
    const oneBased = idx + 1
    if (oneBased < current) return 1
    if (oneBased === current) return ratio
    return 0
  })
})

const progressText = computed(() => {
  if (safeTaskCount.value <= 0) return '暂无任务'
  const current = safeCurrentTaskIndex.value
  return `任务 ${current}/${safeTaskCount.value}`
})
</script>

<template>
  <aside
    class="absolute left-1/2 top-23 bottom-4 z-20 flex w-14 min-h-0 flex-col items-center rounded-2xl border border-(--app-border) bg-(--app-card) p-2 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    aria-label="任务进度区域"
  >
    <div class="mb-2 text-center text-[10px] leading-4 text-(--app-text-muted)">
      {{ progressText }}
    </div>

    <div class="flex h-full w-full flex-col-reverse gap-1 overflow-hidden rounded-xl bg-(--app-card-soft) p-1">
      <div
        v-for="(fillRatio, idx) in segmentFillRatios"
        :key="`task-segment-${idx}`"
        class="relative flex-1 overflow-hidden rounded bg-(--app-bg)"
      >
        <div
          class="absolute bottom-0 left-0 right-0 bg-blue-500 transition-all duration-300"
          :style="{ height: `${fillRatio * 100}%` }"
        />
      </div>
    </div>

    <div class="mt-2 text-[10px] leading-4 text-(--app-text-muted)">
      {{ jindubaifenbi.toFixed(0) }}%
    </div>
  </aside>
</template>
