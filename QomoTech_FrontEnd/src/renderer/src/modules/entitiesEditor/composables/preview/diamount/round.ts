// =============================================================================
// diamount/round.ts — 圆形明亮式 (Round Brilliant Cut)
// =============================================================================

import type { ContourSegment, Point2D } from '../../../commons/types'
import type { ProfileVertex, ShapeDefinition } from './types'
import { polylineVerticesToSegments } from '../../../utils/geometry'

export const roundDef: ShapeDefinition = {
  get2DContours(center: Point2D, L: number, W: number): ContourSegment[] {
    const R = Math.max(L, W)
    return polylineVerticesToSegments([
      { point: { X: center.X + R, Y: center.Y }, bulge: 1 },
      { point: { X: center.X - R, Y: center.Y }, bulge: 1 },
    ])
  },

  getProfileVertices(R: number, _L: number, _W: number): ProfileVertex[] {
    const segs = 16
    const verts: ProfileVertex[] = []
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2
      verts.push({ x: Math.cos(a) * R, z: Math.sin(a) * R })
    }
    return verts
  },
}
