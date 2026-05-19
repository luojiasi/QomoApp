// =============================================================================
// diamount/types.ts — 异形钻石形状的共享类型
// =============================================================================

import type { Point2D, PolylineVertex } from '../../../commons/types'

/** XZ 平面单个顶点（3D 轮廓用，Y-up 构建） */
export interface ProfileVertex {
  x: number
  z: number
}

/** 每个形状文件必须导出的定义 */
export interface ShapeDefinition {
  /** 2D 精确轮廓：使用 bulge 弧段表示，供 Canvas 2D 渲染 */
  get2DContours(center: Point2D, L: number, W: number): PolylineVertex[][]
  /** 3D 腰围顶点：供 Three.js 刻面构建 */
  getProfileVertices(R: number, L: number, W: number): ProfileVertex[]
}

/** 形状 → 中文标签 */
export const SHAPE_LABELS: Record<string, string> = {
  ROUND:    '圆形明亮式',
  PRINCESS: '公主方',
  CUSHION:  '垫形',
  EMERALD:  '祖母绿形',
  OVAL:     '椭圆形',
  PEAR:     '水滴形',
  MARQUISE: '马眼形',
  HEART:    '心形',
}
