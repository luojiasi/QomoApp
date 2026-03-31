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
    class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
    aria-label="程序运行状态"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="font-text-(--app-text-primary)">程序状态</p>
        <p class="mt-1 text-[20px] text-(--app-text-muted)">
          {{ props.programRunning ? '运行中' : '空闲' }}
        </p>
      </div>
      <div class="shrink-0 text-right">
        <div class="text-[11px] text-(--app-text-muted)">已运行</div>
        <div class="mt-0.5 font-mono text-lg text-(--app-text-primary)">
          {{ props.programRunning ? props.programElapsedText : '00:00:00' }}
        </div>
      </div>
    </div>
  </div>
</template>

