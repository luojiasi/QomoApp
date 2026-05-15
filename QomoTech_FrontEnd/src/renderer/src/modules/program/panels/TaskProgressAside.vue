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
  <div class="flex w-full min-w-0 items-center gap-3" aria-label="任务进度区域">
    <div class="shrink-0 text-xs text-(--app-text-muted) whitespace-nowrap">
      {{ progressText }}
    </div>

    <div
      v-if="safeTaskCount > 0"
      class="flex h-5 flex-1 min-w-0 gap-0.5 overflow-hidden rounded-lg bg-(--app-card-soft) p-0.5"
    >
      <div
        v-for="(fillRatio, idx) in segmentFillRatios"
        :key="`task-seg-${idx}`"
        class="relative flex-1 overflow-hidden rounded bg-(--app-bg)"
      >
        <div
          class="absolute left-0 top-0 bottom-0 bg-blue-500 transition-all duration-300"
          :style="{ width: `${fillRatio * 100}%` }"
        />
      </div>
    </div>

    <div v-else class="h-5 flex-1 rounded-lg bg-(--app-card-soft)" />

    <div class="shrink-0 text-xs text-(--app-text-muted) whitespace-nowrap">
      {{ Number.isFinite(jindubaifenbi) ? jindubaifenbi.toFixed(0) : '0' }}%
    </div>
  </div>
</template>
