import type { TenPlusQuickShapeId } from '../types/shapePreset'

export const 快捷形状选项: ReadonlyArray<{
  value: TenPlusQuickShapeId
  label: string
}> = [
  { value: '垫型', label: '垫型 / 枕形' },
  { value: '水滴', label: '水滴 / 梨形' },
  { value: '马眼', label: '马眼 / 橄榄形' }
]

export const 默认快捷形状: TenPlusQuickShapeId = '垫型'

export const 垫型默认长 = 4
export const 垫型默认宽 = 4
export const 垫型默认高 = 2
export const 垫型默认角 = 90
/** 与 test/cushion_shape.html 默认 n=4 一致 */
export const 垫型默认指数 = 1.5
export const 垫型指数最小 = 1.5
export const 垫型指数最大 = 12

/** 超椭圆相对公式坐标再转 45°：尖角离开坐标轴，右侧朝向切割方向 */
export const 垫型旋转角 = 45

/** 四分之一弧（X 镜像：原 −45°~45° 起改为 +180°），第一段 135°~225°，之后每次 R +90° */
export const 垫型四分弧: ReadonlyArray<{ start: number; end: number }> = [
  { start: -45, end: 45 },
  { start: 45, end: 135 },
  { start: 135, end: 225 },
  { start: 225, end: 315 }
]

/** 水滴默认长宽：宽=2a=4，长=a+L=6.4（比 1.6，对应 HTML a=1、L=2.2） */
export const 水滴默认长 = 3
export const 水滴默认宽 = 2

/** 马眼默认长宽：2:1，与 test/marquise_shape.html 半长 l=2、半宽 w=1 一致（总长 4、总宽 2） */
export const 马眼默认长 = 4
export const 马眼默认宽 = 2
