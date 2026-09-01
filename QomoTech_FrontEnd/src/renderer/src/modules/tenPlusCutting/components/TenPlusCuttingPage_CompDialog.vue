<script setup lang="ts">
import { computed, watch } from 'vue'
import { isTableAngle } from '../composables/useTenPlusTask'
import { TEN_PLUS_DEFAULT_DIAMETER_PERCENT } from '../constants/tenPlusCutting'
import type { TenPlusTaskRow } from '../types/tenPlusCutting'

const RING_R = 54
const RING_C = 2 * Math.PI * RING_R

const ANGLE_VX = 30
const ANGLE_VY = 98
const ANGLE_RAY = 88
const ANGLE_ARC_R = 34
const ANGLE_ARC_C = 2 * Math.PI * ANGLE_ARC_R
const ANGLE_ORIGIN = `${(ANGLE_VX / 128) * 100}% ${(ANGLE_VY / 128) * 100}%`

const props = defineProps<{
  row: TenPlusTaskRow
}>()

const emit = defineEmits<{
  close: []
}>()

const tableLocked = computed(() => isTableAngle(props.row.angle))

const ringDasharray = computed(() => {
  const n = Number(props.row.diameterPercent)
  const pct = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 100
  return `${(pct / 100) * RING_C} ${RING_C}`
})

const visualAngle = computed(() => {
  const n = Number(props.row.compAngle)
  if (!Number.isFinite(n)) return 0
  return Math.max(-170, Math.min(170, n))
})

const angleArcDash = computed(() => {
  const a = Math.abs(visualAngle.value)
  return `${(a / 360) * ANGLE_ARC_C} ${ANGLE_ARC_C}`
})

const angleRayStyle = computed(() => ({
  transform: `rotate(${-visualAngle.value}deg)`,
  transformOrigin: ANGLE_ORIGIN
}))

const angleArcStyle = computed(() => ({
  transform: visualAngle.value >= 0 ? 'scaleY(-1)' : 'none',
  transformOrigin: ANGLE_ORIGIN
}))

watch(
  () => props.row.diameterPercent,
  (v) => {
    if (!Number.isFinite(v)) props.row.diameterPercent = TEN_PLUS_DEFAULT_DIAMETER_PERCENT
  },
  { immediate: true }
)
</script>

<template>
  <div class="tpc-comp-overlay" @click.self="emit('close')">
    <div class="tpc-comp-card" role="dialog" aria-modal="true">
      <header class="tpc-comp-head">
        <span>修改补偿值</span>
        <span class="tpc-comp-task">#{{ row.taskNo }}</span>
      </header>

      <p v-if="tableLocked" class="tpc-comp-hint">台面行仅可改直径与角度。</p>

      <div class="tpc-comp-dials">
        <div class="tpc-comp-dial">
          <svg class="tpc-comp-ring" viewBox="0 0 128 128" aria-hidden="true">
            <circle class="tpc-comp-ring-track" cx="64" cy="64" :r="RING_R" />
            <circle
              class="tpc-comp-ring-value"
              cx="64"
              cy="64"
              :r="RING_R"
              :stroke-dasharray="ringDasharray"
            />
          </svg>
          <label class="tpc-comp-dial-core">
            <input
              v-model.number="row.diameterPercent"
              type="number"
              class="tpc-comp-dial-val"
              step="0.1"
              aria-label="直径百分比"
              :placeholder="String(TEN_PLUS_DEFAULT_DIAMETER_PERCENT)"
            />
            <span>%</span>
          </label>
        </div>

        <div class="tpc-comp-dial">
          <svg class="tpc-comp-ring" viewBox="0 0 128 128" aria-hidden="true">
            <circle
              class="tpc-comp-angle-arc"
              :cx="ANGLE_VX"
              :cy="ANGLE_VY"
              :r="ANGLE_ARC_R"
              :stroke-dasharray="angleArcDash"
              :style="angleArcStyle"
            />
            <line
              class="tpc-comp-angle-ray"
              :x1="ANGLE_VX"
              :y1="ANGLE_VY"
              :x2="ANGLE_VX + ANGLE_RAY"
              :y2="ANGLE_VY"
            />
            <line
              class="tpc-comp-angle-ray tpc-comp-angle-ray-move"
              :x1="ANGLE_VX"
              :y1="ANGLE_VY"
              :x2="ANGLE_VX + ANGLE_RAY"
              :y2="ANGLE_VY"
              :style="angleRayStyle"
            />
            <circle class="tpc-comp-angle-vertex" :cx="ANGLE_VX" :cy="ANGLE_VY" r="3.2" />
          </svg>
          <label class="tpc-comp-dial-core tpc-comp-angle-core">
            <input
              v-model.number="row.compAngle"
              type="number"
              class="tpc-comp-dial-val tpc-comp-angle-val"
              step="0.01"
              aria-label="角度补偿"
            />
            <span>°</span>
          </label>
        </div>
      </div>
      <div class="tpc-comp-dial-caps">
        <span>直径百分比</span>
        <span>角度补偿</span>
      </div>

      <div class="tpc-comp-group">XYZ 补偿</div>
      <div class="tpc-comp-grid">
        <label class="tpc-comp-tile">
          <span>X</span>
          <input v-model.number="row.compX" type="number" step="0.001" :disabled="tableLocked" />
        </label>
        <label class="tpc-comp-tile">
          <span>Y</span>
          <input v-model.number="row.compY" type="number" step="0.001" :disabled="tableLocked" />
        </label>
        <label class="tpc-comp-tile">
          <span>Z</span>
          <input v-model.number="row.compZ" type="number" step="0.001" :disabled="tableLocked" />
        </label>
      </div>

      <div class="tpc-comp-group">K / B / X</div>
      <div class="tpc-comp-grid">
        <label class="tpc-comp-tile">
          <span>K</span>
          <input v-model.number="row.k" type="number" step="0.001" :disabled="tableLocked" />
        </label>
        <label class="tpc-comp-tile">
          <span>B</span>
          <input v-model.number="row.b" type="number" step="0.001" :disabled="tableLocked" />
        </label>
        <label class="tpc-comp-tile">
          <span>X</span>
          <input v-model.number="row.x" type="number" step="0.001" :disabled="tableLocked" />
        </label>
      </div>

      <button type="button" class="tpc-comp-done" @click="emit('close')">完成</button>
    </div>
  </div>
</template>

<style scoped>
.tpc-comp-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--app-text-primary) 32%, transparent);
  backdrop-filter: blur(10px);
}
.tpc-comp-card {
  width: 400px;
  max-width: 92vw;
  padding: 22px 22px 18px;
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-card) 88%, transparent);
  border: 1px solid var(--app-border);
  border-top: 2px solid #0ea5e9;
  border-radius: 16px;
  box-shadow:
    0 24px 64px color-mix(in srgb, var(--app-text-primary) 22%, transparent),
    0 0 0 1px color-mix(in srgb, #0ea5e9 12%, transparent);
  backdrop-filter: blur(18px);
  animation: tpc-comp-in 0.32s ease;
}
@keyframes tpc-comp-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.tpc-comp-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--app-text-secondary);
}
.tpc-comp-task {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #0ea5e9;
}
.tpc-comp-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--app-text-muted);
}
.tpc-comp-dials {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin: 18px 0 4px;
}
.tpc-comp-dial {
  position: relative;
  width: 168px;
  height: 168px;
  margin: 0 auto;
}
.tpc-comp-ring {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.tpc-comp-ring-track,
.tpc-comp-ring-value {
  fill: none;
  stroke-width: 3.2;
  transform: rotate(-90deg);
  transform-origin: 64px 64px;
}
.tpc-comp-ring-track {
  stroke: color-mix(in srgb, #0ea5e9 18%, var(--app-border));
}
.tpc-comp-ring-value,
.tpc-comp-angle-arc,
.tpc-comp-angle-ray {
  stroke: #0ea5e9;
  stroke-linecap: round;
  filter: drop-shadow(0 0 5px color-mix(in srgb, #0ea5e9 50%, transparent));
}
.tpc-comp-ring-value {
  fill: none;
  transition: stroke-dasharray 0.35s ease;
}
.tpc-comp-angle-arc {
  fill: none;
  stroke-width: 3.2;
  transform-box: view-box;
  transition: stroke-dasharray 0.35s ease, transform 0.35s ease;
}
.tpc-comp-angle-ray {
  stroke-width: 3.2;
  transform-box: view-box;
}
.tpc-comp-angle-ray-move {
  transition: transform 0.35s ease;
}
.tpc-comp-angle-vertex {
  fill: #0ea5e9;
  filter: drop-shadow(0 0 5px color-mix(in srgb, #0ea5e9 50%, transparent));
}
.tpc-comp-dial-core {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0;
}
.tpc-comp-angle-core {
  inset: 12px 8px 52px 40px;
  justify-content: flex-start;
  padding-top: 8px;
}
.tpc-comp-dial-val {
  box-sizing: content-box;
  width: 3ch;
  height: 1em;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  outline: none;
  text-align: right;
  font-size: 32px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, 'Cascadia Mono', 'Segoe UI', monospace;
  line-height: 1;
  color: var(--app-text-primary);
  appearance: textfield;
}
.tpc-comp-angle-val {
  width: 3.2ch;
  font-size: 26px;
}
.tpc-comp-dial-val::-webkit-outer-spin-button,
.tpc-comp-dial-val::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
.tpc-comp-dial-core > span {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1;
  color: #0ea5e9;
}
.tpc-comp-angle-core > span {
  font-size: 16px;
}
.tpc-comp-dial-caps {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 18px;
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--app-text-muted);
}
.tpc-comp-dial-val:focus {
  color: #0ea5e9;
}
.tpc-comp-tile input:focus {
  color: #0ea5e9;
}
.tpc-comp-group {
  margin: 16px 0 8px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: var(--app-text-muted);
}
.tpc-comp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.tpc-comp-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px 6px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-card-soft);
}
.tpc-comp-tile span {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--app-text-muted);
}
.tpc-comp-tile input {
  width: 100%;
  padding: 4px 2px;
  border: 0;
  background: transparent;
  outline: none;
  text-align: center;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-family: inherit;
  color: var(--app-text-primary);
}
.tpc-comp-tile input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tpc-comp-done {
  display: block;
  width: 100%;
  margin-top: 18px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.08em;
  border: 0;
  border-radius: 10px;
  background: #0ea5e9;
  color: #fff;
  cursor: pointer;
}
.tpc-comp-done:hover {
  background: #0284c7;
}
</style>
