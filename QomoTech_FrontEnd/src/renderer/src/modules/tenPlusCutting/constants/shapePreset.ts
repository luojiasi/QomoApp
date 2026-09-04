import type { TenPlusQuickShapeId } from '../types/shapePreset'

export const TEN_PLUS_QUICK_SHAPE_OPTIONS: ReadonlyArray<{
  value: TenPlusQuickShapeId
  label: string
}> = [
  { value: 'cushion', label: '垫型 / 枕形' },
  { value: 'teardrop', label: '水滴 / 梨形' },
  { value: 'marquise', label: '马眼 / 橄榄形' }
]

export const TEN_PLUS_DEFAULT_QUICK_SHAPE: TenPlusQuickShapeId = 'cushion'

export const TEN_PLUS_CUSHION_DEFAULT_LENGTH = 4
export const TEN_PLUS_CUSHION_DEFAULT_WIDTH = 4
export const TEN_PLUS_CUSHION_DEFAULT_HEIGHT = 2
export const TEN_PLUS_CUSHION_DEFAULT_ANGLE = 90
/** 与 test/cushion_shape.html 默认 n=4 一致 */
export const TEN_PLUS_CUSHION_DEFAULT_EXPONENT = 1.5
export const TEN_PLUS_CUSHION_EXPONENT_MIN = 1.5
export const TEN_PLUS_CUSHION_EXPONENT_MAX = 12

/** 超椭圆相对公式坐标再转 45°：尖角离开坐标轴，右侧朝向切割方向 */
export const TEN_PLUS_CUSHION_ROTATION_DEG = 45

/** 四分之一弧（X 镜像：原 −45°~45° 起改为 +180°），第一段 135°~225°，之后每次 R +90° */
export const TEN_PLUS_CUSHION_QUARTERS: ReadonlyArray<{ start: number; end: number }> = [
  { start: -45, end: 45 },
  { start: 45, end: 135 },
  { start: 135, end: 225 },
  { start: 225, end: 315 }
]

/** 水滴默认长宽：宽=2a=4，长=a+L=6.4（比 1.6，对应 HTML a=1、L=2.2） */
export const TEN_PLUS_TEARDROP_DEFAULT_LENGTH = 3
export const TEN_PLUS_TEARDROP_DEFAULT_WIDTH = 2

/** 马眼默认长宽：2:1，与 test/marquise_shape.html 半长 l=2、半宽 w=1 一致（总长 4、总宽 2） */
export const TEN_PLUS_MARQUISE_DEFAULT_LENGTH = 4
export const TEN_PLUS_MARQUISE_DEFAULT_WIDTH = 2
