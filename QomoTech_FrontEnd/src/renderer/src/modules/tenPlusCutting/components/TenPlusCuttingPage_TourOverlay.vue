<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useTenPlusTour } from '../composables/useTenPlusTour'

const emit = defineEmits<{
  close: []
}>()

const {
  index,
  step,
  total,
  isFirst,
  isLast,
  hole,
  cardLeft,
  cardTop,
  arrow,
  missing,
  cardWidth,
  start,
  stop,
  next,
  prev
} = useTenPlusTour()

function onKey(ev: KeyboardEvent): void {
  if (ev.key === 'Escape') {
    ev.preventDefault()
    onDone()
    return
  }
  if (ev.key === 'ArrowRight' || ev.key === 'Enter') {
    ev.preventDefault()
    if (isLast.value) onDone()
    else next()
    return
  }
  if (ev.key === 'ArrowLeft') {
    ev.preventDefault()
    prev()
  }
}

function onDone(): void {
  stop()
  emit('close')
}

onMounted(() => {
  start()
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  stop()
})
</script>

<template>
  <div
    class="tpc-tour"
    role="dialog"
    aria-modal="true"
    :class="{ alert: step?.accent === 'red', important: Boolean(step?.important) }"
    :aria-labelledby="step ? 'tpc-tour-title' : undefined"
  >
    <div class="tpc-tour-dim" :class="{ cut: Boolean(hole) }" />
    <div
      v-if="hole"
      class="tpc-tour-hole"
      :style="{
        left: `${hole.left}px`,
        top: `${hole.top}px`,
        width: `${hole.width}px`,
        height: `${hole.height}px`
      }"
    />
    <svg v-if="arrow && hole" class="tpc-tour-svg" aria-hidden="true">
      <defs>
        <marker id="tpc-tour-head" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="#38bdf8" />
        </marker>
        <marker id="tpc-tour-head-alert" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="#ef4444" />
        </marker>
      </defs>
      <line
        :x1="arrow.x1"
        :y1="arrow.y1"
        :x2="arrow.x2"
        :y2="arrow.y2"
        class="tpc-tour-line"
        :marker-end="step?.accent === 'red' ? 'url(#tpc-tour-head-alert)' : 'url(#tpc-tour-head)'"
      />
    </svg>

    <div
      v-if="step"
      class="tpc-tour-card"
      :class="{ alert: step.accent === 'red', important: Boolean(step.important) }"
      :style="{
        left: `${cardLeft}px`,
        top: `${cardTop}px`,
        width: `${cardWidth}px`
      }"
    >
      <div class="tpc-tour-card-head">
        <div class="tpc-tour-head-left">
          <span class="tpc-tour-count">{{ index + 1 }} / {{ total }}</span>
          <span v-if="step.important" class="tpc-tour-badge">重要</span>
        </div>
        <button type="button" class="tpc-tour-skip" @click="onDone">跳过</button>
      </div>
      <h2 id="tpc-tour-title">{{ step.title }}</h2>
      <p v-if="step.warning" class="tpc-tour-warning">{{ step.warning }}</p>
      <p>{{ step.body }}</p>
      <p v-if="missing" class="tpc-tour-missing">当前屏上看不到该控件，请先选中一个编程目标。</p>
      <div class="tpc-tour-nav">
        <button type="button" class="tpc-tour-btn" :disabled="isFirst" @click="prev">上一步</button>
        <button type="button" class="tpc-tour-btn primary" @click="isLast ? onDone() : next()">
          {{ isLast ? '完成' : '下一步' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tpc-tour {
  position: fixed;
  inset: 0;
  z-index: 240;
  pointer-events: none;
}
.tpc-tour-dim {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, #020617 48%, transparent);
  pointer-events: auto;
}
.tpc-tour-dim.cut {
  background: transparent;
}
.tpc-tour-hole {
  position: fixed;
  box-sizing: border-box;
  border-radius: 10px;
  box-shadow: 0 0 0 9999px color-mix(in srgb, #020617 48%, transparent);
  outline: 2px solid #38bdf8;
  pointer-events: none;
  animation: tpc-tour-pulse 1.4s ease-in-out infinite;
}
.tpc-tour.alert .tpc-tour-hole {
  outline-color: #ef4444;
  animation-name: tpc-tour-pulse-alert;
}
.tpc-tour-svg {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
.tpc-tour-line {
  stroke: #38bdf8;
  stroke-width: 2.2;
  stroke-linecap: round;
}
.tpc-tour.alert .tpc-tour-line {
  stroke: #ef4444;
}
.tpc-tour-card {
  position: fixed;
  z-index: 1;
  pointer-events: auto;
  padding: 12px 14px 12px;
  border-radius: 14px;
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-card) 92%, transparent);
  border: 0.5px solid color-mix(in srgb, #fff 50%, var(--app-border));
  box-shadow:
    0 0 0 0.5px color-mix(in srgb, #fff 30%, transparent) inset,
    0 16px 40px color-mix(in srgb, #000 22%, transparent);
  backdrop-filter: blur(24px) saturate(1.4);
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI Variable Display',
    'Segoe UI',
    system-ui,
    sans-serif;
}
.tpc-tour-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.tpc-tour-head-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.tpc-tour-count {
  font-size: 11px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: #38bdf8;
}
.tpc-tour-badge {
  flex: 0 0 auto;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 800;
  line-height: 18px;
  letter-spacing: 0.06em;
  color: #fff;
  background: #dc2626;
}
.tpc-tour-skip {
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 11px;
  cursor: pointer;
}
.tpc-tour-skip:hover {
  color: var(--app-text-primary);
}
.tpc-tour-card h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.03em;
}
.tpc-tour-card p {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--app-text-secondary);
}
.tpc-tour-card.alert {
  border-color: color-mix(in srgb, #ef4444 55%, var(--app-border));
  box-shadow:
    0 0 0 0.5px color-mix(in srgb, #ef4444 35%, transparent) inset,
    0 16px 40px color-mix(in srgb, #000 22%, transparent);
}
.tpc-tour-card.alert .tpc-tour-count {
  color: #ef4444;
}
.tpc-tour-card.alert h2,
.tpc-tour-card.alert p {
  color: #dc2626;
}
.tpc-tour-warning {
  margin: 8px 0 0 !important;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 14px !important;
  font-weight: 800;
  line-height: 1.45 !important;
  letter-spacing: 0.02em;
  color: #991b1b !important;
  background: color-mix(in srgb, #ef4444 18%, var(--app-card));
  border: 1px solid color-mix(in srgb, #ef4444 55%, transparent);
}
.tpc-tour.important .tpc-tour-hole {
  outline-width: 3px;
  box-shadow:
    0 0 0 9999px color-mix(in srgb, #020617 55%, transparent),
    0 0 0 6px color-mix(in srgb, #ef4444 35%, transparent);
}
.tpc-tour-card.important {
  border-width: 1.5px;
  border-color: #ef4444;
  background: color-mix(in srgb, #ef4444 10%, var(--app-card));
}
.tpc-tour-card.important h2 {
  font-size: 16px;
  font-weight: 800;
}
.tpc-tour-missing {
  color: #f59e0b !important;
}
.tpc-tour-nav {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
.tpc-tour-btn {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-soft);
  color: var(--app-text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.tpc-tour-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tpc-tour-btn.primary {
  background: color-mix(in srgb, #0ea5e9 22%, var(--app-card));
  border-color: color-mix(in srgb, #0ea5e9 55%, var(--app-border));
  color: var(--app-text-primary);
  font-weight: 600;
}
@keyframes tpc-tour-pulse {
  0%,
  100% {
    outline-color: #38bdf8;
  }
  50% {
    outline-color: color-mix(in srgb, #38bdf8 45%, #fff);
  }
}
@keyframes tpc-tour-pulse-alert {
  0%,
  100% {
    outline-color: #ef4444;
  }
  50% {
    outline-color: color-mix(in srgb, #ef4444 45%, #fff);
  }
}
</style>
