<script setup lang="ts">
import { computed, reactive } from 'vue'
import {
  TEN_PLUS_CUSHION_DEFAULT_LENGTH,
  TEN_PLUS_CUSHION_DEFAULT_WIDTH,
  TEN_PLUS_CUSHION_EXPONENT_MAX,
  TEN_PLUS_CUSHION_EXPONENT_MIN,
  TEN_PLUS_QUICK_SHAPE_OPTIONS,
  TEN_PLUS_TEARDROP_DEFAULT_LENGTH,
  TEN_PLUS_TEARDROP_DEFAULT_WIDTH
} from '../constants/shapePreset'
import type { TenPlusQuickShapeInput } from '../types/shapePreset'
import {
  buildQuickShapePreview,
  createDefaultQuickShapeInput,
  describeQuickShapeError,
  pointsToSvgPolyline,
  teardropFromSize,
  teardropGeometry
} from '../utils/tenPlusShapePresets'

const PREVIEW_SIZE = 220
const PREVIEW_PAD = 1.2

const emit = defineEmits<{
  close: []
  confirm: [input: TenPlusQuickShapeInput]
}>()

const form = reactive(createDefaultQuickShapeInput())

const errorText = computed(() => describeQuickShapeError({ ...form }))

const preview = computed(() => buildQuickShapePreview({ ...form }))

const teardropInfo = computed(() => {
  if (form.shape !== 'teardrop' || errorText.value) return null
  const { a, L } = teardropFromSize(form.length, form.width)
  return teardropGeometry(a, L)
})

const subtitle = computed(() => {
  if (form.shape === 'teardrop') {
    return '长=a+L、宽=2a；沿轮廓顶→右→左（反向），同层三段中心圆'
  }
  return '超椭圆垫型，轮廓转 45°；第一段朝右，R 每次 +90°'
})

const previewScale = computed(() => {
  const model = preview.value
  if (!model) return 0
  const reach = model.outline.reduce(
    (m, p) => Math.max(m, Math.abs(p.x), Math.abs(p.y)),
    0.001
  )
  return PREVIEW_SIZE / (reach * 2 * PREVIEW_PAD)
})

const previewHalf = PREVIEW_SIZE / 2

const outlinePoints = computed(() => {
  const model = preview.value
  if (!model || form.shape === 'teardrop') return ''
  return pointsToSvgPolyline(model.outline, previewScale.value)
})

const quarterPoints = computed(() => {
  const model = preview.value
  if (!model) return []
  const scale = previewScale.value
  return model.quarters.map((pts) => pointsToSvgPolyline(pts, scale))
})

function segmentClass(index: number): string {
  if (form.shape === 'teardrop') {
    if (index === 0) return 'tpc-shape-qtop'
    if (index === 1) return 'tpc-shape-q0'
    return 'tpc-shape-qn'
  }
  return index === 0 ? 'tpc-shape-q0' : 'tpc-shape-qn'
}

function onShapeChange(): void {
  if (form.shape === 'teardrop') {
    form.length = TEN_PLUS_TEARDROP_DEFAULT_LENGTH
    form.width = TEN_PLUS_TEARDROP_DEFAULT_WIDTH
    return
  }
  form.length = TEN_PLUS_CUSHION_DEFAULT_LENGTH
  form.width = TEN_PLUS_CUSHION_DEFAULT_WIDTH
}

function onConfirm(): void {
  if (errorText.value) return
  emit('confirm', {
    shape: form.shape,
    length: Number(form.length),
    width: Number(form.width),
    height: Number(form.height),
    exponent: Number(form.exponent),
    angle: Number(form.angle)
  })
}
</script>

<template>
  <div class="tpc-shape-overlay">
    <div class="tpc-shape-card" role="dialog" aria-modal="true" aria-labelledby="tpc-shape-title">
      <header class="tpc-shape-head">
        <div>
          <h2 id="tpc-shape-title">快捷形状编辑</h2>
          <p>{{ subtitle }}</p>
        </div>
        <button type="button" class="tpc-shape-close" aria-label="关闭" @click="emit('close')">
          ✕
        </button>
      </header>

      <div class="tpc-shape-body">
        <div class="tpc-shape-form">
          <label class="tpc-shape-field">
            <span>形状</span>
            <select v-model="form.shape" class="tpc-shape-input" @change="onShapeChange">
              <option
                v-for="item in TEN_PLUS_QUICK_SHAPE_OPTIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>
          </label>

          <div class="tpc-shape-grid">
            <label class="tpc-shape-field">
              <span>长 (mm)</span>
              <input v-model.number="form.length" type="number" min="0.1" step="0.1" class="tpc-shape-input" />
            </label>
            <label class="tpc-shape-field">
              <span>宽 (mm)</span>
              <input v-model.number="form.width" type="number" min="0.1" step="0.1" class="tpc-shape-input" />
            </label>
            <label class="tpc-shape-field">
              <span>高度 (mm)</span>
              <input v-model.number="form.height" type="number" min="0" step="0.1" class="tpc-shape-input" />
            </label>
            <label class="tpc-shape-field">
              <span>角度 (°)</span>
              <input v-model.number="form.angle" type="number" min="-90" max="90" step="1" class="tpc-shape-input" />
            </label>
            <label v-if="form.shape === 'cushion'" class="tpc-shape-field tpc-shape-span">
              <span>指数 n（{{ TEN_PLUS_CUSHION_EXPONENT_MIN }} 尖 … {{ TEN_PLUS_CUSHION_EXPONENT_MAX }} 方）</span>
              <input
                v-model.number="form.exponent"
                type="number"
                :min="TEN_PLUS_CUSHION_EXPONENT_MIN"
                :max="TEN_PLUS_CUSHION_EXPONENT_MAX"
                step="0.1"
                class="tpc-shape-input"
              />
            </label>
          </div>

          <p v-if="form.shape === 'cushion'" class="tpc-shape-hint">
            r(θ) = a·b / [(b·|cosθ|)ⁿ + (a·|sinθ|)ⁿ]^(1/n)
            · n=2 椭圆 · n=4 垫型
          </p>
          <p v-else-if="form.shape === 'teardrop' && teardropInfo" class="tpc-shape-hint">
            a = 宽/2 = {{ teardropInfo.a.toFixed(2) }}
            · L = 长 − a = {{ teardropInfo.L.toFixed(2) }}
            · cx = (a²−L²)/(2a) · r = (a²+L²)/(2a)
            · 尖角 {{ teardropInfo.tipAngleDeg.toFixed(1) }}°
          </p>
          <p v-if="errorText" class="tpc-shape-error">{{ errorText }}</p>
        </div>

        <div class="tpc-shape-preview" :aria-label="form.shape === 'teardrop' ? '水滴预览' : '垫型预览'">
          <svg
            class="tpc-shape-svg"
            :width="PREVIEW_SIZE"
            :height="PREVIEW_SIZE"
            :viewBox="`${-previewHalf} ${-previewHalf} ${PREVIEW_SIZE} ${PREVIEW_SIZE}`"
          >
            <line
              :x1="-previewHalf"
              y1="0"
              :x2="previewHalf"
              y2="0"
              class="tpc-shape-axis"
            />
            <line
              x1="0"
              :y1="-previewHalf"
              x2="0"
              :y2="previewHalf"
              class="tpc-shape-axis"
            />
            <polyline
              v-if="outlinePoints"
              :points="outlinePoints"
              class="tpc-shape-outline"
              fill="none"
            />
            <polyline
              v-for="(pts, i) in quarterPoints"
              :key="i"
              :points="pts"
              fill="none"
              :class="segmentClass(i)"
            />
            <circle cx="0" cy="0" r="2.5" class="tpc-shape-origin" />
          </svg>
          <div v-if="form.shape === 'cushion'" class="tpc-shape-legend">
            <span><i class="tpc-shape-swatch outline" />完整轮廓</span>
            <span><i class="tpc-shape-swatch q0" />右侧 −45°–45°</span>
            <span><i class="tpc-shape-swatch qn" />其余三段（R +90°）</span>
          </div>
          <div v-else class="tpc-shape-legend">
            <span><i class="tpc-shape-swatch outline" />顶部半圆</span>
            <span><i class="tpc-shape-swatch q0" />右侧弧（右肩 → 尖端）</span>
            <span><i class="tpc-shape-swatch qn" />左侧弧（尖端 → 左肩）</span>
          </div>
        </div>
      </div>

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
  width: 680px;
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
.tpc-shape-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 16px;
  align-items: start;
}
.tpc-shape-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}
.tpc-shape-span {
  grid-column: 1 / -1;
}
.tpc-shape-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-muted);
}
.tpc-shape-input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card);
  color: var(--app-text-primary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.tpc-shape-input:focus {
  outline: none;
  border-color: var(--tpc-accent, #0071e3);
}
.tpc-shape-hint,
.tpc-shape-error {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.45;
}
.tpc-shape-hint {
  color: var(--app-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}
.tpc-shape-error {
  color: #ef4444;
}
.tpc-shape-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.tpc-shape-svg {
  display: block;
  border-radius: 12px;
  background: color-mix(in srgb, var(--app-text-primary) 6%, var(--app-card));
  box-shadow: inset 0 0 0 1px var(--app-border);
}
.tpc-shape-axis {
  stroke: color-mix(in srgb, var(--app-text-primary) 18%, transparent);
  stroke-width: 1;
}
.tpc-shape-outline {
  stroke: #4dd8a8;
  stroke-width: 1.5;
}
.tpc-shape-q0 {
  stroke: #4da3ff;
  stroke-width: 3;
}
.tpc-shape-qn {
  stroke: #ff7a59;
  stroke-width: 3;
}
.tpc-shape-qtop {
  stroke: #4dd8a8;
  stroke-width: 3;
}
.tpc-shape-origin {
  fill: var(--app-text-primary);
}
.tpc-shape-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--app-text-muted);
  width: 100%;
}
.tpc-shape-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tpc-shape-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
.tpc-shape-swatch.outline {
  background: #4dd8a8;
}
.tpc-shape-swatch.q0 {
  background: #4da3ff;
}
.tpc-shape-swatch.qn {
  background: #ff7a59;
}
.tpc-shape-btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.tpc-shape-btn {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-soft);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 12px;
}
.tpc-shape-btn.primary {
  background: color-mix(in srgb, var(--tpc-accent, #0071e3) 15%, var(--app-card));
  border-color: color-mix(in srgb, var(--tpc-accent, #0071e3) 50%, var(--app-border));
  color: var(--app-text-primary);
}
.tpc-shape-btn.primary:hover:not(:disabled) {
  background: var(--tpc-accent, #0071e3);
  border-color: var(--tpc-accent, #0071e3);
  color: #fff;
}
.tpc-shape-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
@media (max-width: 640px) {
  .tpc-shape-body {
    grid-template-columns: 1fr;
  }
}
</style>
