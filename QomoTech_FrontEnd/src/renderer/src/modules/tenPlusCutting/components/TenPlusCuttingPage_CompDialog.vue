<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { isTableAngle } from '../composables/useTenPlusTask'
import {
  TEN_PLUS_CHORD_RATIO_STEP,
  TEN_PLUS_DEFAULT_CHORD_RATIO,
  TEN_PLUS_DEFAULT_CUT_END_PERCENT,
  TEN_PLUS_DEFAULT_CUT_START_PERCENT,
  TEN_PLUS_DEFAULT_DIAMETER_PERCENT,
  TEN_PLUS_DEFAULT_DIAMOND_PERCENT,
  TEN_PLUS_DEFAULT_HEIGHT_PERCENT,
  TEN_PLUS_DEFAULT_R_TURNS,
  isEqualLinePath
} from '../constants/tenPlusCutting'
import { computeDiamondRatio } from '../utils/tenPlusDiamond'
import type { TenPlusTaskRow } from '../types/tenPlusCutting'

const RING_R = 54
const RING_C = 2 * Math.PI * RING_R

const ANGLE_VX = 64
const ANGLE_VY = 76
const ANGLE_RAY = 44
const ANGLE_ARC_R = 22

const H_TOP = 15
const H_BOTTOM = 113
const H_LEFT = 13
const H_RIGHT = 119
const H_ARROW_X = 25
const H_HEAD = 7

const props = defineProps<{
  row: TenPlusTaskRow
}>()

const emit = defineEmits<{
  close: []
}>()

const tableLocked = computed(() => isTableAngle(props.row.angle))

function finiteOr(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback
}

function ringDasharrayOf(percent: number): string {
  const pct = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 100
  return `${(pct / 100) * RING_C} ${RING_C}`
}

function scaledText(base: number, percent: number, fallbackPercent: number): string {
  const value = finiteOr(base, 0) * (finiteOr(percent, fallbackPercent) / 100)
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 1000) / 1000)
}

const ringDasharray = computed(() => ringDasharrayOf(Number(props.row.diameterPercent)))

const effectiveDiameterText = computed(() =>
  scaledText(Number(props.row.diameter), Number(props.row.diameterPercent), TEN_PLUS_DEFAULT_DIAMETER_PERCENT)
)

const effectiveHeightText = computed(() =>
  scaledText(Number(props.row.height), Number(props.row.heightPercent), TEN_PLUS_DEFAULT_HEIGHT_PERCENT)
)

const visualAngle = computed(() => {
  const base = finiteOr(Number(props.row.angle), 0)
  const comp = finiteOr(Number(props.row.compAngle), 0)
  return Math.max(-170, Math.min(170, base + comp))
})

const currentAngle = computed(() => {
  const base = finiteOr(Number(props.row.angle), 0)
  const comp = finiteOr(Number(props.row.compAngle), 0)
  return base + comp
})

const ANIM_MS = 400
const drawnAngle = ref(0)
let angleRaf = 0
const drawnKbx = ref({ k: 0, b: 0, x: 0 })
let kbxRaf = 0

function easeOutSoft(t: number): number {
  return 1 - (1 - t) ** 4
}

watch(
  visualAngle,
  (to) => {
    const from = drawnAngle.value
    if (angleRaf) cancelAnimationFrame(angleRaf)
    if (from === to) {
      drawnAngle.value = to
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ANIM_MS)
      drawnAngle.value = from + (to - from) * easeOutSoft(t)
      if (t < 1) angleRaf = requestAnimationFrame(step)
      else drawnAngle.value = to
    }
    angleRaf = requestAnimationFrame(step)
  },
  { immediate: true }
)

const targetKbx = computed(() => ({
  k: finiteOr(Number(props.row.k), 0),
  b: finiteOr(Number(props.row.b), 0),
  x: finiteOr(Number(props.row.x), 0)
}))

watch(
  targetKbx,
  (to) => {
    const from = { ...drawnKbx.value }
    if (kbxRaf) cancelAnimationFrame(kbxRaf)
    if (from.k === to.k && from.b === to.b && from.x === to.x) {
      drawnKbx.value = { ...to }
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ANIM_MS)
      const e = easeOutSoft(t)
      drawnKbx.value = {
        k: from.k + (to.k - from.k) * e,
        b: from.b + (to.b - from.b) * e,
        x: from.x + (to.x - from.x) * e
      }
      if (t < 1) kbxRaf = requestAnimationFrame(step)
      else drawnKbx.value = { k: to.k, b: to.b, x: to.x }
    }
    kbxRaf = requestAnimationFrame(step)
  },
  { immediate: true }
)

const visualHeightPercent = computed(() => {
  const n = Number(props.row.heightPercent)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : TEN_PLUS_DEFAULT_HEIGHT_PERCENT
})

const drawnHeightPercent = ref(0)
let heightRaf = 0
const drawnChordRatio = ref(0)
let chordRaf = 0

watch(
  visualHeightPercent,
  (to) => {
    const from = drawnHeightPercent.value
    if (heightRaf) cancelAnimationFrame(heightRaf)
    if (from === to) {
      drawnHeightPercent.value = to
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ANIM_MS)
      drawnHeightPercent.value = from + (to - from) * easeOutSoft(t)
      if (t < 1) heightRaf = requestAnimationFrame(step)
      else drawnHeightPercent.value = to
    }
    heightRaf = requestAnimationFrame(step)
  },
  { immediate: true }
)

const heightBar = computed(() => {
  const span = H_BOTTOM - H_TOP
  const topY = H_BOTTOM - (drawnHeightPercent.value / 100) * span
  const gap = H_BOTTOM - topY
  const x = H_ARROW_X
  return {
    topY,
    showArrow: gap > 4,
    showHeads: gap > H_HEAD * 2 + 4,
    headUp: `M${x},${topY} L${x - 4.4},${topY + H_HEAD} L${x + 4.4},${topY + H_HEAD} Z`,
    headDown: `M${x},${H_BOTTOM} L${x - 4.4},${H_BOTTOM - H_HEAD} L${x + 4.4},${H_BOTTOM - H_HEAD} Z`
  }
})

onUnmounted(() => {
  if (angleRaf) cancelAnimationFrame(angleRaf)
  if (kbxRaf) cancelAnimationFrame(kbxRaf)
  if (heightRaf) cancelAnimationFrame(heightRaf)
  if (chordRaf) cancelAnimationFrame(chordRaf)
})

function polar(deg: number, radius: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180
  return {
    x: ANGLE_VX + radius * Math.cos(a),
    y: ANGLE_VY - radius * Math.sin(a)
  }
}

const baseRayEnd = computed(() => polar(0, ANGLE_RAY))
const moveRayEnd = computed(() => polar(drawnAngle.value, ANGLE_RAY))

const angleArcPath = computed(() => {
  const a = drawnAngle.value
  const start = polar(0, ANGLE_ARC_R)
  const end = polar(a, ANGLE_ARC_R)
  const large = Math.abs(a) > 180 ? 1 : 0
  const sweep = a >= 0 ? 0 : 1
  return `M ${start.x} ${start.y} A ${ANGLE_ARC_R} ${ANGLE_ARC_R} 0 ${large} ${sweep} ${end.x} ${end.y}`
})

const angleNowLabel = computed(() => {
  const a = drawnAngle.value
  const text = `${fmtCoord(currentAngle.value)}°`
  if (Math.abs(a) < 2) {
    return { x: ANGLE_VX + 38, y: ANGLE_VY + 18, text }
  }
  const p = polar(a / 2, ANGLE_ARC_R + 18)
  return { x: Math.min(118, Math.max(10, p.x)), y: Math.min(122, Math.max(48, p.y + 4)), text }
})

const KBX_PLOT = { w: 160, h: 160, padL: 16, padR: 20, padT: 16, padB: 42 }

function axisSpan(vals: number[], minSpan: number): { lo: number; hi: number } {
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

function fmtCoord(n: number): string {
  const t = Math.round(n * 1000) / 1000
  return Object.is(t, -0) ? '0' : String(t)
}

function niceTicks(lo: number, hi: number, count: number): number[] {
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

function clampLabel(
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

const kbxPlot = computed(() => {
  const k = drawnKbx.value.k
  const b = drawnKbx.value.b
  const xEnd = drawnKbx.value.x
  const x0 = 0
  const y0 = b
  const x1 = xEnd
  const y1 = k * xEnd + b
  const xs0 = axisSpan([0, x0, x1], 1)
  const ys0 = axisSpan([0, y0, y1], 1)
  const span = Math.max(xs0.hi - xs0.lo, ys0.hi - ys0.lo)
  const xMid = (xs0.lo + xs0.hi) / 2
  const yMid = (ys0.lo + ys0.hi) / 2
  const xs = { lo: xMid - span / 2, hi: xMid + span / 2 }
  const ys = { lo: yMid - span / 2, hi: yMid + span / 2 }
  const { w, h, padL, padR, padT, padB } = KBX_PLOT
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
    ...clampLabel(p0.x + 7, p0.y - 10, 'start', w, padT + 10, labelYMax),
    text: `(${fmtCoord(x0)}, ${fmtCoord(y0)})`
  }
  const p1Label = {
    ...clampLabel(
      p1.x >= w * 0.55 ? p1.x - 7 : p1.x + 7,
      p1.y - 10,
      p1.x >= w * 0.55 ? 'end' : 'start',
      w,
      padT + 10,
      labelYMax
    ),
    text: `(${fmtCoord(x1)}, ${fmtCoord(y1)})`
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
    gridX: niceTicks(xs.lo, xs.hi, 3)
      .filter((v) => Math.abs(v) > skip0)
      .map((v) => ({ x1: toX(v), y1: oy, x2: toX(v), y2: plotBottom })),
    gridY: niceTicks(ys.lo, ys.hi, 3)
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
    if (!Number.isFinite(v)) props.row.diameterPercent = TEN_PLUS_DEFAULT_DIAMETER_PERCENT
  },
  { immediate: true }
)

watch(
  () => props.row.heightPercent,
  (v) => {
    if (!Number.isFinite(v)) props.row.heightPercent = TEN_PLUS_DEFAULT_HEIGHT_PERCENT
  },
  { immediate: true }
)

function clampCutPercent(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

function commitCutStart(): void {
  const start = clampCutPercent(Number(props.row.cutStartPercent), TEN_PLUS_DEFAULT_CUT_START_PERCENT)
  props.row.cutStartPercent = start
  if (Number(props.row.cutEndPercent) < start) props.row.cutEndPercent = start
}

function commitCutEnd(): void {
  const end = clampCutPercent(Number(props.row.cutEndPercent), TEN_PLUS_DEFAULT_CUT_END_PERCENT)
  props.row.cutEndPercent = end
  if (Number(props.row.cutStartPercent) > end) props.row.cutStartPercent = end
}

watch(
  () => props.row.cutStartPercent,
  (v) => {
    if (!Number.isFinite(v)) props.row.cutStartPercent = TEN_PLUS_DEFAULT_CUT_START_PERCENT
  },
  { immediate: true }
)

watch(
  () => props.row.cutEndPercent,
  (v) => {
    if (!Number.isFinite(v)) props.row.cutEndPercent = TEN_PLUS_DEFAULT_CUT_END_PERCENT
  },
  { immediate: true }
)

const cutRangeBar = computed(() => {
  const start = clampCutPercent(Number(props.row.cutStartPercent), TEN_PLUS_DEFAULT_CUT_START_PERCENT)
  const end = clampCutPercent(Number(props.row.cutEndPercent), TEN_PLUS_DEFAULT_CUT_END_PERCENT)
  const span = H_BOTTOM - H_TOP
  const startY = H_TOP + (start / 100) * span
  const endY = H_TOP + (end / 100) * span
  return {
    startY,
    endY,
    height: Math.max(0, endY - startY)
  }
})

watch(
  () => props.row.chordRatio,
  (v) => {
    if (!Number.isFinite(v)) props.row.chordRatio = TEN_PLUS_DEFAULT_CHORD_RATIO
  },
  { immediate: true }
)

const showRTurnsCard = computed(
  () => isEqualLinePath(props.row.pathType) && Number(props.row.divisions) === 0
)

watch(
  () => props.row.rTurns,
  (v) => {
    if (!Number.isFinite(v)) props.row.rTurns = TEN_PLUS_DEFAULT_R_TURNS
  },
  { immediate: true }
)

const R_TURNS_RING_MAX = 4

const rTurnsDasharray = computed(() => {
  const n = Number(props.row.rTurns)
  const turns = Number.isFinite(n) && n > 0 ? n : TEN_PLUS_DEFAULT_R_TURNS
  return ringDasharrayOf(Math.min(100, (turns / R_TURNS_RING_MAX) * 100))
})

function commitRTurns(): void {
  const n = Number(props.row.rTurns)
  props.row.rTurns = Number.isFinite(n) && n > 0 ? n : TEN_PLUS_DEFAULT_R_TURNS
}

const visualChordRatio = computed(() => {
  const n = Number(props.row.chordRatio)
  return Number.isFinite(n) ? Math.max(0, n) : TEN_PLUS_DEFAULT_CHORD_RATIO
})

watch(
  visualChordRatio,
  (to) => {
    const from = drawnChordRatio.value
    if (chordRaf) cancelAnimationFrame(chordRaf)
    if (from === to) {
      drawnChordRatio.value = to
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ANIM_MS)
      drawnChordRatio.value = from + (to - from) * easeOutSoft(t)
      if (t < 1) chordRaf = requestAnimationFrame(step)
      else drawnChordRatio.value = to
    }
    chordRaf = requestAnimationFrame(step)
  },
  { immediate: true }
)

const chordBar = computed(() => {
  const r = drawnChordRatio.value
  const extra = Math.max(0, r - 1)
  const deficit = Math.max(0, 1 - r)
  const total = Math.max(r, 1)
  return {
    actualPct: (Math.min(r, 1) / total) * 100,
    extraPct: (extra / total) * 100,
    deficitPct: (deficit / total) * 100
  }
})

function nudgeChordRatio(delta: number): void {
  const cur = Number(props.row.chordRatio)
  const base = Number.isFinite(cur) ? cur : TEN_PLUS_DEFAULT_CHORD_RATIO
  props.row.chordRatio = Math.round((base + delta) * 1000) / 1000
}

const diamondRing = computed(() => ringDasharrayOf(Number(props.row.diamondPercent)))

const diamondRatio = computed(() =>
  props.row.useDiamondRatio ? computeDiamondRatio(props.row) : null
)

function percentText(v: number | null | undefined, fallback = '—'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return fallback
  return `${Math.round(v * 100) / 100}%`
}

watch(
  diamondRatio,
  (r) => {
    if (!r) return
    if (r.diameterPercent !== null) props.row.diameterPercent = r.diameterPercent
    if (r.heightPercent !== null) props.row.heightPercent = r.heightPercent
  },
  { immediate: true }
)

function selectInput(ev: Event): void {
  const el = ev.target
  if (el instanceof HTMLInputElement && !el.disabled) el.select()
}

const focusedField = ref<string | null>(null)

function onFieldFocus(key: string, ev: Event): void {
  focusedField.value = key
  selectInput(ev)
}

function onFieldBlur(key: string): void {
  if (focusedField.value === key) focusedField.value = null
}

function focusKbxCard(ev: MouseEvent): void {
  if (tableLocked.value) return
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
  <div class="tpc-comp-overlay" @click.self="emit('close')">
    <div class="tpc-comp-card" role="dialog" aria-modal="true">
      <header class="tpc-comp-head">
        <div class="tpc-comp-head-text">
          <h2>修改补偿值</h2>
          <p v-if="tableLocked">台面行仅可改直径与角度</p>
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
              <circle class="tpc-comp-ring-track" cx="64" cy="64" :r="RING_R" />
              <circle
                class="tpc-comp-ring-value"
                cx="64"
                cy="64"
                :r="RING_R"
                :stroke-dasharray="diamondRing"
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
                  :placeholder="String(TEN_PLUS_DEFAULT_DIAMOND_PERCENT)"
                  @focus="selectInput"
                />
                <span>%</span>
              </span>
              <span class="tpc-comp-dial-result">
                <span class="tpc-comp-dial-result-label">直径</span>
                {{ percentText(diamondRatio?.diameterPercent) }}
              </span>
              <span class="tpc-comp-dial-result">
                <span class="tpc-comp-dial-result-label">高度</span>
                {{ percentText(diamondRatio?.heightPercent) }}
              </span>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">钻石比例</div>
        </label>

        <label v-if="!row.useDiamondRatio" class="tpc-comp-unit" for="tpc-comp-diameter">
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
            <div class="tpc-comp-dial-core">
              <span class="tpc-comp-dial-row">
                <input
                  id="tpc-comp-diameter"
                  v-model.number="row.diameterPercent"
                  type="number"
                  class="tpc-comp-dial-val"
                  step="0.1"
                  aria-label="直径百分比"
                  :placeholder="String(TEN_PLUS_DEFAULT_DIAMETER_PERCENT)"
                  @focus="selectInput"
                />
                <span>%</span>
              </span>
              <span class="tpc-comp-dial-result">
                <span class="tpc-comp-dial-result-label">实际尺寸</span>
                {{ effectiveDiameterText }}
              </span>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">直径百分比</div>
        </label>

        <label
          v-if="!row.useDiamondRatio"
          class="tpc-comp-unit"
          :class="{ locked: tableLocked }"
          for="tpc-comp-height"
        >
          <div class="tpc-comp-dial">
            <svg class="tpc-comp-height-bar" viewBox="0 0 128 128" aria-hidden="true">
              <line
                class="tpc-comp-height-track"
                :x1="H_ARROW_X"
                :y1="H_TOP"
                :x2="H_ARROW_X"
                :y2="H_BOTTOM"
              />
              <line
                class="tpc-comp-height-rail"
                :x1="H_LEFT"
                :y1="heightBar.topY"
                :x2="H_RIGHT"
                :y2="heightBar.topY"
              />
              <line
                class="tpc-comp-height-rail"
                :x1="H_LEFT"
                :y1="H_BOTTOM"
                :x2="H_RIGHT"
                :y2="H_BOTTOM"
              />
              <line
                v-if="heightBar.showArrow"
                class="tpc-comp-height-arrow"
                :x1="H_ARROW_X"
                :y1="heightBar.topY"
                :x2="H_ARROW_X"
                :y2="H_BOTTOM"
              />
              <template v-if="heightBar.showHeads">
                <path class="tpc-comp-height-head" :d="heightBar.headUp" />
                <path class="tpc-comp-height-head" :d="heightBar.headDown" />
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
                  :placeholder="String(TEN_PLUS_DEFAULT_HEIGHT_PERCENT)"
                  :disabled="tableLocked"
                  @focus="selectInput"
                />
                <span>%</span>
              </span>
              <span class="tpc-comp-dial-result">
                <span class="tpc-comp-dial-result-label">实际高度</span>
                {{ effectiveHeightText }}
              </span>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">高度百分比</div>
        </label>

        <label class="tpc-comp-unit" for="tpc-comp-angle">
          <div class="tpc-comp-dial tpc-comp-dial-angle">
            <svg class="tpc-comp-angle" viewBox="0 0 128 128" aria-hidden="true">
              <path class="tpc-comp-angle-arc" :d="angleArcPath" />
              <line
                class="tpc-comp-angle-ray"
                :x1="ANGLE_VX"
                :y1="ANGLE_VY"
                :x2="baseRayEnd.x"
                :y2="baseRayEnd.y"
              />
              <line
                class="tpc-comp-angle-ray"
                :x1="ANGLE_VX"
                :y1="ANGLE_VY"
                :x2="moveRayEnd.x"
                :y2="moveRayEnd.y"
              />
              <circle class="tpc-comp-angle-vertex" :cx="ANGLE_VX" :cy="ANGLE_VY" r="3.2" />
              <text
                class="tpc-comp-angle-now"
                :x="angleNowLabel.x"
                :y="angleNowLabel.y"
                text-anchor="middle"
              >
                {{ angleNowLabel.text }}
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
                @focus="selectInput"
              />
              <span>°</span>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">角度补偿</div>
        </label>

        <div class="tpc-comp-unit tpc-comp-unit-chord">
          <div class="tpc-comp-chord-body">
            <div class="tpc-comp-chord-top" aria-hidden="true">
              <span class="tpc-comp-chord-seg is-actual" :style="{ width: `${chordBar.actualPct}%` }" />
              <span
                v-if="chordBar.extraPct > 0"
                class="tpc-comp-chord-seg is-extra"
                :style="{ width: `${chordBar.extraPct}%` }"
              />
              <span
                v-if="chordBar.deficitPct > 0"
                class="tpc-comp-chord-seg is-deficit"
                :style="{ width: `${chordBar.deficitPct}%` }"
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
                  @click="nudgeChordRatio(-TEN_PLUS_CHORD_RATIO_STEP)"
                >
                  ‹
                </button>
                <input
                  id="tpc-comp-chord"
                  v-model.number="row.chordRatio"
                  type="number"
                  class="tpc-comp-chord-val"
                  :step="TEN_PLUS_CHORD_RATIO_STEP"
                  aria-label="弦长倍率"
                  :placeholder="String(TEN_PLUS_DEFAULT_CHORD_RATIO)"
                  @focus="selectInput"
                />
                <button
                  type="button"
                  class="tpc-comp-chord-btn"
                  aria-label="增大弦长倍率"
                  @click="nudgeChordRatio(TEN_PLUS_CHORD_RATIO_STEP)"
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
          :class="{ locked: tableLocked }"
          @click="focusKbxCard"
        >
          <div class="tpc-comp-kbx-card">
            <div class="tpc-comp-plot">
              <svg :viewBox="`0 0 ${KBX_PLOT.w} ${KBX_PLOT.h}`" aria-hidden="true">
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
                  v-for="(g, i) in kbxPlot.gridX"
                  :key="`gx-${i}`"
                  class="tpc-comp-plot-grid"
                  v-bind="g"
                />
                <line
                  v-for="(g, i) in kbxPlot.gridY"
                  :key="`gy-${i}`"
                  class="tpc-comp-plot-grid"
                  v-bind="g"
                />
                <line
                  class="tpc-comp-plot-axis"
                  v-bind="kbxPlot.axisX"
                  marker-end="url(#tpc-kbx-arrow)"
                />
                <line
                  class="tpc-comp-plot-axis"
                  v-bind="kbxPlot.axisY"
                  marker-end="url(#tpc-kbx-arrow)"
                />
                <text
                  class="tpc-comp-plot-axis-name"
                  :x="kbxPlot.xName.x"
                  :y="kbxPlot.xName.y"
                  text-anchor="end"
                >
                  {{ kbxPlot.xName.text }}
                </text>
                <text class="tpc-comp-plot-axis-name" :x="kbxPlot.yName.x" :y="kbxPlot.yName.y">
                  {{ kbxPlot.yName.text }}
                </text>
                <line
                  v-if="!kbxPlot.collapsed"
                  class="tpc-comp-plot-line-halo"
                  v-bind="kbxPlot.line"
                />
                <line v-if="!kbxPlot.collapsed" class="tpc-comp-plot-line" v-bind="kbxPlot.line" />
                <circle class="tpc-comp-plot-dot" :cx="kbxPlot.p0.x" :cy="kbxPlot.p0.y" r="3.4" />
                <circle
                  v-if="!kbxPlot.collapsed"
                  class="tpc-comp-plot-dot"
                  :cx="kbxPlot.p1.x"
                  :cy="kbxPlot.p1.y"
                  r="3.4"
                />
                <text
                  class="tpc-comp-plot-point"
                  :x="kbxPlot.p0Label.x"
                  :y="kbxPlot.p0Label.y"
                  :text-anchor="kbxPlot.p0Label.anchor"
                >
                  {{ kbxPlot.p0Label.text }}
                </text>
                <text
                  v-if="!kbxPlot.collapsed"
                  class="tpc-comp-plot-point"
                  :x="kbxPlot.p1Label.x"
                  :y="kbxPlot.p1Label.y"
                  :text-anchor="kbxPlot.p1Label.anchor"
                >
                  {{ kbxPlot.p1Label.text }}
                </text>
              </svg>
            </div>
            <div class="tpc-comp-kbx-fields">
              <label class="tpc-comp-kbx-field" :class="{ 'is-focused': focusedField === 'k' }">
                <span>K</span>
                <input
                  v-model.number="row.k"
                  type="number"
                  step="0.001"
                  :disabled="tableLocked"
                  @focus="onFieldFocus('k', $event)"
                  @blur="onFieldBlur('k')"
                />
              </label>
              <label class="tpc-comp-kbx-field" :class="{ 'is-focused': focusedField === 'b' }">
                <span>B</span>
                <input
                  v-model.number="row.b"
                  type="number"
                  step="0.001"
                  :disabled="tableLocked"
                  @focus="onFieldFocus('b', $event)"
                  @blur="onFieldBlur('b')"
                />
              </label>
              <label class="tpc-comp-kbx-field" :class="{ 'is-focused': focusedField === 'x' }">
                <span>X</span>
                <input
                  v-model.number="row.x"
                  type="number"
                  step="0.001"
                  :disabled="tableLocked"
                  @focus="onFieldFocus('x', $event)"
                  @blur="onFieldBlur('x')"
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
                :x1="H_ARROW_X"
                :y1="H_TOP"
                :x2="H_ARROW_X"
                :y2="H_BOTTOM"
              />
              <line
                class="tpc-comp-height-rail"
                :x1="H_LEFT"
                :y1="H_TOP"
                :x2="H_RIGHT"
                :y2="H_TOP"
              />
              <line
                class="tpc-comp-height-rail"
                :x1="H_LEFT"
                :y1="H_BOTTOM"
                :x2="H_RIGHT"
                :y2="H_BOTTOM"
              />
              <rect
                class="tpc-comp-cut-fill"
                :x="H_ARROW_X - 3.2"
                :y="cutRangeBar.startY"
                width="6.4"
                :height="cutRangeBar.height"
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
                  :placeholder="String(TEN_PLUS_DEFAULT_CUT_START_PERCENT)"
                  @focus="selectInput"
                  @blur="commitCutStart"
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
                  :placeholder="String(TEN_PLUS_DEFAULT_CUT_END_PERCENT)"
                  @focus="selectInput"
                  @blur="commitCutEnd"
                />
                <span>%</span>
              </label>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">切割范围</div>
        </div>

        <label v-if="showRTurnsCard" class="tpc-comp-unit" for="tpc-comp-r-turns">
          <div class="tpc-comp-dial">
            <svg class="tpc-comp-ring" viewBox="0 0 128 128" aria-hidden="true">
              <circle class="tpc-comp-ring-track" cx="64" cy="64" :r="RING_R" />
              <circle
                class="tpc-comp-ring-value"
                cx="64"
                cy="64"
                :r="RING_R"
                :stroke-dasharray="rTurnsDasharray"
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
                  :placeholder="String(TEN_PLUS_DEFAULT_R_TURNS)"
                  @focus="selectInput"
                  @blur="commitRTurns"
                />
                <span>圈</span>
              </span>
            </div>
          </div>
          <div class="tpc-comp-unit-cap">R轴旋转圈数</div>
        </label>
      </div>

      <section class="tpc-comp-xyz" :class="{ locked: tableLocked }">
        <div class="tpc-comp-group">XYZ 补偿</div>
        <div class="tpc-comp-xyz-cells">
          <label class="tpc-comp-xyz-cell" :class="{ 'is-focused': focusedField === 'compX' }">
            <span>X</span>
            <input
              v-model.number="row.compX"
              type="number"
              step="0.001"
              :disabled="tableLocked"
              @focus="onFieldFocus('compX', $event)"
              @blur="onFieldBlur('compX')"
            />
          </label>
          <label class="tpc-comp-xyz-cell" :class="{ 'is-focused': focusedField === 'compY' }">
            <span>Y</span>
            <input
              v-model.number="row.compY"
              type="number"
              step="0.001"
              :disabled="tableLocked"
              @focus="onFieldFocus('compY', $event)"
              @blur="onFieldBlur('compY')"
            />
          </label>
          <label class="tpc-comp-xyz-cell" :class="{ 'is-focused': focusedField === 'compZ' }">
            <span>Z</span>
            <input
              v-model.number="row.compZ"
              type="number"
              step="0.001"
              :disabled="tableLocked"
              @focus="onFieldFocus('compZ', $event)"
              @blur="onFieldBlur('compZ')"
            />
          </label>
        </div>
      </section>

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
.tpc-comp-xyz-cell input:focus,
.tpc-comp-kbx-field input:focus {
  color: var(--app-text-primary);
}
.tpc-comp-xyz {
  margin-top: 18px;
}
.tpc-comp-xyz.locked {
  opacity: 0.42;
}
.tpc-comp-group {
  margin: 0 0 7px 4px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--app-text-muted);
}
.tpc-comp-xyz-cells {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  overflow: visible;
  border-radius: 0;
  background: transparent;
}
.tpc-comp-xyz-cells:has(.is-focused) .tpc-comp-xyz-cell:not(.is-focused) {
  background: var(--tpc-surface-dim);
}
.tpc-comp-xyz-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px 11px;
  cursor: text;
  border: 2px solid transparent;
  border-radius: 12px;
  background: var(--tpc-surface);
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}
.tpc-comp-xyz-cell.is-focused {
  z-index: 2;
  background: var(--tpc-surface);
}
.tpc-comp-xyz-cell.is-focused::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid color-mix(in srgb, var(--app-text-primary) 50%, #737373);
  border-radius: 12px;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--app-text-primary) 16%, transparent);
  pointer-events: none;
}
.tpc-comp-xyz-cell.is-focused span {
  color: var(--app-text-primary);
  font-weight: 650;
}
.tpc-comp-xyz-cell span {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--app-text-muted);
}
.tpc-comp-xyz-cell input {
  width: 100%;
  padding: 2px 0 0;
  border: 0;
  background: transparent;
  outline: none;
  text-align: center;
  font-size: 20px;
  font-weight: 560;
  font-variant-numeric: tabular-nums;
  font-family: inherit;
  letter-spacing: -0.03em;
  color: var(--app-text-primary);
  appearance: textfield;
}
.tpc-comp-xyz-cell input::-webkit-outer-spin-button,
.tpc-comp-xyz-cell input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
.tpc-comp-xyz-cell input:disabled {
  cursor: not-allowed;
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
