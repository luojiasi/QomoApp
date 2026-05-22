// =============================================================================
// diamount/marquise.ts — 马眼形 (Marquise Cut)
// 轮廓：4 段弧组成的两头尖船形。
// =============================================================================

import type { ContourSegment, Point2D } from '../../../commons/types'
import type { ProfileVertex, ShapeDefinition } from './types'
import { polylineVerticesToSegments } from '../../../utils/geometry'

/** 马眼弧的 bulge = tan(半段弧角/4) */
const MARQUISE_BULGE = Math.tan((Math.PI / 2) / 4) // ≈ 0.4142

export const marquiseDef: ShapeDefinition = {
  get2DContours(center: Point2D, L: number, W: number): ContourSegment[] {
    return polylineVerticesToSegments([
      { point: { X: center.X + L, Y: center.Y },       bulge: MARQUISE_BULGE },
      { point: { X: center.X,     Y: center.Y + W },    bulge: MARQUISE_BULGE },
      { point: { X: center.X - L, Y: center.Y },       bulge: MARQUISE_BULGE },
      { point: { X: center.X,     Y: center.Y - W },    bulge: MARQUISE_BULGE },
    ])
  },

  getProfileVertices(_R: number, L: number, W: number): ProfileVertex[] {
    // 马眼形参数方程采样 32 点
    // 经典马眼：x = L * cos(t), z = W * sin(t) * (1 + cos(t)) / 2
    const N = 32
    const verts: ProfileVertex[] = []
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2
      const x = L * Math.cos(t)
      const z = W * Math.sin(t) * (1 + Math.cos(t)) / 2
      verts.push({ x, z })
    }
    return verts
  },
}
