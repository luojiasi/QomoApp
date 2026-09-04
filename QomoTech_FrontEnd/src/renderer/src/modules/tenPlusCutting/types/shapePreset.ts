import type { TenPlusTaskRow } from './tenPlusCutting'

/** 快捷形状 id；新增形状只在此联合上追加 */
export type TenPlusQuickShapeId = 'cushion' | 'teardrop' | 'marquise'

/**
 * 快捷形状弹窗提交的尺寸。三种形状都填长/宽：
 * 垫型：外接长宽；水滴：长=a+L、宽=2a；马眼：总长 2l、总宽 2w。
 */
export interface TenPlusQuickShapeInput {
  shape: TenPlusQuickShapeId
  length: number
  width: number
  height: number
  /** 超椭圆指数 n。水滴 / 马眼忽略。 */
  exponent: number
  /** 腰棱倾角，默认 90 */
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
