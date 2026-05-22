// =============================================================================
// diamount/heart.ts — 心形 (Heart Cut)
// 轮廓：顶部两瓣弧 + 底部V形尖，用 6 段弧+直线组合。
// =============================================================================

import type { ContourSegment, Point2D, PolylineVertex } from '../../../commons/types'
import type { ProfileVertex, ShapeDefinition } from './types'
import { polylineVerticesToSegments } from '../../../utils/geometry'

/** 三点确定圆弧的 bulge 值 */
function threePointBulge(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  if (Math.abs(d) < 1e-10) return 0
  const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d
  const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d
  let sweep = Math.atan2(b.y - uy, b.x - ux) - Math.atan2(a.y - uy, a.x - ux)
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  while (sweep < -Math.PI) sweep += 2 * Math.PI
  return Math.tan(sweep / 4)
}

/** 心形参数方程采样点（t ∈ [0, 2π)） */
function heartPoint(t: number, R: number): { x: number; y: number } {
  // 经典心形：x = 16R * sin³(t), y = R * (13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t))
  return {
    x: 16 * R * Math.pow(Math.sin(t), 3),
    y: R * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
  }
}

export const heartDef: ShapeDefinition = {
  get2DContours(center: Point2D, L: number, W: number): ContourSegment[] {
    const R = Math.max(L, W) / 16 // 归一化，使心形 ≈ L 宽
    const segs = 8
    const pts: PolylineVertex[] = []

    for (let i = 0; i < segs; i++) {
      const t1 = (i / segs) * Math.PI * 2
      const t2 = ((i + 1) / segs) * Math.PI * 2
      const tmid = (t1 + t2) / 2

      const p1 = heartPoint(t1, R)
      const p2 = heartPoint(t2, R)
      const pmid = heartPoint(tmid, R)

      pts.push({
        point: { X: center.X + p1.x, Y: center.Y + p1.y },
        bulge: threePointBulge(p1, p2, pmid),
      })
    }
    return polylineVerticesToSegments(pts)
  },

  getProfileVertices(_Rradius: number, L: number, W: number): ProfileVertex[] {
    // 心形 3D 轮廓：用参数方程采样
    const R = Math.max(L, W) / 16
    const N = 32
    const verts: ProfileVertex[] = []
    // 心形在 XZ 平面：Z 对应原来 Y
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2
      const p = heartPoint(t, R)
      verts.push({ x: p.x, z: p.y })
    }
    return verts
  },
}
