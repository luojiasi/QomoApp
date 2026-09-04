import {
  TEN_PLUS_DEFAULT_DIAMOND_CUT,
  TEN_PLUS_DEFAULT_DIAMOND_PRESET_CROWN,
  TEN_PLUS_DEFAULT_DIAMOND_PRESET_DIAMETER,
  TEN_PLUS_DEFAULT_DIAMOND_PRESET_GIRDLE,
  TEN_PLUS_DEFAULT_DIAMOND_PRESET_PAVILION,
  TEN_PLUS_DIAMOND_CUT_OPTIONS,
  TEN_PLUS_DIAMOND_PRESET_PERCENT_MAX,
  TEN_PLUS_DIAMOND_PRESET_PERCENT_MIN,
  TEN_PLUS_DIAMOND_PROFILE_TABLE_RATIO
} from '../constants/diamondPreset'
import { TEN_PLUS_EQUAL_LINE_PATH_TYPE } from '../constants/tenPlusCutting'
import type {
  DiamondProfileModel,
  DiamondProfilePoint,
  TenPlusDiamondCutId,
  TenPlusDiamondLayerKey,
  TenPlusDiamondPresetInput,
  TenPlusDiamondPresetRowDraft
} from '../types/diamondPreset'
import type { TenPlusTaskRow } from '../types/tenPlusCutting'
import { computeDiamondRatio } from './tenPlusDiamond'

const LAYER_ORDER: ReadonlyArray<{ key: TenPlusDiamondLayerKey; label: string }> = [
  { key: 'crownPercent', label: '冠' },
  { key: 'girdlePercent', label: '腰' },
  { key: 'pavilionPercent', label: '亭' }
]

function isPercentInvalid(v: number): boolean {
  return (
    !Number.isFinite(v) ||
    v < TEN_PLUS_DIAMOND_PRESET_PERCENT_MIN ||
    v > TEN_PLUS_DIAMOND_PRESET_PERCENT_MAX
  )
}

export function createDefaultDiamondPresetInput(): TenPlusDiamondPresetInput {
  return {
    cut: TEN_PLUS_DEFAULT_DIAMOND_CUT,
    diameter: TEN_PLUS_DEFAULT_DIAMOND_PRESET_DIAMETER,
    crownPercent: TEN_PLUS_DEFAULT_DIAMOND_PRESET_CROWN,
    girdlePercent: TEN_PLUS_DEFAULT_DIAMOND_PRESET_GIRDLE,
    pavilionPercent: TEN_PLUS_DEFAULT_DIAMOND_PRESET_PAVILION
  }
}

export function diamondCutLabel(cut: TenPlusDiamondCutId): string {
  return TEN_PLUS_DIAMOND_CUT_OPTIONS.find((item) => item.value === cut)?.label ?? '钻石'
}

export function describeDiamondPresetError(input: TenPlusDiamondPresetInput): string {
  const diameter = Number(input.diameter)
  if (!Number.isFinite(diameter) || diameter <= 0 || diameter > 200) {
    return '直径必须在 0 以上、200 以内'
  }
  if (isPercentInvalid(Number(input.crownPercent))) return '冠高比须在 0.1%–100% 之间'
  if (isPercentInvalid(Number(input.girdlePercent))) return '腰高比须在 0.1%–100% 之间'
  if (isPercentInvalid(Number(input.pavilionPercent))) return '亭高比须在 0.1%–100% 之间'
  return ''
}

export function diamondLayerHeightMm(diameter: number, percent: number): number {
  return (Number(diameter) * Number(percent)) / 100
}

function clampCutAngleDeg(deg: number): number {
  if (!Number.isFinite(deg) || deg <= 0) return 90
  return Math.min(90, Math.round(deg * 10) / 10)
}

/** 相对台面（水平）的倾角：0 台面、90 竖直。与任务行 angle 同一套。 */
function slopeAngleDeg(rise: number, run: number): number {
  if (!(rise > 0) || !(run > 0)) return 90
  return clampCutAngleDeg((Math.atan(rise / run) * 180) / Math.PI)
}

/**
 * 冠：atan(冠高 / ((腰宽 − 台宽) / 2))；腰：90°；亭：atan(亭高 / 半径)。
 */
export function computeDiamondPresetAngles(
  input: TenPlusDiamondPresetInput
): Record<TenPlusDiamondLayerKey, number> {
  const diameter = Number(input.diameter)
  const radius = diameter / 2
  const tableHalf = radius * TEN_PLUS_DIAMOND_PROFILE_TABLE_RATIO
  return {
    crownPercent: slopeAngleDeg(
      diamondLayerHeightMm(diameter, Number(input.crownPercent)),
      radius - tableHalf
    ),
    girdlePercent: 90,
    pavilionPercent: slopeAngleDeg(
      diamondLayerHeightMm(diameter, Number(input.pavilionPercent)),
      radius
    )
  }
}

/**
 * 三行等分线段：冠 → 腰 → 亭。
 * 尺寸、高度都取直径（高度=直径时，钻石比例与高度百分比一一对应）；分割数 0。
 * 角度按侧视斜边相对水平计算，再走钻石比例换算直径/高度百分比。
 */
export function buildDiamondPresetRowDrafts(
  input: TenPlusDiamondPresetInput
): TenPlusDiamondPresetRowDraft[] {
  const error = describeDiamondPresetError(input)
  if (error) throw new Error(error)
  const diameter = Number(input.diameter)
  const height = diameter
  const angles = computeDiamondPresetAngles(input)
  return LAYER_ORDER.map((layer) => {
    const diamondPercent = Number(input[layer.key])
    const draft: TenPlusDiamondPresetRowDraft = {
      pathType: TEN_PLUS_EQUAL_LINE_PATH_TYPE,
      diameter,
      height,
      divisions: 0,
      angle: angles[layer.key],
      useDiamondRatio: true,
      diamondPercent,
      diameterPercent: 100,
      heightPercent: 100
    }
    const ratio = computeDiamondRatio(draft as TenPlusTaskRow)
    if (ratio.diameterPercent !== null) draft.diameterPercent = ratio.diameterPercent
    if (ratio.heightPercent !== null) draft.heightPercent = ratio.heightPercent
    return draft
  })
}

export function diamondPresetLayerLabels(): ReadonlyArray<{
  label: string
  key: TenPlusDiamondLayerKey
}> {
  return LAYER_ORDER
}

function polyPath(points: DiamondProfilePoint[]): string {
  if (points.length === 0) return ''
  const head = points[0]
  const rest = points
    .slice(1)
    .map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
  return `M${head.x.toFixed(2)} ${head.y.toFixed(2)} ${rest} Z`
}

/**
 * 圆钻侧视轮廓。高度直接用冠/腰/亭百分比，腰宽固定，台面宽按 TABLE_RATIO。
 */
export function buildDiamondProfile(
  crownPercent: number,
  girdlePercent: number,
  pavilionPercent: number
): DiamondProfileModel {
  const crownH = Math.max(Number(crownPercent) || 0, 0.2)
  const girdleH = Math.max(Number(girdlePercent) || 0, 0.2)
  const pavilionH = Math.max(Number(pavilionPercent) || 0, 0.2)
  const halfW = 50
  const tableHalf = halfW * TEN_PLUS_DIAMOND_PROFILE_TABLE_RATIO
  const tableY = 0
  const girdleTopY = crownH
  const girdleBottomY = crownH + girdleH
  const culetY = girdleBottomY + pavilionH

  const tableL: DiamondProfilePoint = { x: -tableHalf, y: tableY }
  const tableR: DiamondProfilePoint = { x: tableHalf, y: tableY }
  const gTopL: DiamondProfilePoint = { x: -halfW, y: girdleTopY }
  const gTopR: DiamondProfilePoint = { x: halfW, y: girdleTopY }
  const gBotL: DiamondProfilePoint = { x: -halfW, y: girdleBottomY }
  const gBotR: DiamondProfilePoint = { x: halfW, y: girdleBottomY }
  const culet: DiamondProfilePoint = { x: 0, y: culetY }

  const pad = 6
  return {
    crownPath: polyPath([tableL, tableR, gTopR, gTopL]),
    girdlePath: polyPath([gTopL, gTopR, gBotR, gBotL]),
    pavilionPath: polyPath([gBotL, gBotR, culet]),
    leftFacetPath: polyPath([tableL, { x: 0, y: tableY }, gTopL]),
    facetPath: [
      `M${(-halfW * 0.34).toFixed(2)} ${girdleBottomY.toFixed(2)} L0 ${culetY.toFixed(2)}`,
      `M${(halfW * 0.34).toFixed(2)} ${girdleBottomY.toFixed(2)} L0 ${culetY.toFixed(2)}`,
      `M0 ${tableY.toFixed(2)} L0 ${girdleTopY.toFixed(2)}`
    ].join(' '),
    outlinePath: polyPath([tableL, tableR, gTopR, gBotR, culet, gBotL, gTopL]),
    tableY,
    girdleTopY,
    girdleBottomY,
    culetY,
    halfWidth: halfW,
    viewMinX: -halfW - pad,
    viewMinY: -pad,
    viewWidth: halfW * 2 + pad * 2,
    viewHeight: culetY + pad * 2
  }
}
