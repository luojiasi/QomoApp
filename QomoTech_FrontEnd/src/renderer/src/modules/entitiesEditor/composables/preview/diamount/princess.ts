// =============================================================================
// diamount/princess.ts — 公主方 (Princess Cut)
// 从 useCreatePreview3D 的 getSquareProfile 提取。
// =============================================================================

import type { ContourSegment, Point2D } from '../../../commons/types'
import type { ProfileVertex, ShapeDefinition } from './types'
import { polylineVerticesToSegments } from '../../../utils/geometry'

export const princessDef: ShapeDefinition = {
  get2DContours(center: Point2D, L: number, W: number): ContourSegment[] {
    const R = Math.max(L, W)
    return polylineVerticesToSegments([
      { point: { X: center.X + R, Y: center.Y - R }, bulge: 0 },
      { point: { X: center.X + R, Y: center.Y + R }, bulge: 0 },
      { point: { X: center.X - R, Y: center.Y + R }, bulge: 0 },
      { point: { X: center.X - R, Y: center.Y - R }, bulge: 0 },
    ])
  },

  getProfileVertices(R: number, _L: number, _W: number): ProfileVertex[] {
    const segsPerEdge = 4
    const step = (2 * R) / segsPerEdge
    const verts: ProfileVertex[] = []
    // 右边缘：X=R, Z 从 -R → R
    for (let i = 0; i < segsPerEdge; i++) verts.push({ x: R,        z: -R + i * step })
    // 上边缘：Z=R, X 从 R → -R
    for (let i = 0; i < segsPerEdge; i++) verts.push({ x: R - i * step, z: R })
    // 左边缘：X=-R, Z 从 R → -R
    for (let i = 0; i < segsPerEdge; i++) verts.push({ x: -R,       z: R - i * step })
    // 下边缘：Z=-R, X 从 -R → R
    for (let i = 0; i < segsPerEdge; i++) verts.push({ x: -R + i * step, z: -R })
    return verts
  },
}
