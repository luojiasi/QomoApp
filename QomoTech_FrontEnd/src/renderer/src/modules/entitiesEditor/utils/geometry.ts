// =============================================================================
// 纯几何工具函数
// 所有函数无副作用，不依赖 store / 组件
// =============================================================================

import type { ArcEntity, BaseEntity, BezierEntity, BoundingBox, EditorEntity, LineEntity, Point2D, Point3D } from "@/modules/entitiesEditor/commons/types"

// ============ 坐标转换 ============

export function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): Point2D {
  const rad = (angleDeg * Math.PI) / 180
  return { X: cx + radius * Math.cos(rad), Y: cy + radius * Math.sin(rad) }
}

export function cartesianToPolar(cx: number, cy: number, px: number, py: number): { radius: number; angleDeg: number } {
  const dx = px - cx
  const dy = py - cy
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI
  return { radius: Math.sqrt(dx * dx + dy * dy), angleDeg: angleDeg < 0 ? angleDeg + 360 : angleDeg }
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { X: (a.X + b.X) / 2, Y: (a.Y + b.Y) / 2 }
}

export function distance(a: Point2D, b: Point2D): number {
  const dx = a.X - b.X
  const dy = a.Y - b.Y
  return Math.sqrt(dx * dx + dy * dy)
}

// ============ 边界计算 ============

export function boundsFromPoints(points: Point2D[]): BoundingBox {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.X < minX) minX = p.X
    if (p.Y < minY) minY = p.Y
    if (p.X > maxX) maxX = p.X
    if (p.Y > maxY) maxY = p.Y
  }
  return { minX, minY, maxX, maxY }
}

export function mergeBounds(a: BoundingBox, b: BoundingBox): BoundingBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

export function getEntityBounds(entity: EditorEntity): BoundingBox {
  switch (entity.kind) {
    case 'LINE':
      return boundsFromPoints([entity.start, entity.end])
    case 'ARC': {
      const s = polarToCartesian(entity.center.X, entity.center.Y, entity.radius, entity.startAngleDeg)
      const e = polarToCartesian(entity.center.X, entity.center.Y, entity.radius, entity.endAngleDeg)
      return boundsFromPoints([entity.center, s, e])
    }
    case 'BEZIER':
      return boundsFromPoints(entity.controlPoints)
  }
}

export function getSceneBounds(entities: EditorEntity[]): BoundingBox {
  if (entities.length === 0) return { minX: -100, minY: -100, maxX: 100, maxY: 100 }
  let result = getEntityBounds(entities[0])
  for (let i = 1; i < entities.length; i++) {
    result = mergeBounds(result, getEntityBounds(entities[i]))
  }
  return result
}

// ============ 变换 ============

export function translateEntity<T extends BaseEntity>(entity: T, dx: number, dy: number): T {
  const translatePoint = (p: Point2D): Point2D => ({ X: p.X + dx, Y: p.Y + dy })
  const clone = { ...entity }
  switch (clone.kind) {
    case 'LINE': {
      const line = clone as unknown as LineEntity
      return { ...line, start: translatePoint(line.start), end: translatePoint(line.end) } as unknown as T
    }
    case 'ARC': {
      const arc = clone as unknown as ArcEntity
      return { ...arc, center: translatePoint(arc.center) } as unknown as T
    }
    case 'BEZIER': {
      const bez = clone as unknown as BezierEntity
      return { ...bez, controlPoints: bez.controlPoints.map(translatePoint) } as unknown as T
    }
  }
  return clone
}

export function recenterEntities(entities: EditorEntity[]): EditorEntity[] {
  const bounds = getSceneBounds(entities)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  return entities.map((e) => translateEntity(e, -cx, -cy))
}

export function projectToCircle(point: Point2D, center: Point2D, radius: number): Point2D {
  const { radius: dist, angleDeg } = cartesianToPolar(center.X, center.Y, point.X, point.Y)
  if (dist === 0) return { X: center.X + radius, Y: center.Y }
  return polarToCartesian(center.X, center.Y, radius, angleDeg)
}

// ============ 采样（★ LOD 段数由调用方传入） ============

export function sampleArcPoints(center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number, segments: number): Point2D[] {
  const points: Point2D[] = []
  const sweep = endAngleDeg - startAngleDeg
  for (let i = 0; i <= segments; i++) {
    const angle = startAngleDeg + (sweep * i) / segments
    points.push(polarToCartesian(center.X, center.Y, radius, angle))
  }
  return points
}

export function sampleBezierPoints(controlPoints: Point2D[], segments: number): Point2D[] {
  if (controlPoints.length < 2) return controlPoints
  const points: Point2D[] = []
  const n = controlPoints.length - 1
  const binomials = precomputeBinomials(n)
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    let X = 0, Y = 0
    for (let j = 0; j <= n; j++) {
      const coeff = binomials[j] * Math.pow(1 - t, n - j) * Math.pow(t, j)
      X += coeff * controlPoints[j].X
      Y += coeff * controlPoints[j].Y
    }
    points.push({ X, Y })
  }
  return points
}

function precomputeBinomials(n: number): number[] {
  const result = [1]
  for (let k = 1; k <= n; k++) {
    result.push((result[k - 1] * (n - k + 1)) / k)
  }
  return result
}

// ============ 法向偏移 ============

export function offsetSegment(a: Point2D, b: Point2D, offset: number): { start: Point2D; end: Point2D } {
  const dx = b.X - a.X
  const dy = b.Y - a.Y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return { start: { ...a }, end: { ...b } }
  const nx = -dy / len * offset
  const ny = dx / len * offset
  return {
    start: { X: a.X + nx, Y: a.Y + ny },
    end: { X: b.X + nx, Y: b.Y + ny },
  }
}

export function offsetPolyline(points: Point2D[], offset: number): Point2D[] {
  if (points.length < 2) return points
  return points.map((p, i) => {
    if (i < points.length - 1) {
      const seg = offsetSegment(p, points[i + 1], offset)
      return seg.start
    }
    const seg = offsetSegment(points[i - 1], p, offset)
    return seg.end
  })
}

// ============ 三角剖分（★ 供 3D 合并几何体用） ============

export interface TriangleStripData {
  positions: Float32Array
  indices: Uint32Array
}

/** 沿采样线两侧挤出成三角形带 */
export function triangulateLineStrip(strip: Point2D[], innerStrip: Point2D[], height: number): TriangleStripData {
  const n = strip.length
  const positions: number[] = []
  // 底面上顶点 + 底面下顶点 + 顶面上顶点 + 顶面下顶点
  for (let i = 0; i < n; i++) {
    const top = strip[i]
    const bot = innerStrip[i]
    // z=0 (底面)
    positions.push(top.X, top.Y, 0, bot.X, bot.Y, 0)
    // z=height (顶面)
    positions.push(top.X, top.Y, height, bot.X, bot.Y, height)
  }

  const indices: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const b0 = i * 4 // 底面: top0, bot0
    const b1 = (i + 1) * 4
    const t0 = b0 + 2 // 顶面: top0, bot0
    const t1 = b1 + 2

    // 外侧面 (沿 strip — top edge)
    addQuad(indices, b0, b1, t1, t0)
    // 内侧面 (沿 innerStrip — bottom edge)
    addQuad(indices, b0 + 1, b1 + 1, t1 + 1, t0 + 1)
    // 顶面四边形
    addQuad(indices, t0, t1, t1 + 1, t0 + 1)
    // 底面四边形
    addQuad(indices, b0 + 1, b1 + 1, b1, b0)
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) }
}

export function triangulateArcStrip(
  center: Point2D,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  openSize: number,
  height: number,
  segments: number,
): TriangleStripData {
  const strip = sampleArcPoints(center, radius, startAngleDeg, endAngleDeg, segments)
  const innerR = Math.max(0, radius - openSize)
  const innerStrip = sampleArcPoints(center, innerR, startAngleDeg, endAngleDeg, segments)
  return triangulateLineStrip(strip, innerStrip, height)
}

export function triangulateBezierStrip(
  controlPoints: Point2D[],
  openSize: number,
  height: number,
  segments: number,
): TriangleStripData {
  const strip = sampleBezierPoints(controlPoints, segments)
  const innerStrip = offsetPolyline(strip, -openSize)
  return triangulateLineStrip(strip, innerStrip, height)
}

// ============ 辅助 ============

function addQuad(indices: number[], a: number, b: number, c: number, d: number): void {
  indices.push(a, b, c, a, c, d)
}
