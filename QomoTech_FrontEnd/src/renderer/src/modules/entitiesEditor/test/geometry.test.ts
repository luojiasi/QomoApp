// =============================================================================
// geometry.ts 单元测试 —— 运行：npx tsx geometry.test.ts
// =============================================================================

import * as assert from 'node:assert'
import {
  polarToCartesian,
  cartesianToPolar,
  sampleArcPoints,
  sampleBezierPoints,
  samplePolylineVertices,
  sampleEllipsePoints,
  offsetSegment,
  offsetPolyline,
  computeArcOffsetRadius,
  getEntityBounds,
  getSceneBounds,
  mergeBounds,
  triangulateLineStrip,
  triangulateArcStrip,
  triangulateBezierStrip,
  triangulatePolylineStrip,
  type TriangulatedStrip
} from '../utils/geometry'

import type {
  Point2D,
  LineEntity,
  ArcEntity,
  CircleEntity,
  EllipseEntity,
  PolylineEntity,
  BezierEntity,
  PolylineVertex,
  EditorEntity,
  BoundingBox
} from '../commons/types'

// =============================================================================
// 测试辅助
// =============================================================================

let passed = 0
let failed = 0
const failures: string[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
  } catch (e) {
    failed++
    const msg = `  FAIL: ${name}\n        ${(e as Error).message}`
    failures.push(msg)
    console.error(msg)
  }
}

function assertNear(a: number, b: number, eps = 1e-9, label = '') {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(`${label} got ${a}, expected ${b} (non-finite)`)
  }
  if (Math.abs(a - b) > eps) {
    throw new Error(`${label} expected ${b}, got ${a} (diff ${Math.abs(a - b)})`)
  }
}

function assertPointNear(a: Point2D, b: Point2D, eps = 1e-9, label = '') {
  assertNear(a.X, b.X, eps, `${label}.X`)
  assertNear(a.Y, b.Y, eps, `${label}.Y`)
}

function assertGt(a: number, b: number, label = '') {
  if (!(a > b)) throw new Error(`${label} expected ${a} > ${b}`)
}

function assertLt(a: number, b: number, label = '') {
  if (!(a < b)) throw new Error(`${label} expected ${a} < ${b}`)
}

// =============================================================================
// 构建测试实体工厂
// =============================================================================

function makeLine(x1: number, y1: number, x2: number, y2: number, openSide: 'LEFT' | 'RIGHT' = 'RIGHT'): LineEntity {
  return { id: 'ln', kind: 'LINE', layerId: 'L1', openSide, start: { X: x1, Y: y1 }, end: { X: x2, Y: y2 } }
}

function makeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number, openSide: 'LEFT' | 'RIGHT' = 'RIGHT'): ArcEntity {
  return { id: 'ar', kind: 'ARC', layerId: 'L1', openSide, center: { X: cx, Y: cy }, radius: r, startAngle: startDeg, endAngle: endDeg }
}

function makeCircle(cx: number, cy: number, r: number): CircleEntity {
  return { id: 'ci', kind: 'CIRCLE', layerId: 'L1', openSide: 'RIGHT', center: { X: cx, Y: cy }, radius: r }
}

function makeEllipse(cx: number, cy: number, majorX: number, majorY: number, ratio: number, startDeg: number, endDeg: number): EllipseEntity {
  return { id: 'el', kind: 'ELLIPSE', layerId: 'L1', openSide: 'RIGHT', center: { X: cx, Y: cy }, majorAxisEnd: { X: majorX, Y: majorY }, minorAxisRatio: ratio, startParamDeg: startDeg, endParamDeg: endDeg }
}

function makePolyline(vertices: PolylineVertex[], closed: boolean, openSide: 'LEFT' | 'RIGHT' = 'RIGHT'): PolylineEntity {
  return { id: 'pl', kind: 'POLYLINE', layerId: 'L1', openSide, closed, vertices }
}

function makeBezier(cp: Point2D[]): BezierEntity {
  return { id: 'bz', kind: 'BEZIER', layerId: 'L1', openSide: 'RIGHT', controlPoints: cp }
}

function v(x: number, y: number, bulge = 0): PolylineVertex {
  return { point: { X: x, Y: y }, bulge }
}

// =============================================================================
// 坐标转换
// =============================================================================

console.log('\n=== 1. polarToCartesian ===')

test('0° 正东', () => {
  const p = polarToCartesian(0, 0, 10, 0)
  assertPointNear(p, { X: 10, Y: 0 })
})
test('90° 正北', () => {
  const p = polarToCartesian(0, 0, 5, 90)
  assertPointNear(p, { X: 0, Y: 5 })
})
test('180° 正西', () => {
  const p = polarToCartesian(0, 0, 3, 180)
  assertPointNear(p, { X: -3, Y: 0 }, 1e-9)
})
test('270° 正南', () => {
  const p = polarToCartesian(0, 0, 7, 270)
  assertPointNear(p, { X: 0, Y: -7 }, 1e-9)
})
test('45° 对角', () => {
  const p = polarToCartesian(0, 0, Math.SQRT2, 45)
  assertPointNear(p, { X: 1, Y: 1 })
})
test('带偏移中心', () => {
  const p = polarToCartesian(3, 4, 5, 0)
  assertPointNear(p, { X: 8, Y: 4 })
})
test('负角度 -90° → +270° 同义', () => {
  const a = polarToCartesian(0, 0, 10, -90)
  const b = polarToCartesian(0, 0, 10, 270)
  assertPointNear(a, b, 1e-9)
})
test('720° → 等价于 0° (模 360)', () => {
  const a = polarToCartesian(0, 0, 10, 720)
  const b = polarToCartesian(0, 0, 10, 0)
  assertPointNear(a, b, 1e-9)
})
test('半径=0 退回中心', () => {
  const p = polarToCartesian(5, 5, 0, 123)
  assertPointNear(p, { X: 5, Y: 5 })
})
test('负半径 — 行为：按实际 cos/sin 计算', () => {
  const p = polarToCartesian(0, 0, -10, 0)
  assertPointNear(p, { X: -10, Y: 0 })
})
test('极大角度 10^6° — sin/cos 周期不丢精', () => {
  const p = polarToCartesian(0, 0, 10, 1_000_000)
  // 1_000_000 % 360 = 280
  const q = polarToCartesian(0, 0, 10, 280)
  assertPointNear(p, q, 1e-6)
})

console.log('\n=== 2. cartesianToPolar ===')

test('正 X 轴', () => {
  const r = cartesianToPolar(0, 0, 10, 0)
  assertNear(r.radius, 10)
  assertNear(r.angleDeg, 0)
})
test('正 Y 轴', () => {
  const r = cartesianToPolar(0, 0, 0, 10)
  assertNear(r.angleDeg, 90)
})
test('第二象限 (−,+)', () => {
  const r = cartesianToPolar(0, 0, -1, 1)
  assertNear(r.angleDeg, 135)
})
test('第三象限 (−,−)', () => {
  const r = cartesianToPolar(0, 0, -1, -1)
  assertNear(r.angleDeg, -135)
})
test('第四象限 (+,−)', () => {
  const r = cartesianToPolar(0, 0, 1, -1)
  assertNear(r.angleDeg, -45)
})
test('偏移中心', () => {
  const r = cartesianToPolar(3, 4, 3, 9)
  assertNear(r.radius, 5)
  assertNear(r.angleDeg, 90)
})
test('原点 (0,0) → radius=0', () => {
  const r = cartesianToPolar(5, 5, 5, 5)
  assertNear(r.radius, 0)
})
test('往返: polar→cartesian→polar 闭合', () => {
  for (const [cx, cy, radius, angleDeg] of [
    [0, 0, 10, 30],
    [-3, 7, 15, -45],
    [100, -200, 0.5, 400],
    [1, 2, 3, 999]
  ]) {
    const cart = polarToCartesian(cx, cy, radius, angleDeg)
    const back = cartesianToPolar(cx, cy, cart.X, cart.Y)
    assertNear(back.radius, Math.abs(radius), 1e-9, `radius roundtrip ${radius}`)
    // 角度归一化 (0,360] 比较
    const normAngle = ((angleDeg % 360) + 360) % 360
    const normBack = ((back.angleDeg % 360) + 360) % 360
    assertNear(normBack, normAngle, 1e-8, `angle roundtrip ${angleDeg}`)
  }
})

// =============================================================================
// 弧段采样
// =============================================================================

console.log('\n=== 3. sampleArcPoints ===')

test('整圆 0→360 首尾重合', () => {
  const pts = sampleArcPoints({ X: 0, Y: 0 }, 10, 0, 360, 36)
  assertNear(pts[0].X, 10)
  assertNear(pts[0].Y, 0)
  assertNear(pts[pts.length - 1].X, 10)
  assertNear(pts[pts.length - 1].Y, 0)
})
test('整圆所有点到圆心距离=半径', () => {
  const pts = sampleArcPoints({ X: 3, Y: 4 }, 5, 0, 360, 48)
  for (const p of pts) {
    assertNear(Math.hypot(p.X - 3, p.Y - 4), 5)
  }
})
test('弧段点数 = segments+1', () => {
  assert.strictEqual(sampleArcPoints({ X: 0, Y: 0 }, 5, 0, 90, 9).length, 10)
  assert.strictEqual(sampleArcPoints({ X: 0, Y: 0 }, 5, 0, 90, 1).length, 2)
})
test('sweep>360 自动归一化', () => {
  // 0→400 → 等价于 0→40
  const pts = sampleArcPoints({ X: 0, Y: 0 }, 10, 0, 400, 24)
  assertNear(pts[pts.length - 1].X, polarToCartesian(0, 0, 10, 40).X, 1e-6)
  assertNear(pts[pts.length - 1].Y, polarToCartesian(0, 0, 10, 40).Y, 1e-6)
})
test('sweep<=−360 自动归一化', () => {
  // 0→−400 → 等价于 0→−40
  const pts = sampleArcPoints({ X: 0, Y: 0 }, 10, 0, -400, 24)
  assertNear(pts[pts.length - 1].X, polarToCartesian(0, 0, 10, -40).X, 1e-6)
  assertNear(pts[pts.length - 1].Y, polarToCartesian(0, 0, 10, -40).Y, 1e-6)
})
test('sweep≈0 补齐为 ±360', () => {
  const ptsPos = sampleArcPoints({ X: 0, Y: 0 }, 10, 45, 45, 36)
  assert.strictEqual(ptsPos.length, 37) // 整圆
  // 首尾应重合
  assertPointNear(ptsPos[0], ptsPos[ptsPos.length - 1], 1e-9)
})
test('CW 弧（end<start）点正确', () => {
  const pts = sampleArcPoints({ X: 0, Y: 0 }, 10, 90, 0, 18)
  // 终点在 (10,0), 起点在 (0,10)
  assertPointNear(pts[0], { X: 0, Y: 10 }, 1e-9)
  assertPointNear(pts[pts.length - 1], { X: 10, Y: 0 }, 1e-9)
})
test('负角度弧段', () => {
  const pts = sampleArcPoints({ X: 0, Y: 0 }, 10, -90, 0, 24)
  assertPointNear(pts[0], { X: 0, Y: -10 }, 1e-9)
  assertPointNear(pts[pts.length - 1], { X: 10, Y: 0 }, 1e-9)
})
test('偏置中心+CCW小弧', () => {
  const pts = sampleArcPoints({ X: 7, Y: -3 }, 4, 30, 120, 24)
  for (const p of pts) {
    assertNear(Math.hypot(p.X - 7, p.Y + 3), 4)
  }
})

// =============================================================================
// 贝塞尔采样
// =============================================================================

console.log('\n=== 4. sampleBezierPoints ===')

test('空控制点 → []', () => {
  assert.strictEqual(sampleBezierPoints([], 10).length, 0)
})
test('单控制点 → 复制自身', () => {
  const pts = sampleBezierPoints([{ X: 5, Y: 7 }], 10)
  assert.strictEqual(pts.length, 1)
  assertPointNear(pts[0], { X: 5, Y: 7 })
})
test('两点 → 直线均匀采样', () => {
  const pts = sampleBezierPoints([{ X: 0, Y: 0 }, { X: 10, Y: 20 }], 8)
  for (const p of pts) assertNear(p.X * 2, p.Y)
})
test('起点=CP[0]，终点=CP[N-1]', () => {
  const cp = [{ X: 0, Y: 0 }, { X: 3, Y: 8 }, { X: 7, Y: -2 }, { X: 10, Y: 10 }]
  const pts = sampleBezierPoints(cp, 16)
  assertPointNear(pts[0], cp[0])
  assertPointNear(pts[pts.length - 1], cp[cp.length - 1])
})
test('点数 = segments+1', () => {
  assert.strictEqual(sampleBezierPoints([{ X: 0, Y: 0 }, { X: 10, Y: 10 }], 4).length, 5)
})
test('5阶贝塞尔（6个CP）不出错', () => {
  const cp = [{ X: 0, Y: 0 }, { X: 2, Y: 6 }, { X: 4, Y: -4 }, { X: 6, Y: 8 }, { X: 8, Y: -2 }, { X: 10, Y: 10 }]
  const pts = sampleBezierPoints(cp, 32)
  assertPointNear(pts[0], cp[0])
  assertPointNear(pts[pts.length - 1], cp[cp.length - 1])
})
test('共线控制点 — 曲线退化为直线', () => {
  const cp = [{ X: 0, Y: 0 }, { X: 2, Y: 2 }, { X: 5, Y: 5 }, { X: 10, Y: 10 }]
  const pts = sampleBezierPoints(cp, 16)
  for (const p of pts) assertNear(p.X, p.Y, 1e-9)
})
test('t=0.5 应在凸包内', () => {
  const cp = [{ X: 0, Y: 0 }, { X: 10, Y: 0 }, { X: 0, Y: 10 }]
  const pts = sampleBezierPoints(cp, 2)
  const mid = pts[1]
  assertGt(mid.X, 0)
  assertLt(mid.Y, 10)
})
test('segments=2 最少3点', () => {
  assert.strictEqual(sampleBezierPoints([{ X: 0, Y: 0 }, { X: 10, Y: 0 }], 0).length, 3)
})

// =============================================================================
// Polyline 顶点采样
// =============================================================================

console.log('\n=== 5. samplePolylineVertices ===')

test('直线段矩形 → 4个顶点', () => {
  const pts = samplePolylineVertices([v(0, 0), v(10, 0), v(10, 5), v(0, 5)])
  assert.strictEqual(pts.length, 4)
})
test('半圆 bulge=1', () => {
  const pts = samplePolylineVertices([v(10, 0, 1), v(-10, 0)])
  assertGt(pts.length, 4)
  for (const p of pts) {
    assertNear(Math.hypot(p.X, p.Y), 10, 0.1, `dist from (0,0)`)
  }
})
test('负 bulge=−1 CW半圆', () => {
  const pts = samplePolylineVertices([v(10, 0, -1), v(-10, 0)])
  assertGt(pts.length, 4)
  for (const p of pts) {
    assertNear(Math.hypot(p.X, p.Y), 10, 0.1)
  }
})
test('混合 bulge 0 / 0.5 / 0', () => {
  const verts = [v(0, 0), v(10, 0, 0.5), v(10, 10)]
  const pts = samplePolylineVertices(verts)
  assertGt(pts.length, 3)
  assertPointNear(pts[0], { X: 0, Y: 0 })
  assertPointNear(pts[pts.length - 1], { X: 10, Y: 10 })
})
test('单顶点 → 返回自身', () => {
  const pts = samplePolylineVertices([v(5, 5)])
  assert.strictEqual(pts.length, 1)
  assertPointNear(pts[0], { X: 5, Y: 5 })
})
test('零长弦 bulge≠0 不崩', () => {
  const pts = samplePolylineVertices([v(0, 0, 0.5), v(0, 0), v(10, 0)])
  assertGt(pts.length, 0)
})
test('bulge=tan(22.5°)≈0.414 → 90°弧', () => {
  // sweep=90°, bulge=tan(90°/4)=tan(22.5°)≈0.4142
  const bulge90 = Math.tan((90 * Math.PI) / 180 / 4)
  const pts = samplePolylineVertices([v(10, 0, bulge90), v(0, 10)])
  for (const p of pts) {
    assertNear(Math.hypot(p.X, p.Y), 10, 0.1)
  }
})
test('闭合 polyline 首段与末段衔接', () => {
  const verts = [v(0, 0), v(10, 0), v(10, 10), v(0, 10)]
  const pts = samplePolylineVertices(verts)
  // 应包含起点和终点同位置
  assertPointNear(pts[0], { X: 0, Y: 0 })
})
test('超大 bulge=10', () => {
  // tan(sweep/4)=10, sweep≈4*atan(10)≈4*1.471≈5.88 rad≈337°
  const pts = samplePolylineVertices([v(10, 0, 10), v(-10, 0)])
  assertGt(pts.length, 10)
})

// =============================================================================
// 椭圆采样
// =============================================================================

console.log('\n=== 6. sampleEllipsePoints ===')

test('ratio=1 等价于圆', () => {
  const pts = sampleEllipsePoints({ X: 0, Y: 0 }, { X: 10, Y: 0 }, 1, 0, 360, 36)
  for (const p of pts) assertNear(Math.hypot(p.X, p.Y), 10, 0.05)
})
test('ratio=0.5 半高椭圆 — 上下边界=±5', () => {
  const pts = sampleEllipsePoints({ X: 0, Y: 0 }, { X: 10, Y: 0 }, 0.5, 0, 360, 48)
  let maxY = -Infinity, minY = Infinity
  for (const p of pts) { if (p.Y > maxY) maxY = p.Y; if (p.Y < minY) minY = p.Y }
  assertNear(maxY, 5, 0.2)
  assertNear(minY, -5, 0.2)
})
test('旋转 90° — 长轴指向 +Y', () => {
  const pts = sampleEllipsePoints({ X: 0, Y: 0 }, { X: 0, Y: 10 }, 0.5, 0, 360, 48)
  let maxX = -Infinity, maxY = -Infinity
  for (const p of pts) { if (p.X > maxX) maxX = p.X; if (p.Y > maxY) maxY = p.Y }
  assertNear(maxX, 5, 0.2)   // 短半轴=5
  assertNear(maxY, 10, 0.2)   // 长半轴=10
})
test('ratio>1 (0.5 反过来)', () => {
  const pts = sampleEllipsePoints({ X: 0, Y: 0 }, { X: 5, Y: 0 }, 2, 0, 360, 48)
  // 长轴=5(沿X), 短轴=10(沿Y)... 不, majorR=5, minorR=5*2=10
  let maxY = -Infinity
  for (const p of pts) { if (p.Y > maxY) maxY = p.Y }
  assertNear(maxY, 10, 0.3)
})
test('部分弧 30→210° 起点终点正确', () => {
  const pts = sampleEllipsePoints({ X: 0, Y: 0 }, { X: 10, Y: 0 }, 1, 30, 210, 24)
  const start = polarToCartesian(0, 0, 10, 30)
  const end = polarToCartesian(0, 0, 10, 210)
  assertPointNear(pts[0], start, 0.1)
  assertPointNear(pts[pts.length - 1], end, 0.1)
})
test('sweep>360 归一化', () => {
  const pts360 = sampleEllipsePoints({ X: 0, Y: 0 }, { X: 10, Y: 0 }, 1, 0, 360, 36)
  const pts400 = sampleEllipsePoints({ X: 0, Y: 0 }, { X: 10, Y: 0 }, 1, 0, 400, 36)
  // 400→40 归一化后点数相同，终点不同
  assert.strictEqual(pts360.length, pts400.length)
})
test('majorRadius≈0 退回中心', () => {
  const pts = sampleEllipsePoints({ X: 3, Y: 5 }, { X: 0, Y: 0 }, 0.5, 0, 360, 10)
  assert.strictEqual(pts.length, 1)
  assertPointNear(pts[0], { X: 3, Y: 5 })
})
test('旋转 −30° (CW)', () => {
  const r = -30 * Math.PI / 180
  const majorX = 8 * Math.cos(r), majorY = 8 * Math.sin(r)
  const pts = sampleEllipsePoints({ X: 0, Y: 0 }, { X: majorX, Y: majorY }, 0.5, 0, 360, 48)
  let maxY = -Infinity, minY = Infinity
  for (const p of pts) { if (p.Y > maxY) maxY = p.Y; if (p.Y < minY) minY = p.Y }
  // 旋转椭圆 Y 范围 = sqrt(a²sin²θ + b²cos²θ) = sqrt(64*0.25 + 16*0.75) ≈ 5.29
  const expected = Math.hypot(8 * Math.abs(Math.sin(r)), 4 * Math.abs(Math.cos(r)))
  assertNear(maxY, expected, 0.3)
  assertNear(minY, -expected, 0.3)
})

// =============================================================================
// offsetSegment
// =============================================================================

console.log('\n=== 7. offsetSegment ===')

test('水平线 RIGHT → Y轴负向偏移', () => {
  const [s, e] = offsetSegment({ X: 0, Y: 0 }, { X: 10, Y: 0 }, 'RIGHT', 2)
  assertNear(s.Y, -2); assertNear(e.Y, -2)
})
test('水平线 LEFT → Y轴正向偏移', () => {
  const [s, e] = offsetSegment({ X: 0, Y: 0 }, { X: 10, Y: 0 }, 'LEFT', 2)
  assertNear(s.Y, 2); assertNear(e.Y, 2)
})
test('竖直线（向上）LEFT → X轴负向', () => {
  const [s, e] = offsetSegment({ X: 0, Y: 0 }, { X: 0, Y: 10 }, 'LEFT', 3)
  assertNear(s.X, -3); assertNear(e.X, -3)
})
test('竖直线（向上）RIGHT → X轴正向', () => {
  const [s, e] = offsetSegment({ X: 0, Y: 0 }, { X: 0, Y: 10 }, 'RIGHT', 3)
  assertNear(s.X, 3); assertNear(e.X, 3)
})
test('偏移量不改变线段长度', () => {
  const [s, e] = offsetSegment({ X: 0, Y: 0 }, { X: 6, Y: 8 }, 'LEFT', 5)
  assertNear(Math.hypot(e.X - s.X, e.Y - s.Y), 10)
})
test('零长线段不退', () => {
  const [s, e] = offsetSegment({ X: 5, Y: 5 }, { X: 5, Y: 5 }, 'LEFT', 100)
  assertPointNear(s, { X: 5, Y: 5 })
  assertPointNear(e, { X: 5, Y: 5 })
})
test('偏移后每点距原始线的垂直距离 = openSize', () => {
  const start = { X: 1, Y: 2 }, end = { X: 7, Y: 10 }
  const [s] = offsetSegment(start, end, 'LEFT', 4)
  const dx = end.X - start.X, dy = end.Y - start.Y
  const len = Math.hypot(dx, dy)
  const dist = Math.abs((dy * (s.X - start.X) - dx * (s.Y - start.Y)) / len)
  assertNear(dist, 4)
})
test('斜线段 RIGHT+LEFT 对称（往返偏移为0）', () => {
  const start = { X: 3, Y: 1 }, end = { X: 9, Y: 13 }
  const [ls] = offsetSegment(start, end, 'LEFT', 2)
  const [rs] = offsetSegment(start, end, 'RIGHT', 2)
  // 两者应关于原始线对称
  assertNear((ls.X + rs.X) / 2, start.X, 1e-9)
  assertNear((ls.Y + rs.Y) / 2, start.Y, 1e-9)
})

// =============================================================================
// offsetPolyline
// =============================================================================

console.log('\n=== 8. offsetPolyline ===')

test('单段 = offsetSegment', () => {
  const pts = [{ X: 0, Y: 0 }, { X: 10, Y: 0 }]
  const [s, e] = offsetSegment(pts[0], pts[1], 'LEFT', 2)
  const res = offsetPolyline(pts, 'LEFT', 2)
  assertPointNear(res[0], s)
  assertPointNear(res[1], e)
})
test('L形折线中间顶点取平均法向', () => {
  const pts = [{ X: 0, Y: 0 }, { X: 10, Y: 0 }, { X: 10, Y: 10 }]
  const res = offsetPolyline(pts, 'LEFT', Math.SQRT2)
  assertNear(res[1].X, 10 - 1)
  assertNear(res[1].Y, 0 + 1)
})
test('两个点退化为 offsetSegment', () => {
  const pts = [{ X: 2, Y: 3 }, { X: 8, Y: 15 }]
  const res = offsetPolyline(pts, 'RIGHT', 1)
  const [es, ee] = offsetSegment(pts[0], pts[1], 'RIGHT', 1)
  assertPointNear(res[0], es)
  assertPointNear(res[1], ee)
})
test('openSize≈0 返回原样', () => {
  const pts = [{ X: 0, Y: 0 }, { X: 10, Y: 5 }, { X: 20, Y: 8 }]
  const res = offsetPolyline(pts, 'LEFT', 0)
  assert.strictEqual(res.length, 3)
  for (let i = 0; i < 3; i++) assertPointNear(res[i], pts[i])
})
test('含零长段', () => {
  const pts = [{ X: 0, Y: 0 }, { X: 5, Y: 5 }, { X: 5, Y: 5 }, { X: 10, Y: 5 }]
  const res = offsetPolyline(pts, 'LEFT', 2)
  assert.strictEqual(res.length, 4)
})
test('U形折线各段偏移一致', () => {
  const pts = [{ X: 0, Y: 0 }, { X: 10, Y: 0 }, { X: 10, Y: 10 }, { X: 0, Y: 10 }]
  const res = offsetPolyline(pts, 'LEFT', 2)
  assert.strictEqual(res.length, 4)
  // 首点(0,0)向右段，左法向(0,1) → Y偏移+2
  assertNear(res[0].Y, 2, 0.5)
  // 末点(0,10)入段←，左法向(0,−1) → Y偏移−2
  assertNear(res[3].Y, 8, 0.5)
})

// =============================================================================
// computeArcOffsetRadius
// =============================================================================

console.log('\n=== 9. computeArcOffsetRadius ===')

test('CCW(0→180) LEFT → R+openSize', () => {
  assertNear(computeArcOffsetRadius(makeArc(0, 0, 10, 0, 180, 'LEFT'), 'LEFT', 3), 13)
})
test('CCW(0→180) RIGHT → R−openSize', () => {
  assertNear(computeArcOffsetRadius(makeArc(0, 0, 10, 0, 180, 'RIGHT'), 'RIGHT', 3), 7)
})
test('CW(180→0) LEFT → R−openSize', () => {
  assertNear(computeArcOffsetRadius(makeArc(0, 0, 10, 180, 0, 'LEFT'), 'LEFT', 3), 7)
})
test('CW(180→0) RIGHT → R+openSize', () => {
  assertNear(computeArcOffsetRadius(makeArc(0, 0, 10, 180, 0, 'RIGHT'), 'RIGHT', 3), 13)
})
test('sweep=0 整圆 → 补全为+360 (sweep>=0)', () => {
  const r = computeArcOffsetRadius(makeArc(0, 0, 5, 45, 45, 'RIGHT'), 'RIGHT', 2)
  // sweep=0 → sweep>=0 → sweep=+360, orientationSign=+1, RIGHT sign=−1, delta=1*(−1)*2=−2 → R−2=3
  assertNear(r, 3)
})
test('极小半径保护 ≥1e−6', () => {
  const r = computeArcOffsetRadius(makeArc(0, 0, 1, 0, 180, 'RIGHT'), 'RIGHT', 100)
  assertGt(r, 0)
  assert.ok(Number.isFinite(r))
})
test('CCW 小弧(30→60) LEFT', () => {
  assertNear(computeArcOffsetRadius(makeArc(0, 0, 8, 30, 60, 'LEFT'), 'LEFT', 1), 9)
})
test('CW 大弧(350→10) RIGHT', () => {
  const arc = makeArc(0, 0, 6, 350, 10, 'RIGHT')
  const r = computeArcOffsetRadius(arc, 'RIGHT', 2)
  // sweep = 10−350 = −340, orientationSign=−1, RIGHT sign=−1, delta=(−1)*(−1)*2=+2, R+2=8
  assertNear(r, 8)
})

// =============================================================================
// getEntityBounds
// =============================================================================

console.log('\n=== 10. getEntityBounds ===')

test('LINE 左下→右上', () => {
  const bb = getEntityBounds(makeLine(-3, -5, 7, 11))
  assertNear(bb.minX, -3); assertNear(bb.minY, -5)
  assertNear(bb.maxX, 7); assertNear(bb.maxY, 11)
})
test('LINE 右上→左下 (reverse)', () => {
  const bb = getEntityBounds(makeLine(7, 11, -3, -5))
  assertNear(bb.minX, -3); assertNear(bb.minY, -5)
  assertNear(bb.maxX, 7); assertNear(bb.maxY, 11)
})
test('CIRCLE 不采样直接算', () => {
  const bb = getEntityBounds(makeCircle(5, -2, 3))
  assertNear(bb.minX, 2); assertNear(bb.minY, -5)
  assertNear(bb.maxX, 8); assertNear(bb.maxY, 1)
})
test('ARC 上半圆 0→180', () => {
  const bb = getEntityBounds(makeArc(0, 0, 10, 0, 180))
  assertNear(bb.maxY, 10, 0.5)
  assertNear(bb.minY, 0, 0.1)
  assertNear(bb.minX, -10, 0.5)
  assertNear(bb.maxX, 10, 0.5)
})
test('ELLIPSE 横长椭圆', () => {
  const bb = getEntityBounds(makeEllipse(0, 0, 10, 0, 0.5, 0, 360))
  assertNear(bb.maxX, 10, 0.5); assertNear(bb.minX, -10, 0.5)
  assertNear(bb.maxY, 5, 0.5); assertNear(bb.minY, -5, 0.5)
})
test('POLYLINE 矩形', () => {
  const bb = getEntityBounds(makePolyline([v(0, 0), v(10, 0), v(10, 5), v(0, 5)], true))
  assertNear(bb.minX, 0); assertNear(bb.minY, 0)
  assertNear(bb.maxX, 10); assertNear(bb.maxY, 5)
})
test('BEZIER 曲线在CP凸包内', () => {
  const cp = [{ X: 0, Y: 0 }, { X: 10, Y: 0 }, { X: 0, Y: 10 }]
  const bb = getEntityBounds(makeBezier(cp))
  assert.ok(bb.minX >= 0, `minX ${bb.minX} >= 0`)
  assert.ok(bb.minY >= 0, `minY ${bb.minY} >= 0`)
  assert.ok(bb.maxX <= 10, `maxX ${bb.maxX} <= 10`)
  assert.ok(bb.maxY <= 10, `maxY ${bb.maxY} <= 10`)
})
test('LINE 水平/垂直', () => {
  const bbH = getEntityBounds(makeLine(0, 5, 20, 5))
  assertNear(bbH.minY, 5); assertNear(bbH.maxY, 5)
  const bbV = getEntityBounds(makeLine(3, 0, 3, 15))
  assertNear(bbV.minX, 3); assertNear(bbV.maxX, 3)
})
test('ARC 负坐标', () => {
  const bb = getEntityBounds(makeArc(-10, -10, 5, 0, 360))
  assertNear(bb.minX, -15); assertNear(bb.minY, -15)
  assertNear(bb.maxX, -5); assertNear(bb.maxY, -5)
})

// =============================================================================
// mergeBounds + getSceneBounds
// =============================================================================

console.log('\n=== 11. mergeBounds / getSceneBounds ===')

test('mergeBounds 重叠', () => {
  const m = mergeBounds(
    { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    { minX: 5, minY: -5, maxX: 15, maxY: 5 }
  )
  assertNear(m.minX, 0); assertNear(m.minY, -5)
  assertNear(m.maxX, 15); assertNear(m.maxY, 10)
})
test('mergeBounds 包含', () => {
  const outer: BoundingBox = { minX: -10, minY: -10, maxX: 10, maxY: 10 }
  const inner: BoundingBox = { minX: -3, minY: -2, maxX: 3, maxY: 2 }
  const m = mergeBounds(outer, inner)
  assertNear(m.minX, -10); assertNear(m.maxX, 10)
})
test('mergeBounds 不相交', () => {
  const a: BoundingBox = { minX: 0, minY: 0, maxX: 5, maxY: 5 }
  const b: BoundingBox = { minX: 10, minY: 10, maxX: 15, maxY: 15 }
  const m = mergeBounds(a, b)
  assertNear(m.minX, 0); assertNear(m.maxX, 15)
  assertNear(m.minY, 0); assertNear(m.maxY, 15)
})
test('mergeBounds Infinity 取值自另一端', () => {
  const real: BoundingBox = { minX: 1, minY: 2, maxX: 3, maxY: 4 }
  const inf: BoundingBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  const m = mergeBounds(real, inf)
  assertNear(m.minX, 1); assertNear(m.minY, 2)
  assertNear(m.maxX, 3); assertNear(m.maxY, 4)
})
test('getSceneBounds 空数组 → 原点', () => {
  const bb = getSceneBounds([])
  assertNear(bb.minX, 0); assertNear(bb.minY, 0)
  assertNear(bb.maxX, 0); assertNear(bb.maxY, 0)
})
test('getSceneBounds 单实体', () => {
  const bb = getSceneBounds([makeCircle(0, 0, 10)])
  assertNear(bb.minX, -10); assertNear(bb.maxX, 10)
})
test('getSceneBounds 多实体混合', () => {
  const entities: EditorEntity[] = [
    makeLine(0, 0, 10, 0),
    makeCircle(30, 0, 5),
    makeArc(-20, 5, 3, 0, 180)
  ]
  const bb = getSceneBounds(entities)
  assertLt(bb.minX, -20)
  assertGt(bb.maxX, 30)
})

// =============================================================================
// 综合场景 / 往返验证
// =============================================================================

console.log('\n=== 12. 综合 / 往返 ===')

test('offsetSegment 往返 (LEFT+等距RIGHT回到原位)', () => {
  const s = { X: 1, Y: 3 }, e = { X: 11, Y: 7 }
  const [ls, le] = offsetSegment(s, e, 'LEFT', 4)
  const [bs, be] = offsetSegment(ls, le, 'RIGHT', 4)
  assertPointNear(bs, s, 1e-9)
  assertPointNear(be, e, 1e-9)
})
test('sampleArcPoints 往返: 端点 → cartesianToPolar 验证', () => {
  const center = { X: 2, Y: -3 }
  const pts = sampleArcPoints(center, 7, 45, 180, 24)
  const p0 = cartesianToPolar(center.X, center.Y, pts[0].X, pts[0].Y)
  assertNear(p0.angleDeg, 45, 1e-9)
  const pEnd = cartesianToPolar(center.X, center.Y, pts[pts.length - 1].X, pts[pts.length - 1].Y)
  assertNear(pEnd.angleDeg, 180, 1e-9)
})
test('包含 bulge 的 polyline 采样后 bounds 收敛', () => {
  const poly = makePolyline([v(-10, 0, 0.5), v(0, 10, -0.3), v(10, 0)], false)
  const bb = getEntityBounds(poly)
  assert.ok(Number.isFinite(bb.minX))
  assert.ok(Number.isFinite(bb.maxX))
  assert.ok(Number.isFinite(bb.minY))
  assert.ok(Number.isFinite(bb.maxY))
  assertGt(bb.maxX, bb.minX)
  assertGt(bb.maxY, bb.minY)
})
test('旋转 37° 椭圆 bounds 包围所有采样点', () => {
  const r37 = 37 * Math.PI / 180
  const mx = 10 * Math.cos(r37), my = 10 * Math.sin(r37)
  const ellipse = makeEllipse(0, 0, mx, my, 0.5, 0, 360)
  const bb = getEntityBounds(ellipse)
  const pts = sampleEllipsePoints({ X: 0, Y: 0 }, { X: mx, Y: my }, 0.5, 0, 360, 64)
  for (const p of pts) {
    assert.ok(p.X >= bb.minX - 1e-9, `pt ${p.X.toFixed(1)},${p.Y.toFixed(1)} >= minX ${bb.minX.toFixed(1)}`)
    assert.ok(p.X <= bb.maxX + 1e-9, `pt X ${p.X.toFixed(1)} <= maxX ${bb.maxX.toFixed(1)}`)
    assert.ok(p.Y >= bb.minY - 1e-9, `pt Y ${p.Y.toFixed(1)} >= minY ${bb.minY.toFixed(1)}`)
    assert.ok(p.Y <= bb.maxY + 1e-9, `pt Y ${p.Y.toFixed(1)} <= maxY ${bb.maxY.toFixed(1)}`)
  }
})
test('大规模场景 bounds 正常', () => {
  const entities: EditorEntity[] = [
    makeCircle(100, 200, 50),
    makeCircle(-300, -100, 30),
    makeLine(-500, 0, 500, 0),
    makeArc(0, -400, 20, 0, 180)
  ]
  const bb = getSceneBounds(entities)
  assert.ok(bb.minX <= -500, `minX ${bb.minX} <= -500`)
  assert.ok(bb.minY <= -390, `minY ${bb.minY} <= -390`)
  assert.ok(bb.maxX >= 500, `maxX ${bb.maxX} >= 500`)
  assert.ok(bb.maxY >= 250, `maxY ${bb.maxY} >= 250`)
})

// =============================================================================
// 三角剖分
// =============================================================================

function verifyTriangulated(tri: TriangulatedStrip, label: string) {
  // positions 长度 > 0 且是 3 的倍数（xyz）
  assert.ok(tri.positions.length > 0, `${label}: positions.length=${tri.positions.length} > 0`)
  assert.strictEqual(tri.positions.length % 3, 0, `${label}: positions 是 3 的倍数`)
  // indices 长度 > 0 且是 3 的倍数
  assert.ok(tri.indices.length > 0, `${label}: indices.length=${tri.indices.length} > 0`)
  assert.strictEqual(tri.indices.length % 3, 0, `${label}: indices 是 3 的倍数`)
  // 索引不越界
  const vcount = tri.positions.length / 3
  for (let i = 0; i < tri.indices.length; i++) {
    assert.ok(tri.indices[i] < vcount, `${label}: indices[${i}]=${tri.indices[i]} < ${vcount}`)
  }
  // 有意义的 z 值
  let hasTop = false, hasBot = false
  for (let i = 2; i < tri.positions.length; i += 3) {
    if (tri.positions[i] > 0.1) hasTop = true
    if (tri.positions[i] < 0.1 && tri.positions[i] >= -0.01) hasBot = true
  }
  assert.ok(hasTop, `${label}: 应有 z=height 顶点`)
  assert.ok(hasBot, `${label}: 应有 z=0 顶点`)
}

console.log('\n=== 13. triangulateLineStrip ===')

test('triangulateLineStrip: 基本线段', () => {
  const strip = [{ X: 0, Y: 0 }, { X: 10, Y: 0 }]
  const inner = offsetPolyline(strip, 'LEFT', 2)
  const tri = triangulateLineStrip(strip, inner, 5)
  verifyTriangulated(tri, 'line')
})

test('triangulateLineStrip: positions=2段×4顶点×3分量=24', () => {
  const strip = [{ X: 0, Y: 0 }, { X: 10, Y: 0 }]
  const inner = [{ X: 0, Y: 2 }, { X: 10, Y: 2 }]
  const tri = triangulateLineStrip(strip, inner, 5)
  assert.strictEqual(tri.positions.length, 2 * 12)
})

test('triangulateLineStrip: indices=2段×8三角×3=24', () => {
  const strip = [{ X: 0, Y: 0 }, { X: 10, Y: 0 }, { X: 20, Y: 5 }]
  const inner = offsetPolyline(strip, 'LEFT', 2)
  const tri = triangulateLineStrip(strip, inner, 3)
  assert.strictEqual(tri.indices.length, (strip.length - 1) * 8 * 3)
})

test('triangulateLineStrip: 不足2点返回空', () => {
  const tri = triangulateLineStrip([{ X: 0, Y: 0 }], [{ X: 0, Y: 2 }], 5)
  assert.strictEqual(tri.positions.length, 0)
  assert.strictEqual(tri.indices.length, 0)
})

test('triangulateLineStrip: 不等长取 min', () => {
  const strip = [{ X: 0, Y: 0 }, { X: 10, Y: 0 }]
  const inner = [{ X: 0, Y: 2 }] // 只有1个点
  const tri = triangulateLineStrip(strip, inner, 5)
  assert.strictEqual(tri.positions.length, 0)
})

console.log('\n=== 14. triangulateArcStrip ===')

test('triangulateArcStrip: 半圆弧', () => {
  const tri = triangulateArcStrip({ X: 0, Y: 0 }, 10, 0, 180, 2, 'LEFT', 5, 24)
  verifyTriangulated(tri, 'arc')
})

test('triangulateArcStrip: 整圆', () => {
  const tri = triangulateArcStrip({ X: 5, Y: 5 }, 8, 0, 360, 1, 'RIGHT', 3, 36)
  verifyTriangulated(tri, 'full-circle')
})

test('triangulateArcStrip: CW弧', () => {
  const tri = triangulateArcStrip({ X: 0, Y: 0 }, 10, 90, 0, 2, 'RIGHT', 4, 24)
  verifyTriangulated(tri, 'cw-arc')
})

test('triangulateArcStrip: LEFT扩 RIGHT缩', () => {
  const triL = triangulateArcStrip({ X: 0, Y: 0 }, 10, 0, 180, 2, 'LEFT', 5, 16)
  const triR = triangulateArcStrip({ X: 0, Y: 0 }, 10, 0, 180, 2, 'RIGHT', 5, 16)
  // LEFT 扩大的内圈点距圆心更大
  assertGt(triL.positions.length, 0)
  assertGt(triR.positions.length, 0)
})

console.log('\n=== 15. triangulateBezierStrip ===')

test('triangulateBezierStrip: 三次贝塞尔', () => {
  const cp = [{ X: 0, Y: 0 }, { X: 3, Y: 8 }, { X: 7, Y: -2 }, { X: 10, Y: 10 }]
  const tri = triangulateBezierStrip(cp, 2, 'LEFT', 5, 32)
  verifyTriangulated(tri, 'bezier')
})

test('triangulateBezierStrip: 直线贝塞尔（2 cp）', () => {
  const tri = triangulateBezierStrip([{ X: 0, Y: 0 }, { X: 10, Y: 10 }], 1, 'RIGHT', 3, 8)
  verifyTriangulated(tri, 'bezier-linear')
})

test('triangulateBezierStrip: openSize=0 内外重合', () => {
  const cp = [{ X: 0, Y: 0 }, { X: 5, Y: 5 }, { X: 10, Y: 0 }]
  const tri = triangulateBezierStrip(cp, 0, 'LEFT', 5, 16)
  verifyTriangulated(tri, 'bezier-zero-offset')
})

console.log('\n=== 16. triangulatePolylineStrip ===')

test('triangulatePolylineStrip: 直线 polyline', () => {
  const verts = [v(0, 0), v(10, 0), v(10, 10)]
  const tri = triangulatePolylineStrip(verts, 2, 'LEFT', 5)
  verifyTriangulated(tri, 'polyline-straight')
})

test('triangulatePolylineStrip: 含 bulge 弧段', () => {
  const verts = [v(0, 0), v(10, 0, 0.5), v(10, 10)]
  const tri = triangulatePolylineStrip(verts, 1.5, 'RIGHT', 4)
  verifyTriangulated(tri, 'polyline-bulge')
})

test('triangulatePolylineStrip: 矩形闭合', () => {
  const verts = [v(0, 0), v(10, 0), v(10, 6), v(0, 6)]
  const tri = triangulatePolylineStrip(verts, 2, 'LEFT', 5)
  verifyTriangulated(tri, 'polyline-rect')
})

test('triangulatePolylineStrip: 半圆 polyline', () => {
  const verts = [v(10, 0, 1), v(-10, 0)]
  const tri = triangulatePolylineStrip(verts, 1, 'LEFT', 4)
  verifyTriangulated(tri, 'polyline-semicircle')
})

// =============================================================================
// 结果
// =============================================================================

console.log(`\n${'═'.repeat(50)}`)
console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`)
console.log('═'.repeat(50))

if (failed > 0) {
  console.error(`\n失败详情:`)
  for (const f of failures) console.error(f)
  process.exit(1)
}
