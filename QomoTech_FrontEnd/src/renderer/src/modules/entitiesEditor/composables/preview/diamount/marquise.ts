// =============================================================================
// diamount/marquise.ts — 马眼形 (Marquise Cut)
// 轮廓：4 段弧组成的两头尖船形。
// =============================================================================

import type { PolylineVertex, Point2D } from '../../../commons/types'
import type { ProfileVertex, ShapeDefinition } from './types'

/** 弧段数（每段弧对应一个四分之一马眼） */
const ARC_SEGS = 4
/** 马眼弧的 bulge = tan(半段弧角/4) */
const MARQUISE_BULGE = Math.tan((Math.PI / 2) / 4) // ≈ 0.4142

export const marquiseDef: ShapeDefinition = {
  get2DContours(center: Point2D, L: number, W: number): PolylineVertex[][] {
    // 4 段弧的端点（XZ 平面，X=长轴，Z=短轴）
    // 右尖(L,0) → 上拱(0,W) → 左尖(-L,0) → 下拱(0,-W) → 右尖
    return [[
      { point: { X: center.X + L, Y: center.Y },       bulge: MARQUISE_BULGE },
      { point: { X: center.X,     Y: center.Y + W },    bulge: MARQUISE_BULGE },
      { point: { X: center.X - L, Y: center.Y },       bulge: MARQUISE_BULGE },
      { point: { X: center.X,     Y: center.Y - W },    bulge: MARQUISE_BULGE },
    ]]
  },

  getProfileVertices(R: number, L: number, W: number): ProfileVertex[] {
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
