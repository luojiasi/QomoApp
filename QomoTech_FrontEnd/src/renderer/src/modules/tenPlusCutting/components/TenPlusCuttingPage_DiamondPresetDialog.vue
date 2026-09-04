<script setup lang="ts">
import { computed, onUnmounted, reactive, watch } from 'vue'
import {
  TEN_PLUS_DEFAULT_DIAMOND_PRESET_CROWN,
  TEN_PLUS_DEFAULT_DIAMOND_PRESET_GIRDLE,
  TEN_PLUS_DEFAULT_DIAMOND_PRESET_PAVILION,
  TEN_PLUS_DIAMOND_CUT_OPTIONS,
  TEN_PLUS_DIAMOND_PRESET_PERCENT_MAX,
  TEN_PLUS_DIAMOND_PRESET_PERCENT_MIN
} from '../constants/diamondPreset'
import type { TenPlusDiamondPresetInput } from '../types/diamondPreset'
import {
  buildDiamondProfile,
  createDefaultDiamondPresetInput,
  describeDiamondPresetError,
  diamondCutLabel,
  diamondLayerHeightMm
} from '../utils/tenPlusDiamondPresets'

const emit = defineEmits<{
  close: []
  confirm: [input: TenPlusDiamondPresetInput]
}>()

const RING_R = 54

const form = reactive(createDefaultDiamondPresetInput())

const errorText = computed(() => describeDiamondPresetError({ ...form }))
const cutLabel = computed(() => diamondCutLabel(form.cut))

const heightFields = [
  { key: 'crownPercent', cap: '冠高比', tone: 'crown', id: 'tpc-d-crown-pct' },
  { key: 'girdlePercent', cap: '腰高比', tone: 'girdle', id: 'tpc-d-girdle-pct' },
  { key: 'pavilionPercent', cap: '亭高比', tone: 'pavilion', id: 'tpc-d-pavilion-pct' }
] as const

function formatMm(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 1000) / 1000)
}

function actualHeightText(percent: number): string {
  return formatMm(diamondLayerHeightMm(Number(form.diameter), percent))
}

const totalHeightText = computed(() =>
  formatMm(
    diamondLayerHeightMm(Number(form.diameter), Number(form.crownPercent)) +
      diamondLayerHeightMm(Number(form.diameter), Number(form.girdlePercent)) +
      diamondLayerHeightMm(Number(form.diameter), Number(form.pavilionPercent))
  )
)

function selectInput(ev: Event): void {
  const el = ev.target
  if (el instanceof HTMLInputElement) el.select()
}

function clampPercent(v: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback
  return Math.min(TEN_PLUS_DIAMOND_PRESET_PERCENT_MAX, Math.max(TEN_PLUS_DIAMOND_PRESET_PERCENT_MIN, v))
}

const display = reactive({
  crown: 0.4,
  girdle: 0.4,
  pavilion: 0.4
})

const profile = computed(() =>
  buildDiamondProfile(display.crown, display.girdle, display.pavilion)
)

const ANIM_MS = 380
let rafId = 0
let animFrom = { crown: 0.4, girdle: 0.4, pavilion: 0.4 }
let animTo = { crown: 0.4, girdle: 0.4, pavilion: 0.4 }
let animStart = 0

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function tick(now: number): void {
  const t = Math.min(1, (now - animStart) / ANIM_MS)
  const e = easeOutCubic(t)
  display.crown = animFrom.crown + (animTo.crown - animFrom.crown) * e
  display.girdle = animFrom.girdle + (animTo.girdle - animFrom.girdle) * e
  display.pavilion = animFrom.pavilion + (animTo.pavilion - animFrom.pavilion) * e
  if (t < 1) rafId = requestAnimationFrame(tick)
}

function animateTo(next: { crown: number; girdle: number; pavilion: number }): void {
  animFrom = { crown: display.crown, girdle: display.girdle, pavilion: display.pavilion }
  animTo = next
  animStart = performance.now()
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(tick)
}

watch(
  () => [form.crownPercent, form.girdlePercent, form.pavilionPercent] as const,
  ([crown, girdle, pavilion]) => {
    animateTo({
      crown: clampPercent(Number(crown), TEN_PLUS_DEFAULT_DIAMOND_PRESET_CROWN),
      girdle: clampPercent(Number(girdle), TEN_PLUS_DEFAULT_DIAMOND_PRESET_GIRDLE),
      pavilion: clampPercent(Number(pavilion), TEN_PLUS_DEFAULT_DIAMOND_PRESET_PAVILION)
    })
  },
  { immediate: true }
)

onUnmounted(() => {
  cancelAnimationFrame(rafId)
})

function onConfirm(): void {
  if (errorText.value) return
  emit('confirm', {
    cut: form.cut,
    diameter: Number(form.diameter),
    crownPercent: Number(form.crownPercent),
    girdlePercent: Number(form.girdlePercent),
    pavilionPercent: Number(form.pavilionPercent)
  })
}
</script>

<template>
  <div class="tpc-shape-overlay" @click.self="emit('close')">
    <div class="tpc-shape-card" role="dialog" aria-modal="true" aria-labelledby="tpc-diamond-title">
      <header class="tpc-shape-head">
        <div>
          <h2 id="tpc-diamond-title">钻石快捷形状编辑</h2>
          <p>生成三行等分线段（冠、腰、亭）。尺寸与高度取直径，分割数 0，补偿打开钻石比例。</p>
        </div>
        <button type="button" class="tpc-shape-close" aria-label="关闭" @click="emit('close')">
          ✕
        </button>
      </header>

      <div class="tpc-diamond-body">
        <div class="tpc-diamond-left">
          <label class="tpc-cut-field" for="tpc-d-cut">
            <span>钻石类型</span>
            <select id="tpc-d-cut" v-model="form.cut" class="tpc-cut-select">
              <option
                v-for="item in TEN_PLUS_DIAMOND_CUT_OPTIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>
          </label>
          <label class="tpc-hcard" for="tpc-d-diameter">
          <div class="tpc-hcard-dial">
            <svg class="tpc-hcard-ring" viewBox="0 0 128 128" aria-hidden="true">
              <circle class="tpc-hcard-ring-track" cx="64" cy="64" :r="RING_R" />
              <circle class="tpc-hcard-ring-value" cx="64" cy="64" :r="RING_R" />
            </svg>
            <div class="tpc-hcard-core">
              <span class="tpc-hcard-row">
                <input
                  id="tpc-d-diameter"
                  v-model.number="form.diameter"
                  type="number"
                  class="tpc-hcard-val tpc-hcard-val-mm"
                  min="0.1"
                  max="200"
                  step="0.1"
                  aria-label="直径"
                  @focus="selectInput"
                />
                <span>mm</span>
              </span>
              <span class="tpc-hcard-result">
                <span class="tpc-hcard-result-label">三层合计</span>
                {{ totalHeightText }}
              </span>
            </div>
          </div>
          <div class="tpc-hcard-cap">直径</div>
        </label>
        </div>

        <div class="tpc-diamond-stage">
          <div class="tpc-diamond-figure">
            <svg
              class="tpc-diamond-svg"
              :viewBox="`${profile.viewMinX} ${profile.viewMinY} ${profile.viewWidth} ${profile.viewHeight}`"
              role="img"
              :aria-label="`${cutLabel}侧视`"
            >
              <path class="tpc-d-fill crown" :d="profile.crownPath" />
              <path class="tpc-d-fill girdle" :d="profile.girdlePath" />
              <path class="tpc-d-fill pavilion" :d="profile.pavilionPath" />
              <path class="tpc-d-facet-fill" :d="profile.leftFacetPath" />
              <path class="tpc-d-facet" :d="profile.facetPath" />
              <path class="tpc-d-outline" :d="profile.outlinePath" />
            </svg>

            <div class="tpc-d-callouts">
            <label
              v-for="field in heightFields"
              :key="field.key"
              class="tpc-d-layer"
              :class="`is-${field.tone}`"
              :for="field.id"
            >
              <span class="tpc-d-layer-cap">{{ field.cap }}</span>
              <span class="tpc-d-layer-row">
                <input
                  :id="field.id"
                  v-model.number="form[field.key]"
                  type="number"
                  class="tpc-d-layer-val"
                  step="0.1"
                  :min="TEN_PLUS_DIAMOND_PRESET_PERCENT_MIN"
                  :max="TEN_PLUS_DIAMOND_PRESET_PERCENT_MAX"
                  :aria-label="field.cap"
                  @focus="selectInput"
                />
                <span>%</span>
              </span>
              <span class="tpc-d-layer-mm">{{ actualHeightText(Number(form[field.key])) }} mm</span>
            </label>
            </div>
          </div>
        </div>
      </div>
      <p v-if="errorText" class="tpc-shape-error">{{ errorText }}</p>

      <div class="tpc-shape-btns">
        <button type="button" class="tpc-shape-btn" @click="emit('close')">取消</button>
        <button
          type="button"
          class="tpc-shape-btn primary"
          :disabled="Boolean(errorText)"
          @click="onConfirm"
        >
          写入当前目标
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tpc-shape-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #000 22%, transparent);
  backdrop-filter: blur(32px) saturate(1.35);
}
.tpc-shape-card {
  --tpc-accent: #0071e3;
  --tpc-surface: var(--app-card);
  width: 720px;
  max-width: 94vw;
  padding: 18px 18px 14px;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI Variable Display',
    'Segoe UI',
    system-ui,
    sans-serif;
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-card) 78%, transparent);
  border: 0.5px solid color-mix(in srgb, #fff 55%, var(--app-border));
  border-radius: 18px;
  box-shadow:
    0 0 0 0.5px color-mix(in srgb, #fff 35%, transparent) inset,
    0 18px 50px color-mix(in srgb, #000 16%, transparent);
  backdrop-filter: blur(40px) saturate(1.6);
}
.tpc-shape-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.tpc-shape-head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.03em;
}
.tpc-shape-head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--app-text-muted);
}
.tpc-shape-close {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--app-text-primary) 6%, transparent);
  color: var(--app-text-muted);
  cursor: pointer;
}
.tpc-shape-close:hover {
  color: var(--app-text-primary);
}
.tpc-diamond-body {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.tpc-diamond-left {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.tpc-cut-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-muted);
}
.tpc-cut-select {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--tpc-surface, var(--app-card));
  color: var(--app-text-primary);
  font-size: 12px;
}
.tpc-cut-select:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--app-text-primary) 38%, var(--app-border));
}
.tpc-hcard {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 12px 8px 10px;
  border: 2px solid transparent;
  border-radius: 18px;
  background: var(--tpc-surface);
  cursor: text;
  transition:
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}
.tpc-hcard:focus-within {
  border-color: color-mix(in srgb, var(--app-text-primary) 38%, var(--app-border));
  box-shadow:
    0 2px 6px color-mix(in srgb, var(--app-text-primary) 12%, transparent),
    0 10px 28px color-mix(in srgb, var(--app-text-primary) 14%, transparent);
}
.tpc-hcard:focus-within .tpc-hcard-cap {
  color: var(--app-text-primary);
  font-weight: 650;
}
.tpc-hcard-dial {
  position: relative;
  width: 148px;
  height: 148px;
  margin: 0 auto;
  overflow: hidden;
}
.tpc-hcard-ring {
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}
.tpc-hcard-ring-track,
.tpc-hcard-ring-value {
  fill: none;
  stroke-width: 5;
  transform: rotate(-90deg);
  transform-origin: 64px 64px;
}
.tpc-hcard-ring-track {
  stroke: color-mix(in srgb, var(--app-text-muted) 16%, var(--app-border));
}
.tpc-hcard-ring-value {
  stroke: var(--tpc-accent);
  stroke-linecap: round;
}
.tpc-hcard-core {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.tpc-hcard-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: center;
}
.tpc-hcard-val {
  box-sizing: content-box;
  width: 3.4ch;
  height: 1em;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  outline: none;
  text-align: right;
  font-size: 34px;
  font-weight: 620;
  font-variant-numeric: tabular-nums;
  font-family: inherit;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--app-text-primary);
  appearance: textfield;
}
.tpc-hcard-val-mm {
  width: 3.6ch;
}
.tpc-hcard-val::-webkit-outer-spin-button,
.tpc-hcard-val::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
.tpc-hcard-row > span {
  margin: 0;
  font-size: 17px;
  font-weight: 560;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--app-text-secondary);
}
.tpc-hcard-result {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  line-height: 1.2;
  color: var(--app-text-secondary);
}
.tpc-hcard-result-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-secondary);
}
.tpc-hcard-cap {
  margin-top: 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--app-text-muted);
}
.tpc-diamond-stage {
  min-width: 0;
  border-radius: 18px;
  background: color-mix(in srgb, var(--app-text-primary) 5%, var(--app-card));
  box-shadow: inset 0 0 0 1px var(--app-border);
}
.tpc-diamond-figure {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 148px;
  gap: 12px;
  height: 288px;
  padding: 12px;
}
.tpc-diamond-svg {
  display: block;
  width: 100%;
  height: 100%;
}
.tpc-d-fill.crown {
  fill: #d7e6f2;
}
.tpc-d-fill.girdle {
  fill: #e2d3b4;
}
.tpc-d-fill.pavilion {
  fill: #b7cfe3;
}
.tpc-d-facet-fill {
  fill: color-mix(in srgb, #fff 28%, transparent);
}
.tpc-d-facet {
  fill: none;
  stroke: color-mix(in srgb, var(--app-text-primary) 22%, #7aa3c2);
  stroke-width: 0.9;
  stroke-linejoin: round;
}
.tpc-d-outline {
  fill: none;
  stroke: color-mix(in srgb, var(--app-text-primary) 42%, #5d8cb0);
  stroke-width: 1.35;
  stroke-linejoin: round;
}
.tpc-d-callouts {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  min-height: 0;
}
.tpc-d-layer {
  position: relative;
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 8px 10px 8px 12px;
  border: 1px solid color-mix(in srgb, var(--app-border) 80%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--app-card) 92%, transparent);
  box-shadow: 0 1px 0 color-mix(in srgb, #fff 55%, transparent) inset;
  cursor: text;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}
.tpc-d-layer::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 0;
  width: 3px;
  border-radius: 99px;
  background: var(--layer);
}
.tpc-d-layer.is-crown {
  --layer: #7aa8cc;
}
.tpc-d-layer.is-girdle {
  --layer: #c4a574;
}
.tpc-d-layer.is-pavilion {
  --layer: #4f86b0;
}
.tpc-d-layer:focus-within {
  border-color: color-mix(in srgb, var(--layer) 55%, var(--app-border));
  box-shadow:
    0 2px 8px color-mix(in srgb, var(--app-text-primary) 10%, transparent),
    0 0 0 3px color-mix(in srgb, var(--layer) 18%, transparent);
}
.tpc-d-layer-cap {
  font-size: 11px;
  font-weight: 560;
  color: var(--app-text-muted);
}
.tpc-d-layer:focus-within .tpc-d-layer-cap {
  color: var(--app-text-primary);
  font-weight: 650;
}
.tpc-d-layer-row {
  display: flex;
  align-items: baseline;
  gap: 2px;
}
.tpc-d-layer-val {
  box-sizing: content-box;
  width: 3.4ch;
  height: 1em;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  outline: none;
  text-align: left;
  font-size: 22px;
  font-weight: 620;
  font-variant-numeric: tabular-nums;
  font-family: inherit;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--app-text-primary);
  appearance: textfield;
}
.tpc-d-layer-val::-webkit-outer-spin-button,
.tpc-d-layer-val::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
.tpc-d-layer-row > span {
  font-size: 13px;
  font-weight: 560;
  color: var(--app-text-secondary);
}
.tpc-d-layer-mm {
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--app-text-muted);
}
.tpc-shape-error {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, #ef4444 12%, var(--app-card));
  color: #ef4444;
  font-size: 12px;
  line-height: 1.45;
}
.tpc-shape-btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
.tpc-shape-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-soft);
  color: var(--app-text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.tpc-shape-btn.primary {
  background: color-mix(in srgb, var(--tpc-accent) 16%, var(--app-card));
  border-color: color-mix(in srgb, var(--tpc-accent) 50%, var(--app-border));
  color: var(--app-text-primary);
  font-weight: 600;
}
.tpc-shape-btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
@media (max-width: 640px) {
  .tpc-diamond-body {
    grid-template-columns: 1fr;
  }
}
</style>
