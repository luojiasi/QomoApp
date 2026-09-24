<script setup lang="ts">
import { computed, reactive } from 'vue'
import {
  垫型默认长,
  垫型默认宽,
  垫型指数最大,
  垫型指数最小,
  马眼默认长,
  马眼默认宽,
  快捷形状选项,
  水滴默认长,
  水滴默认宽
} from '../constants/shapePreset'
import type { TenPlusQuickShapeInput } from '../types/shapePreset'
import {
  构建快捷形状预览,
  创建默认快捷形状,
  快捷形状错误,
  马眼几何公式,
  点列转折线,
  水滴由尺寸,
  水滴几何公式
} from '../utils/shapePresets'

const 预览尺寸 = 220
const 预览边距 = 1.2

const 发出 = defineEmits<{
  close: []
  confirm: [input: TenPlusQuickShapeInput]
}>()

const 表单 = reactive(创建默认快捷形状())

const 错误文案 = computed(() => 快捷形状错误({ ...表单 }))

const 预览 = computed(() => 构建快捷形状预览({ ...表单 }))

const 水滴几何 = computed(() => {
  if (表单.shape !== '水滴' || 错误文案.value) return null
  const { a, L } = 水滴由尺寸(表单.length, 表单.width)
  return 水滴几何公式(a, L)
})

const 马眼几何 = computed(() => {
  if (表单.shape !== '马眼' || 错误文案.value) return null
  return 马眼几何公式(表单.length / 2, 表单.width / 2)
})

const 副标题 = computed(() => {
  if (表单.shape === '水滴') {
    return '长=a+L、宽=2a；X 镜像后沿轮廓顶→左→右，同层三段中心圆'
  }
  if (表单.shape === '马眼') {
    return '长=2l、宽=2w；两段等半径中心圆，X 镜像后左弧→右弧，第 2 行同层'
  }
  return '超椭圆垫型，轮廓转 45°；第一段 135°~225°（X 镜像），R 每次 +90°'
})

const 预览比例 = computed(() => {
  const 模型 = 预览.value
  if (!模型) return 0
  const 外伸 = 模型.轮廓.reduce(
    (最大, 点) => Math.max(最大, Math.abs(点.横), Math.abs(点.纵)),
    0.001
  )
  return 预览尺寸 / (外伸 * 2 * 预览边距)
})

const 预览半边 = 预览尺寸 / 2

const 轮廓点串 = computed(() => {
  const 模型 = 预览.value
  if (!模型 || 表单.shape !== '垫型') return ''
  return 点列转折线(模型.轮廓, 预览比例.value)
})

const 分段点串 = computed(() => {
  const 模型 = 预览.value
  if (!模型) return []
  const 比例 = 预览比例.value
  return 模型.分段.map((点列) => 点列转折线(点列, 比例))
})

function 分段样式(下标: number): string {
  if (表单.shape === '水滴') {
    if (下标 === 0) return 'tpc-shape-qtop'
    if (下标 === 1) return 'tpc-shape-q0'
    return 'tpc-shape-qn'
  }
  return 下标 === 0 ? 'tpc-shape-q0' : 'tpc-shape-qn'
}

function 形状变化(): void {
  if (表单.shape === '水滴') {
    表单.length = 水滴默认长
    表单.width = 水滴默认宽
    return
  }
  if (表单.shape === '马眼') {
    表单.length = 马眼默认长
    表单.width = 马眼默认宽
    return
  }
  表单.length = 垫型默认长
  表单.width = 垫型默认宽
}

function 确认(): void {
  if (错误文案.value) return
  发出('confirm', {
    shape: 表单.shape,
    length: Number(表单.length),
    width: Number(表单.width),
    height: Number(表单.height),
    exponent: Number(表单.exponent),
    angle: Number(表单.angle)
  })
}

interface 公式项 {
  符号: string
  公式: string
  取值: string
}

const 公式列表 = computed((): 公式项[] => {
  if (错误文案.value) return []
  if (表单.shape === '水滴' && 水滴几何.value) {
    const 几何 = 水滴几何.value
    return [
      { 符号: 'a', 公式: '宽 / 2', 取值: 几何.a.toFixed(2) },
      { 符号: 'L', 公式: '长 − a', 取值: 几何.L.toFixed(2) },
      { 符号: 'cx', 公式: '(a² − L²) / 2a', 取值: 几何.cx.toFixed(2) },
      { 符号: 'r', 公式: '(a² + L²) / 2a', 取值: 几何.r.toFixed(2) },
      { 符号: '尖角', 公式: '', 取值: `${几何.尖角.toFixed(1)}°` }
    ]
  }
  if (表单.shape === '马眼' && 马眼几何.value) {
    const 几何 = 马眼几何.value
    return [
      { 符号: 'l', 公式: '长 / 2', 取值: 几何.l.toFixed(2) },
      { 符号: 'w', 公式: '宽 / 2', 取值: 几何.w.toFixed(2) },
      { 符号: 'R', 公式: '(l² + w²) / 2w', 取值: 几何.R.toFixed(2) },
      { 符号: 'd', 公式: '(l² − w²) / 2w', 取值: 几何.d.toFixed(2) },
      { 符号: 'θ', 公式: 'atan2(l, d)', 取值: `${几何.半张角.toFixed(1)}°` }
    ]
  }
  if (表单.shape === '垫型') {
    return [
      { 符号: 'a', 公式: '长 / 2', 取值: (表单.length / 2).toFixed(2) },
      { 符号: 'b', 公式: '宽 / 2', 取值: (表单.width / 2).toFixed(2) },
      { 符号: 'n', 公式: '2 椭圆 · 4 垫型', 取值: Number(表单.exponent).toFixed(1) }
    ]
  }
  return []
})
</script>

<template>
  <div class="tpc-shape-overlay">
    <div class="tpc-shape-card" role="dialog" aria-modal="true" aria-labelledby="tpc-shape-title">
      <header class="tpc-shape-head">
        <div>
          <h2 id="tpc-shape-title">快捷形状编辑</h2>
          <p>{{ 副标题 }}</p>
        </div>
        <button type="button" class="tpc-shape-close" aria-label="关闭" @click="发出('close')">
          ✕
        </button>
      </header>

      <div class="tpc-shape-body">
        <div class="tpc-shape-form">
          <label class="tpc-shape-field">
            <span>形状</span>
            <select v-model="表单.shape" class="tpc-shape-input" @change="形状变化">
              <option
                v-for="项 in 快捷形状选项"
                :key="项.value"
                :value="项.value"
              >
                {{ 项.label }}
              </option>
            </select>
          </label>

          <div class="tpc-shape-grid">
            <label class="tpc-shape-field">
              <span>长 (mm)</span>
              <input v-model.number="表单.length" type="number" min="0.1" step="0.1" class="tpc-shape-input" />
            </label>
            <label class="tpc-shape-field">
              <span>宽 (mm)</span>
              <input v-model.number="表单.width" type="number" min="0.1" step="0.1" class="tpc-shape-input" />
            </label>
            <label class="tpc-shape-field">
              <span>高度 (mm)</span>
              <input v-model.number="表单.height" type="number" min="0" step="0.1" class="tpc-shape-input" />
            </label>
            <label class="tpc-shape-field">
              <span>角度 (°)</span>
              <input v-model.number="表单.angle" type="number" min="-90" max="90" step="1" class="tpc-shape-input" />
            </label>
            <label v-if="表单.shape === '垫型'" class="tpc-shape-field tpc-shape-span">
              <span>指数 n（{{ 垫型指数最小 }} 尖 … {{ 垫型指数最大 }} 方）</span>
              <input
                v-model.number="表单.exponent"
                type="number"
                :min="垫型指数最小"
                :max="垫型指数最大"
                step="0.1"
                class="tpc-shape-input"
              />
            </label>
          </div>

          <div v-if="公式列表.length" class="tpc-shape-eqs" aria-live="polite">
            <div v-for="项 in 公式列表" :key="项.符号" class="tpc-shape-eq">
              <span class="tpc-shape-eq-sym">{{ 项.符号 }}</span>
              <span class="tpc-shape-eq-form">{{ 项.公式 ? `= ${项.公式}` : '' }}</span>
              <span class="tpc-shape-eq-val">= {{ 项.取值 }}</span>
            </div>
            <p v-if="表单.shape === '垫型'" class="tpc-shape-eq-note">
              r(θ) = a·b / [(b·|cosθ|)ⁿ + (a·|sinθ|)ⁿ]^(1/n)
            </p>
          </div>
          <p v-if="错误文案" class="tpc-shape-error">{{ 错误文案 }}</p>
        </div>

        <div
          class="tpc-shape-preview"
          :aria-label="
            表单.shape === '水滴' ? '水滴预览' : 表单.shape === '马眼' ? '马眼预览' : '垫型预览'
          "
        >
          <svg
            class="tpc-shape-svg"
            :width="预览尺寸"
            :height="预览尺寸"
            :viewBox="`${-预览半边} ${-预览半边} ${预览尺寸} ${预览尺寸}`"
          >
            <line
              :x1="-预览半边"
              y1="0"
              :x2="预览半边"
              y2="0"
              class="tpc-shape-axis"
            />
            <line
              x1="0"
              :y1="-预览半边"
              x2="0"
              :y2="预览半边"
              class="tpc-shape-axis"
            />
            <polyline
              v-if="轮廓点串"
              :points="轮廓点串"
              class="tpc-shape-outline"
              fill="none"
            />
            <polyline
              v-for="(点串, 下标) in 分段点串"
              :key="下标"
              :points="点串"
              fill="none"
              :class="分段样式(下标)"
            />
            <circle cx="0" cy="0" r="2.5" class="tpc-shape-origin" />
          </svg>
          <div v-if="表单.shape === '垫型'" class="tpc-shape-legend">
            <span><i class="tpc-shape-swatch outline" />完整轮廓</span>
            <span><i class="tpc-shape-swatch q0" />第一段</span>
            <span><i class="tpc-shape-swatch qn" />其余三段</span>
          </div>
          <div v-else-if="表单.shape === '马眼'" class="tpc-shape-legend">
            <span><i class="tpc-shape-swatch q0" />左弧 · 下尖 → 上尖</span>
            <span><i class="tpc-shape-swatch qn" />右弧 · 上尖 → 下尖</span>
          </div>
          <div v-else class="tpc-shape-legend">
            <span><i class="tpc-shape-swatch outline" />顶弧</span>
            <span><i class="tpc-shape-swatch q0" />右肩 → 尖端</span>
            <span><i class="tpc-shape-swatch qn" />尖端 → 左肩</span>
          </div>
        </div>
      </div>

      <div class="tpc-shape-btns">
        <button type="button" class="tpc-shape-btn" @click="发出('close')">取消</button>
        <button
          type="button"
          class="tpc-shape-btn primary"
          :disabled="Boolean(错误文案)"
          @click="确认"
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
.tpc-shape-eqs {
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--app-text-primary) 5%, var(--app-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #fff 22%, var(--app-border));
}
.tpc-shape-eq {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 8px;
  min-height: 26px;
  padding: 3px 2px;
}
.tpc-shape-eq + .tpc-shape-eq {
  border-top: 1px solid color-mix(in srgb, var(--app-text-primary) 8%, transparent);
}
.tpc-shape-eq-sym {
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--app-text-primary);
}
.tpc-shape-eq-form {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--app-text-muted);
}
.tpc-shape-eq-val {
  font-size: 13px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--app-text-primary);
}
.tpc-shape-eq-note {
  margin: 6px 0 0;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--app-text-primary) 8%, transparent);
  font-size: 11px;
  line-height: 1.45;
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
  gap: 6px;
  width: 100%;
}
.tpc-shape-legend span {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--app-text-primary) 4%, transparent);
  font-size: 11px;
  color: var(--app-text-secondary);
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
