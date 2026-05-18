// =============================================================================
// useCreatePreview3D — 将 entitiesEditor 实体转为 Three.js 3D 预览对象
//
// 参考 editor/cad/threeGeometry.ts 的几何构造逻辑，使用 entitiesEditor 的
// utils/geometry.ts 中的采样与三角剖分函数，配合共享材质减少 draw call。
//
// 材质分为三层：
//   参考线（底部 2D 轮廓）  → 统一 MeshBasicMaterial，无光照
//   挤出面（竖直墙体）      → 渐变顶点色 MeshStandardMaterial，半透明
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
  Point2D,
  OpenSide,
} from '../../commons/types'
import {
  sampleArcPoints,
  sampleBezierPoints,
  samplePolylineVertices,
  sampleEllipsePoints,
  offsetPolyline,
  offsetSegment,
} from '../../utils/geometry'
import type { Scene3DConfig } from '../../shares/types'

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
      depthWrite: true,
    }),
    selectedLine: new THREE.LineBasicMaterial({
      color: c.materialSelectedColor,
      linewidth: 2,
      transparent: true,
      opacity: c.materialReferenceOpacity,
      depthTest: true,
      depthWrite: true,
    }),
    wallFace: new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: c.materialWallOpacity,
      roughness: 0.6,
      metalness: 0.1,
      depthWrite: false,
    }),
    selectedWallFace: new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: c.materialSelectedWallOpacity,
      roughness: 0.5,
      metalness: 0.1,
      depthWrite: false,
    }),
    capFace: new THREE.MeshStandardMaterial({
      color: c.materialCapColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: c.materialCapOpacity,
      roughness: 0.7,
      metalness: 0.05,
      depthWrite: false,
    }),
    selectedCapFace: new THREE.MeshStandardMaterial({
      color: c.materialSelectedCapColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: c.materialSelectedCapOpacity,
      roughness: 0.7,
      metalness: 0.05,
      depthWrite: false,
    }),
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

/** 将 Point2D[] 转为带顶点色（沿 Z 渐变）的 BufferGeometry */
function buildWallGeometry(outer: Point2D[], inner: Point2D[], height: number): THREE.BufferGeometry | null {
  const N = Math.min(outer.length, inner.length)
  if (N < 2) return null

  const c = _cfg!
  // 每采样点 4 个顶点：outer_top, outer_bot, inner_top, inner_bot
  const positions = new Float32Array(N * 12)
  const colors = new Float32Array(N * 12)
  const topColor = new THREE.Color(c.materialWallTopColor)
  const botColor = new THREE.Color(c.materialWallBottomColor)

  for (let i = 0; i < N; i++) {
    const b = i * 12
    positions[b + 0] = outer[i].X; positions[b + 1] = outer[i].Y; positions[b + 2] = height
    positions[b + 3] = outer[i].X; positions[b + 4] = outer[i].Y; positions[b + 5] = 0
    positions[b + 6] = inner[i].X; positions[b + 7] = inner[i].Y; positions[b + 8] = height
    positions[b + 9] = inner[i].X; positions[b + 10] = inner[i].Y; positions[b + 11] = 0

    // 顶点色：top → 亮色, bottom → 暗色
    colors[b + 0] = topColor.r; colors[b + 1] = topColor.g; colors[b + 2] = topColor.b
    colors[b + 3] = botColor.r; colors[b + 4] = botColor.g; colors[b + 5] = botColor.b
    colors[b + 6] = topColor.r; colors[b + 7] = topColor.g; colors[b + 8] = topColor.b
    colors[b + 9] = botColor.r; colors[b + 10] = botColor.g; colors[b + 11] = botColor.b
  }

  const segs = N - 1
  const indices = new Uint32Array(segs * 24)
  for (let i = 0; i < segs; i++) {
    const v0 = i * 4
    const v1 = (i + 1) * 4
    const t = i * 24

    // 外侧墙
    indices[t + 0] = v0 + 0; indices[t + 1] = v1 + 0; indices[t + 2] = v0 + 1
    indices[t + 3] = v1 + 0; indices[t + 4] = v1 + 1; indices[t + 5] = v0 + 1
    // 内侧墙
    indices[t + 6] = v0 + 2; indices[t + 7] = v0 + 3; indices[t + 8] = v1 + 2
    indices[t + 9] = v1 + 2; indices[t + 10] = v0 + 3; indices[t + 11] = v1 + 3
    // 顶面
    indices[t + 12] = v0 + 0; indices[t + 13] = v1 + 0; indices[t + 14] = v1 + 2
    indices[t + 15] = v0 + 0; indices[t + 16] = v1 + 2; indices[t + 17] = v0 + 2
    // 底面
    indices[t + 18] = v0 + 1; indices[t + 19] = v0 + 3; indices[t + 20] = v1 + 1
    indices[t + 21] = v1 + 1; indices[t + 22] = v0 + 3; indices[t + 23] = v1 + 3
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeVertexNormals()
  return geo
}

/** 将 Point2D[] 转为底部参考线几何体 */
function buildRefLineGeometry(points: Point2D[]): THREE.BufferGeometry {
  const pts: number[] = []
  for (const p of points) {
    pts.push(p.X, p.Y, 0)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return geo
}

// ── 实体 → 3D 对象 ──────────────────────────────────────

function createLine3D(entity: LineEntity, openSide: OpenSide, openSize: number, height: number): THREE.Object3D | null {
  const [outerStart, outerEnd] = offsetSegment(entity.start, entity.end, openSide, openSize)
  const outer: Point2D[] = [outerStart, outerEnd]
  const inner: Point2D[] = [{ ...entity.start }, { ...entity.end }]

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  const refGeo = buildRefLineGeometry(inner)
  const refLine = new THREE.Line(refGeo, mats.referenceLine)
  group.add(refLine)

  const wallGeo = buildWallGeometry(outer, inner, height)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

function createArc3D(entity: ArcEntity, openSide: OpenSide, openSize: number, height: number): THREE.Object3D | null {
  const radius = entity.radius
  if (radius < 1e-6) return null

  const sign = openSideSign(openSide)
  let sweep = entity.endAngle - entity.startAngle
  if (Math.abs(sweep) < 1e-9) sweep = sweep >= 0 ? 360 : -360
  const orientationSign = sweep >= 0 ? 1 : -1
  const offsetRadius = Math.max(1e-6, radius + orientationSign * sign * openSize)

  const segs = Math.max(8, Math.ceil(Math.abs(sweep) / 5))
  const inner = sampleArcPoints(entity.center, radius, entity.startAngle, entity.endAngle, segs)
  const outer = sampleArcPoints(entity.center, offsetRadius, entity.startAngle, entity.endAngle, segs)

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  group.add(new THREE.Line(buildRefLineGeometry(inner), mats.referenceLine))

  const wallGeo = buildWallGeometry(outer, inner, height)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

function createCircle3D(entity: CircleEntity, openSide: OpenSide, openSize: number, height: number): THREE.Object3D | null {
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

  const circlePts = inner.slice(0, -1).map(p => new THREE.Vector3(p.X, p.Y, 0))
  const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePts)
  group.add(new THREE.LineLoop(circleGeo, mats.referenceLine))

  const wallGeo = buildWallGeometry(outer, inner, height)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

function createPolyline3D(entity: PolylineEntity, openSide: OpenSide, openSize: number, height: number): THREE.Object3D | null {
  const inner = samplePolylineVertices(entity.vertices)
  if (inner.length < 2) return null

  const outer = offsetPolyline(inner, openSide, openSize)

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  group.add(new THREE.Line(buildRefLineGeometry(inner), mats.referenceLine))

  const wallGeo = buildWallGeometry(outer, inner, height)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

function createBezier3D(entity: BezierEntity, openSide: OpenSide, openSize: number, height: number): THREE.Object3D | null {
  const inner = sampleBezierPoints(entity.controlPoints, 64)
  if (inner.length < 2) return null

  const outer = offsetPolyline(inner, openSide, openSize)

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  group.add(new THREE.Line(buildRefLineGeometry(inner), mats.referenceLine))

  const wallGeo = buildWallGeometry(outer, inner, height)
  if (wallGeo) {
    group.add(new THREE.Mesh(wallGeo, mats.wallFace))
  }

  return group
}

function createEllipse3D(entity: EllipseEntity, openSide: OpenSide, openSize: number, height: number): THREE.Object3D | null {
  const majorRx = Math.hypot(entity.majorAxisEnd.X, entity.majorAxisEnd.Y)
  if (majorRx < 1e-9) return null

  const inner = sampleEllipsePoints(
    entity.center,
    entity.majorAxisEnd,
    entity.minorAxisRatio,
    entity.startParamDeg,
    entity.endParamDeg,
    64,
  )
  if (inner.length < 2) return null

  const outer = offsetPolyline(inner, openSide, openSize)

  const group = new THREE.Group()
  const mats = getSharedMaterials()

  group.add(new THREE.Line(buildRefLineGeometry(inner), mats.referenceLine))

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
export function createEntity3D(entity: SurfaceEntity<EditorEntity>): Entity3DObject | null {
  const e = entity as SurfaceEntity<EditorEntity>
  const h = e.height
  const openSize = e.openSize
  const openSide = e.openSide

  let obj: THREE.Object3D | null = null

  switch (e.kind) {
    case 'LINE':     obj = createLine3D(e, openSide, openSize, h); break
    case 'ARC':      obj = createArc3D(e, openSide, openSize, h); break
    case 'CIRCLE':   obj = createCircle3D(e, openSide, openSize, h); break
    case 'POLYLINE': obj = createPolyline3D(e, openSide, openSize, h); break
    case 'BEZIER':   obj = createBezier3D(e, openSide, openSize, h); break
    case 'ELLIPSE':  obj = createEllipse3D(e, openSide, openSize, h); break
  }

  if (!obj) return null

  obj.userData.entityId = entity.id
  obj.userData.entityKind = entity.kind

  const mats = getSharedMaterials()
  const lineChildren: THREE.Line[] = []
  const meshChildren: THREE.Mesh[] = []

  obj.traverse((child) => {
    if (child instanceof THREE.Line || child instanceof THREE.LineLoop) lineChildren.push(child)
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
        if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineLoop) {
          child.geometry?.dispose()
        }
      })
      if (obj!.parent) obj!.parent.remove(obj!)
    },
  }
}

/**
 * 批量创建所有实体的 3D 对象。
 * 返回 Map<entityId, Entity3DObject>。
 * 需先调用 applyMaterialConfig() 初始化材质参数。
 */
export function createAllEntityObjects(
  entities: SurfaceEntity<EditorEntity>[],
  selectedIds: Set<string>,
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
