<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  弦长倍率步进,
  默认弦长倍率,
  默认结束切割百分比,
  默认起始切割百分比,
  默认直径百分比,
  默认钻石百分比,
  默认高度百分比,
  默认R圈数,
  是等分线段,
  是台面角
} from '../constants/tenPlusCutting'
import { 计算钻石比例 } from '../utils/tenPlusDiamond'
import type { TenPlusTaskRow } from '../types/tenPlusCutting'

const 圆环半径 = 54
const 圆环周长 = 2 * Math.PI * 圆环半径

const 角度圆心横 = 64
const 角度圆心纵 = 76
const 角度射线长 = 44
const 角度弧半径 = 22

const 高度顶 = 15
const 高度底 = 113
const 高度左 = 13
const 高度右 = 119
const 高度箭头横 = 25
const 箭头头 = 7

const props = defineProps<{
  row: TenPlusTaskRow
}>()

const emit = defineEmits<{
  关闭: []
}>()

const 台面锁定 = computed(() => 是台面角(props.row.angle))

function 有限或(n: number, fallback: number): number {return Number.isFinite(n) ? n : fallback}

function 圆环虚线(percent: number): string {
  const pct = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 100
  return `${(pct / 100) * 圆环周长} ${圆环周长}`
}

function 缩放文案(base: number, percent: number, fallbackPercent: number): string {
  const value = 有限或(base, 0) * (有限或(percent, fallbackPercent) / 100)
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 1000) / 1000)
}

const 圆环虚线值 = computed(() => 圆环虚线(Number(props.row.diameterPercent)))

const 有效直径文案 = computed(() =>缩放文案(Number(props.row.diameter), Number(props.row.diameterPercent), 默认直径百分比))

const 有效高度文案 = computed(() =>缩放文案(Number(props.row.height), Number(props.row.heightPercent), 默认高度百分比))

const 可视角度 = computed(() => {
  const base = 有限或(Number(props.row.angle), 0)
  const comp = 有限或(Number(props.row.compAngle), 0)
  return Math.max(-170, Math.min(170, base + comp))
})

const 当前角度 = computed(() => {
  const base = 有限或(Number(props.row.angle), 0)
  const comp = 有限或(Number(props.row.compAngle), 0)
  return base + comp
})

const 动画毫秒 = 400
const 绘制角度 = ref(0)
let 角度动画帧 = 0
const 绘制斜率截距 = ref({ k: 0, b: 0, x: 0 })
let 斜率动画帧 = 0

function 缓出(t: number): number {return 1 - (1 - t) ** 4}

watch(
  可视角度,
  (to) => {
    const from = 绘制角度.value
    if (角度动画帧) cancelAnimationFrame(角度动画帧)
    if (from === to) {
      绘制角度.value = to
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 动画毫秒)
      绘制角度.value = from + (to - from) * 缓出(t)
      if (t < 1) 角度动画帧 = requestAnimationFrame(step)
      else 绘制角度.value = to
    }
    角度动画帧 = requestAnimationFrame(step)
  },
  { immediate: true }
)

const 目标斜率截距 = computed(() => ({
  k: 有限或(Number(props.row.k), 0),
  b: 有限或(Number(props.row.b), 0),
  x: 有限或(Number(props.row.x), 0)
}))

watch(
  目标斜率截距,
  (to) => {
    const from = { ...绘制斜率截距.value }
    if (斜率动画帧) cancelAnimationFrame(斜率动画帧)
    if (from.k === to.k && from.b === to.b && from.x === to.x) {
      绘制斜率截距.value = { ...to }
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 动画毫秒)
      const e = 缓出(t)
      绘制斜率截距.value = {
        k: from.k + (to.k - from.k) * e,
        b: from.b + (to.b - from.b) * e,
        x: from.x + (to.x - from.x) * e
      }
      if (t < 1) 斜率动画帧 = requestAnimationFrame(step)
      else 绘制斜率截距.value = { k: to.k, b: to.b, x: to.x }
    }
    斜率动画帧 = requestAnimationFrame(step)
  },
  { immediate: true }
)

const 可视高度百分比 = computed(() => {
  const n = Number(props.row.heightPercent)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 默认高度百分比
})

const 绘制高度百分比 = ref(0)
let 高度动画帧 = 0
const 绘制弦比 = ref(0)
let 弦比动画帧 = 0

watch(
  可视高度百分比,
  (to) => {
    const from = 绘制高度百分比.value
    if (高度动画帧) cancelAnimationFrame(高度动画帧)
    if (from === to) {
      绘制高度百分比.value = to
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 动画毫秒)
      绘制高度百分比.value = from + (to - from) * 缓出(t)
      if (t < 1) 高度动画帧 = requestAnimationFrame(step)
      else 绘制高度百分比.value = to
    }
    高度动画帧 = requestAnimationFrame(step)
  },
  { immediate: true }
)

const 高度条 = computed(() => {
  const span = 高度底 - 高度顶
  const topY = 高度底 - (绘制高度百分比.value / 100) * span
  const gap = 高度底 - topY
  const x = 高度箭头横
  return {
    topY,
    showArrow: gap > 4,
    showHeads: gap > 箭头头 * 2 + 4,
    headUp: `M${x},${topY} L${x - 4.4},${topY + 箭头头} L${x + 4.4},${topY + 箭头头} Z`,
    headDown: `M${x},${高度底} L${x - 4.4},${高度底 - 箭头头} L${x + 4.4},${高度底 - 箭头头} Z`
  }
})

onUnmounted(() => {
  if (角度动画帧) cancelAnimationFrame(角度动画帧)
  if (斜率动画帧) cancelAnimationFrame(斜率动画帧)
  if (高度动画帧) cancelAnimationFrame(高度动画帧)
  if (弦比动画帧) cancelAnimationFrame(弦比动画帧)
})

function 极坐标(deg: number, radius: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180
  return {
    x: 角度圆心横 + radius * Math.cos(a),
    y: 角度圆心纵 - radius * Math.sin(a)
  }
}

const 基线终点 = computed(() => 极坐标(0, 角度射线长))
const 运动射线终点 = computed(() => 极坐标(绘制角度.value, 角度射线长))

const 角度弧路径 = computed(() => {
  const a = 绘制角度.value
  const start = 极坐标(0, 角度弧半径)
  const end = 极坐标(a, 角度弧半径)
  const large = Math.abs(a) > 180 ? 1 : 0
  const sweep = a >= 0 ? 0 : 1
  return `M ${start.x} ${start.y} A ${角度弧半径} ${角度弧半径} 0 ${large} ${sweep} ${end.x} ${end.y}`
})

const 当前角度标签 = computed(() => {
  const a = 绘制角度.value
  const text = `${格式化坐标(当前角度.value)}°`
  if (Math.abs(a) < 2) {
    return { x: 角度圆心横 + 38, y: 角度圆心纵 + 18, text }
  }
  const p = 极坐标(a / 2, 角度弧半径 + 18)
  return { x: Math.min(118, Math.max(10, p.x)), y: Math.min(122, Math.max(48, p.y + 4)), text }
})

const 斜率图尺寸 = { w: 160, h: 160, padL: 16, padR: 20, padT: 16, padB: 42 }

function 轴范围(vals: number[], minSpan: number): { lo: number; hi: number } {
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  if (hi - lo < minSpan) {
    const mid = (lo + hi) / 2
    lo = mid - minSpan / 2
    hi = mid + minSpan / 2
  }
  const extra = (hi - lo) * 0.18
  return { lo: lo - extra, hi: hi + extra }
}

function 格式化坐标(n: number): string {
  const t = Math.round(n * 1000) / 1000
  return Object.is(t, -0) ? '0' : String(t)
}

function 刻度(lo: number, hi: number, count: number): number[] {
  const span = hi - lo
  if (!(span > 0)) return []
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag
  const start = Math.ceil(lo / step) * step
  const ticks: number[] = []
  for (let v = start; v <= hi + step * 1e-6; v += step) {
    ticks.push(Number(v.toPrecision(8)))
  }
  return ticks
}

function 限制标签(
  x: number,
  y: number,
  anchor: 'start' | 'end',
  w: number,
  yMin: number,
  yMax: number
): { x: number; y: number; anchor: 'start' | 'end' } {
  const nx = anchor === 'end' ? Math.max(10, x) : Math.min(w - 10, x)
  return { x: nx, y: Math.min(yMax, Math.max(yMin, y)), anchor }
}

const 斜率图 = computed(() => {
  const k = 绘制斜率截距.value.k
  const b = 绘制斜率截距.value.b
  const xEnd = 绘制斜率截距.value.x
  const x0 = 0
  const y0 = b
  const x1 = xEnd
  const y1 = k * xEnd + b
  const xs0 = 轴范围([0, x0, x1], 1)
  const ys0 = 轴范围([0, y0, y1], 1)
  const span = Math.max(xs0.hi - xs0.lo, ys0.hi - ys0.lo)
  const xMid = (xs0.lo + xs0.hi) / 2
  const yMid = (ys0.lo + ys0.hi) / 2
  const xs = { lo: xMid - span / 2, hi: xMid + span / 2 }
  const ys = { lo: yMid - span / 2, hi: yMid + span / 2 }
  const { w, h, padL, padR, padT, padB } = 斜率图尺寸
  const inner = Math.min(w - padL - padR, h - padT - padB)
  const ox = padL + (w - padL - padR - inner) / 2
  const oy = padT
  const toX = (x: number): number => ox + ((x - xs.lo) / (xs.hi - xs.lo)) * inner
  const toY = (y: number): number => oy + inner - ((y - ys.lo) / (ys.hi - ys.lo)) * inner
  const axisY0 = toY(0)
  const axisX0 = toX(0)
  const p0 = { x: toX(x0), y: toY(y0) }
  const p1 = { x: toX(x1), y: toY(y1) }
  const plotBottom = oy + inner
  const labelYMax = plotBottom - 6
  const p0Label = {
    ...限制标签(p0.x + 7, p0.y - 10, 'start', w, padT + 10, labelYMax),
    text: `(${格式化坐标(x0)}, ${格式化坐标(y0)})`
  }
  const p1Label = {
    ...限制标签(
      p1.x >= w * 0.55 ? p1.x - 7 : p1.x + 7,
      p1.y - 10,
      p1.x >= w * 0.55 ? 'end' : 'start',
      w,
      padT + 10,
      labelYMax
    ),
    text: `(${格式化坐标(x1)}, ${格式化坐标(y1)})`
  }
  if (Math.abs(p0Label.y - p1Label.y) < 11 && Math.abs(p0.x - p1.x) < 48) {
    p1Label.y = Math.min(labelYMax, p0Label.y + 12)
  }
  const skip0 = span * 0.04
  return {
    axisX: { x1: ox, y1: axisY0, x2: ox + inner, y2: axisY0 },
    axisY: { x1: axisX0, y1: plotBottom, x2: axisX0, y2: oy },
    line: { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y },
    p0,
    p1,
    collapsed: x0 === x1 && y0 === y1,
    gridX: 刻度(xs.lo, xs.hi, 3)
      .filter((v) => Math.abs(v) > skip0)
      .map((v) => ({ x1: toX(v), y1: oy, x2: toX(v), y2: plotBottom })),
    gridY: 刻度(ys.lo, ys.hi, 3)
      .filter((v) => Math.abs(v) > skip0)
      .map((v) => ({ x1: ox, y1: toY(v), x2: ox + inner, y2: toY(v) })),
    xName: {
      x: ox + inner - 3,
      y: axisY0 + 12 > plotBottom - 2 ? axisY0 - 6 : axisY0 + 12,
      text: 'x'
    },
    yName: { x: axisX0 + 8, y: oy + 4, text: 'y' },
    p0Label,
    p1Label
  }
})

watch(
  () => props.row.diameterPercent,
  (v) => {
    if (!Number.isFinite(v)) props.row.diameterPercent = 默认直径百分比
  },
  { immediate: true }
)

watch(
  () => props.row.heightPercent,
  (v) => {
    if (!Number.isFinite(v)) props.row.heightPercent = 默认高度百分比
  },
  { immediate: true }
)

function 限制切削百分比(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

function 提交切削起点(): void {
  const start = 限制切削百分比(Number(props.row.cutStartPercent), 默认起始切割百分比)
  props.row.cutStartPercent = start
  if (Number(props.row.cutEndPercent) < start) props.row.cutEndPercent = start
}

function 提交切削终点(): void {
  const end = 限制切削百分比(Number(props.row.cutEndPercent), 默认结束切割百分比)
  props.row.cutEndPercent = end
  if (Number(props.row.cutStartPercent) > end) props.row.cutStartPercent = end
}

watch(
  () => props.row.cutStartPercent,
  (v) => {
    if (!Number.isFinite(v)) props.row.cutStartPercent = 默认起始切割百分比
  },
  { immediate: true }
)

watch(
  () => props.row.cutEndPercent,
  (v) => {
    if (!Number.isFinite(v)) props.row.cutEndPercent = 默认结束切割百分比
  },
  { immediate: true }
)

const 切削范围条 = computed(() => {
  const start = 限制切削百分比(Number(props.row.cutStartPercent), 默认起始切割百分比)
  const end = 限制切削百分比(Number(props.row.cutEndPercent), 默认结束切割百分比)
  const span = 高度底 - 高度顶
  const startY = 高度顶 + (start / 100) * span
  const endY = 高度顶 + (end / 100) * span
  return {
    startY,
    endY,
    height: Math.max(0, endY - startY)
  }
})

watch(
  () => props.row.chordRatio,
  (v) => {
    if (!Number.isFinite(v)) props.row.chordRatio = 默认弦长倍率
  },
  { immediate: true }
)

const 显示圈数卡片 = computed(
  () => 是等分线段(props.row.pathType) && Number(props.row.divisions) === 0
)

watch(
  () => props.row.rTurns,
  (v) => {
    if (!Number.isFinite(v)) props.row.rTurns = 默认R圈数
  },
  { immediate: true }
)

const 圈数圆环上限 = 4

const 圈数虚线 = computed(() => {
  const n = Number(props.row.rTurns)
  const turns = Number.isFinite(n) && n > 0 ? n : 默认R圈数
  return 圆环虚线(Math.min(100, (turns / 圈数圆环上限) * 100))
})

function 提交圈数(): void {
  const n = Number(props.row.rTurns)
  props.row.rTurns = Number.isFinite(n) && n > 0 ? n : 默认R圈数
}

const 可视弦比 = computed(() => {
  const n = Number(props.row.chordRatio)
  return Number.isFinite(n) ? Math.max(0, n) : 默认弦长倍率
})

watch(
  可视弦比,
  (to) => {
    const from = 绘制弦比.value
    if (弦比动画帧) cancelAnimationFrame(弦比动画帧)
    if (from === to) {
      绘制弦比.value = to
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 动画毫秒)
      绘制弦比.value = from + (to - from) * 缓出(t)
      if (t < 1) 弦比动画帧 = requestAnimationFrame(step)
      else 绘制弦比.value = to
    }
    弦比动画帧 = requestAnimationFrame(step)
  },
  { immediate: true }
)

const 弦比条 = computed(() => {
  const r = 绘制弦比.value
  const extra = Math.max(0, r - 1)
  const deficit = Math.max(0, 1 - r)
  const total = Math.max(r, 1)
  return {
    actualPct: (Math.min(r, 1) / total) * 100,
    extraPct: (extra / total) * 100,
    deficitPct: (deficit / total) * 100
  }
})

function 微调弦比(delta: number): void {
  const cur = Number(props.row.chordRatio)
  const base = Number.isFinite(cur) ? cur : 默认弦长倍率
  props.row.chordRatio = Math.round((base + delta) * 1000) / 1000
}

const 钻石圆环 = computed(() => 圆环虚线(Number(props.row.diamondPercent)))

const 钻石比例结果 = computed(() =>
  props.row.useDiamondRatio ? 计算钻石比例(props.row) : null
)

function 百分比文案(v: number | null | undefined, fallback = '—'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return fallback
  return `${Math.round(v * 100) / 100}%`
}

watch(
  钻石比例结果,
  (r) => {
    if (!r) return
    if (r.直径百分比 !== null) props.row.diameterPercent = r.直径百分比
    if (r.高度百分比 !== null) props.row.heightPercent = r.高度百分比
  },
  { immediate: true }
)

function 选中输入(ev: Event): void {
  const el = ev.target
  if (el instanceof HTMLInputElement && !el.disabled) el.select()
}

const 焦点字段 = ref<string | null>(null)

function 字段获得焦点(key: string, ev: Event): void {
  焦点字段.value = key
  选中输入(ev)
}

function 字段失去焦点(key: string): void {
  if (焦点字段.value === key) 焦点字段.value = null
}

function 聚焦斜率卡片(ev: MouseEvent): void {
  if (台面锁定.value) return
  const t = ev.target
  if (!(t instanceof Element) || t.closest('.tpc-comp-kbx-field')) return
  const host = ev.currentTarget as HTMLElement
  const input = host.querySelector('input:not(:disabled)')
  if (input instanceof HTMLInputElement) {
    input.focus()
    input.select()
  }
}
</script>

<template>
  <div class="tpc-comp-overlay" @click.self="emit('关闭')">
    <div class="tpc-comp-card" role="dialog" aria-modal="true">
      <header class="tpc-comp-head">
        <div class="tpc-comp-head-text">
          <h2>修改补偿值</h2>
          <p v-if="台面锁定">台面行仅可改直径与角度</p>
        </div>
        <div class="tpc-comp-head-right">
          <button
            type="button"
            class="tpc-comp-switch"
            role="switch"
            :aria-checked="row.useDiamondRatio"
            @click="row.useDiamondRatio = !row.useDiamondRatio"
          >
            <span class="tpc-comp-switch-text">钻石比例</span>
            <span class="tpc-comp-switch-track" :class="{ on: row.useDiamondRatio }">
              <span class="tpc-comp-switch-knob" />
            </span>
          </button>
          <span class="tpc-comp-task">序号 {{ row.taskNo }}</span>
        </div>
      </header>

      <div class="tpc-comp-row1" :class="{ 'is-diamond': row.useDiamondRatio }">
        <label v-if="row.useDiamondRatio" class="tpc-comp-unit" for="tpc-comp-diamond">
          <div class="tpc-comp-dial">
            <svg class="tpc-comp-ring" viewBox="0 0 128 128" aria-hidden="true">
              <circle class="tpc-comp-ring-track" cx="64" cy="64" :r="圆环半径" />
              <circle
                class="tpc-comp-ring-value"
                cx="64"
                cy="64"
                :r="圆环半径"
                :stroke-dasharray="钻石圆环"
              />
            </svg>
            <div class="tpc-comp-dial-core">
              <span class="tpc-comp-dial-row">
                <input
                  id="tpc-comp-diamond"
                  v-model.number="row.diamondPercent"
                  type="number"
                  class="tpc-comp-dial-val"
                  step="0.1"
                  aria-label="钻石比例"
                  :placeholder="String(默认钻石百分比)"
                  @focus="选中输入"
                />
                <span>%</span>
              </span>
              <span class="tpc-comp-dial-result">
                <span class="tpc-comp-dial-result-label">直径</span>
                {{ 百分比文案(钻石比例结果?.直径百分比) }}
              </span>
              <span class="tpc-comp-dial-result">
                <span class="tpc-comp-dial-result-label">高度</span>
                {{ 百分比文案(钻石比例结果?.高度百分比) }}
              </span>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">钻石比例</div>
        </label>

        <label v-if="!row.useDiamondRatio" class="tpc-comp-unit" for="tpc-comp-diameter">
          <div class="tpc-comp-dial">
            <svg class="tpc-comp-ring" viewBox="0 0 128 128" aria-hidden="true">
              <circle class="tpc-comp-ring-track" cx="64" cy="64" :r="圆环半径" />
              <circle
                class="tpc-comp-ring-value"
                cx="64"
                cy="64"
                :r="圆环半径"
                :stroke-dasharray="圆环虚线值"
              />
            </svg>
            <div class="tpc-comp-dial-core">
              <span class="tpc-comp-dial-row">
                <input
                  id="tpc-comp-diameter"
                  v-model.number="row.diameterPercent"
                  type="number"
                  class="tpc-comp-dial-val"
                  step="0.1"
                  aria-label="直径百分比"
                  :placeholder="String(默认直径百分比)"
                  @focus="选中输入"
                />
                <span>%</span>
              </span>
              <span class="tpc-comp-dial-result">
                <span class="tpc-comp-dial-result-label">实际尺寸</span>
                {{ 有效直径文案 }}
              </span>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">直径百分比</div>
        </label>

        <label
          v-if="!row.useDiamondRatio"
          class="tpc-comp-unit"
          :class="{ locked: 台面锁定 }"
          for="tpc-comp-height"
        >
          <div class="tpc-comp-dial">
            <svg class="tpc-comp-height-bar" viewBox="0 0 128 128" aria-hidden="true">
              <line
                class="tpc-comp-height-track"
                :x1="高度箭头横"
                :y1="高度顶"
                :x2="高度箭头横"
                :y2="高度底"
              />
              <line
                class="tpc-comp-height-rail"
                :x1="高度左"
                :y1="高度条.topY"
                :x2="高度右"
                :y2="高度条.topY"
              />
              <line
                class="tpc-comp-height-rail"
                :x1="高度左"
                :y1="高度底"
                :x2="高度右"
                :y2="高度底"
              />
              <line
                v-if="高度条.showArrow"
                class="tpc-comp-height-arrow"
                :x1="高度箭头横"
                :y1="高度条.topY"
                :x2="高度箭头横"
                :y2="高度底"
              />
              <template v-if="高度条.showHeads">
                <path class="tpc-comp-height-head" :d="高度条.headUp" />
                <path class="tpc-comp-height-head" :d="高度条.headDown" />
              </template>
            </svg>
            <div class="tpc-comp-dial-core tpc-comp-height-core">
              <span class="tpc-comp-dial-row">
                <input
                  id="tpc-comp-height"
                  v-model.number="row.heightPercent"
                  type="number"
                  class="tpc-comp-dial-val"
                  step="0.1"
                  aria-label="高度百分比"
                  :placeholder="String(默认高度百分比)"
                  :disabled="台面锁定"
                  @focus="选中输入"
                />
                <span>%</span>
              </span>
              <span class="tpc-comp-dial-result">
                <span class="tpc-comp-dial-result-label">实际高度</span>
                {{ 有效高度文案 }}
              </span>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">高度百分比</div>
        </label>

        <label class="tpc-comp-unit" for="tpc-comp-angle">
          <div class="tpc-comp-dial tpc-comp-dial-angle">
            <svg class="tpc-comp-angle" viewBox="0 0 128 128" aria-hidden="true">
              <path class="tpc-comp-angle-arc" :d="角度弧路径" />
              <line
                class="tpc-comp-angle-ray"
                :x1="角度圆心横"
                :y1="角度圆心纵"
                :x2="基线终点.x"
                :y2="基线终点.y"
              />
              <line
                class="tpc-comp-angle-ray"
                :x1="角度圆心横"
                :y1="角度圆心纵"
                :x2="运动射线终点.x"
                :y2="运动射线终点.y"
              />
              <circle class="tpc-comp-angle-vertex" :cx="角度圆心横" :cy="角度圆心纵" r="3.2" />
              <text
                class="tpc-comp-angle-now"
                :x="当前角度标签.x"
                :y="当前角度标签.y"
                text-anchor="middle"
              >
                {{ 当前角度标签.text }}
              </text>
            </svg>
            <div class="tpc-comp-dial-core tpc-comp-angle-core">
              <input
                id="tpc-comp-angle"
                v-model.number="row.compAngle"
                type="number"
                class="tpc-comp-dial-val tpc-comp-angle-val"
                step="0.01"
                aria-label="角度补偿"
                @focus="选中输入"
              />
              <span>°</span>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">角度补偿</div>
        </label>

        <div class="tpc-comp-unit tpc-comp-unit-chord">
          <div class="tpc-comp-chord-body">
            <div class="tpc-comp-chord-top" aria-hidden="true">
              <span class="tpc-comp-chord-seg is-actual" :style="{ width: `${弦比条.actualPct}%` }" />
              <span
                v-if="弦比条.extraPct > 0"
                class="tpc-comp-chord-seg is-extra"
                :style="{ width: `${弦比条.extraPct}%` }"
              />
              <span
                v-if="弦比条.deficitPct > 0"
                class="tpc-comp-chord-seg is-deficit"
                :style="{ width: `${弦比条.deficitPct}%` }"
              />
            </div>
            <div class="tpc-comp-chord-row">
              <div class="tpc-comp-chord-aside" aria-hidden="true">
                <span class="tpc-comp-chord-seg is-actual" />
              </div>
              <div class="tpc-comp-chord-stepper">
                <button
                  type="button"
                  class="tpc-comp-chord-btn"
                  aria-label="减小弦长倍率"
                  @click="微调弦比(-弦长倍率步进)"
                >
                  ‹
                </button>
                <input
                  id="tpc-comp-chord"
                  v-model.number="row.chordRatio"
                  type="number"
                  class="tpc-comp-chord-val"
                  :step="弦长倍率步进"
                  aria-label="弦长倍率"
                  :placeholder="String(默认弦长倍率)"
                  @focus="选中输入"
                />
                <button
                  type="button"
                  class="tpc-comp-chord-btn"
                  aria-label="增大弦长倍率"
                  @click="微调弦比(弦长倍率步进)"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">弦长倍率</div>
        </div>

        <div
          class="tpc-comp-unit tpc-comp-unit-kbx"
          :class="{ locked: 台面锁定 }"
          @click="聚焦斜率卡片"
        >
          <div class="tpc-comp-kbx-card">
            <div class="tpc-comp-plot">
              <svg :viewBox="`0 0 ${斜率图尺寸.w} ${斜率图尺寸.h}`" aria-hidden="true">
                <defs>
                  <marker
                    id="tpc-kbx-arrow"
                    markerWidth="7"
                    markerHeight="7"
                    refX="6"
                    refY="3.5"
                    orient="auto"
                  >
                    <path d="M0,0 L7,3.5 L0,7 Z" fill="#94a3b8" />
                  </marker>
                </defs>
                <line
                  v-for="(g, i) in 斜率图.gridX"
                  :key="`gx-${i}`"
                  class="tpc-comp-plot-grid"
                  v-bind="g"
                />
                <line
                  v-for="(g, i) in 斜率图.gridY"
                  :key="`gy-${i}`"
                  class="tpc-comp-plot-grid"
                  v-bind="g"
                />
                <line
                  class="tpc-comp-plot-axis"
                  v-bind="斜率图.axisX"
                  marker-end="url(#tpc-kbx-arrow)"
                />
                <line
                  class="tpc-comp-plot-axis"
                  v-bind="斜率图.axisY"
                  marker-end="url(#tpc-kbx-arrow)"
                />
                <text
                  class="tpc-comp-plot-axis-name"
                  :x="斜率图.xName.x"
                  :y="斜率图.xName.y"
                  text-anchor="end"
                >
                  {{ 斜率图.xName.text }}
                </text>
                <text class="tpc-comp-plot-axis-name" :x="斜率图.yName.x" :y="斜率图.yName.y">
                  {{ 斜率图.yName.text }}
                </text>
                <line
                  v-if="!斜率图.collapsed"
                  class="tpc-comp-plot-line-halo"
                  v-bind="斜率图.line"
                />
                <line v-if="!斜率图.collapsed" class="tpc-comp-plot-line" v-bind="斜率图.line" />
                <circle class="tpc-comp-plot-dot" :cx="斜率图.p0.x" :cy="斜率图.p0.y" r="3.4" />
                <circle
                  v-if="!斜率图.collapsed"
                  class="tpc-comp-plot-dot"
                  :cx="斜率图.p1.x"
                  :cy="斜率图.p1.y"
                  r="3.4"
                />
                <text
                  class="tpc-comp-plot-point"
                  :x="斜率图.p0Label.x"
                  :y="斜率图.p0Label.y"
                  :text-anchor="斜率图.p0Label.anchor"
                >
                  {{ 斜率图.p0Label.text }}
                </text>
                <text
                  v-if="!斜率图.collapsed"
                  class="tpc-comp-plot-point"
                  :x="斜率图.p1Label.x"
                  :y="斜率图.p1Label.y"
                  :text-anchor="斜率图.p1Label.anchor"
                >
                  {{ 斜率图.p1Label.text }}
                </text>
              </svg>
            </div>
            <div class="tpc-comp-kbx-fields">
              <label class="tpc-comp-kbx-field" :class="{ 'is-focused': 焦点字段 === 'k' }">
                <span>K</span>
                <input
                  v-model.number="row.k"
                  type="number"
                  step="0.001"
                  :disabled="台面锁定"
                  @focus="字段获得焦点('k', $event)"
                  @blur="字段失去焦点('k')"
                />
              </label>
              <label class="tpc-comp-kbx-field" :class="{ 'is-focused': 焦点字段 === 'b' }">
                <span>B</span>
                <input
                  v-model.number="row.b"
                  type="number"
                  step="0.001"
                  :disabled="台面锁定"
                  @focus="字段获得焦点('b', $event)"
                  @blur="字段失去焦点('b')"
                />
              </label>
              <label class="tpc-comp-kbx-field" :class="{ 'is-focused': 焦点字段 === 'x' }">
                <span>X</span>
                <input
                  v-model.number="row.x"
                  type="number"
                  step="0.001"
                  :disabled="台面锁定"
                  @focus="字段获得焦点('x', $event)"
                  @blur="字段失去焦点('x')"
                />
              </label>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">拟合直线</div>
        </div>

        <div class="tpc-comp-unit tpc-comp-unit-cut">
          <div class="tpc-comp-dial">
            <svg class="tpc-comp-cut-bar" viewBox="0 0 128 128" aria-hidden="true">
              <line
                class="tpc-comp-height-track"
                :x1="高度箭头横"
                :y1="高度顶"
                :x2="高度箭头横"
                :y2="高度底"
              />
              <line
                class="tpc-comp-height-rail"
                :x1="高度左"
                :y1="高度顶"
                :x2="高度右"
                :y2="高度顶"
              />
              <line
                class="tpc-comp-height-rail"
                :x1="高度左"
                :y1="高度底"
                :x2="高度右"
                :y2="高度底"
              />
              <rect
                class="tpc-comp-cut-fill"
                :x="高度箭头横 - 3.2"
                :y="切削范围条.startY"
                width="6.4"
                :height="切削范围条.height"
                rx="3.2"
              />
            </svg>
            <div class="tpc-comp-dial-core tpc-comp-cut-core">
              <label class="tpc-comp-cut-row" for="tpc-comp-cut-start">
                <span>起始</span>
                <input
                  id="tpc-comp-cut-start"
                  v-model.number="row.cutStartPercent"
                  type="number"
                  class="tpc-comp-dial-val"
                  min="0"
                  max="100"
                  step="0.1"
                  aria-label="起始切割百分比"
                  :placeholder="String(默认起始切割百分比)"
                  @focus="选中输入"
                  @blur="提交切削起点"
                />
                <span>%</span>
              </label>
              <label class="tpc-comp-cut-row" for="tpc-comp-cut-end">
                <span>结束</span>
                <input
                  id="tpc-comp-cut-end"
                  v-model.number="row.cutEndPercent"
                  type="number"
                  class="tpc-comp-dial-val"
                  min="0"
                  max="100"
                  step="0.1"
                  aria-label="结束切割百分比"
                  :placeholder="String(默认结束切割百分比)"
                  @focus="选中输入"
                  @blur="提交切削终点"
                />
                <span>%</span>
              </label>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">切割范围</div>
        </div>

        <label v-if="显示圈数卡片" class="tpc-comp-unit" for="tpc-comp-r-turns">
          <div class="tpc-comp-dial">
            <svg class="tpc-comp-ring" viewBox="0 0 128 128" aria-hidden="true">
              <circle class="tpc-comp-ring-track" cx="64" cy="64" :r="圆环半径" />
              <circle
                class="tpc-comp-ring-value"
                cx="64"
                cy="64"
                :r="圆环半径"
                :stroke-dasharray="圈数虚线"
              />
            </svg>
            <div class="tpc-comp-dial-core">
              <span class="tpc-comp-dial-row">
                <input
                  id="tpc-comp-r-turns"
                  v-model.number="row.rTurns"
                  type="number"
                  class="tpc-comp-dial-val"
                  min="0.1"
                  step="0.1"
                  aria-label="R轴旋转圈数"
                  :placeholder="String(默认R圈数)"
                  @focus="选中输入"
                  @blur="提交圈数"
                />
                <span>圈</span>
              </span>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">R轴旋转圈数</div>
        </label>
      </div>

      <button type="button" class="tpc-comp-done" @click="emit('关闭')">完成</button>
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
  background: color-mix(in srgb, #000 22%, transparent);
  backdrop-filter: blur(32px) saturate(1.35);
}
.tpc-comp-card {
  --tpc-accent: #0071e3;
  --tpc-surface: var(--app-card);
  --tpc-surface-dim: color-mix(in srgb, var(--app-bg) 72%, var(--app-card));
  width: 1080px;
  max-width: 96vw;
  padding: 20px 20px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Display', 'Segoe UI',
    system-ui, sans-serif;
  color: var(--app-text-primary);
  background: color-mix(in srgb, var(--app-card) 78%, transparent);
  border: 0.5px solid color-mix(in srgb, #fff 55%, var(--app-border));
  border-radius: 22px;
  box-shadow:
    0 0 0 0.5px color-mix(in srgb, #fff 35%, transparent) inset,
    0 1px 1px color-mix(in srgb, #000 4%, transparent),
    0 18px 50px color-mix(in srgb, #000 16%, transparent);
  backdrop-filter: blur(40px) saturate(1.6);
  animation: tpc-comp-in 0.46s cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-color-scheme: dark) {
  .tpc-comp-card {
    --tpc-accent: #0a84ff;
  }
}
:root[data-theme='light'] .tpc-comp-card {
  --tpc-accent: #0071e3;
}
:root[data-theme='dark'] .tpc-comp-card {
  --tpc-accent: #0a84ff;
}
@keyframes tpc-comp-in {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.tpc-comp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}
.tpc-comp-head-text h2 {
  margin: 0;
  font-size: 21px;
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--app-text-primary);
}
.tpc-comp-head-text p {
  margin: 5px 0 0;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: var(--app-text-muted);
}
.tpc-comp-task {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--tpc-surface-dim);
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  line-height: 1.4;
  white-space: nowrap;
}
.tpc-comp-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.tpc-comp-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 10px;
  border: 0;
  border-radius: 999px;
  background: var(--tpc-surface-dim);
  color: var(--app-text-secondary);
  font-family: inherit;
  cursor: pointer;
}
.tpc-comp-switch-text {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.4;
  white-space: nowrap;
}
.tpc-comp-switch-track {
  position: relative;
  display: block;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--app-text-primary) 18%, transparent);
  transition: background 0.18s ease;
}
.tpc-comp-switch-track.on {
  background: var(--tpc-accent);
}
.tpc-comp-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px color-mix(in srgb, #000 22%, transparent);
  transition: transform 0.18s ease;
}
.tpc-comp-switch-track.on .tpc-comp-switch-knob {
  transform: translateX(14px);
}
.tpc-comp-row1 {
  display: grid;
  grid-template-columns: repeat(4, 2fr);
  gap: 10px;
  align-items: start;
  margin: 18px 0 0;
}
.tpc-comp-row1.is-diamond {
  grid-template-columns: repeat(3, 2fr);
}
.tpc-comp-unit {
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
    background 0.18s ease,
    box-shadow 0.18s ease;
}
.tpc-comp-row1:has(.tpc-comp-unit:focus-within) .tpc-comp-unit:not(:focus-within) {
  background: var(--tpc-surface-dim);
}
.tpc-comp-unit:focus-within {
  background: var(--tpc-surface);
  border-color: color-mix(in srgb, var(--app-text-primary) 38%, var(--app-border));
  box-shadow:
    0 2px 6px color-mix(in srgb, var(--app-text-primary) 12%, transparent),
    0 10px 28px color-mix(in srgb, var(--app-text-primary) 14%, transparent);
}
.tpc-comp-unit:focus-within .tpc-comp-unit-cap {
  color: var(--app-text-primary);
  font-weight: 650;
}
.tpc-comp-unit-cap {
  margin-top: 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--app-text-muted);
}
.tpc-comp-unit.locked,
.tpc-comp-unit-kbx.locked {
  opacity: 0.42;
  cursor: default;
}
.tpc-comp-dial {
  position: relative;
  width: 148px;
  height: 148px;
  margin: 0 auto;
  overflow: hidden;
}
.tpc-comp-dial-angle {
  overflow: visible;
}
.tpc-comp-ring,
.tpc-comp-angle,
.tpc-comp-height-bar {
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.tpc-comp-height-track {
  stroke: color-mix(in srgb, var(--app-text-muted) 22%, var(--app-border));
  stroke-width: 1.6;
  stroke-dasharray: 3 5;
  stroke-linecap: round;
}
.tpc-comp-height-rail {
  stroke: color-mix(in srgb, var(--app-text-muted) 45%, var(--app-border));
  stroke-width: 2.4;
  stroke-linecap: round;
}
.tpc-comp-height-arrow {
  stroke: var(--tpc-accent);
  stroke-width: 2.6;
  stroke-linecap: round;
}
.tpc-comp-height-head {
  fill: var(--tpc-accent);
}
.tpc-comp-height-core {
  padding-left: 26px;
}
.tpc-comp-cut-bar {
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.tpc-comp-cut-fill {
  fill: var(--tpc-accent);
}
.tpc-comp-cut-core {
  padding-left: 26px;
  gap: 8px;
}
.tpc-comp-cut-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  cursor: text;
}
.tpc-comp-cut-row > span:first-child {
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-muted);
}
.tpc-comp-unit-cut {
  cursor: default;
}
.tpc-comp-cut-row .tpc-comp-dial-val {
  width: 4.2ch;
  font-size: 18px;
}
.tpc-comp-ring {
  overflow: hidden;
}
.tpc-comp-ring-track,
.tpc-comp-ring-value {
  fill: none;
  stroke-width: 5;
  transform: rotate(-90deg);
  transform-origin: 64px 64px;
}
.tpc-comp-ring-track {
  stroke: color-mix(in srgb, var(--app-text-muted) 16%, var(--app-border));
}
.tpc-comp-ring-value,
.tpc-comp-angle-arc,
.tpc-comp-angle-ray {
  stroke: var(--tpc-accent);
  stroke-linecap: round;
}
.tpc-comp-ring-value {
  fill: none;
  transition: stroke-dasharray 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.tpc-comp-angle-arc {
  fill: none;
  stroke-width: 2.6;
}
.tpc-comp-angle-ray {
  stroke-width: 2.6;
}
.tpc-comp-angle-vertex {
  fill: var(--tpc-accent);
}
.tpc-comp-angle-now {
  fill: var(--tpc-accent);
  font-size: 11px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  stroke: var(--app-card);
  stroke-width: 3.5px;
  paint-order: stroke fill;
}
.tpc-comp-dial-core {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.tpc-comp-dial-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: center;
}
.tpc-comp-dial-result {
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
.tpc-comp-dial-result-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-secondary);
}
.tpc-comp-angle-core {
  inset: 8px 8px auto 8px;
  height: 36px;
  flex-direction: row;
  justify-content: center;
  align-items: baseline;
  padding: 0;
  gap: 1px;
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
  font-size: 34px;
  font-weight: 620;
  font-variant-numeric: tabular-nums;
  font-family: inherit;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--app-text-primary);
  appearance: textfield;
}
.tpc-comp-angle-val {
  width: 3.2ch;
  font-size: 28px;
}
.tpc-comp-dial-val::-webkit-outer-spin-button,
.tpc-comp-dial-val::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
.tpc-comp-dial-row > span,
.tpc-comp-angle-core > span {
  margin: 0;
  font-size: 17px;
  font-weight: 560;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--app-text-secondary);
}
.tpc-comp-angle-core > span {
  font-size: 16px;
}
.tpc-comp-dial-val:focus,
.tpc-comp-kbx-field input:focus {
  color: var(--app-text-primary);
}
.tpc-comp-unit-chord {
  cursor: default;
}
.tpc-comp-chord-body {
  width: 148px;
  height: 148px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  background: var(--tpc-surface);
}
.tpc-comp-chord-top {
  display: flex;
  align-items: center;
  flex: 1;
  min-height: 0;
  padding: 0 10px;
  border-bottom: 0.5px solid color-mix(in srgb, var(--app-border) 70%, transparent);
}
.tpc-comp-chord-seg {
  display: block;
  height: 4px;
  border-radius: 999px;
  transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.tpc-comp-chord-seg.is-actual {
  background: color-mix(in srgb, var(--app-text-primary) 28%, transparent);
}
.tpc-comp-chord-seg.is-extra {
  margin-left: 3px;
  background: var(--tpc-accent);
}
.tpc-comp-chord-seg.is-deficit {
  margin-left: 3px;
  background: color-mix(in srgb, var(--app-text-primary) 10%, transparent);
}
.tpc-comp-chord-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}
.tpc-comp-chord-aside {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 10px;
  border-right: 0.5px solid color-mix(in srgb, var(--app-border) 70%, transparent);
}
.tpc-comp-chord-aside .tpc-comp-chord-seg {
  width: 100%;
}
.tpc-comp-chord-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 4px;
}
.tpc-comp-chord-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--tpc-accent);
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
}
.tpc-comp-chord-btn:hover {
  background: color-mix(in srgb, var(--tpc-accent) 10%, transparent);
}
.tpc-comp-chord-btn:active {
  opacity: 0.7;
}
.tpc-comp-chord-val {
  width: 3.4ch;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  outline: none;
  text-align: center;
  font-size: 16px;
  font-weight: 590;
  font-variant-numeric: tabular-nums;
  font-family: inherit;
  letter-spacing: -0.03em;
  color: var(--app-text-primary);
  appearance: textfield;
}
.tpc-comp-chord-val::-webkit-outer-spin-button,
.tpc-comp-chord-val::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
.tpc-comp-kbx-card {
  position: relative;
  width: 148px;
  height: 148px;
  margin: 0 auto;
  overflow: visible;
  border-radius: 16px;
  background: var(--tpc-surface);
}
.tpc-comp-plot {
  width: 148px;
  height: 148px;
  overflow: hidden;
  border-radius: 16px;
}
.tpc-comp-plot svg {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.tpc-comp-plot-grid {
  stroke: color-mix(in srgb, var(--app-border) 55%, transparent);
  stroke-width: 0.45;
}
.tpc-comp-plot-axis {
  stroke: color-mix(in srgb, var(--app-text-muted) 70%, var(--app-border));
  stroke-width: 1;
}
.tpc-comp-plot-axis-name {
  fill: var(--app-text-muted);
  font-size: 10px;
  font-weight: 600;
}
.tpc-comp-plot-point {
  fill: var(--tpc-accent);
  font-size: 9px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  stroke: var(--app-card);
  stroke-width: 3.5px;
  paint-order: stroke fill;
}
.tpc-comp-plot-line-halo {
  stroke: var(--app-card);
  stroke-width: 4.5;
  stroke-linecap: round;
}
.tpc-comp-plot-line {
  stroke: var(--tpc-accent);
  stroke-width: 2.1;
  stroke-linecap: round;
}
.tpc-comp-plot-dot {
  fill: var(--tpc-accent);
  stroke: var(--app-card);
  stroke-width: 1.5;
}
.tpc-comp-kbx-fields {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 6px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px;
  overflow: visible;
  background: transparent;
}
.tpc-comp-kbx-field {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  min-width: 0;
  padding: 4px 2px 5px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: var(--tpc-surface);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--app-text-secondary);
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}
.tpc-comp-kbx-fields:has(.is-focused) .tpc-comp-kbx-field:not(.is-focused) {
  background: var(--tpc-surface-dim);
}
.tpc-comp-kbx-field.is-focused {
  z-index: 2;
  background: var(--tpc-surface);
  color: var(--app-text-primary);
}
.tpc-comp-kbx-field.is-focused::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid color-mix(in srgb, var(--app-text-primary) 50%, #737373);
  border-radius: 8px;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--app-text-primary) 16%, transparent);
  pointer-events: none;
}
.tpc-comp-kbx-field input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  outline: none;
  text-align: center;
  font-size: 13px;
  font-weight: 560;
  font-variant-numeric: tabular-nums;
  font-family: inherit;
  letter-spacing: -0.02em;
  color: var(--app-text-primary);
  appearance: textfield;
}
.tpc-comp-kbx-field input::-webkit-outer-spin-button,
.tpc-comp-kbx-field input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
.tpc-comp-kbx-field input:disabled {
  cursor: not-allowed;
}
.tpc-comp-done {
  display: block;
  width: 100%;
  margin-top: 16px;
  padding: 12px 14px;
  font-size: 16px;
  font-weight: 590;
  letter-spacing: -0.02em;
  border: 0;
  border-radius: 14px;
  background: var(--tpc-accent);
  color: #fff;
  cursor: pointer;
  transition:
    filter 0.16s ease,
    transform 0.12s ease;
}
.tpc-comp-done:hover {
  filter: brightness(1.06);
}
.tpc-comp-done:active {
  transform: scale(0.985);
}
</style>
