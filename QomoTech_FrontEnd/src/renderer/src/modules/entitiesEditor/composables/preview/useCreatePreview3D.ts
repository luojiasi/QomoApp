// =============================================================================
// useCreatePreview3D — 将 entitiesEditor 实体转为 Three.js 3D 预览对象
//
// 参考 editor/cad/threeGeometry.ts 的几何构造逻辑，使用 entitiesEditor 的
// utils/geometry.ts 中的采样与三角剖分函数，配合共享材质减少 draw call。
//
// 材质分为三层：
//   参考线（底部 2D 轮廓）  → 统一 MeshBasicMaterial，无光照
//   挤出面（竖直墙体）      → 纯色半透明 MeshStandardMaterial（参考 editor/ 旧版 uniform 风格）
//   开口偏移参考线          → 左红右绿半透明线（openSide LEFT=红, RIGHT=绿）
//   顶/底盖（水平封口）     → 固定色 MeshStandardMaterial，半透明
//
// 材质参数由 Scene3DConfig 驱动，通过 applyMaterialConfig() 热更新。
// =============================================================================

import * as THREE from 'three'
import type {
  SurfaceEntity,
  EditorEntity,
  LineEntity,
  ArcEntity,
  CircleEntity,
  EllipseEntity,
  PolylineEntity,
  BezierEntity,
  DiamondParams,
  Point2D,
  OpenSide
} from '../../commons/types'
import {
  sampleArcPoints,
  sampleBezierPoints,
  samplePolylineVertices,
  sampleEllipsePoints,
  offsetPolyline,
  offsetSegment
} from '../../utils/geometry'
import type { Scene3DConfig } from '../../shares/types'
import { getShapeDef } from './diamount'

// ── 材质参数（运行时可变，由 applyMaterialConfig 更新） ───

let _cfg: Scene3DConfig | null = null

// ── 共享材质（复用，避免逐实体创建） ──────────────────────

let _sharedMaterials: ReturnType<typeof createSharedMaterials> | null = null

function createSharedMaterials() {
  const c = _cfg!
  return {
    referenceLine: new THREE.LineBasicMaterial({
      color: c.materialDefaultColor,
      linewidth: 1,
      transparent: true,
      opacity: c.materialReferenceOpacity,
      depthTest: true,
      depthWrite: true
    }),
    selectedLine: new THREE.LineBasicMaterial({
      color: c.materialSelectedColor,
      linewidth: 2,
      transparent: true,
      opacity: c.materialReferenceOpacity,
      depthTest: true,
      depthWrite: true
    }),
    wallFace: new THREE.MeshStandardMaterial({
      color: c.materialWallTopColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: c.materialWallOpacity,
      roughness: 0.72,
      metalness: 0.02,
      depthWrite: false,
      emissive: 0x05050a,
      emissiveIntensity: 0.06
    }),
    selectedWallFace: new THREE.MeshStandardMaterial({
      color: c.materialSelectedColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: c.materialSelectedWallOpacity,
      roughness: 0.62,
      metalness: 0.06,
      depthWrite: false,
      emissive: 0x0a0a12,
      emissiveIntensity: 0.12
    }),
    capFace: new THREE.MeshStandardMaterial({
      color: c.materialCapColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: c.materialCapOpacity,
      roughness: 0.7,
      metalness: 0.05,
      depthWrite: false
    }),
    selectedCapFace: new THREE.MeshStandardMaterial({
      color: c.materialSelectedCapColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: c.materialSelectedCapOpacity,
      roughness: 0.7,
      metalness: 0.05,
      depthWrite: false
    })
  }
}

function getSharedMaterials() {
  if (!_sharedMaterials) _sharedMaterials = createSharedMaterials()
  return _sharedMaterials
}

/**
 * 应用材质配置并重建所有共享材质。
 * 应在场景配置变更时调用，调用后需重建实体 3D 对象。
 */
export function applyMaterialConfig(cfg: Scene3DConfig) {
  if (_sharedMaterials) {
    for (const mat of Object.values(_sharedMaterials)) mat.dispose()
    _sharedMaterials = null
  }
  _cfg = cfg
}

// ── 辅助 ──────────────────────────────────────────────────

function openSideSign(side: OpenSide): number {
  return side === 'LEFT' ? 1 : -1
}

/** 将 Point2D[] 转为墙体 BufferGeometry（纯色半透明，不渐变）。
 * 参考 editor/cad/threeGeometry.ts createReferenceWallFace 的单色风格。
 * @param zBase - 顶面 Z 坐标（默认 0）
 * @param tiltAngleDeg - 倾斜角（度），非 0 时底部顶点沿径向位移
 * @param downward - true 时墙体向下挤出（zBase → zBase-height），自由参数使用
 */
function buildWallGeometry(
  outer: Point2D[],
  inner: Point2D[],
  height: number,
  zBase: number = 0,
  tiltAngleDeg: number = 0,
  downward: boolean = false
): THREE.BufferGeometry | null {
  const N = Math.min(outer.length, inner.length)
  if (N < 2) return null

  const positions = new Float32Array(N * 12)

  const tiltRad = tiltAngleDeg * (Math.PI / 180)
  const shift = height * Math.tan(tiltRad)

  const topZ = downward ? zBase : zBase + height
  const botZ = downward ? zBase - height : zBase

  for (let i = 0; i < N; i++) {
    const b = i * 12

    const outerDist = Math.hypot(outer[i].X, outer[i].Y)
    const innerDist = Math.hypot(inner[i].X, inner[i].Y)

    const outerNX = outerDist > 1e-9 ? outer[i].X / outerDist : 0
    const outerNY = outerDist > 1e-9 ? outer[i].Y / outerDist : 0
    const innerNX = innerDist > 1e-9 ? inner[i].X / innerDist : 0
    const innerNY = innerDist > 1e-9 ? inner[i].Y / innerDist : 0

    // downward 时底部顶点位移（连接下层）；默认时顶部顶点位移
    const outerShiftX = downward ? 0 : outerNX * shift
    const outerShiftY = downward ? 0 : outerNY * shift
    const innerShiftX = downward ? 0 : innerNX * shift
    const innerShiftY = downward ? 0 : innerNY * shift

    const outerBotShiftX = downward ? outerNX * shift : 0
    const outerBotShiftY = downward ? outerNY * shift : 0
    const innerBotShiftX = downward ? innerNX * shift : 0
    const innerBotShiftY = downward ? innerNY * shift : 0

    // outer_top
    positions[b + 0] = outer[i].X + outerShiftX
    positions[b + 1] = outer[i].Y + outerShiftY
    positions[b + 2] = topZ
    // outer_bot
    positions[b + 3] = outer[i].X + outerBotShiftX
    positions[b + 4] = outer[i].Y + outerBotShiftY
    positions[b + 5] = botZ
    // inner_top
    positions[b + 6] = inner[i].X + innerShiftX
    positions[b + 7] = inner[i].Y + innerShiftY
    positions[b + 8] = topZ
    // inner_bot
    positions[b + 9] = inner[i].X + innerBotShiftX
    positions[b + 10] = inner[i].Y + innerBotShiftY
    positions[b + 11] = botZ

  }

  const segs = N - 1
  const indices = new Uint32Array(segs * 24)
  for (let i = 0; i < segs; i++) {
    const v0 = i * 4
    const v1 = (i + 1) * 4
    const t = i * 24

    // 外侧墙
    indices[t + 0] = v0 + 0
    indices[t + 1] = v1 + 0
    indices[t + 2] = v0 + 1
    indices[t + 3] = v1 + 0
    indices[t + 4] = v1 + 1
    indices[t + 5] = v0 + 1
    // 内侧墙
    indices[t + 6] = v0 + 2
    indices[t + 7] = v0 + 3
    indices[t + 8] = v1 + 2
    indices[t + 9] = v1 + 2
    indices[t + 10] = v0 + 3
    indices[t + 11] = v1 + 3
    // 顶面
    indices[t + 12] = v0 + 0
    indices[t + 13] = v1 + 0
    indices[t + 14] = v1 + 2
    indices[t + 15] = v0 + 0
    indices[t + 16] = v1 + 2
    indices[t + 17] = v0 + 2
    // 底面
    indices[t + 18] = v0 + 1
    indices[t + 19] = v0 + 3
    indices[t + 20] = v1 + 1
    indices[t + 21] = v1 + 1
    indices[t + 22] = v0 + 3
    indices[t + 23] = v1 + 3
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeVertexNormals()
  return geo
}

/** 将 Point2D[] 转为参考线几何体（在 z = zBase 平面） */
function buildRefLineGeometry(points: Point2D[], zBase: number = 0): THREE.BufferGeometry {
  const pts: number[] = []
  for (const p of points) {
    pts.push(p.X, p.Y, zBase)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return geo
}

// ── 实体 → 3D 对象 ──────────────────────────────────────

function createLine3D(
  entity: LineEntity,
  openSide: OpenSide,
  openSize: number,
  height: number,
  zBase: number = 0,
  tiltAngleDeg: number = 0,
  downward: boolean = false
): THREE.Object3D | null {
  const [outerStart, outerEnd] = offsetSegment(entity.start, entity.end, openSide, openSize)
  const outer: Point2D[] = [outerStart, outerEnd]
  const inner: Point2D[] = [{ ...entity.start }, { ...entity.end }]

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  const refGeo = buildRefLineGeometry(inner, zBase)
  const refLine = new THREE.Line(refGeo, mats.referenceLine)
  group.add(refLine)

  // ── 开口偏移参考线（zBase 平面，L/R 分色） ──
  if (openSize > 1e-9) {
    const offsetGeo = buildRefLineGeometry(outer, zBase)
    const offsetColor = openSide === 'LEFT' ? 0xf87171 : 0x4ade80
    const offsetMat = new THREE.LineBasicMaterial({
      color: offsetColor,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    })
    const offsetLine = new THREE.Line(offsetGeo, offsetMat)
    offsetLine.userData._isOffsetLine = true
    group.add(offsetLine)
    // 记录以便 dispose
    group.userData._offsetLineMat = offsetMat
  }

  const wallGeo = buildWallGeometry(outer, inner, height, zBase, tiltAngleDeg, downward)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

function createArc3D(
  entity: ArcEntity,
  openSide: OpenSide,
  openSize: number,
  height: number
): THREE.Object3D | null {
  const radius = entity.radius
  if (radius < 1e-6) return null

  const sign = openSideSign(openSide)
  let sweep = entity.endAngle - entity.startAngle
  if (Math.abs(sweep) < 1e-9) sweep = sweep >= 0 ? 360 : -360
  const orientationSign = sweep >= 0 ? 1 : -1
  const offsetRadius = Math.max(1e-6, radius + orientationSign * sign * openSize)

  const segs = Math.max(8, Math.ceil(Math.abs(sweep) / 5))
  const inner = sampleArcPoints(entity.center, radius, entity.startAngle, entity.endAngle, segs)
  const outer = sampleArcPoints(
    entity.center,
    offsetRadius,
    entity.startAngle,
    entity.endAngle,
    segs
  )

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  group.add(new THREE.Line(buildRefLineGeometry(inner), mats.referenceLine))

  // ── 开口偏移参考线 ──
  if (openSize > 1e-9) {
    const offsetColor = openSide === 'LEFT' ? 0xf87171 : 0x4ade80
    const offsetMat = new THREE.LineBasicMaterial({ color: offsetColor, transparent: true, opacity: 0.6, depthWrite: false })
    const offsetGeo = buildRefLineGeometry(outer)
    const offsetLine = new THREE.Line(offsetGeo, offsetMat)
    offsetLine.userData._isOffsetLine = true
    group.add(offsetLine)
    if (!group.userData._offsetMats) group.userData._offsetMats = []
    ;(group.userData._offsetMats as THREE.Material[]).push(offsetMat)
  }

  const wallGeo = buildWallGeometry(outer, inner, height)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

function createCircle3D(
  entity: CircleEntity,
  openSide: OpenSide,
  openSize: number,
  height: number
): THREE.Object3D | null {
  const radius = entity.radius
  if (radius < 1e-6) return null

  const sign = openSideSign(openSide)
  const offsetRadius = Math.max(1e-6, radius + sign * openSize)

  const segs = 64
  const center = entity.center
  const inner = sampleArcPoints(center, radius, 0, 360, segs)
  const outer = sampleArcPoints(center, offsetRadius, 0, 360, segs)

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  const circlePts = inner.slice(0, -1).map((p) => new THREE.Vector3(p.X, p.Y, 0))
  const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePts)
  group.add(new THREE.LineLoop(circleGeo, mats.referenceLine))

  // ── 开口偏移参考线（偏移圆环） ──
  if (openSize > 1e-9) {
    const offsetColor = openSide === 'LEFT' ? 0xf87171 : 0x4ade80
    const offsetMat = new THREE.LineBasicMaterial({ color: offsetColor, transparent: true, opacity: 0.6, depthWrite: false })
    const outerPts = outer.slice(0, -1).map((p) => new THREE.Vector3(p.X, p.Y, 0))
    const offsetGeo = new THREE.BufferGeometry().setFromPoints(outerPts)
    const offsetLoop = new THREE.LineLoop(offsetGeo, offsetMat)
    offsetLoop.userData._isOffsetLine = true
    group.add(offsetLoop)
    if (!group.userData._offsetMats) group.userData._offsetMats = []
    ;(group.userData._offsetMats as THREE.Material[]).push(offsetMat)
  }

  const wallGeo = buildWallGeometry(outer, inner, height)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

function createPolyline3D(
  entity: PolylineEntity,
  openSide: OpenSide,
  openSize: number,
  height: number
): THREE.Object3D | null {
  const inner = samplePolylineVertices(entity.vertices)
  if (inner.length < 2) return null

  const outer = offsetPolyline(inner, openSide, openSize)

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  group.add(new THREE.Line(buildRefLineGeometry(inner), mats.referenceLine))

  // ── 开口偏移参考线 ──
  if (openSize > 1e-9) {
    const offsetColor = openSide === 'LEFT' ? 0xf87171 : 0x4ade80
    const offsetMat = new THREE.LineBasicMaterial({ color: offsetColor, transparent: true, opacity: 0.6, depthWrite: false })
    const offsetGeo = buildRefLineGeometry(outer)
    const offsetLine = new THREE.Line(offsetGeo, offsetMat)
    offsetLine.userData._isOffsetLine = true
    group.add(offsetLine)
    if (!group.userData._offsetMats) group.userData._offsetMats = []
    ;(group.userData._offsetMats as THREE.Material[]).push(offsetMat)
  }

  const wallGeo = buildWallGeometry(outer, inner, height)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

function createBezier3D(
  entity: BezierEntity,
  openSide: OpenSide,
  openSize: number,
  height: number
): THREE.Object3D | null {
  const inner = sampleBezierPoints(entity.controlPoints, 64)
  if (inner.length < 2) return null

  const outer = offsetPolyline(inner, openSide, openSize)

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  group.add(new THREE.Line(buildRefLineGeometry(inner), mats.referenceLine))

  // ── 开口偏移参考线 ──
  if (openSize > 1e-9) {
    const offsetColor = openSide === 'LEFT' ? 0xf87171 : 0x4ade80
    const offsetMat = new THREE.LineBasicMaterial({ color: offsetColor, transparent: true, opacity: 0.6, depthWrite: false })
    const offsetGeo = buildRefLineGeometry(outer)
    group.add(new THREE.Line(offsetGeo, offsetMat))
    if (!group.userData._offsetMats) group.userData._offsetMats = []
    ;(group.userData._offsetMats as THREE.Material[]).push(offsetMat)
  }

  const wallGeo = buildWallGeometry(outer, inner, height)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

function createEllipse3D(
  entity: EllipseEntity,
  openSide: OpenSide,
  openSize: number,
  height: number
): THREE.Object3D | null {
  const majorRx = Math.hypot(entity.majorAxisEnd.X, entity.majorAxisEnd.Y)
  if (majorRx < 1e-9) return null

  const inner = sampleEllipsePoints(
    entity.center,
    entity.majorAxisEnd,
    entity.minorAxisRatio,
    entity.startParamDeg,
    entity.endParamDeg,
    64
  )
  if (inner.length < 2) return null

  const outer = offsetPolyline(inner, openSide, openSize)

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  group.add(new THREE.Line(buildRefLineGeometry(inner), mats.referenceLine))

  // ── 开口偏移参考线 ──
  if (openSize > 1e-9) {
    const offsetColor = openSide === 'LEFT' ? 0xf87171 : 0x4ade80
    const offsetMat = new THREE.LineBasicMaterial({ color: offsetColor, transparent: true, opacity: 0.6, depthWrite: false })
    const offsetGeo = buildRefLineGeometry(outer)
    const offsetLine = new THREE.Line(offsetGeo, offsetMat)
    offsetLine.userData._isOffsetLine = true
    group.add(offsetLine)
    if (!group.userData._offsetMats) group.userData._offsetMats = []
    ;(group.userData._offsetMats as THREE.Material[]).push(offsetMat)
  }

  const wallGeo = buildWallGeometry(outer, inner, height)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

// ── 公开 API ─────────────────────────────────────────────

export interface Entity3DObject {
  object: THREE.Object3D
  setSelected(selected: boolean): void
  dispose(): void
}

/**
 * 将单个实体转换为 3D 预览对象。
 * 返回的 object 可直接加入 Three.js scene。
 * 需先调用 applyMaterialConfig() 初始化材质参数。
 */
/**
 * 构建刻面钻石 3D 模型（台面→冠部→腰部→亭部）。
 * 从旧 editor buildDiamond3DObject 迁移，适配 Entity3DObject 接口。
 */
/**
 * 构建刻面钻石 3D 模型（台面→冠部→腰部→亭部）。
 * 腰部半径使用传入的 2D 轮廓半径，而非 params.L/W 推算。
 */

function createDiamond3D(
  params: DiamondParams,
  center: Point2D,
  radius: number
): THREE.Group | null {
  if (!Number.isFinite(radius) || radius <= 0) return null

  const crownH = (params.Crown / 100) * radius * 2
  const pavilionH = (params.Pavilion / 100) * radius * 2
  const girdleH = (params.Girdle / 100) * radius * 2
  const totalH = crownH + girdleH + pavilionH
  const tableR = (params.Table / 100) * radius
  const R = radius
  const halfH = totalH / 2

  // Y-up 构建 → 最后 rotateX 转 Z-up
  const yTop = -halfH
  const yGirdleTop = -(halfH - crownH)
  const yGirdleBot = -(halfH - crownH - girdleH)
  const yBot = halfH

  const positions: number[] = []
  const normals: number[] = []

  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const ab = new THREE.Vector3().copy(b).sub(a)
    const ac = new THREE.Vector3().copy(c).sub(a)
    const n = new THREE.Vector3().crossVectors(ab, ac).normalize()
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    normals.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z)
  }

  const shapeDef = getShapeDef(params.shape)
  const profileVerts = shapeDef.getProfileVertices(R, params.L, params.W)
  const totalSegs = profileVerts.length

  function profileXZ(i: number, scale: number): { x: number; z: number } {
    const v = profileVerts[i]
    return { x: v.x * scale, z: v.z * scale }
  }

  for (let i = 0; i < totalSegs; i++) {
    const j = (i + 1) % totalSegs
    const v0 = profileXZ(i, 1)
    const v1 = profileXZ(j, 1)
    const t0 = profileXZ(i, tableR / R)
    const t1 = profileXZ(j, tableR / R)

    const tc = new THREE.Vector3(0, yTop, 0)
    const te0 = new THREE.Vector3(t0.x, yTop, t0.z)
    const te1 = new THREE.Vector3(t1.x, yTop, t1.z)
    const gt0 = new THREE.Vector3(v0.x, yGirdleTop, v0.z)
    const gt1 = new THREE.Vector3(v1.x, yGirdleTop, v1.z)
    const gb0 = new THREE.Vector3(v0.x, yGirdleBot, v0.z)
    const gb1 = new THREE.Vector3(v1.x, yGirdleBot, v1.z)
    const cu = new THREE.Vector3(0, yBot, 0)

    // 台面
    pushTri(tc, te0, te1)
    // 冠部刻面
    pushTri(te0, gt0, te1)
    pushTri(te1, gt0, gt1)
    // 腰部
    pushTri(gt0, gb0, gt1)
    pushTri(gb0, gb1, gt1)
    // 亭部刻面
    pushTri(gb0, cu, gb1)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.rotateX(-Math.PI / 2)

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8ecff,
    metalness: 0.0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    envMapIntensity: 1.2,
    clearcoat: 0.6,
    clearcoatRoughness: 0.05,
    flatShading: true
  })

  const edgeGeom = new THREE.EdgesGeometry(geometry, 5)
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x6699cc,
    transparent: true,
    opacity: 0.25
  })

  const mesh = new THREE.Mesh(geometry, bodyMat)
  const wireframe = new THREE.LineSegments(edgeGeom, edgeMat)

  const group = new THREE.Group()
  group.add(mesh)
  group.add(wireframe)

  if (Number.isFinite(center.X) && Number.isFinite(center.Y)) {
    group.position.set(center.X, center.Y, 0)
  }

  // 存储材质引用以便 setSelected / dispose
  group.userData._diamondBodyMat = bodyMat
  group.userData._diamondEdgeMat = edgeMat

  return group
}

export function createEntity3D(entity: SurfaceEntity<EditorEntity>): Entity3DObject | null {
  const e = entity as SurfaceEntity<EditorEntity>
  const h = e.height
  const zBase = e.zBase ?? 0
  const tiltAngleDeg = e.tiltAngleDeg ?? 0
  const openSize = e.openSize
  const openSide = e.openSide
  const downward = zBase > 0

  let obj: THREE.Object3D | null = null

  switch (e.kind) {
    case 'LINE':
      obj = createLine3D(e, openSide, openSize, h, zBase, tiltAngleDeg, downward)
      break
    case 'ARC':
      obj = createArc3D(e, openSide, openSize, h)
      break
    case 'CIRCLE':
      obj = createCircle3D(e, openSide, openSize, h)
      break
    case 'DIAMOND':
      obj = createDiamond3D(e.diamondParams, e.center, e.radius)
      break
    case 'POLYLINE':
      obj = createPolyline3D(e, openSide, openSize, h)
      break
    case 'BEZIER':
      obj = createBezier3D(e, openSide, openSize, h)
      break
    case 'ELLIPSE':
      obj = createEllipse3D(e, openSide, openSize, h)
      break
  }

  if (!obj) return null

  obj.userData.entityId = entity.id
  obj.userData.entityKind = entity.kind

  // Diamond 使用自有材质，走独立路径
  if (e.kind === 'DIAMOND') {
    const bodyMat = obj.userData._diamondBodyMat as THREE.MeshPhysicalMaterial
    const edgeMat = obj.userData._diamondEdgeMat as THREE.LineBasicMaterial
    return {
      object: obj,
      setSelected(selected: boolean) {
        bodyMat.opacity = selected ? 0.65 : 0.9
        bodyMat.emissive = selected ? new THREE.Color(0x3b82f6) : new THREE.Color(0x000000)
        bodyMat.emissiveIntensity = selected ? 0.4 : 0
        edgeMat.opacity = selected ? 0.6 : 0.25
        edgeMat.color.set(selected ? 0x3b82f6 : 0x6699cc)
      },
      dispose() {
        obj!.traverse((child) => {
          if (
            child instanceof THREE.Mesh ||
            child instanceof THREE.Line ||
            child instanceof THREE.LineLoop ||
            child instanceof THREE.LineSegments
          ) {
            child.geometry?.dispose()
          }
        })
        bodyMat.dispose()
        edgeMat.dispose()
        if (obj!.parent) obj!.parent.remove(obj!)
      }
    }
  }

  const mats = getSharedMaterials()
  const lineChildren: THREE.Line[] = []
  const meshChildren: THREE.Mesh[] = []

  obj.traverse((child) => {
    if (child instanceof THREE.Line || child instanceof THREE.LineLoop) {
      if (!child.userData._isOffsetLine) lineChildren.push(child)
    }
    if (child instanceof THREE.Mesh) meshChildren.push(child)
  })

  return {
    object: obj,
    setSelected(selected: boolean) {
      for (const line of lineChildren) {
        line.material = selected ? mats.selectedLine : mats.referenceLine
      }
      for (const mesh of meshChildren) {
        mesh.material = selected ? mats.selectedWallFace : mats.wallFace
      }
    },
    dispose() {
      obj!.traverse((child) => {
        if (
          child instanceof THREE.Mesh ||
          child instanceof THREE.Line ||
          child instanceof THREE.LineLoop
        ) {
          child.geometry?.dispose()
        }
      })
      // 清理偏移线材质
      const offsetMats = obj!.userData._offsetMats as THREE.Material[] | undefined
      if (offsetMats) {
        for (const m of offsetMats) m.dispose()
      }
      const offsetLineMat = obj!.userData._offsetLineMat as THREE.Material | undefined
      if (offsetLineMat) offsetLineMat.dispose()
      if (obj!.parent) obj!.parent.remove(obj!)
    }
  }
}

/**
 * 批量创建所有实体的 3D 对象。
 * 返回 Map<entityId, Entity3DObject>。
 * 需先调用 applyMaterialConfig() 初始化材质参数。
 */
export function createAllEntityObjects(
  entities: SurfaceEntity<EditorEntity>[],
  selectedIds: Set<string>
): Map<string, Entity3DObject> {
  const map = new Map<string, Entity3DObject>()

  for (const entity of entities) {
    const result = createEntity3D(entity)
    if (!result) continue
    result.setSelected(selectedIds.has(entity.id))
    map.set(entity.id, result)
  }

  return map
}

/** 释放所有共享材质 */
export function disposeSharedMaterials() {
  if (!_sharedMaterials) return
  for (const mat of Object.values(_sharedMaterials)) {
    mat.dispose()
  }
  _sharedMaterials = null
}
