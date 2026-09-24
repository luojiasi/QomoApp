<script setup lang="ts">
import { computed, onUnmounted, reactive, watch } from 'vue'
import {百分比最大值,百分比最小值,默认亭高比,默认冠高比,默认台面比,默认腰高比,钻石切工选项} from '../constants/diamondPreset'
import type { 钻石预设输入 } from '../types/diamondPreset'
import {层高毫米,切工标签,切工轮廓,切工需要长宽,创建默认钻石预设,生成钻石侧视,钻石预设错误} from '../utils/diamondPresets'

const emit = defineEmits<{
  关闭: []
  确认: [输入: 钻石预设输入]
}>()

const 圆环半径 = 54

const 表单 = reactive(创建默认钻石预设())

const 错误文案 = computed(() => 钻石预设错误({ ...表单 }))
const 切工名称 = computed(() => 切工标签(表单.切工))
const 轮廓 = computed(() => 切工轮廓(表单.切工))
const 需要长宽 = computed(() => 切工需要长宽(表单.切工))
const 写入说明 = computed((): string => {
  if (轮廓.value.种类 === '切角矩形') {
    return `生成四行：台面等分线段扫面，冠/腰/亭为非等分直线。长宽取左侧输入，切角比例 ${轮廓.value.切角比例}%`
  }
  return '生成四行等分线段（台面、冠、腰、亭）。台面直径取腰宽、角度 0、分割数 0；冠/腰/亭分割数 0'
})

const 高度基准 = computed(() => (需要长宽.value ? Number(表单.宽) : Number(表单.直径)))

const 高度字段 = [
  { 键: '台面比', 标题: '台面比', 色调: '台面', 编号: 'tpc-d-table-pct' },
  { 键: '冠高比', 标题: '冠高比', 色调: '冠', 编号: 'tpc-d-crown-pct' },
  { 键: '腰高比', 标题: '腰高比', 色调: '腰', 编号: 'tpc-d-girdle-pct' },
  { 键: '亭高比', 标题: '亭高比', 色调: '亭', 编号: 'tpc-d-pavilion-pct' }
] as const

function 格式化毫米(值: number): string {
  if (!Number.isFinite(值)) return '—'
  return String(Math.round(值 * 1000) / 1000)
}

function 实际高度文案(百分比: number): string {
  return 格式化毫米(层高毫米(高度基准.value, 百分比))
}

function 百分比字宽(值: number): number {
  const 原文 = Number.isFinite(值) ? String(值) : ''
  return Math.max(1, 原文.length)
}

const 合计高度文案 = computed(() =>
  格式化毫米(
    层高毫米(高度基准.value, Number(表单.冠高比)) +
      层高毫米(高度基准.value, Number(表单.腰高比)) +
      层高毫米(高度基准.value, Number(表单.亭高比))
  )
)

function 选中输入(事件: Event): void {
  const 元素 = 事件.target
  if (元素 instanceof HTMLInputElement) 元素.select()
}

function 限制百分比(值: number, 回退: number): number {
  if (!Number.isFinite(值)) return 回退
  return Math.min(百分比最大值, Math.max(百分比最小值, 值))
}

const 显示 = reactive({台面比: 默认台面比,冠高比: 默认冠高比,腰高比: 默认腰高比,亭高比: 默认亭高比})
const 侧视 = computed(() => 生成钻石侧视(显示.冠高比, 显示.腰高比, 显示.亭高比, 显示.台面比))

const 动画毫秒 = 380
let 动画帧 = 0
let 动画起点 = { 台面比: 默认台面比, 冠高比: 默认冠高比, 腰高比: 默认腰高比, 亭高比: 默认亭高比 }
let 动画终点 = { 台面比: 默认台面比, 冠高比: 默认冠高比, 腰高比: 默认腰高比, 亭高比: 默认亭高比 }
let 动画开始 = 0

function 缓出三次(进度: number): number {return 1 - (1 - 进度) ** 3}

function 动画步进(当前: number): void {
  const 进度 = Math.min(1, (当前 - 动画开始) / 动画毫秒)
  const 缓动 = 缓出三次(进度)
  显示.台面比 = 动画起点.台面比 + (动画终点.台面比 - 动画起点.台面比) * 缓动
  显示.冠高比 = 动画起点.冠高比 + (动画终点.冠高比 - 动画起点.冠高比) * 缓动
  显示.腰高比 = 动画起点.腰高比 + (动画终点.腰高比 - 动画起点.腰高比) * 缓动
  显示.亭高比 = 动画起点.亭高比 + (动画终点.亭高比 - 动画起点.亭高比) * 缓动
  if (进度 < 1) 动画帧 = requestAnimationFrame(动画步进)
}

function 动画到(下一项: { 台面比: number; 冠高比: number; 腰高比: number; 亭高比: number }): void {
  动画起点 = {台面比: 显示.台面比,冠高比: 显示.冠高比,腰高比: 显示.腰高比,亭高比: 显示.亭高比}
  动画终点 = 下一项
  动画开始 = performance.now()
  cancelAnimationFrame(动画帧)
  动画帧 = requestAnimationFrame(动画步进)
}

watch(
  () => [表单.台面比, 表单.冠高比, 表单.腰高比, 表单.亭高比] as const,
  ([台面比, 冠高比, 腰高比, 亭高比]) => {
    动画到({
      台面比: 限制百分比(Number(台面比), 默认台面比),
      冠高比: 限制百分比(Number(冠高比), 默认冠高比),
      腰高比: 限制百分比(Number(腰高比), 默认腰高比),
      亭高比: 限制百分比(Number(亭高比), 默认亭高比)
    })
  },
  { immediate: true }
)

watch(
  () => 表单.切工,
  (切工, 旧切工) => {
    const 现在长宽 = 切工需要长宽(切工)
    const 刚才长宽 = 旧切工 != null && 切工需要长宽(旧切工)
    if (现在长宽 && !刚才长宽) {
      表单.长 = Number(表单.直径)
      表单.宽 = Number(表单.直径)
    }
    if (!现在长宽 && 刚才长宽) {
      表单.直径 = Number(表单.宽) || Number(表单.长) || 表单.直径
    }
  }
)

onUnmounted(() => {cancelAnimationFrame(动画帧)})

function 确认写入(): void {
  if (错误文案.value) return
  emit('确认', {
    切工: 表单.切工,
    直径: Number(表单.直径),
    长: Number(表单.长),
    宽: Number(表单.宽),
    台面比: Number(表单.台面比),
    冠高比: Number(表单.冠高比),
    腰高比: Number(表单.腰高比),
    亭高比: Number(表单.亭高比)
  })
}
</script>

<template>
  <div class="tpc-shape-overlay" @click.self="emit('关闭')">
    <div class="tpc-shape-card" role="dialog" aria-modal="true" aria-labelledby="tpc-diamond-title">
      <header class="tpc-shape-head">
        <div>
          <h2 id="tpc-diamond-title">钻石快捷形状编辑</h2>
          <p>{{ 写入说明 }}</p>
        </div>
        <button type="button" class="tpc-shape-close" aria-label="关闭" @click="emit('关闭')">
          ✕
        </button>
      </header>

      <div class="tpc-diamond-body">
        <div class="tpc-diamond-left">
          <label class="tpc-cut-field" for="tpc-d-cut">
            <span>钻石类型</span>
            <select id="tpc-d-cut" v-model="表单.切工" class="tpc-cut-select">
              <option
                v-for="项 in 钻石切工选项"
                :key="项.value"
                :value="项.value"
              >
                {{ 项.label }}
              </option>
            </select>
          </label>
          <div class="tpc-hcard">
          <div class="tpc-hcard-dial">
            <svg class="tpc-hcard-ring" viewBox="0 0 128 128" aria-hidden="true">
              <circle class="tpc-hcard-ring-track" cx="64" cy="64" :r="圆环半径" />
              <circle class="tpc-hcard-ring-value" cx="64" cy="64" :r="圆环半径" />
            </svg>
            <div v-if="!需要长宽" class="tpc-hcard-core">
              <span class="tpc-hcard-row">
                <input
                  id="tpc-d-diameter"
                  v-model.number="表单.直径"
                  type="number"
                  class="tpc-hcard-val tpc-hcard-val-mm"
                  min="0.1"
                  max="200"
                  step="0.1"
                  aria-label="直径"
                  @focus="选中输入"
                />
                <span>mm</span>
              </span>
              <span class="tpc-hcard-result">
                <span class="tpc-hcard-result-label">三层合计</span>
                {{ 合计高度文案 }}
              </span>
            </div>
            <div v-else class="tpc-hcard-core tpc-hcard-core-lw">
              <label class="tpc-hcard-lw-row" for="tpc-d-length">
                <span class="tpc-hcard-lw-cap">长</span>
                <input
                  id="tpc-d-length"
                  v-model.number="表单.长"
                  type="number"
                  class="tpc-hcard-val tpc-hcard-val-lw"
                  min="0.1"
                  max="200"
                  step="0.1"
                  aria-label="长"
                  @focus="选中输入"
                />
                <span>mm</span>
              </label>
              <label class="tpc-hcard-lw-row" for="tpc-d-width">
                <span class="tpc-hcard-lw-cap">宽</span>
                <input
                  id="tpc-d-width"
                  v-model.number="表单.宽"
                  type="number"
                  class="tpc-hcard-val tpc-hcard-val-lw"
                  min="0.1"
                  max="200"
                  step="0.1"
                  aria-label="宽"
                  @focus="选中输入"
                />
                <span>mm</span>
              </label>
              <span class="tpc-hcard-result">
                <span class="tpc-hcard-result-label">三层合计</span>
                {{ 合计高度文案 }}
              </span>
            </div>
          </div>
          <div class="tpc-hcard-cap">{{ 需要长宽 ? '长 / 宽' : '直径' }}</div>
        </div>
        </div>

        <div class="tpc-diamond-stage">
          <div class="tpc-diamond-figure">
            <svg
              class="tpc-diamond-svg"
              :viewBox="`${侧视.视口左} ${侧视.视口上} ${侧视.视口宽} ${侧视.视口高}`"
              role="img"
              :aria-label="`${切工名称}侧视`"
            >
              <path class="tpc-d-fill 冠" :d="侧视.冠路径" />
              <path class="tpc-d-fill 腰" :d="侧视.腰路径" />
              <path class="tpc-d-fill 亭" :d="侧视.亭路径" />
              <path class="tpc-d-facet-fill" :d="侧视.左刻面路径" />
              <path class="tpc-d-facet" :d="侧视.刻面路径" />
              <path class="tpc-d-outline" :d="侧视.轮廓路径" />
            </svg>

            <div class="tpc-d-callouts">
            <label
              v-for="字段 in 高度字段"
              :key="字段.键"
              class="tpc-d-layer"
              :class="`is-${字段.色调}`"
              :for="字段.编号"
            >
              <span class="tpc-d-layer-cap">{{ 字段.标题 }}</span>
              <span class="tpc-d-layer-row">
                <input
                  :id="字段.编号"
                  v-model.number="表单[字段.键]"
                  type="number"
                  class="tpc-d-layer-val"
                  :style="{ width: `${百分比字宽(Number(表单[字段.键]))}ch` }"
                  step="0.1"
                  :min="百分比最小值"
                  :max="百分比最大值"
                  :aria-label="字段.标题"
                  @focus="选中输入"
                />
                <span class="tpc-d-layer-unit">%</span>
              </span>
              <span class="tpc-d-layer-mm">{{ 实际高度文案(Number(表单[字段.键])) }} mm</span>
            </label>
            </div>
          </div>
        </div>
      </div>
      <p v-if="错误文案" class="tpc-shape-error">{{ 错误文案 }}</p>

      <div class="tpc-shape-btns">
        <button type="button" class="tpc-shape-btn" @click="emit('关闭')">取消</button>
        <button
          type="button"
          class="tpc-shape-btn primary"
          :disabled="Boolean(错误文案)"
          @click="确认写入"
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
.tpc-hcard-core-lw {
  gap: 2px;
  padding: 18px 8px 10px;
}
.tpc-hcard-lw-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
}
.tpc-hcard-lw-cap {
  width: 1.15em;
  margin: 0;
  font-size: 12px;
  font-weight: 560;
  color: var(--app-text-secondary);
}
.tpc-hcard-val-lw {
  width: 3.6ch;
  font-size: 22px;
}
.tpc-hcard-lw-row > span:last-child {
  margin: 0;
  font-size: 12px;
  font-weight: 560;
  color: var(--app-text-secondary);
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
  height: 360px;
  padding: 12px;
}
.tpc-diamond-svg {
  display: block;
  width: 100%;
  height: 100%;
}
.tpc-d-fill.冠 {
  fill: #d7e6f2;
}
.tpc-d-fill.腰 {
  fill: #e2d3b4;
}
.tpc-d-fill.亭 {
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
.tpc-d-layer.is-台面 {
  --layer: #9aa7b4;
}
.tpc-d-layer.is-冠 {
  --layer: #7aa8cc;
}
.tpc-d-layer.is-腰 {
  --layer: #c4a574;
}
.tpc-d-layer.is-亭 {
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
  min-width: 0;
  max-width: 100%;
}
.tpc-d-layer-val {
  box-sizing: content-box;
  min-width: 1ch;
  max-width: calc(100% - 1.15em);
  height: 1em;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  outline: none;
  text-align: left;
  overflow: hidden;
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
.tpc-d-layer-unit {
  flex: 0 0 auto;
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
