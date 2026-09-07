import type { TenPlusTaskRow } from './tenPlusCutting'

/** 钻石快捷形状的切工类型 */
export type TenPlusDiamondCutId =
  | 'round'
  | 'oval'
  | 'princess'
  | 'emerald'
  | 'radiant'
  | 'heart'

export type TenPlusDiamondLayerKey = 'crownPercent' | 'girdlePercent' | 'pavilionPercent'

/** 钻石快捷形状：类型 + 直径 + 台面/冠/腰/亭百分比 */
export interface TenPlusDiamondPresetInput {
  cut: TenPlusDiamondCutId
  diameter: number
  /** 台面宽占腰宽（直径）的百分比 */
  tablePercent: number
  crownPercent: number
  girdlePercent: number
  pavilionPercent: number
}

/** 生成任务行时要覆盖的字段；id / taskNo 由 store 分配 */
export type TenPlusDiamondPresetRowDraft = Pick<
  TenPlusTaskRow,
  | 'pathType'
  | 'diameter'
  | 'height'
  | 'divisions'
  | 'angle'
  | 'useDiamondRatio'
  | 'diamondPercent'
  | 'diameterPercent'
  | 'heightPercent'
>

export interface DiamondProfilePoint {
  x: number
  y: number
}

/** 圆钻侧视：台面 → 冠 → 腰 → 亭尖 */
export interface DiamondProfileModel {
  crownPath: string
  girdlePath: string
  pavilionPath: string
  leftFacetPath: string
  facetPath: string
  outlinePath: string
  tableY: number
  girdleTopY: number
  girdleBottomY: number
  culetY: number
  halfWidth: number
  viewMinX: number
  viewMinY: number
  viewWidth: number
  viewHeight: number
}
