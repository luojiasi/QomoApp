<script setup lang="ts">
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
</script>

<template>
  <div
    :class="[
      'rounded-xl border border-(--app-border) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5',
      props.programRunning ? 'bg-(--app-status-running-bg)' : 'bg-(--app-status-idle-bg)'
    ]"
    aria-label="程序运行状态"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="mt-1 text-[20px] text-(--app-text-primary)">
          {{ props.programRunning ? '运行中' : '空闲' }}
        </p>
      </div>
      <div class="shrink-0 text-right">
        <div class="mt-0.5 font-mono text-lg text-(--app-text-primary)">
          {{ props.programElapsedText }}
        </div>
      </div>
    </div>
  </div>
</template>
