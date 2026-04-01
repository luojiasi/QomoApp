<script setup lang="ts">
import { computed } from 'vue'

type AxisStatusLabel = {
  status: number
  label: string
}

const props = withDefaults(
  defineProps<{
    programRunning?: boolean
    programElapsedText?: string
    axisStatusLabels?: AxisStatusLabel[]
  }>(),
  {
    programRunning: false,
    programElapsedText: '00:00:00',
    axisStatusLabels: () => []
  }
)

const hasAxisAlarm = computed(() =>
  props.axisStatusLabels.some((item) => Number.isFinite(item.status) && item.status !== 0)
)

const axisAlarmText = computed(() => {
  const labels = props.axisStatusLabels
    .filter((item) => Number.isFinite(item.status) && item.status !== 0)
    .map((item) => item.label)
  return labels.join(' | ')
})
</script>

<template>
  <div
    :class="[
      'rounded-xl border border-(--app-border) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5',
      hasAxisAlarm
        ? 'bg-red-100'
        : (props.programRunning ? 'bg-(--app-status-running-bg)' : 'bg-(--app-status-idle-bg)')
    ]"
    aria-label="程序运行状态"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p
          class="mt-1 text-(--app-text-primary)"
          :class="hasAxisAlarm ? 'text-sm font-medium text-red-700' : 'text-[20px]'"
        >
          {{ hasAxisAlarm ? axisAlarmText : (props.programRunning ? '运行中' : '空闲') }}
        </p>
      </div>
      <div class="shrink-0 text-right">
        <div class="mt-0.5 font-mono text-lg text-(--app-text-primary)">
          {{ props.programRunning ? props.programElapsedText : '00:00:00' }}
        </div>
      </div>
    </div>
  </div>
</template>

