// =============================================================================
// diamount/oval.ts — 椭圆形 (Oval Cut)
// 2D：8 段椭圆弧近似（三点圆弧拟合）
// 3D：椭圆参数方程直接采样
// =============================================================================

import type { PolylineVertex, Point2D } from '../../../commons/types'
import type { ProfileVertex, ShapeDefinition } from './types'

/** 三点确定圆弧的 bulge 值 */
function threePointBulge(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  pmid: { x: number; y: number },
): number {
  const { x: ax, y: ay } = p1
  const { x: bx, y: by } = p2
  const { x: cx, y: cy } = pmid

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(d) < 1e-10) return 0 // 三点共线
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d

  let sweep = Math.atan2(by - uy, bx - ux) - Math.atan2(ay - uy, ax - ux)
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  while (sweep < -Math.PI) sweep += 2 * Math.PI
  return Math.tan(sweep / 4)
}

export const ovalDef: ShapeDefinition = {
  get2DContours(center: Point2D, L: number, W: number): PolylineVertex[][] {
    const segs = 8 // 8 段椭圆弧
    const pts: PolylineVertex[] = []

    for (let i = 0; i < segs; i++) {
      const θ1 = (i / segs) * Math.PI * 2
      const θ2 = ((i + 1) / segs) * Math.PI * 2
      const midθ = (θ1 + θ2) / 2

      const p1 = { x: L * Math.cos(θ1), y: W * Math.sin(θ1) }
      const p2 = { x: L * Math.cos(θ2), y: W * Math.sin(θ2) }
      const pmid = { x: L * Math.cos(midθ), y: W * Math.sin(midθ) }

      pts.push({
        point: { X: center.X + p1.x, Y: center.Y + p1.y },
        bulge: threePointBulge(p1, p2, pmid),
      })
    }
    return [pts]
  },

  getProfileVertices(R: number, L: number, W: number): ProfileVertex[] {
    // 直接用椭圆方程采样 32 点
    const N = 32
    const verts: ProfileVertex[] = []
    for (let i = 0; i < N; i++) {
      const θ = (i / N) * Math.PI * 2
      verts.push({ x: L * Math.cos(θ), z: W * Math.sin(θ) })
    }
    return verts
  },
}
