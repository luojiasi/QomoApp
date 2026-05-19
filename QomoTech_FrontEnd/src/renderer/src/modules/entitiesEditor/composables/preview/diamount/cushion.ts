// =============================================================================
// diamount/cushion.ts — 垫形 (Cushion Cut)
// 圆角矩形：4 条直边 + 4 段圆角弧，共 8 顶点。
// =============================================================================

import type { PolylineVertex, Point2D } from '../../../commons/types'
import type { ProfileVertex, ShapeDefinition } from './types'

/** 垫形圆角比例（相对于半径） */
const CORNER_RATIO = 0.25
/** 四分之一圆弧的 bulge = tan(90°/4) = tan(22.5°) */
const BULGE_90 = Math.tan((Math.PI / 2) / 4) // ≈ 0.4142

export const cushionDef: ShapeDefinition = {
  get2DContours(center: Point2D, L: number, W: number): PolylineVertex[][] {
    const R = Math.max(L, W)
    const cr = R * CORNER_RATIO
    const out = (d: number) => d  // 正方向偏移
    const neg = (d: number) => -d // 负方向偏移

    // 顶点顺序：右上 → 左上 → 左下 → 右下（逆时针）
    // 直边 + 圆角弧交替
    return [[
      // 上边（直线段）
      { point: { X: center.X + R - cr, Y: center.Y - R }, bulge: 0 },
      // 左上圆角（圆弧段）
      { point: { X: center.X - R,       Y: center.Y - R + cr }, bulge: BULGE_90 },
      // 左边（直线段）
      { point: { X: center.X - R,       Y: center.Y + R - cr }, bulge: 0 },
      // 左下圆角（圆弧段）
      { point: { X: center.X - R + cr,  Y: center.Y + R }, bulge: BULGE_90 },
      // 下边（直线段）
      { point: { X: center.X + R - cr,  Y: center.Y + R }, bulge: 0 },
      // 右下圆角（圆弧段）
      { point: { X: center.X + R,       Y: center.Y + R - cr }, bulge: BULGE_90 },
      // 右边（直线段）
      { point: { X: center.X + R,       Y: center.Y - R + cr }, bulge: 0 },
      // 右上圆角（圆弧段，回到起点）
      { point: { X: center.X + R - cr,  Y: center.Y - R }, bulge: BULGE_90 },
    ]]
  },

  getProfileVertices(R: number, _L: number, _W: number): ProfileVertex[] {
    // 3D 腰围：在 2D 轮廓上均匀采样 32 点
    // 用参数 t ∈ [0, 1) 沿方形+圆角周长分布
    const N = 32
    const cr = R * CORNER_RATIO
    const sideLen = 2 * R - 2 * cr        // 直线段长度
    const cornerArc = (Math.PI / 2) * cr    // 圆角弧长
    const perimeter = 4 * sideLen + 4 * cornerArc

    const verts: ProfileVertex[] = []
    for (let i = 0; i < N; i++) {
      const t = (i / N) * perimeter
      let accum = 0

      // 上边（直线）
      if (t < sideLen) {
        const p = t / sideLen
        verts.push({ x: R - cr - p * (2 * R - 2 * cr), z: -R })
        continue
      }
      accum += sideLen

      // 左上圆角（90° 弧）
      if (t < accum + cornerArc) {
        const p = (t - accum) / cornerArc
        const a = (Math.PI / 2) * p
        verts.push({ x: -R + cr + cr * Math.cos(a - Math.PI / 2), z: -R + cr + cr * Math.sin(a - Math.PI / 2) })
        continue
      }
      accum += cornerArc

      // 左边（直线）
      if (t < accum + sideLen) {
        const p = (t - accum) / sideLen
        verts.push({ x: -R, z: -R + cr + p * (2 * R - 2 * cr) })
        continue
      }
      accum += sideLen

      // 左下圆角
      if (t < accum + cornerArc) {
        const p = (t - accum) / cornerArc
        const a = (Math.PI / 2) * p
        verts.push({ x: -R + cr + cr * Math.cos(a), z: R - cr + cr * Math.sin(a) })
        continue
      }
      accum += cornerArc

      // 下边（直线）
      if (t < accum + sideLen) {
        const p = (t - accum) / sideLen
        verts.push({ x: -R + cr + p * (2 * R - 2 * cr), z: R })
        continue
      }
      accum += sideLen

      // 右下圆角
      if (t < accum + cornerArc) {
        const p = (t - accum) / cornerArc
        const a = (Math.PI / 2) * p
        verts.push({ x: R - cr + cr * Math.cos(a + Math.PI / 2), z: R - cr + cr * Math.sin(a + Math.PI / 2) })
        continue
      }
      accum += cornerArc

      // 右边（直线）
      const p = (t - accum) / sideLen
      verts.push({ x: R, z: R - cr - p * (2 * R - 2 * cr) })
    }
    return verts
  },
}
