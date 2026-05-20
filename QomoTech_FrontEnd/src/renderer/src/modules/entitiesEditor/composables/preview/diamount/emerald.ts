// =============================================================================
// diamount/emerald.ts — 祖母绿形 (Emerald Cut / Step Cut)
// 八角形：矩形四角各切一刀，8 段直线（bulge=0）。
// =============================================================================

import type { ContourSegment, Point2D } from '../../../commons/types'
import type { ProfileVertex, ShapeDefinition } from './types'
import { polylineVerticesToSegments } from '../../../utils/geometry'

/** 切角比例：占半径的百分比 */
const CUT_RATIO = 0.20

export const emeraldDef: ShapeDefinition = {
  get2DContours(center: Point2D, L: number, W: number): ContourSegment[] {
    const cutX = L * CUT_RATIO
    const cutZ = W * CUT_RATIO
    return polylineVerticesToSegments([
      { point: { X: center.X + L - cutX, Y: center.Y - W },     bulge: 0 },
      { point: { X: center.X + L,        Y: center.Y - W + cutZ }, bulge: 0 },
      { point: { X: center.X + L,        Y: center.Y + W - cutZ }, bulge: 0 },
      { point: { X: center.X + L - cutX, Y: center.Y + W },     bulge: 0 },
      { point: { X: center.X - L + cutX, Y: center.Y + W },     bulge: 0 },
      { point: { X: center.X - L,        Y: center.Y + W - cutZ }, bulge: 0 },
      { point: { X: center.X - L,        Y: center.Y - W + cutZ }, bulge: 0 },
      { point: { X: center.X - L + cutX, Y: center.Y - W },     bulge: 0 },
    ])
  },

  getProfileVertices(R: number, L: number, W: number): ProfileVertex[] {
    // 直接用 8 个顶点 + 每条边插入均匀点
    const cutX = L * CUT_RATIO
    const cutZ = W * CUT_RATIO
    const raw: ProfileVertex[] = [
      { x: L - cutX, z: -W },
      { x: L,        z: -W + cutZ },
      { x: L,        z: W - cutZ },
      { x: L - cutX, z: W },
      { x: -L + cutX, z: W },
      { x: -L,        z: W - cutZ },
      { x: -L,        z: -W + cutZ },
      { x: -L + cutX, z: -W },
    ]
    // 每边插值 4 段，使总顶点足够光滑
    const segsPerEdge = 4
    const verts: ProfileVertex[] = []
    for (let i = 0; i < raw.length; i++) {
      const cur = raw[i]
      const next = raw[(i + 1) % raw.length]
      for (let j = 0; j < segsPerEdge; j++) {
        const t = j / segsPerEdge
        verts.push({ x: cur.x + (next.x - cur.x) * t, z: cur.z + (next.z - cur.z) * t })
      }
    }
    return verts
  },
}
