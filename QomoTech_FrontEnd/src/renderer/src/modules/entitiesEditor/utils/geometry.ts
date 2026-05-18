// =============================================================================
// 纯几何工具函数 —— 无 Three.js 依赖
// 核心采样/偏移逻辑提取自 editor/cad/threeGeometry.ts
// =============================================================================

import type {
  Point2D,
  BoundingBox,
  EditorEntity,
  OpenSide,
  ArcEntity,
  PolylineVertex,
} from '../commons/types'

// =============================================================================
// 坐标转换
// =============================================================================

/** 极坐标 → 笛卡尔坐标（角度单位：度） */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): Point2D {
  const rad = (angleDeg * Math.PI) / 180
  return { X: cx + radius * Math.cos(rad), Y: cy + radius * Math.sin(rad) }
}

/** 笛卡尔坐标 → 极坐标（返回角度单位：度） */
export function cartesianToPolar(
  cx: number,
  cy: number,
  px: number,
  py: number
): { radius: number; angleDeg: number } {
  const dx = px - cx
  const dy = py - cy
  return {
    radius: Math.hypot(dx, dy),
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI
  }
}

// =============================================================================
// 采样
// =============================================================================

/** 弧段采样：按段数返回点列（含起点和终点，共 segments+1 点） */
export function sampleArcPoints(
  center: Point2D,
  radius: number,
  startDeg: number,
  endDeg: number,
  segments: number
): Point2D[] {
  let sweep = endDeg - startDeg
  while (sweep > 360) sweep -= 360
  while (sweep <= -360) sweep += 360
  if (Math.abs(sweep) < 1e-9) {
    sweep = sweep >= 0 ? 360 : -360
  }
  const step = sweep / Math.max(segments, 1)
  const points: Point2D[] = []
  for (let i = 0; i <= segments; i++) {
    const angle = startDeg + step * i
    const rad = (angle * Math.PI) / 180
    points.push({
      X: center.X + radius * Math.cos(rad),
      Y: center.Y + radius * Math.sin(rad)
    })
  }
  return points
}

/** De Casteljau 单点求值（递归线性插值） */
function evaluateBezierPoint(controlPoints: Point2D[], t: number): Point2D {
  if (controlPoints.length === 0) return { X: 0, Y: 0 }
  let working = controlPoints.map((p) => ({ ...p }))
  while (working.length > 1) {
    const next: Point2D[] = []
    for (let i = 0; i < working.length - 1; i++) {
      next.push({
        X: working[i].X * (1 - t) + working[i + 1].X * t,
        Y: working[i].Y * (1 - t) + working[i + 1].Y * t
      })
    }
    working = next
  }
  return working[0]
}

/** 贝塞尔曲线采样（De Casteljau 算法，任意阶） */
export function sampleBezierPoints(
  controlPoints: Point2D[],
  segments: number
): Point2D[] {
  const safeSegments = Math.max(2, segments)
  if (controlPoints.length === 0) return []
  if (controlPoints.length === 1) return [{ ...controlPoints[0] }]
  const points: Point2D[] = []
  for (let i = 0; i <= safeSegments; i++) {
    points.push(evaluateBezierPoint(controlPoints, i / safeSegments))
  }
  return points
}

/**
 * Polyline 顶点采样：bulge=0 为直线段，bulge≠0 为弧段
 * DXF bulge 定义：bulge = tan(弧角/4)，正值为逆时针弧
 */
export function samplePolylineVertices(vertices: PolylineVertex[]): Point2D[] {
  if (vertices.length < 2) return vertices.map((v) => ({ ...v.point }))

  const result: Point2D[] = []
  const n = vertices.length

  for (let i = 0; i < n; i++) {
    const curr = vertices[i]
    const next = vertices[(i + 1) % n]
    const bulge = curr.bulge

    if (Math.abs(bulge) < 1e-9) {
      // 直线段 —— 只需加入起点，终点由下段覆盖
      if (result.length === 0 || result[result.length - 1].X !== curr.point.X || result[result.length - 1].Y !== curr.point.Y) {
        result.push({ ...curr.point })
      }
      continue
    }

    // ── 弧段：从 chord + bulge 反推圆心、半径，然后采样 ──
    const p1 = curr.point
    const p2 = next.point
    const chordVecX = p2.X - p1.X
    const chordVecY = p2.Y - p1.Y
    const chordLen = Math.hypot(chordVecX, chordVecY)
    if (chordLen < 1e-9) continue

    const sweepAngle = 4 * Math.atan(bulge)
    const radius = chordLen / (2 * Math.abs(Math.sin(sweepAngle / 2)))

    // 左法向（p1→p2 的左侧）
    const nx = -chordVecY / chordLen
    const ny = chordVecX / chordLen

    // 弦中点到圆心的有符号距离（bulge>0 → 圆心在左，CCW 弧）
    const midToCenter = radius * Math.cos(sweepAngle / 2) * Math.sign(bulge)
    const cx = (p1.X + p2.X) / 2 + nx * midToCenter
    const cy = (p1.Y + p2.Y) / 2 + ny * midToCenter

    const startAngleRad = Math.atan2(p1.Y - cy, p1.X - cx)
    const endAngleRad = Math.atan2(p2.Y - cy, p2.X - cx)

    // 按 bulge 符号确定扫掠方向，保证扫掠角与 bulge 同号
    let sweep = endAngleRad - startAngleRad
    if (bulge > 0) {
      while (sweep < 0) sweep += 2 * Math.PI
    } else {
      while (sweep > 0) sweep -= 2 * Math.PI
    }

    const startDeg = (startAngleRad * 180) / Math.PI
    const endDeg = startDeg + (sweep * 180) / Math.PI

    // 自适应段数：每约 10° 一段，最少 4 段
    const segs = Math.max(4, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 18)))
    const arcPts = sampleArcPoints(
      { X: cx, Y: cy },
      radius,
      startDeg,
      endDeg,
      segs
    )

    // 避免与已加入的上段终点重复
    if (result.length > 0) {
      const last = result[result.length - 1]
      if (Math.abs(last.X - arcPts[0].X) < 1e-9 && Math.abs(last.Y - arcPts[0].Y) < 1e-9) {
        result.pop()
      }
    }
    for (const pt of arcPts) {
      result.push(pt)
    }
  }

  return result
}

/** 椭圆采样：从中心、长轴端点、短轴比例、起止参数角计算点列 */
export function sampleEllipsePoints(
  center: Point2D,
  majorEnd: Point2D,
  ratio: number,
  startDeg: number,
  endDeg: number,
  segments: number
): Point2D[] {
  const majorRadius = Math.hypot(majorEnd.X, majorEnd.Y)
  if (majorRadius < 1e-9) return [center]

  const rot = Math.atan2(majorEnd.Y, majorEnd.X)
  const minorRadius = majorRadius * ratio

  const cosR = Math.cos(rot)
  const sinR = Math.sin(rot)

  let sweep = endDeg - startDeg
  while (sweep > 360) sweep -= 360
  while (sweep <= -360) sweep += 360
  if (Math.abs(sweep) < 1e-9) {
    sweep = sweep >= 0 ? 360 : -360
  }

  const step = sweep / Math.max(segments, 1)
  const points: Point2D[] = []
  for (let i = 0; i <= segments; i++) {
    const tDeg = startDeg + step * i
    const t = (tDeg * Math.PI) / 180
    const ct = Math.cos(t)
    const st = Math.sin(t)
    points.push({
      X: center.X + majorRadius * ct * cosR - minorRadius * st * sinR,
      Y: center.Y + majorRadius * ct * sinR + minorRadius * st * cosR
    })
  }
  return points
}

// =============================================================================
// 偏移
// =============================================================================

/** LEFT → +1, RIGHT → -1 */
function openSideSign(openSide: OpenSide): number {
  return openSide === 'LEFT' ? 1 : -1
}

/**
 * 单线段偏移：沿「起点→终点」前进方向的法向平移
 * LEFT：整体向左法向平移 openSize
 * RIGHT：整体向右法向平移 openSize
 */
export function offsetSegment(
  start: Point2D,
  end: Point2D,
  openSide: OpenSide,
  openSize: number
): [Point2D, Point2D] {
  const dx = end.X - start.X
  const dy = end.Y - start.Y
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return [start, end]

  // 前进方向的左法向 = (-dy, dx) / len
  const rx = -dy / len
  const ry = dx / len
  const sign = openSideSign(openSide)
  const ox = rx * openSize * sign
  const oy = ry * openSize * sign

  return [
    { X: start.X + ox, Y: start.Y + oy },
    { X: end.X + ox, Y: end.Y + oy }
  ]
}

/**
 * 折线等距偏移：每顶点取相邻段法向的平均方向偏移
 * 与 editor/cad/threeGeometry.ts 中 offsetOpenPolylineByOpenDirection 算法一致
 */
export function offsetPolyline(
  points: Point2D[],
  openSide: OpenSide,
  openSize: number
): Point2D[] {
  if (points.length < 2 || openSize < 1e-9) {
    return points.map((p) => ({ ...p }))
  }

  const sign = openSideSign(openSide)

  // 计算每段的单位法向（已乘符号）
  const segmentNormals: ({ X: number; Y: number } | null)[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i]
    const q = points[i + 1]
    const dx = q.X - p.X
    const dy = q.Y - p.Y
    const len = Math.hypot(dx, dy)
    if (len < 1e-9) {
      segmentNormals.push(null)
    } else {
      segmentNormals.push({ X: (-dy / len) * sign, Y: (dx / len) * sign })
    }
  }

  return points.map((p, i) => {
    const candidates = [
      i > 0 ? segmentNormals[i - 1] : null,
      i < segmentNormals.length ? segmentNormals[i] : null
    ].filter((n): n is { X: number; Y: number } => n !== null)

    if (candidates.length === 0) return { ...p }

    // 平均法向
    const avg = candidates.reduce(
      (acc, n) => ({ X: acc.X + n.X, Y: acc.Y + n.Y }),
      { X: 0, Y: 0 }
    )
    const len = Math.hypot(avg.X, avg.Y)

    if (len < 1e-9) {
      const f = candidates[0]
      return { X: p.X + f.X * openSize, Y: p.Y + f.Y * openSize }
    }

    return {
      X: p.X + (avg.X / len) * openSize,
      Y: p.Y + (avg.Y / len) * openSize
    }
  })
}

/** 圆弧偏移半径：考虑弧的扫掠方向与开口侧 */
export function computeArcOffsetRadius(
  entity: ArcEntity,
  openSide: OpenSide,
  openSize: number
): number {
  let sweep = entity.endAngle - entity.startAngle
  if (Math.abs(sweep) < 1e-9) sweep = sweep >= 0 ? 360 : -360
  const orientationSign = sweep >= 0 ? 1 : -1
  const delta = orientationSign * openSideSign(openSide) * openSize
  return Math.max(1e-6, entity.radius + delta)
}

// =============================================================================
// 边界
// =============================================================================

/** 合并两个包围盒 */
export function mergeBounds(a: BoundingBox, b: BoundingBox): BoundingBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  }
}

const EMPTY_BOUNDS: BoundingBox = {
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity
}

/** 点列包围盒 */
function pointsBounds(points: Point2D[]): BoundingBox {
  if (points.length === 0) return { ...EMPTY_BOUNDS }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.X < minX) minX = p.X
    if (p.Y < minY) minY = p.Y
    if (p.X > maxX) maxX = p.X
    if (p.Y > maxY) maxY = p.Y
  }
  return { minX, minY, maxX, maxY }
}

/** 单实体包围盒 */
export function getEntityBounds(entity: EditorEntity): BoundingBox {
  switch (entity.kind) {
    case 'LINE':
      return pointsBounds([entity.start, entity.end])

    case 'ARC':
      return pointsBounds(
        sampleArcPoints(entity.center, entity.radius, entity.startAngle, entity.endAngle, 48)
      )

    case 'CIRCLE':
    case 'DIAMOND':
      return {
        minX: entity.center.X - entity.radius,
        minY: entity.center.Y - entity.radius,
        maxX: entity.center.X + entity.radius,
        maxY: entity.center.Y + entity.radius
      }

    case 'ELLIPSE':
      return pointsBounds(
        sampleEllipsePoints(
          entity.center,
          entity.majorAxisEnd,
          entity.minorAxisRatio,
          entity.startParamDeg,
          entity.endParamDeg,
          64
        )
      )

    case 'POLYLINE':
      return pointsBounds(samplePolylineVertices(entity.vertices))

    case 'BEZIER':
      return pointsBounds(sampleBezierPoints(entity.controlPoints, 64))
  }
}

/** 全部实体包围盒（空集合返回原点） */
export function getSceneBounds(entities: EditorEntity[]): BoundingBox {
  if (entities.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  let result: BoundingBox = { ...EMPTY_BOUNDS }
  for (const e of entities) {
    result = mergeBounds(result, getEntityBounds(e))
  }
  return result
}

// =============================================================================
// 三角剖分（供 3D 挤出可视化）
// =============================================================================

export interface TriangulatedStrip {
  positions: Float32Array
  indices: Uint32Array
}

/**
 * 核心：两条等长点列 → 4面三角形带
 * 面：外侧墙 / 内侧墙 / 顶面 / 底面
 *
 * 顶点布局（每采样点 4 个顶点，每顶点 3 分量 xyz）：
 *   [0] outer_top    (原始点, z=height)
 *   [1] outer_bot    (原始点, z=0)
 *   [2] inner_top    (偏移点, z=height)
 *   [3] inner_bot    (偏移点, z=0)
 */
function triangulateStripPair(
  outer: Point2D[],
  inner: Point2D[],
  height: number
): TriangulatedStrip {
  const N = Math.min(outer.length, inner.length)
  if (N < 2) {
    return { positions: new Float32Array(0), indices: new Uint32Array(0) }
  }

  const positions = new Float32Array(N * 12) // 4 vertices × 3 floats × N
  for (let i = 0; i < N; i++) {
    const b = i * 12
    positions[b + 0] = outer[i].X; positions[b + 1] = outer[i].Y; positions[b + 2] = height
    positions[b + 3] = outer[i].X; positions[b + 4] = outer[i].Y; positions[b + 5] = 0
    positions[b + 6] = inner[i].X; positions[b + 7] = inner[i].Y; positions[b + 8] = height
    positions[b + 9] = inner[i].X; positions[b + 10] = inner[i].Y; positions[b + 11] = 0
  }

  // 每段 8 个三角形（4面 × 2三角），每三角形 3 索引
  const segs = N - 1
  const indices = new Uint32Array(segs * 24)
  for (let i = 0; i < segs; i++) {
    const v0 = i * 4        // 当前段 4 顶点起始
    const v1 = (i + 1) * 4  // 下一段 4 顶点起始
    const t = i * 24        // 三角形索引写入位置

    // 外侧墙（法向朝外，即远离 inner）
    indices[t + 0] = v0 + 0; indices[t + 1] = v1 + 0; indices[t + 2] = v0 + 1
    indices[t + 3] = v1 + 0; indices[t + 4] = v1 + 1; indices[t + 5] = v0 + 1

    // 内侧墙（法向朝内，即朝向 outer）
    indices[t + 6] = v0 + 2; indices[t + 7] = v0 + 3; indices[t + 8] = v1 + 2
    indices[t + 9] = v1 + 2; indices[t + 10] = v0 + 3; indices[t + 11] = v1 + 3

    // 顶面（水平连接 outer→inner，z=height）
    indices[t + 12] = v0 + 0; indices[t + 13] = v1 + 0; indices[t + 14] = v1 + 2
    indices[t + 15] = v0 + 0; indices[t + 16] = v1 + 2; indices[t + 17] = v0 + 2

    // 底面（水平连接 inner→outer，z=0）
    indices[t + 18] = v0 + 1; indices[t + 19] = v0 + 3; indices[t + 20] = v1 + 1
    indices[t + 21] = v1 + 1; indices[t + 22] = v0 + 3; indices[t + 23] = v1 + 3
  }

  return { positions, indices }
}

/** 线段三角剖分 */
export function triangulateLineStrip(
  strip: Point2D[],
  innerStrip: Point2D[],
  height: number
): TriangulatedStrip {
  return triangulateStripPair(strip, innerStrip, height)
}

/** 圆弧三角剖分 */
export function triangulateArcStrip(
  center: Point2D,
  radius: number,
  startDeg: number,
  endDeg: number,
  openSize: number,
  openSide: OpenSide,
  height: number,
  segments: number
): TriangulatedStrip {
  const outer = sampleArcPoints(center, radius, startDeg, endDeg, segments)

  let sweep = endDeg - startDeg
  if (Math.abs(sweep) < 1e-9) sweep = sweep >= 0 ? 360 : -360
  const orientationSign = sweep >= 0 ? 1 : -1
  const delta = orientationSign * openSideSign(openSide) * openSize
  const offsetRadius = Math.max(1e-6, radius + delta)

  const inner = sampleArcPoints(center, offsetRadius, startDeg, endDeg, segments)
  return triangulateStripPair(outer, inner, height)
}

/** 贝塞尔三角剖分 */
export function triangulateBezierStrip(
  controlPoints: Point2D[],
  openSize: number,
  openSide: OpenSide,
  height: number,
  segments: number
): TriangulatedStrip {
  const outer = sampleBezierPoints(controlPoints, segments)
  const inner = offsetPolyline(outer, openSide, openSize)
  return triangulateStripPair(outer, inner, height)
}

/** Polyline 三角剖分（含 bulge 弧段，段数自适应） */
export function triangulatePolylineStrip(
  vertices: PolylineVertex[],
  openSize: number,
  openSide: OpenSide,
  height: number
): TriangulatedStrip {
  const outer = samplePolylineVertices(vertices)
  const inner = offsetPolyline(outer, openSide, openSize)
  return triangulateStripPair(outer, inner, height)
}
