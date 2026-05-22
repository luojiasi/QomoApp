// =============================================================================
// diamount/pear.ts — 水滴形/梨形 (Pear Cut)
// 轮廓：底部大半圆 + 两侧直线汇聚到尖端（顶部）。
// =============================================================================

import type { ContourSegment, Point2D } from '../../../commons/types'
import type { ProfileVertex, ShapeDefinition } from './types'
import { polylineVerticesToSegments } from '../../../utils/geometry'

/** 底部弧段占轮廓的比例弧角度数（从底部向两侧张开） */
const BOTTOM_ARC_DEG = 210

export const pearDef: ShapeDefinition = {
  get2DContours(center: Point2D, L: number, W: number): ContourSegment[] {
    const tipY = center.Y + L                       // 尖端（顶部）
    const botR = W                                   // 底部弧半径
    const botCenterY = center.Y - L * 0.35           // 底部弧圆心 Y

    // 底部弧段：从右切点到左切点，弧角 BOTTOM_ARC_DEG
    const halfArcDeg = BOTTOM_ARC_DEG / 2

    const toRad = (deg: number) => (deg * Math.PI) / 180

    // 切点角度（弧段起始/结束角度）
    const rightAngleDeg = 90 + halfArcDeg  // 右切点角度
    const leftAngleDeg  = 90 - halfArcDeg  // 左切点角度

    // 底部弧的切点
    const rp = {
      X: center.X + botR * Math.cos(toRad(rightAngleDeg)),
      Y: botCenterY + botR * Math.sin(toRad(rightAngleDeg)),
    }
    const lp = {
      X: center.X + botR * Math.cos(toRad(leftAngleDeg)),
      Y: botCenterY + botR * Math.sin(toRad(leftAngleDeg)),
    }

    // 计算底部弧段的 bulge
    // 三点确定圆弧：右切点 → 弧中点 → 左切点
    const arcP1 = { x: rp.X - center.X, y: rp.Y - center.Y }
    const arcP2 = { x: lp.X - center.X, y: lp.Y - center.Y }
    const arcMidAngleDeg = 90
    const arcMid = {
      x: botR * Math.cos(toRad(arcMidAngleDeg)),
      y: botR * Math.sin(toRad(arcMidAngleDeg)),
    }
    const { x: amx, y: amy } = arcMid
    const d = 2 * (arcP1.x * (arcP2.y - amy) + arcP2.x * (amy - arcP1.y) + amx * (arcP1.y - arcP2.y))
    let arcBulge = 0
    if (Math.abs(d) > 1e-10) {
      const ux = ((arcP1.x * arcP1.x + arcP1.y * arcP1.y) * (arcP2.y - amy) + (arcP2.x * arcP2.x + arcP2.y * arcP2.y) * (amy - arcP1.y) + (amx * amx + amy * amy) * (arcP1.y - arcP2.y)) / d
      const uy = ((arcP1.x * arcP1.x + arcP1.y * arcP1.y) * (amx - arcP2.x) + (arcP2.x * arcP2.x + arcP2.y * arcP2.y) * (arcP1.x - amx) + (amx * amx + amy * amy) * (arcP2.x - arcP1.x)) / d
      let sweep = Math.atan2(arcP2.y - uy, arcP2.x - ux) - Math.atan2(arcP1.y - uy, arcP1.x - ux)
      while (sweep > Math.PI) sweep -= 2 * Math.PI
      while (sweep < -Math.PI) sweep += 2 * Math.PI
      arcBulge = Math.tan(sweep / 4)
    }

    const tip = { X: center.X, Y: tipY }

    return polylineVerticesToSegments([
      { point: tip, bulge: 0 },
      { point: rp, bulge: 0 },
      { point: lp, bulge: arcBulge },
      { point: tip, bulge: 0 },
    ])
  },

  getProfileVertices(_R: number, L: number, W: number): ProfileVertex[] {
    // 水滴形参数方程采样 32 点
    const N = 32
    const verts: ProfileVertex[] = []

    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2
      // 参数方程：圆底 + 顶部收缩
      // t ∈ [0, 2π)
      // 底部（t=0→π）：近似半圆
      // 顶部（t=π→2π）：收缩到尖端
      const scale = 1 - 0.5 * Math.abs(Math.cos(t / 2))
      const x = W * Math.sin(t) * scale
      const z = L * (1 - 0.3 * Math.cos(t)) * Math.cos(t * 0.5)
      // 调整使 tip 在正 Z 方向
      verts.push({ x, z })
    }
    return verts
  },
}
