import type { TenPlusTaskRow } from './tenPlusCutting'

/** 快捷形状 id；新增形状只在此联合上追加 */
export type TenPlusQuickShapeId = 'cushion'

/** 快捷形状弹窗提交的尺寸。垫型用超椭圆：长/宽为外接尺寸，n 为圆角指数。 */
export interface TenPlusQuickShapeInput {
  shape: TenPlusQuickShapeId
  length: number
  width: number
  height: number
  /** 超椭圆指数 n：2≈椭圆，4=垫型，越大越接近矩形 */
  exponent: number
  /** 腰棱倾角，垫型默认 90 */
  angle: number
}

/** 生成任务行时要覆盖的字段；id / taskNo 由 store 分配 */
export type TenPlusQuickShapeRowDraft = Pick<
  TenPlusTaskRow,
  | 'pathType'
  | 'diameter'
  | 'length'
  | 'width'
  | 'curveKind'
  | 'superellipseN'
  | 'arcStart'
  | 'arcEnd'
  | 'arcOffsetX'
  | 'arcOffsetY'
  | 'sameLayer'
  | 'angle'
  | 'height'
>
