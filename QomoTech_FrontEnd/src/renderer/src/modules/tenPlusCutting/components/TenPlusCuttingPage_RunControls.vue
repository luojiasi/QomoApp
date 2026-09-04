<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  programRunning: boolean
  programPaused: boolean
  programTaskCount: number
  jindubaifenbi: number
  elapsedText: string
}>()

const emit = defineEmits<{
  pauseToggle: []
  resetAlarms: []
  estop: []
  skipTask: []
}>()

const progressPct = computed(() => {
  const n = Number(props.jindubaifenbi)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
})

const canSkip = computed(() => props.programRunning && props.programTaskCount >= 2)
</script>

<template>
  <div class="tpc-run-controls" aria-label="运行控制" @keydown.enter.prevent>
    <div class="tpc-run-btns">
      <button
        type="button"
        :class="['tpc-run-btn', programPaused ? 'resume' : 'pause']"
        :disabled="!programRunning"
        :title="programPaused ? '继续当前任务' : '暂停当前任务'"
        @click="emit('pauseToggle')"
      >
        {{ programPaused ? '继续' : '暂停' }}
      </button>
      <button
        type="button"
        class="tpc-run-btn reset"
        title="复位清除报警"
        @click="emit('resetAlarms')"
      >
        复位
      </button>
      <button
        type="button"
        class="tpc-run-btn estop"
        title="紧急停止"
        @click="emit('estop')"
      >
        急停
      </button>
      <button
        type="button"
        class="tpc-run-btn skip"
        :disabled="!canSkip"
        title="跳过当前任务"
        @click="emit('skipTask')"
      >
        跳过
      </button>
    </div>
    <div class="tpc-run-meter" aria-label="运行进度">
      <div class="tpc-run-bar">
        <div class="tpc-run-bar-fill" :style="{ width: `${progressPct}%` }" />
      </div>
      <span class="tpc-run-pct">{{ progressPct }}%</span>
      <span class="tpc-run-time">{{ elapsedText }}</span>
    </div>
  </div>
</template>

<style scoped>
.tpc-run-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  padding-left: 12px;
  margin-left: 2px;
  border-left: 0.5px solid color-mix(in srgb, #fff 40%, var(--app-border));
}
.tpc-run-btns {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 3px;
  border-radius: 10px;
  background: var(--tpc-apple-fill, color-mix(in srgb, var(--app-text-primary) 5.5%, transparent));
}
.tpc-run-btn {
  height: 28px;
  min-width: 52px;
  padding: 0 12px;
  border: 0;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 590;
  letter-spacing: -0.01em;
  cursor: pointer;
  background: transparent;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}
.tpc-run-btn.pause {
  color: var(--tpc-apple-orange, #ff9f0a);
  background: color-mix(in srgb, var(--tpc-apple-orange, #ff9f0a) 14%, transparent);
}
.tpc-run-btn.resume {
  color: var(--tpc-apple-green, #34c759);
  background: color-mix(in srgb, var(--tpc-apple-green, #34c759) 14%, transparent);
}
.tpc-run-btn.reset {
  color: var(--tpc-apple-blue, #007aff);
  background: color-mix(in srgb, var(--tpc-apple-blue, #007aff) 12%, transparent);
}
.tpc-run-btn.estop {
  color: #fff;
  background: var(--tpc-apple-red, #ff3b30);
}
.tpc-run-btn.skip {
  color: var(--app-text-secondary);
  background: color-mix(in srgb, var(--app-text-primary) 6%, transparent);
}
.tpc-run-btn.pause:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tpc-apple-orange, #ff9f0a) 22%, transparent);
}
.tpc-run-btn.resume:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tpc-apple-green, #34c759) 22%, transparent);
}
.tpc-run-btn.reset:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tpc-apple-blue, #007aff) 20%, transparent);
}
.tpc-run-btn.estop:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tpc-apple-red, #ff3b30) 88%, #000);
}
.tpc-run-btn.skip:hover:not(:disabled) {
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-text-primary) 10%, transparent);
}
.tpc-run-btn:active:not(:disabled) {
  opacity: 0.82;
}
.tpc-run-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
.tpc-run-meter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.tpc-run-bar {
  flex: 1;
  min-width: 80px;
  height: 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--app-text-primary) 10%, transparent);
  overflow: hidden;
}
.tpc-run-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--tpc-apple-blue, #007aff);
  transition: width 0.2s ease;
}
.tpc-run-pct,
.tpc-run-time {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 590;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--app-text-secondary);
}
.tpc-run-time {
  min-width: 5.2em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
</style>
