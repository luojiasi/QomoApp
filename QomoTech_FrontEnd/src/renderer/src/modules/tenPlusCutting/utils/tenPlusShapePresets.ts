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
import { TEN_PLUS_CURVE_KIND_SUPERELLIPSE, TEN_PLUS_CURVE_PATH_TYPE } from '../constants/tenPlusCutting'
import type {
  TenPlusQuickShapeInput,
  TenPlusQuickShapeRowDraft
} from '../types/shapePreset'

const PREVIEW_OUTLINE_SEGMENTS = 360
const PREVIEW_QUARTER_SEGMENTS = 60

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

/**
 * 由快捷形状尺寸生成任务行草稿。
 * 垫型：超椭圆四分之一弧 × 4，后 3 行 sameLayer；与 HTML 演示同一公式。
 */
export function buildQuickShapeRowDrafts(
  input: TenPlusQuickShapeInput
): TenPlusQuickShapeRowDraft[] {
  switch (input.shape) {
    case 'cushion':
      return buildCushionDrafts(input)
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
  if (
    !Number.isFinite(input.exponent) ||
    input.exponent < TEN_PLUS_CUSHION_EXPONENT_MIN ||
    input.exponent > TEN_PLUS_CUSHION_EXPONENT_MAX
  ) {
    return `指数 n 必须在 ${TEN_PLUS_CUSHION_EXPONENT_MIN}–${TEN_PLUS_CUSHION_EXPONENT_MAX} 之间`
  }
  if (!Number.isFinite(input.angle) || input.angle < -90 || input.angle > 90) {
    return '角度必须在 -90~90 之间'
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
