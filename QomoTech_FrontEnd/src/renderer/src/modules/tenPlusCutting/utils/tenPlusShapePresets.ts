import {
  TEN_PLUS_CUSHION_DEFAULT_ANGLE,
  TEN_PLUS_CUSHION_DEFAULT_EXPONENT,
  TEN_PLUS_CUSHION_DEFAULT_HEIGHT,
  TEN_PLUS_CUSHION_DEFAULT_LENGTH,
  TEN_PLUS_CUSHION_DEFAULT_WIDTH,
  TEN_PLUS_CUSHION_EXPONENT_MAX,
  TEN_PLUS_CUSHION_EXPONENT_MIN,
  TEN_PLUS_CUSHION_QUARTERS,
  TEN_PLUS_CUSHION_ROTATION_DEG,
  TEN_PLUS_DEFAULT_QUICK_SHAPE
} from '../constants/shapePreset'
import { TEN_PLUS_CURVE_KIND_CIRCLE, TEN_PLUS_CURVE_KIND_SUPERELLIPSE, TEN_PLUS_CURVE_PATH_TYPE } from '../constants/tenPlusCutting'
import type {
  TenPlusQuickShapeInput,
  TenPlusQuickShapeRowDraft
} from '../types/shapePreset'

const PREVIEW_OUTLINE_SEGMENTS = 360
const PREVIEW_QUARTER_SEGMENTS = 60
const PREVIEW_TEARDROP_SEGMENTS = 90

export interface CushionPreviewPoint {
  x: number
  y: number
}

export interface CushionPreviewModel {
  a: number
  b: number
  outline: CushionPreviewPoint[]
  quarters: CushionPreviewPoint[][]
}

export interface TeardropGeometry {
  a: number
  L: number
  cx: number
  r: number
  tipRightDeg: number
  tipLeftDeg: number
  tipAngleDeg: number
}

/**
 * 垫型超椭圆极径，与 test/cushion_shape.html 相同：
 * r(θ) = a·b / [ (b·|cosθ|)ⁿ + (a·|sinθ|)ⁿ ]^(1/n)
 * a、b 为半长、半宽。
 */
export function cushionPolarRadius(thetaRad: number, a: number, b: number, n: number): number {
  const c = Math.abs(Math.cos(thetaRad))
  const s = Math.abs(Math.sin(thetaRad))
  const denom = (b * c) ** n + (a * s) ** n
  if (!(denom > 0)) return 0
  return (a * b) / denom ** (1 / n)
}

export function sampleCushionArc(
  a: number,
  b: number,
  n: number,
  startDeg: number,
  endDeg: number,
  count: number
): CushionPreviewPoint[] {
  if (count < 2) return []
  const span = endDeg - startDeg
  const out: CushionPreviewPoint[] = []
  for (let i = 0; i < count; i += 1) {
    const deg = startDeg + (span * i) / (count - 1)
    const place = (deg * Math.PI) / 180
    const shape = ((deg - TEN_PLUS_CUSHION_ROTATION_DEG) * Math.PI) / 180
    const r = cushionPolarRadius(shape, a, b, n)
    out.push({ x: r * Math.cos(place), y: r * Math.sin(place) })
  }
  return out
}

export function buildCushionPreview(input: TenPlusQuickShapeInput): CushionPreviewModel | null {
  if (describeQuickShapeError(input)) return null
  const a = input.length / 2
  const b = input.width / 2
  return {
    a,
    b,
    outline: sampleCushionArc(a, b, input.exponent, 0, 360, PREVIEW_OUTLINE_SEGMENTS),
    quarters: TEN_PLUS_CUSHION_QUARTERS.map((q) =>
      sampleCushionArc(a, b, input.exponent, q.start, q.end, PREVIEW_QUARTER_SEGMENTS)
    )
  }
}

export function pointsToSvgPolyline(points: CushionPreviewPoint[], scale: number): string {
  return points.map((p) => `${p.x * scale},${-p.y * scale}`).join(' ')
}

/** 水滴：宽=2a，长=a+L。与 test/teardrop_shape.html 同一套。 */
export function teardropFromSize(length: number, width: number): { a: number; L: number } {
  const a = width / 2
  const L = length - a
  return { a, L }
}

export function teardropGeometry(a: number, L: number): TeardropGeometry {
  const cx = (a * a - L * L) / (2 * a)
  const r = (a * a + L * L) / (2 * a)
  const tipRightDeg = (Math.atan2(-L, -cx) * 180) / Math.PI
  let tipLeftDeg = (Math.atan2(-L, cx) * 180) / Math.PI
  if (tipLeftDeg < 0) tipLeftDeg += 360
  const tipAngleDeg = (2 * Math.atan(Math.abs(a * a - L * L) / (2 * a * L)) * 180) / Math.PI
  return { a, L, cx, r, tipRightDeg, tipLeftDeg, tipAngleDeg }
}

function sampleCircleArc(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  count: number
): CushionPreviewPoint[] {
  if (count < 2) return []
  const span = endDeg - startDeg
  const out: CushionPreviewPoint[] = []
  for (let i = 0; i < count; i += 1) {
    const deg = startDeg + (span * i) / (count - 1)
    const rad = (deg * Math.PI) / 180
    out.push({ x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) })
  }
  return out
}

export function buildTeardropPreview(input: TenPlusQuickShapeInput): CushionPreviewModel | null {
  if (describeQuickShapeError(input)) return null
  const { a, L } = teardropFromSize(input.length, input.width)
  const g = teardropGeometry(a, L)
  const top = sampleCircleArc(0, 0, g.a, 180, 0, PREVIEW_TEARDROP_SEGMENTS)
  const right = sampleCircleArc(g.cx, 0, g.r, 0, g.tipRightDeg, PREVIEW_TEARDROP_SEGMENTS)
  const left = sampleCircleArc(-g.cx, 0, g.r, g.tipLeftDeg, 180, PREVIEW_TEARDROP_SEGMENTS)
  return {
    a,
    b: a,
    outline: [...top, ...right.slice(1), ...left.slice(1)],
    quarters: [top, right, left]
  }
}

export function buildQuickShapePreview(input: TenPlusQuickShapeInput): CushionPreviewModel | null {
  if (input.shape === 'teardrop') return buildTeardropPreview(input)
  return buildCushionPreview(input)
}

/**
 * 由快捷形状尺寸生成任务行草稿。
 * 垫型：超椭圆四分之一弧 × 4，后 3 行 sameLayer。
 * 水滴：长/宽 → a=宽/2、L=长−a；沿轮廓顶→右→左(反向)，后 2 行 sameLayer。
 */
export function buildQuickShapeRowDrafts(
  input: TenPlusQuickShapeInput
): TenPlusQuickShapeRowDraft[] {
  switch (input.shape) {
    case 'cushion':
      return buildCushionDrafts(input)
    case 'teardrop':
      return buildTeardropDrafts(input)
    default: {
      const _never: never = input.shape
      throw new Error(`未实现的快捷形状：${String(_never)}`)
    }
  }
}

export function createDefaultQuickShapeInput(): TenPlusQuickShapeInput {
  return {
    shape: TEN_PLUS_DEFAULT_QUICK_SHAPE,
    length: TEN_PLUS_CUSHION_DEFAULT_LENGTH,
    width: TEN_PLUS_CUSHION_DEFAULT_WIDTH,
    height: TEN_PLUS_CUSHION_DEFAULT_HEIGHT,
    exponent: TEN_PLUS_CUSHION_DEFAULT_EXPONENT,
    angle: TEN_PLUS_CUSHION_DEFAULT_ANGLE
  }
}

export function describeQuickShapeError(input: TenPlusQuickShapeInput): string | null {
  if (!Number.isFinite(input.length) || input.length <= 0) return '长必须大于 0'
  if (!Number.isFinite(input.width) || input.width <= 0) return '宽必须大于 0'
  if (!Number.isFinite(input.height) || input.height < 0) return '高度不能为负'
  if (!Number.isFinite(input.angle) || input.angle < -90 || input.angle > 90) {
    return '角度必须在 -90~90 之间'
  }
  if (input.shape === 'teardrop') {
    const { a, L } = teardropFromSize(input.length, input.width)
    if (!(a > 0)) return '宽必须大于 0'
    if (!(L > 0)) return '长必须大于半宽（L = 长 − 宽/2）'
    const { r } = teardropGeometry(a, L)
    if (!(a <= 200) || !(r > 0) || r > 200) {
      return '换算后的半宽或侧弧半径超出 0~200 mm，请减小长或增大宽'
    }
    return null
  }
  if (
    !Number.isFinite(input.exponent) ||
    input.exponent < TEN_PLUS_CUSHION_EXPONENT_MIN ||
    input.exponent > TEN_PLUS_CUSHION_EXPONENT_MAX
  ) {
    return `指数 n 必须在 ${TEN_PLUS_CUSHION_EXPONENT_MIN}–${TEN_PLUS_CUSHION_EXPONENT_MAX} 之间`
  }
  return null
}

function buildCushionDrafts(input: TenPlusQuickShapeInput): TenPlusQuickShapeRowDraft[] {
  const err = describeQuickShapeError(input)
  if (err) throw new Error(err)

  return TEN_PLUS_CUSHION_QUARTERS.map((arc, index) => ({
    pathType: TEN_PLUS_CURVE_PATH_TYPE,
    diameter: 0,
    length: input.length,
    width: input.width,
    curveKind: TEN_PLUS_CURVE_KIND_SUPERELLIPSE,
    superellipseN: input.exponent,
    arcStart: arc.start,
    arcEnd: arc.end,
    arcOffsetX: 0,
    arcOffsetY: 0,
    sameLayer: index > 0,
    angle: input.angle,
    height: input.height
  }))
}

function circleDraft(
  input: TenPlusQuickShapeInput,
  radius: number,
  offsetX: number,
  start: number,
  end: number,
  sameLayer: boolean
): TenPlusQuickShapeRowDraft {
  return {
    pathType: TEN_PLUS_CURVE_PATH_TYPE,
    diameter: radius,
    length: input.length,
    width: input.width,
    curveKind: TEN_PLUS_CURVE_KIND_CIRCLE,
    superellipseN: 0,
    arcStart: start,
    arcEnd: end,
    arcOffsetX: offsetX,
    arcOffsetY: 0,
    sameLayer,
    angle: input.angle,
    height: input.height
  }
}

function buildTeardropDrafts(input: TenPlusQuickShapeInput): TenPlusQuickShapeRowDraft[] {
  const err = describeQuickShapeError(input)
  if (err) throw new Error(err)
  const { a, L } = teardropFromSize(input.length, input.width)
  const g = teardropGeometry(a, L)
  // 沿轮廓闭合：左肩→右肩→尖端→左肩。左弧反向，否则段与段首尾对不上。
  return [
    circleDraft(input, a, 0, 180, 0, false),
    circleDraft(input, g.r, g.cx, 0, g.tipRightDeg, true),
    circleDraft(input, g.r, -g.cx, g.tipLeftDeg, 180, true)
  ]
}
