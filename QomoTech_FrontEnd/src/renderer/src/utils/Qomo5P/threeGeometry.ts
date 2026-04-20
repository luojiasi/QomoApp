import * as THREE from 'three'
import type { OpenDirectionType, Point } from '@renderer/types/Qomo5P'
import type { QomoEntityWithSurface, QomoIrregularSurfacesEntity } from '@renderer/types/Qomo5P'

const SELECTED_REFERENCE_SURFACE_OPACITY = 0.36
const BASE_REFERENCE_SURFACE_OPACITY = 0.26
const SELECTED_REFERENCE_COLOR = 0x22d3ee
const BASE_REFERENCE_COLOR = 0x9fdde7
// “原始层”尽量淡一点，避免和偏移渐变层重叠后把渐变效果盖住
const UNIFORM_LAYER_OPACITY_SCALE = 0.6

const SELECTED_REFERENCE_OFFSET_COLOR_LEFT_TOP = 0xf67676
const SELECTED_REFERENCE_OFFSET_COLOR_LEFT_BUTTOM = 0xf67676
const SELECTED_REFERENCE_OFFSET_COLOR_RIGHT_TOP = 0x42a337
const SELECTED_REFERENCE_OFFSET_COLOR_RIGHT_BUTTOM = 0x42a337

const BASE_REFERENCE_OFFSET_COLOR_LEFT_TOP = 0xe8c4c4
const BASE_REFERENCE_OFFSET_COLOR_LEFT_BUTTOM = 0xe8c4c4
const BASE_REFERENCE_OFFSET_COLOR_RIGHT_TOP = 0x74aa6e
const BASE_REFERENCE_OFFSET_COLOR_RIGHT_BUTTOM = 0x74aa6e

const GRADIENT_LAYER_OPACITY_SCALE = 0.3

/** 桥接区域（原始↔偏移之间）单色，与左红/右绿偏移层区分；violet-500 (#8b5cf6) */
const BRIGR_SELECT_OFFSET_COLOR = 0x8b5cf6
const BRIDGE_LAYER_OPACITY_SCALE = 0.8

// ==================== 1. 旋转核心常量 ====================
/** 固定旋转轴端点（绕Y轴方向旋转，业务固定轴） */
const ROCENTERPOS = { START: { x: 0, y: 10, z: 0 }, END: { x: 0, y: -10, z: 0 } }

/** 与实体 welding.openSize 一致；未定义时用 1（后续可再接开口角/高度公式） */
const DEFAULT_OPEN_SIZE = 1

// 实体开口变量是否需要取反
const OPEN_SIZE_NEED_REVERSE = true

// 坐标轴是否需要取反（true 表示该轴值乘以 -1）
const X_NEED_REVERSE = false
const Y_NEED_REVERSE = false

const applyAxisReverse = (value: number, needReverse: boolean) => (needReverse ? -value : value)

const getOpenDirectionSign = (openDirection: OpenDirectionType) => {
  const baseSign = openDirection === 'RIGHT' ? -1 : 1
  return OPEN_SIZE_NEED_REVERSE ? baseSign : -baseSign
}

/** Canvas -> Three：可通过 X_NEED_REVERSE / Y_NEED_REVERSE 控制 x/y 是否取反 */
const toThreePosition = (point: Point, elevation = 0) =>
  new THREE.Vector3(applyAxisReverse(point.x, X_NEED_REVERSE),applyAxisReverse(point.y, Y_NEED_REVERSE),elevation)

const isEllipseLikeIrregularEntity = (entity: QomoEntityWithSurface): entity is QomoIrregularSurfacesEntity =>
  entity.type === 'IRREGULAR' &&
  (entity.shape === 'oval' ||
    entity.shape === 'square' ||
    entity.shape === 'cushion' ||
    entity.shape === 'octagon' ||
    entity.shape === 'marquise' ||
    entity.shape === 'pear' ||
    entity.shape === 'heart')



// ==================== 3. 旋转核心类型定义 ====================
/** 旋转上下文：存储旋转轴 + 旋转矩阵 */
type AxisRotationContext = {
  axisStart: THREE.Vector3      // 旋转轴起点
  rotationMatrix: THREE.Matrix4 // 旋转矩阵（数学核心）
}

// ==================== 4. 核心：创建绕任意轴旋转矩阵 ====================
/**
 * 创建绕轴旋转的上下文（旋转轴 + 旋转矩阵）
 * @param axisStart 旋转轴起点
 * @param axisEnd 旋转轴终点
 * @param angleRad 旋转角度（弧度）
 */
const makeAxisRotationContext = (axisStart: THREE.Vector3,axisEnd: THREE.Vector3,angleRad: number): AxisRotationContext | null => {
  // 角度无效/接近0，不旋转
  if (!Number.isFinite(angleRad) || Math.abs(angleRad) < 1e-9) return null
  // 计算旋转轴方向向量
  const axisDir = axisEnd.clone().sub(axisStart)
  // 轴长度为0，无效轴
  const axisLen = axisDir.length()
  if (axisLen < 1e-9) return null
  // 轴向量归一化（必须单位向量才能用于旋转）
  axisDir.normalize()
  // 返回：旋转轴起点 + 绕轴旋转矩阵
  return {
    axisStart: axisStart.clone(),
    rotationMatrix: new THREE.Matrix4().makeRotationAxis(axisDir, angleRad)
  }
}
// ==================== 5. 应用旋转到3D坐标点 ====================
/**
 * 对2D点执行「坐标转换 + 绕轴旋转」
 * @param point 2D原始点
 * @param elevation Z轴高度
 * @param rotation 旋转上下文（轴+矩阵）
 */
const toThreePositionWithAxisRotation = (point: Point,elevation = 0,rotation: AxisRotationContext | null = null) => {
  // 第一步：2D → 3D 基础坐标转换
  const v = toThreePosition(point, elevation)
  // 无旋转 → 直接返回
  if (!rotation) return v
  // 第二步：绕轴旋转（标准数学流程：平移→旋转→平移回去）
  return v.sub(rotation.axisStart).applyMatrix4(rotation.rotationMatrix).add(rotation.axisStart)
}

/**
 * 原始实体点先经 `surfaceAngle` 绕 ROCENTERPOS 轴旋转，再正交投影到 **z = 0** 平面。
 * 投影后保留旋转后的 x/y，仅把 z 置 0。
 * 坐标约定：Three Z-up，(canvas.x, canvas.y, 标高) 按轴取反配置映射到 (x, y, z)。
 */
export const projectRotatedEntityPointToThreeZPlane = (point: Point,elevation: number,surfaceAngleDeg: number): THREE.Vector3 => {
  const rotation = makeSurfaceAngleRotation(surfaceAngleDeg)
  const v = toThreePositionWithAxisRotation(point, elevation, rotation)
  return new THREE.Vector3(v.x, v.y, 0)
}

/** z=0（XY 平面）投影后的 Three 向量转 Canvas：按同一取反配置恢复 */
export const canvasPointFromThreeZPlane = (v: THREE.Vector3): Point => ({
  x: applyAxisReverse(v.x, X_NEED_REVERSE),
  y: applyAxisReverse(v.y, Y_NEED_REVERSE)
})

const getReferenceDisplayColor = (selected: boolean) =>
  selected ? SELECTED_REFERENCE_COLOR : BASE_REFERENCE_COLOR
const getOffsetReferenceDisplayColor = (selected: boolean, openDirection: OpenDirectionType) =>
  selected
    ? openDirection === 'RIGHT'
      ? SELECTED_REFERENCE_OFFSET_COLOR_LEFT_TOP
      : SELECTED_REFERENCE_OFFSET_COLOR_RIGHT_TOP
    : openDirection === 'RIGHT'
      ? BASE_REFERENCE_OFFSET_COLOR_LEFT_TOP
      : BASE_REFERENCE_OFFSET_COLOR_RIGHT_TOP

// 给定开口公式：
// openSize = （(高度+1)*1000*tan(开口角度)*2 + (高度+1)*5 +40）/1000
// 其中“高度”取实体 extrudeHeight（挤出高度）；开口角度按角度制 -> 弧度计算 tan。
const getEffectiveOpenSize = (entity: QomoEntityWithSurface) => {
  // 挤出高度的正负只影响方向，这里开口尺寸只与高度幅值相关
  const height = Math.abs(entity.extrudeHeight)
  const angleDeg = entity.welding?.openAngle

  if (!Number.isFinite(height) || !Number.isFinite(angleDeg as number)) return DEFAULT_OPEN_SIZE

  const angleRad = ((angleDeg as number) * Math.PI) / 180
  const tan = Math.tan(angleRad)
  if (!Number.isFinite(tan)) return DEFAULT_OPEN_SIZE

  return ((height + 1) * 1000 * tan * 2 + (height + 1) * 5 + 40) / 1000
}

/**
 * 在 2D 平面内，沿「起点→终点」前进方向的右侧法向为 (dy, -dx)/|L|；
 * RIGHT：沿该法向偏移；LEFT：反向。与 Canvas 点转 Three XY 一致。
 */
const offsetSegmentByOpenDirection = (start: Point,end: Point,openDirection: OpenDirectionType,openSize: number): [Point, Point] => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return [start, end]
  const rx = dy / len
  const ry = -dx / len
  const sign = getOpenDirectionSign(openDirection)
  const ox = rx * openSize * sign
  const oy = ry * openSize * sign
  return [
    { x: start.x + ox, y: start.y + oy },
    { x: end.x + ox, y: end.y + oy }
  ]
}

const offsetOpenPolylineByOpenDirection = (points: Point[],openDirection: OpenDirectionType,openSize: number) => {
  if (points.length < 2 || openSize < 1e-9) return points.map((point) => ({ ...point }))
  const sign = getOpenDirectionSign(openDirection)
  const segmentNormals = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1]
    const dx = next.x - point.x
    const dy = next.y - point.y
    const len = Math.hypot(dx, dy)
    if (len < 1e-9) return null
    return { x: (dy / len) * sign, y: (-dx / len) * sign }
  })
  return points.map((point, index) => {
    const normalCandidates = [
      index > 0 ? segmentNormals[index - 1] : null,
      index < segmentNormals.length ? segmentNormals[index] : null
    ].filter((item): item is { x: number; y: number } => Boolean(item))
    if (normalCandidates.length === 0) return { ...point }
    const normal = normalCandidates.reduce(
      (acc, item) => ({ x: acc.x + item.x, y: acc.y + item.y }),
      { x: 0, y: 0 }
    )
    const len = Math.hypot(normal.x, normal.y)
    if (len < 1e-9) {
      const fallback = normalCandidates[0]
      return {
        x: point.x + fallback.x * openSize,
        y: point.y + fallback.y * openSize
      }
    }
    return {
      x: point.x + (normal.x / len) * openSize,
      y: point.y + (normal.y / len) * openSize
    }
  })
}

type OpenJoinEntityWithSurface = Extract<QomoEntityWithSurface, { type: 'LINE' | 'ARC' | 'BEZIER' }>
type EndpointOffsetOverride = { start?: Point; end?: Point }
type EndpointSide = 'start' | 'end'
type OffsetEndpointLine = { from: Point; to: Point; baseOffsetEndpoint: Point }
type OpenEntityOffsetProfile = {
  entityId: string
  entity: OpenJoinEntityWithSurface
  openSize: number
  originalPoints: Point[]
  offsetPoints: Point[]
}

const POINT_EPS = 1e-6
const LINE_PARALLEL_EPS = 1e-9
const MITER_LIMIT = 8
const OPEN_PATH_SAMPLE_SEGMENTS = 96

const isSamePoint = (a: Point, b: Point, eps = POINT_EPS) =>
  Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps

const intersectLines2D = (a0: Point, a1: Point, b0: Point, b1: Point): Point | null => {
  const ax = a1.x - a0.x
  const ay = a1.y - a0.y
  const bx = b1.x - b0.x
  const by = b1.y - b0.y
  const det = ax * by - ay * bx
  if (Math.abs(det) < LINE_PARALLEL_EPS) return null

  const dx = b0.x - a0.x
  const dy = b0.y - a0.y
  const t = (dx * by - dy * bx) / det
  return { x: a0.x + ax * t, y: a0.y + ay * t }
}
// 计算圆弧偏移的半径
const computeArcOffsetRadius = (entity: Extract<QomoEntityWithSurface, { type: 'ARC' }>,openSize: number) => {
  let sweep = entity.endAngle - entity.startAngle
  if (Math.abs(sweep) < 1e-9) sweep = sweep >= 0 ? 360 : -360
  const orientationSign = sweep >= 0 ? 1 : -1
  const deltaRadius = orientationSign * getOpenDirectionSign(entity.openDirection) * openSize
  return Math.max(1e-6, entity.radius + deltaRadius)
}
// 构建开放实体偏移的轮廓
const buildOpenEntityOffsetProfile = (entity: OpenJoinEntityWithSurface): OpenEntityOffsetProfile | null => {
  const openSize = getEffectiveOpenSize(entity)
  if (openSize < 1e-9) return null

  if (entity.type === 'LINE') {
    const originalPoints = [entity.start, entity.end]
    const [offsetStart, offsetEnd] = offsetSegmentByOpenDirection(entity.start,entity.end,entity.openDirection,openSize)
    return {
      entityId: entity.id,
      entity,
      openSize,
      originalPoints,
      offsetPoints: [offsetStart, offsetEnd]
    }
  }

  if (entity.type === 'ARC') {
    const originalPoints = createArcPoints(entity.center,entity.radius,entity.startAngle,entity.endAngle,OPEN_PATH_SAMPLE_SEGMENTS)
    const offsetRadius = computeArcOffsetRadius(entity, openSize)
    const offsetPoints = createArcPoints(entity.center,offsetRadius,entity.startAngle,entity.endAngle,OPEN_PATH_SAMPLE_SEGMENTS)
    if (originalPoints.length < 2 || offsetPoints.length < 2) return null
    return { entityId: entity.id, entity, openSize, originalPoints, offsetPoints }
  }

  const originalPoints = createBezierPoints(entity.points, OPEN_PATH_SAMPLE_SEGMENTS)
  const offsetPoints = offsetOpenPolylineByOpenDirection(originalPoints, entity.openDirection, openSize)
  if (originalPoints.length < 2 || offsetPoints.length < 2) return null
  return { entityId: entity.id, entity, openSize, originalPoints, offsetPoints }
}
// 获取偏移实体的端点线
const getOffsetEndpointLine = (profile: OpenEntityOffsetProfile,side: EndpointSide): OffsetEndpointLine | null => {
  const points = profile.offsetPoints
  if (points.length < 2) return null
  if (side === 'start') {
    return { from: points[0], to: points[1], baseOffsetEndpoint: points[0] }
  }
  return {
    from: points[points.length - 1],
    to: points[points.length - 2],
    baseOffsetEndpoint: points[points.length - 1]
  }
}
// 获取原始实体的端点
const getOriginalEndpoint = (profile: OpenEntityOffsetProfile, side: EndpointSide) =>
  side === 'start'
    ? profile.originalPoints[0]
    : profile.originalPoints[profile.originalPoints.length - 1]

const buildOpenEntityOffsetOverrides = (entities: QomoEntityWithSurface[]) => {
  const openEntities = entities.filter(
    (entity): entity is OpenJoinEntityWithSurface =>
      entity.type === 'LINE' || entity.type === 'ARC' || entity.type === 'BEZIER'
  )
  const profiles = openEntities
    .map((entity) => buildOpenEntityOffsetProfile(entity))
    .filter((profile): profile is OpenEntityOffsetProfile => Boolean(profile))
  const overrides = new Map<string, EndpointOffsetOverride>()
  if (profiles.length < 2) return overrides

  for (const profile of profiles) {
    ;(['start', 'end'] as const).forEach((side) => {
      const joint = getOriginalEndpoint(profile, side)
      const currentLine = getOffsetEndpointLine(profile, side)
      if (!currentLine) return

      const candidates = profiles
        .filter((other) => other.entityId !== profile.entityId)
        .map((other) => {
          const start = getOriginalEndpoint(other, 'start')
          if (isSamePoint(start, joint)) return { other, side: 'start' as const }
          const end = getOriginalEndpoint(other, 'end')
          if (isSamePoint(end, joint)) return { other, side: 'end' as const }
          return null
        })
        .filter((item): item is { other: OpenEntityOffsetProfile; side: EndpointSide } => Boolean(item))
      if (candidates.length === 0) return

      let bestIntersection: Point | null = null
      let bestScore = Number.POSITIVE_INFINITY
      for (const candidate of candidates) {
        const candidateLine = getOffsetEndpointLine(candidate.other, candidate.side)
        if (!candidateLine) continue
        const intersection = intersectLines2D(
          currentLine.from,
          currentLine.to,
          candidateLine.from,
          candidateLine.to
        )
        if (!intersection) continue
        const miterDistance = Math.hypot(
          intersection.x - currentLine.baseOffsetEndpoint.x,
          intersection.y - currentLine.baseOffsetEndpoint.y
        )
        if (miterDistance > Math.max(profile.openSize, candidate.other.openSize) * MITER_LIMIT) continue
        if (miterDistance < bestScore) {
          bestScore = miterDistance
          bestIntersection = intersection
        }
      }
      if (!bestIntersection) return

      const next = overrides.get(profile.entityId) ?? {}
      next[side] = bestIntersection
      overrides.set(profile.entityId, next)
    })
  }
  return overrides
}
// 导出与 3D 偏移层一致的 2D 路径计算（含接缝斜接）
export type OpenEntityOffsetPath2D = {
  entityId: string
  points: Point[]
}

/**
 * 与 `createEntityReferenceObject` 中偏移参考层一致的 2D 点列（含 `buildOpenEntityOffsetOverrides` 接缝修正）。
 * 供 Home 相机叠加等仅展示使用；不参与编辑几何。
 */
// 导出与 3D 偏移层一致的 2D 路径计算（含接缝斜接）
export const computeOpenEntityOffsetPathsForCanvas = (entities: QomoEntityWithSurface[],openSize_details: number): OpenEntityOffsetPath2D[] => {
  const overrides = buildOpenEntityOffsetOverrides(entities)
  const out: OpenEntityOffsetPath2D[] = []

  for (const entity of entities) {
    if (
      entity.type !== 'LINE' &&
      entity.type !== 'ARC' &&
      entity.type !== 'BEZIER' &&
      entity.type !== 'CIRCLE' &&
      entity.type !== 'IRREGULAR'
    ) {
      continue
    }
    const openSize = openSize_details/1000
    if (openSize < 1e-9) continue

    const endpointOverride = overrides.get(entity.id)

    if (entity.type === 'LINE') {
      const [calculatedOffsetStart, calculatedOffsetEnd] = offsetSegmentByOpenDirection(
        entity.start,
        entity.end,
        entity.openDirection,
        openSize
      )
      const offsetStart = endpointOverride?.start ?? calculatedOffsetStart
      const offsetEnd = endpointOverride?.end ?? calculatedOffsetEnd
      out.push({ entityId: entity.id, points: [offsetStart, offsetEnd] })
      continue
    }

    if (entity.type === 'ARC') {
      const offsetRadius = computeArcOffsetRadius(entity, openSize)
      const computedOuterPts = createArcPoints(
        entity.center,
        offsetRadius,
        entity.startAngle,
        entity.endAngle,
        OPEN_PATH_SAMPLE_SEGMENTS
      )
      if (computedOuterPts.length < 2) continue
      const outerPts = computedOuterPts.map((point) => ({ ...point }))
      if (endpointOverride?.start) outerPts[0] = endpointOverride.start
      if (endpointOverride?.end) outerPts[outerPts.length - 1] = endpointOverride.end
      out.push({ entityId: entity.id, points: outerPts })
      continue
    }

    if (entity.type === 'BEZIER') {
      const innerPts = createBezierPoints(entity.points, OPEN_PATH_SAMPLE_SEGMENTS)
      const computedOuterPts = offsetOpenPolylineByOpenDirection(
        innerPts,
        entity.openDirection,
        openSize
      )
      if (computedOuterPts.length < 2) continue
      const outerPts = computedOuterPts.map((point) => ({ ...point }))
      if (endpointOverride?.start) outerPts[0] = endpointOverride.start
      if (endpointOverride?.end) outerPts[outerPts.length - 1] = endpointOverride.end
      out.push({ entityId: entity.id, points: outerPts })
      continue
    }

    if (entity.type === 'IRREGULAR') {
      const segments = 96
      const rx = entity.radiusX
      const ry = entity.radiusY
      const rot = entity.rotationDeg
      const delta = -openSize * getOpenDirectionSign(entity.openDirection)
      const outerRx = Math.max(1e-6, rx + delta)
      const outerRy = Math.max(1e-6, ry + delta)
      const outerPts =
        entity.shape === 'marquise'
          ? createMarquisePoints(entity.center, outerRx, outerRy, rot, segments)
          : entity.shape === 'pear'
            ? createPearPoints(entity.center, outerRx, outerRy, rot, segments)
            : entity.shape === 'heart'
              ? createHeartPoints(entity.center, outerRx, outerRy, rot, segments)
              : entity.shape === 'square'
                ? createSquarePoints(entity.center, outerRx, outerRy, rot)
                : entity.shape === 'cushion'
                  ? createCushionPoints(entity.center, outerRx, outerRy, rot, segments)
                : entity.shape === 'octagon'
                  ? createOctagonPoints(entity.center, outerRx, outerRy, rot)
                  : createEllipsePoints(entity.center, outerRx, outerRy, rot, 0, 360, segments)
      if (outerPts.length < 2) continue
      out.push({ entityId: entity.id, points: outerPts })
      continue
    }

    // CIRCLE：与 3D 一致，整圆偏移；不参与开放线接缝表
    // 规则：LEFT 偏移在圆外侧（半径增大），RIGHT 偏移在圆内侧（半径减小）
    const r = entity.radius
    const offsetRadius = Math.max(1e-6, r - openSize * getOpenDirectionSign(entity.openDirection))
    const outerPts = createArcPoints(entity.center, offsetRadius, 0, 360, 360)
    if (outerPts.length < 2) continue
    out.push({ entityId: entity.id, points: outerPts })
  }

  return out
}
//导出与 3D 偏移层一致的 2D 路径计算（含接缝斜接）
const createVerticalConnector = (point: Point,startElevation: number,endElevation: number,color: number,rotation: AxisRotationContext | null = null) => {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    toThreePositionWithAxisRotation(point, startElevation, rotation),
    toThreePositionWithAxisRotation(point, endElevation, rotation)
  ])
  const material = new THREE.LineBasicMaterial({ color })
  return new THREE.Line(geometry, material)
}

const createLineFromPoints = (points: Point[],elevation: number,color: number,rotation: AxisRotationContext | null = null) => {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((point) => toThreePositionWithAxisRotation(point, elevation, rotation))
  )
  const material = new THREE.LineBasicMaterial({ color })
  return new THREE.Line(geometry, material)
}

/** startAngle/endAngle 为定向扫掠：end - start 为带符号扫掠角（度），可越过 ±360 */
export const createArcPoints = (center: Point,radius: number,startAngle: number,endAngle: number,segments = 48) => {
  // 与 2D 的 describeArc 保持一致：把扫掠角归一化到 (-360, 360]，
  // 避免 endAngle-startAngle 出现 “360 + 小角度” 时被画成整圆+多一段。
  let sweep = endAngle - startAngle
  while (sweep > 360) sweep -= 360
  while (sweep <= -360) sweep += 360
  if (Math.abs(sweep) < 1e-9) {
    sweep = sweep >= 0 ? 360 : -360
  }
  const step = sweep / Math.max(segments, 1)
  const points: Point[] = []
  for (let index = 0; index <= segments; index += 1) {
    const angle = startAngle + step * index
    const rad = (angle * Math.PI) / 180
    points.push({
      x: center.x + radius * Math.cos(rad),
      y: center.y + radius * Math.sin(rad)
    })
  }

  // const sweep = ((endAngle - startAngle) % 360 + 360) % 360 || 360
  // return Array.from({ length: segments + 1 }, (_, index) => {
  //   const angle = startAngle + (sweep * index) / segments
  //   const rad = (angle * Math.PI) / 180
  //   return {
  //     x: center.x + radius * Math.cos(rad),
  //     y: center.y + radius * Math.sin(rad)
  //   }
  // })
  return points
}

const evaluateBezierPoint = (points: Point[], t: number): Point => {
  if (points.length === 0) return { x: 0, y: 0 }
  let working = points.map((point) => ({ ...point }))
  while (working.length > 1) {
    const next: Point[] = []
    for (let index = 0; index < working.length - 1; index += 1) {
      next.push({
        x: working[index].x * (1 - t) + working[index + 1].x * t,
        y: working[index].y * (1 - t) + working[index + 1].y * t
      })
    }
    working = next
  }
  return working[0]
}

export const createBezierPoints = (controlPoints: Point[], segments = 64) => {
  const sampledPoints: Point[] = []
  const safeSegments = Math.max(2, segments)
  if (controlPoints.length === 0) return sampledPoints
  if (controlPoints.length === 1) return [{ ...controlPoints[0] }]
  for (let index = 0; index <= safeSegments; index += 1) {
    const t = index / safeSegments
    sampledPoints.push(evaluateBezierPoint(controlPoints, t))
  }
  return sampledPoints
}

/** 参数化椭圆：长轴方向与 +X 夹角 rotationDeg（度），t 为参数角（度） */
export const createEllipsePoints = (center: Point,radiusX: number,radiusY: number,rotationDeg: number,startAngleDeg = 0,endAngleDeg = 360,segments = 96): Point[] => {
  const rot = (rotationDeg * Math.PI) / 180
  const ux = Math.cos(rot)
  const uy = Math.sin(rot)
  const vx = -uy
  const vy = ux
  let sweep = endAngleDeg - startAngleDeg
  while (sweep > 360) sweep -= 360
  while (sweep <= -360) sweep += 360
  if (Math.abs(sweep) < 1e-9) {
    sweep = sweep >= 0 ? 360 : -360
  }
  const step = sweep / Math.max(segments, 1)
  const points: Point[] = []
  for (let index = 0; index <= segments; index += 1) {
    const tDeg = startAngleDeg + step * index
    const t = (tDeg * Math.PI) / 180
    const x = center.x + radiusX * Math.cos(t) * ux + radiusY * Math.sin(t) * vx
    const y = center.y + radiusX * Math.cos(t) * uy + radiusY * Math.sin(t) * vy
    points.push({ x, y })
  }
  return points
}

/** 方形：以 center 为中心，radiusX/radiusY 为半宽半高，可旋转 */
export const createSquarePoints = (center: Point,radiusX: number,radiusY: number,rotationDeg: number): Point[] => {
  const rot = (rotationDeg * Math.PI) / 180
  const ux = Math.cos(rot)
  const uy = Math.sin(rot)
  const vx = -uy
  const vy = ux
  const hx = Math.max(radiusX, 1e-6)
  const hy = Math.max(radiusY, 1e-6)
  const toWorld = (localX: number, localY: number): Point => ({
    x: center.x + localX * ux + localY * vx,
    y: center.y + localX * uy + localY * vy
  })
  return [
    toWorld(-hx, -hy),
    toWorld(hx, -hy),
    toWorld(hx, hy),
    toWorld(-hx, hy)
  ]
}

/** 垫形：圆角方形（Cushion），边中部略鼓、四角圆滑 */
export const createCushionPoints = (
  center: Point,
  radiusX: number,
  radiusY: number,
  rotationDeg: number,
  segments = 96
): Point[] => {
  const rot = (rotationDeg * Math.PI) / 180
  const ux = Math.cos(rot)
  const uy = Math.sin(rot)
  const vx = -uy
  const vy = ux
  const rx = Math.max(radiusX, 1e-6)
  const ry = Math.max(radiusY, 1e-6)
  const count = Math.max(segments, 32)
  const superellipseN = 3.6
  const bulge = 0.06
  const points: Point[] = []
  const toWorld = (localX: number, localY: number): Point => ({
    x: center.x + localX * ux + localY * vx,
    y: center.y + localX * uy + localY * vy
  })
  const spow = (value: number, power: number) => Math.sign(value) * Math.pow(Math.abs(value), power)

  for (let index = 0; index <= count; index += 1) {
    const t = (index / count) * Math.PI * 2
    const ct = Math.cos(t)
    const st = Math.sin(t)
    const localX = rx * spow(ct, 2 / superellipseN) * (1 + bulge * Math.cos(4 * t))
    const localY = ry * spow(st, 2 / superellipseN) * (1 + bulge * Math.cos(4 * t))
    points.push(toWorld(localX, localY))
  }
  return points
}

/** 八边形（切角矩形）：以 center 为中心，radiusX/radiusY 控制外接矩形半宽半高 */
export const createOctagonPoints = (
  center: Point,
  radiusX: number,
  radiusY: number,
  rotationDeg: number
): Point[] => {
  const rot = (rotationDeg * Math.PI) / 180
  const ux = Math.cos(rot)
  const uy = Math.sin(rot)
  const vx = -uy
  const vy = ux
  const rx = Math.max(radiusX, 1e-6)
  const ry = Math.max(radiusY, 1e-6)
  const chamferRatio = 0.28
  const cx = rx * chamferRatio
  const cy = ry * chamferRatio
  const toWorld = (localX: number, localY: number): Point => ({
    x: center.x + localX * ux + localY * vx,
    y: center.y + localX * uy + localY * vy
  })
  return [
    toWorld(-rx + cx, -ry),
    toWorld(rx - cx, -ry),
    toWorld(rx, -ry + cy),
    toWorld(rx, ry - cy),
    toWorld(rx - cx, ry),
    toWorld(-rx + cx, ry),
    toWorld(-rx, ry - cy),
    toWorld(-rx, -ry + cy)
  ]
}

/** 宝石状马眼：两端更尖、肩部更饱满，避免旧贝塞尔轮廓偏叶片/椭圆感 */
export const createMarquisePoints = (center: Point,radiusX: number,radiusY: number,rotationDeg: number,segments = 96): Point[] => {
  const rot = (rotationDeg * Math.PI) / 180
  const ux = Math.cos(rot)
  const uy = Math.sin(rot)
  const vx = -uy
  const vy = ux
  const toWorld = (localX: number, localY: number): Point => ({
    x: center.x + localX * ux + localY * vx,
    y: center.y + localX * uy + localY * vy
  })

  const rx = Math.max(radiusX, 1e-6)
  const ry = Math.max(radiusY, 1e-6)
  const halfSegments = Math.max(Math.floor(segments / 2), 16)
  const shoulderExponent = 0.72
  const points: Point[] = []

  const localYAt = (s: number) => {
    const clamped = Math.min(Math.max(s, 0), 1)
    const profile = Math.max(0, Math.sin(Math.PI * clamped))
    return ry * Math.pow(profile, shoulderExponent)
  }

  for (let index = 0; index <= halfSegments; index += 1) {
    const s = index / halfSegments
    const localX = -rx + 2 * rx * s
    points.push(toWorld(localX, localYAt(s)))
  }

  for (let index = 1; index <= halfSegments; index += 1) {
    const s = 1 - index / halfSegments
    const localX = -rx + 2 * rx * s
    points.push(toWorld(localX, -localYAt(s)))
  }

  return points
}

/** 梨形：圆润尾部 + 单侧尖端，尖端朝局部 +X 方向（与第二个定向点一致） */
export const createPearPoints = (center: Point,radiusX: number,radiusY: number,rotationDeg: number,segments = 96): Point[] => {
  const rot = (rotationDeg * Math.PI) / 180
  const ux = Math.cos(rot)
  const uy = Math.sin(rot)
  const vx = -uy
  const vy = ux
  const toWorld = (localX: number, localY: number): Point => ({
    x: center.x + localX * ux + localY * vx,
    y: center.y + localX * uy + localY * vy
  })

  const rx = Math.max(radiusX, 1e-6)
  const ry = Math.max(radiusY, 1e-6)
  const halfSegments = Math.max(Math.floor(segments / 2), 16)
  const alpha = 1.85
  const beta = 2.65
  const shoulderExponent = 0.82
  const peakS = (alpha - 1) / (alpha + beta - 2)
  const peakProfile = Math.pow(peakS, alpha - 1) * Math.pow(1 - peakS, beta - 1)
  const points: Point[] = []

  const localYAt = (s: number) => {
    const clamped = Math.min(Math.max(s, 0), 1)
    const profile = Math.pow(clamped, alpha - 1) * Math.pow(1 - clamped, beta - 1)
    return ry * Math.pow(profile / peakProfile, shoulderExponent)
  }

  for (let index = 0; index <= halfSegments; index += 1) {
    const s = index / halfSegments
    const localX = -rx + 2 * rx * s
    points.push(toWorld(localX, localYAt(s)))
  }

  for (let index = 1; index <= halfSegments; index += 1) {
    const s = 1 - index / halfSegments
    const localX = -rx + 2 * rx * s
    points.push(toWorld(localX, -localYAt(s)))
  }

  return points
}

/** 心形：上方双圆弧 + 下方尖点，尖点朝局部 +X 方向（与第二个定向点一致） */
export const createHeartPoints = (center: Point,radiusX: number,radiusY: number,rotationDeg: number,segments = 96): Point[] => {
  const rot = (rotationDeg * Math.PI) / 180
  const ux = Math.cos(rot)
  const uy = Math.sin(rot)
  const vx = -uy
  const vy = ux
  const toWorld = (localX: number, localY: number): Point => ({
    x: center.x + localX * ux + localY * vx,
    y: center.y + localX * uy + localY * vy
  })

  const rx = Math.max(radiusX, 1e-6)
  const ry = Math.max(radiusY, 1e-6)
  const totalSegments = Math.max(segments, 48)
  const points: Point[] = []
  let rawMinY = Infinity
  let rawMaxY = -Infinity

  for (let index = 0; index <= totalSegments; index += 1) {
    const t = (index / totalSegments) * Math.PI * 2
    const rawX = 16 * Math.pow(Math.sin(t), 3)
    const rawY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    rawMinY = Math.min(rawMinY, rawY)
    rawMaxY = Math.max(rawMaxY, rawY)
    points.push({ x: rawX / 16, y: rawY })
  }

  const yCenter = (rawMinY + rawMaxY) / 2
  const yRadius = Math.max((rawMaxY - rawMinY) / 2, 1e-6)
  return points.map((point) => {
    const localX = (-(point.y - yCenter) / yRadius) * rx
    const localY = point.x * ry * 0.98
    return toWorld(localX, localY)
  })
}

/**
 * LINE / ARC / CIRCLE / IRREGULAR(oval/marquise/pear/heart) 共用：entity.surfaceAngle（度）绕 ROCENTERPOS 轴线旋转全部参考几何顶点。
 * 与 Canvas (x, y) → Three Z-up (x, y, z) 一致。
 */
const makeSurfaceAngleRotation = (surfaceAngleDeg: number) => {
  const axisElevation = 0
  const axisStart = toThreePosition(ROCENTERPOS.START, axisElevation)
  const axisEnd = toThreePosition(ROCENTERPOS.END, axisElevation)
  // 表示旋转方向与 surfaceAngleDeg 的符号按产品约定取反（与同文件里 createEntityReferenceObject 使用的表面倾角一致，避免和 UI/业务角度定义拧着）
  return makeAxisRotationContext(axisStart, axisEnd, (-surfaceAngleDeg * Math.PI) / 180)
}

const createEntityReferenceObject = (entity: QomoEntityWithSurface,selected: boolean,endpointOffsetOverride?: EndpointOffsetOverride) => {
  const color = getReferenceDisplayColor(selected)
  const offsetColor = getOffsetReferenceDisplayColor(selected, entity.openDirection)
  const surfaceAngleDeg = entity.surfaceAngle ?? 0

  switch (entity.type) {
    case 'LINE': {
      const rotation = makeSurfaceAngleRotation(surfaceAngleDeg)

      const openSize = getEffectiveOpenSize(entity)
      const [calculatedOffsetStart, calculatedOffsetEnd] = offsetSegmentByOpenDirection(
        entity.start,
        entity.end,
        entity.openDirection,
        openSize
      )
      const offsetStart = endpointOffsetOverride?.start ?? calculatedOffsetStart
      const offsetEnd = endpointOffsetOverride?.end ?? calculatedOffsetEnd

      // 同时保留：原始实体 + 偏移实体
      const group = new THREE.Group()
      // 偏移实体
      group.add(
        createReferenceGroup(
          [entity.start, entity.end],
          entity.baseHeight,
          entity.extrudeHeight,
          color,
          selected,
          false,
          true,
          'uniform',
          entity.openDirection,
          rotation
        )
      )

      //   //获取旋转后的点的坐标
      // const rotatedRef = group.children[group.children.length - 1] as THREE.Group
      // rotatedRef.updateMatrixWorld(true)
      // // createReferenceGroup 里会先加一条 baseHeight 的线，再（如有）加一条 topElevation 的线
      // const lines = rotatedRef.children.filter((c): c is THREE.Line => (c as THREE.Line).isLine)
      // const baseLine = lines[0]
      // if (baseLine) {
      //   const posAttr = (baseLine.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute
      //   const start3 = new THREE.Vector3(posAttr.getX(0), posAttr.getY(0), posAttr.getZ(0)).applyMatrix4(baseLine.matrixWorld)
      //   const end3 = new THREE.Vector3(posAttr.getX(1), posAttr.getY(1), posAttr.getZ(1)).applyMatrix4(baseLine.matrixWorld)
      //   console.log('rotated start3/end3:', start3, end3)
      // }

      group.add(
        createReferenceGroup(
          [offsetStart, offsetEnd],
          entity.baseHeight,
          entity.extrudeHeight,
          offsetColor,
          selected,
          false,
          true,
          'gradient',
          entity.openDirection,
          rotation
        )
      )

      // 在两条线段之间补上“桥接区域”
      // 1) 用 start/offsetStart 与 end/offsetEnd 生成两块竖直侧面
      // 2) 用原始/偏移四点生成底面与顶面，让中间区域更明显
      if (Math.abs(entity.extrudeHeight) > 1e-9) {
        const topElevation = entity.baseHeight - entity.extrudeHeight
        group.add(
          createReferenceWallFace(
            entity.start,
            offsetStart,
            entity.baseHeight,
            topElevation,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            entity.openDirection,
            false,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )
        group.add(
          createReferenceWallFace(
            entity.end,
            offsetEnd,
            entity.baseHeight,
            topElevation,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            entity.openDirection,
            false,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )
        group.add(
          createQuadFace(
            entity.start,
            entity.end,
            offsetEnd,
            offsetStart,
            entity.baseHeight,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )
        group.add(
          createQuadFace(
            entity.start,
            entity.end,
            offsetEnd,
            offsetStart,
            topElevation,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )
      }
      return group
    }
    case 'ARC': {
      const openSize = getEffectiveOpenSize(entity)
      const offsetRadius = computeArcOffsetRadius(entity, openSize)

      const innerPts = createArcPoints(
        entity.center,
        entity.radius,
        entity.startAngle,
        entity.endAngle
      )
      const computedOuterPts = createArcPoints(
        entity.center,
        offsetRadius,
        entity.startAngle,
        entity.endAngle
      )
      if (innerPts.length < 2 || computedOuterPts.length < 2) return undefined
      const outerPts = computedOuterPts.map((point) => ({ ...point }))
      if (endpointOffsetOverride?.start) outerPts[0] = endpointOffsetOverride.start
      if (endpointOffsetOverride?.end) outerPts[outerPts.length - 1] = endpointOffsetOverride.end

      const rotation = makeSurfaceAngleRotation(surfaceAngleDeg)

      const group = new THREE.Group()
      // 原始弧 + 偏移弧（偏移弧用渐变层）
      group.add(
        createReferenceGroup(
          innerPts,
          entity.baseHeight,
          entity.extrudeHeight,
          color,
          selected,
          false,
          true,
          'uniform',
          entity.openDirection,
          rotation
        )
      )
      group.add(
        createReferenceGroup(
          outerPts,
          entity.baseHeight,
          entity.extrudeHeight,
          offsetColor,
          selected,
          false,
          true,
          'gradient',
          entity.openDirection,
          rotation
        )
      )

      // 桥接预览：补 “原始弧 ↔ 偏移弧” 之间的可见面（起止径向面 + 底/顶水平面）
      if (Math.abs(entity.extrudeHeight) > 1e-9) {
        const topElevation = entity.baseHeight - entity.extrudeHeight

        const innerStart = innerPts[0]
        const innerEnd = innerPts[innerPts.length - 1]
        const outerStart = outerPts[0]
        const outerEnd = outerPts[outerPts.length - 1]

        group.add(
          createReferenceWallFace(
            innerStart,
            outerStart,
            entity.baseHeight,
            topElevation,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            entity.openDirection,
            false,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )
        group.add(
          createReferenceWallFace(
            innerEnd,
            outerEnd,
            entity.baseHeight,
            topElevation,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            entity.openDirection,
            false,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )

        const bottomCap = createSectorCapFace(
          innerPts,
          outerPts,
          entity.baseHeight,
          BRIGR_SELECT_OFFSET_COLOR,
          selected,
          BRIDGE_LAYER_OPACITY_SCALE,
          rotation
        )
        if (bottomCap) group.add(bottomCap)

        const topCap = createSectorCapFace(
          innerPts,
          outerPts,
          topElevation,
          BRIGR_SELECT_OFFSET_COLOR,
          selected,
          BRIDGE_LAYER_OPACITY_SCALE,
          rotation
        )
        if (topCap) group.add(topCap)
      }

      return group
    }
    case 'CIRCLE': {
      // 与 LINE/ARC 一致：原始圆（uniform）+ 偏移圆（gradient）；surfaceAngle 同样经 makeSurfaceAngleRotation 作用
      // 圆环方向约定：LEFT 偏移在圆外侧（半径增大）；RIGHT 偏移在圆内侧（半径减小）
      const segments = 360
      const openSize = getEffectiveOpenSize(entity)
      const r = entity.radius
      const offsetRadius = Math.max(1e-6, r - openSize * getOpenDirectionSign(entity.openDirection))

      const innerPts = createArcPoints(entity.center, r, 0, 360, segments)
      const outerPts = createArcPoints(entity.center, offsetRadius, 0, 360, segments)
      if (innerPts.length < 2 || outerPts.length < 2) return undefined

      const rotation = makeSurfaceAngleRotation(surfaceAngleDeg)

      const group = new THREE.Group()
      group.add(
        createReferenceGroup(
          innerPts,
          entity.baseHeight,
          entity.extrudeHeight,
          color,
          selected,
          true,
          true,
          'uniform',
          entity.openDirection,
          rotation
        )
      )
      group.add(
        createReferenceGroup(
          outerPts,
          entity.baseHeight,
          entity.extrudeHeight,
          offsetColor,
          selected,
          true,
          true,
          'gradient',
          entity.openDirection,
          rotation
        )
      )

      // 桥接：整圆在参数 0° 与 360° 处重合，起止径向面退化为一点；在 180° 处补一条径向面避免无缝
      if (Math.abs(entity.extrudeHeight) > 1e-9) {
        const topZ = entity.baseHeight - entity.extrudeHeight
        const innerStart = innerPts[0]
        const outerStart = outerPts[0]
        const mid = Math.floor(innerPts.length / 2)
        const innerMid = innerPts[mid]
        const outerMid = outerPts[mid]

        group.add(
          createReferenceWallFace(
            innerStart,
            outerStart,
            entity.baseHeight,
            topZ,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            entity.openDirection,
            false,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )
        group.add(
          createReferenceWallFace(
            innerMid,
            outerMid,
            entity.baseHeight,
            topZ,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            entity.openDirection,
            false,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )

        const bottomCap = createSectorCapFace(
          innerPts,
          outerPts,
          entity.baseHeight,
          BRIGR_SELECT_OFFSET_COLOR,
          selected,
          BRIDGE_LAYER_OPACITY_SCALE,
          rotation
        )
        if (bottomCap) group.add(bottomCap)
        const topCap = createSectorCapFace(
          innerPts,
          outerPts,
          topZ,
          BRIGR_SELECT_OFFSET_COLOR,
          selected,
          BRIDGE_LAYER_OPACITY_SCALE,
          rotation
        )
        if (topCap) group.add(topCap)
      }

      return group
    }
    case 'BEZIER': {
      const segments = 96
      const openSize = getEffectiveOpenSize(entity)
      const innerPts = createBezierPoints(entity.points, segments)
      const computedOuterPts = offsetOpenPolylineByOpenDirection(innerPts, entity.openDirection, openSize)
      if (innerPts.length < 2 || computedOuterPts.length < 2) return undefined
      const outerPts = computedOuterPts.map((point) => ({ ...point }))
      if (endpointOffsetOverride?.start) outerPts[0] = endpointOffsetOverride.start
      if (endpointOffsetOverride?.end) outerPts[outerPts.length - 1] = endpointOffsetOverride.end

      const rotation = makeSurfaceAngleRotation(surfaceAngleDeg)
      const group = new THREE.Group()
      group.add(
        createReferenceGroup(
          innerPts,
          entity.baseHeight,
          entity.extrudeHeight,
          color,
          selected,
          false,
          true,
          'uniform',
          entity.openDirection,
          rotation
        )
      )
      group.add(
        createReferenceGroup(
          outerPts,
          entity.baseHeight,
          entity.extrudeHeight,
          offsetColor,
          selected,
          false,
          true,
          'gradient',
          entity.openDirection,
          rotation
        )
      )

      if (Math.abs(entity.extrudeHeight) > 1e-9) {
        const topZ = entity.baseHeight - entity.extrudeHeight
        group.add(
          createReferenceWallFace(
            innerPts[0],
            outerPts[0],
            entity.baseHeight,
            topZ,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            entity.openDirection,
            false,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )
        group.add(
          createReferenceWallFace(
            innerPts[innerPts.length - 1],
            outerPts[outerPts.length - 1],
            entity.baseHeight,
            topZ,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            entity.openDirection,
            false,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )
      }

      return group
    }
    case 'IRREGULAR': {
      if (
        entity.shape !== 'oval' &&
        entity.shape !== 'marquise' &&
        entity.shape !== 'pear' &&
        entity.shape !== 'heart' &&
        entity.shape !== 'square' &&
        entity.shape !== 'cushion' &&
        entity.shape !== 'octagon'
      )
        return undefined
      const segments = 96
      const openSize = getEffectiveOpenSize(entity)
      const rx = entity.radiusX
      const ry = entity.radiusY
      const rot = entity.rotationDeg
      const delta = -openSize * getOpenDirectionSign(entity.openDirection)
      const outerRx = Math.max(1e-6, rx + delta)
      const outerRy = Math.max(1e-6, ry + delta)

      const innerPts =
        entity.shape === 'marquise'
          ? createMarquisePoints(entity.center, rx, ry, rot, segments)
          : entity.shape === 'pear'
            ? createPearPoints(entity.center, rx, ry, rot, segments)
            : entity.shape === 'heart'
              ? createHeartPoints(entity.center, rx, ry, rot, segments)
              : entity.shape === 'square'
                ? createSquarePoints(entity.center, rx, ry, rot)
              : entity.shape === 'cushion'
                ? createCushionPoints(entity.center, rx, ry, rot, segments)
              : entity.shape === 'octagon'
                ? createOctagonPoints(entity.center, rx, ry, rot)
              : createEllipsePoints(entity.center, rx, ry, rot, 0, 360, segments)
      const outerPts =
        entity.shape === 'marquise'
          ? createMarquisePoints(entity.center, outerRx, outerRy, rot, segments)
          : entity.shape === 'pear'
            ? createPearPoints(entity.center, outerRx, outerRy, rot, segments)
            : entity.shape === 'heart'
              ? createHeartPoints(entity.center, outerRx, outerRy, rot, segments)
              : entity.shape === 'square'
                ? createSquarePoints(entity.center, outerRx, outerRy, rot)
              : entity.shape === 'cushion'
                ? createCushionPoints(entity.center, outerRx, outerRy, rot, segments)
              : entity.shape === 'octagon'
                ? createOctagonPoints(entity.center, outerRx, outerRy, rot)
              : createEllipsePoints(entity.center, outerRx, outerRy, rot, 0, 360, segments)
      if (innerPts.length < 2 || outerPts.length < 2) return undefined

      const rotation = makeSurfaceAngleRotation(surfaceAngleDeg)

      const group = new THREE.Group()
      group.add(
        createReferenceGroup(
          innerPts,
          entity.baseHeight,
          entity.extrudeHeight,
          color,
          selected,
          true,
          true,
          'uniform',
          entity.openDirection,
          rotation
        )
      )
      group.add(
        createReferenceGroup(
          outerPts,
          entity.baseHeight,
          entity.extrudeHeight,
          offsetColor,
          selected,
          true,
          true,
          'gradient',
          entity.openDirection,
          rotation
        )
      )

      if (Math.abs(entity.extrudeHeight) > 1e-9) {
        const topZ = entity.baseHeight - entity.extrudeHeight
        const innerStart = innerPts[0]
        const outerStart = outerPts[0]
        const mid = Math.floor(innerPts.length / 2)
        const innerMid = innerPts[mid]
        const outerMid = outerPts[mid]

        group.add(
          createReferenceWallFace(
            innerStart,
            outerStart,
            entity.baseHeight,
            topZ,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            entity.openDirection,
            false,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )
        group.add(
          createReferenceWallFace(
            innerMid,
            outerMid,
            entity.baseHeight,
            topZ,
            BRIGR_SELECT_OFFSET_COLOR,
            selected,
            entity.openDirection,
            false,
            BRIDGE_LAYER_OPACITY_SCALE,
            rotation
          )
        )

        const bottomCap = createSectorCapFace(
          innerPts,
          outerPts,
          entity.baseHeight,
          BRIGR_SELECT_OFFSET_COLOR,
          selected,
          BRIDGE_LAYER_OPACITY_SCALE,
          rotation
        )
        if (bottomCap) group.add(bottomCap)
        const topCap = createSectorCapFace(
          innerPts,
          outerPts,
          topZ,
          BRIGR_SELECT_OFFSET_COLOR,
          selected,
          BRIDGE_LAYER_OPACITY_SCALE,
          rotation
        )
        if (topCap) group.add(topCap)
      }

      return group
    }
    default:
      return undefined
  }
}

const createReferenceGroup = (
  points: Point[],
  baseHeight: number,
  extrudeHeight: number,
  color: number,
  selected: boolean,
  closed = false,
  fillSurface = true,
  wallStyle: 'uniform' | 'gradient' = 'uniform',
  openDirection: OpenDirectionType = 'RIGHT',
  rotation: AxisRotationContext | null = null
) => {
  const group = new THREE.Group()
  const pathPoints = closed && points.length > 1 ? [...points, points[0]] : points
  group.add(createLineFromPoints(pathPoints, baseHeight, color, rotation))
  if (Math.abs(extrudeHeight) > 1e-9) {
    const topElevation = baseHeight - extrudeHeight
    group.add(createLineFromPoints(pathPoints, topElevation, color, rotation))

    if (fillSurface) {
      for (let index = 0; index < pathPoints.length - 1; index += 1) {
        const start = pathPoints[index]
        const end = pathPoints[index + 1]
        group.add(
          createReferenceWallFace(
            start,
            end,
            baseHeight,
            topElevation,
            color,
            selected,
            openDirection,
            wallStyle === 'gradient',
            UNIFORM_LAYER_OPACITY_SCALE,
            rotation
          )
        )
      }
    }
    // 竖向连接线：开放路径只在起终点各画一条（类似“封口”）。
    // 闭合路径（整圆）若对每个顶点都画竖线，会出现一圈密集细线；侧面已由相邻 createReferenceWallFace 拼成连续带，无需逐点竖线。
    const connectorCandidates = closed ? [] : [points[0], points[points.length - 1]].filter(Boolean)
    connectorCandidates.forEach((point) => {
      group.add(createVerticalConnector(point, baseHeight, topElevation, color, rotation))
    })
  }
  return group
}

/** 底→顶颜色渐变；LEFT / RIGHT 用不同色相区分开口侧 */
const wallGradientColors = (openDirection: OpenDirectionType, selected: boolean) => {
  let bottom = new THREE.Color(
    openDirection === 'RIGHT'
      ? BASE_REFERENCE_OFFSET_COLOR_LEFT_BUTTOM
      : BASE_REFERENCE_OFFSET_COLOR_RIGHT_BUTTOM
  )
  let top = new THREE.Color(
    openDirection === 'RIGHT'
      ? BASE_REFERENCE_OFFSET_COLOR_LEFT_TOP
      : BASE_REFERENCE_OFFSET_COLOR_RIGHT_TOP
  )
  if (selected) {
    bottom = new THREE.Color(
      openDirection === 'RIGHT'
        ? SELECTED_REFERENCE_OFFSET_COLOR_LEFT_BUTTOM
        : SELECTED_REFERENCE_OFFSET_COLOR_RIGHT_BUTTOM
    )
    top = new THREE.Color(
      openDirection === 'RIGHT'
        ? SELECTED_REFERENCE_OFFSET_COLOR_LEFT_TOP
        : SELECTED_REFERENCE_OFFSET_COLOR_RIGHT_TOP
    )
    // const sel = new THREE.Color(SELECTED_REFERENCE_COLOR)
    // bottom.lerp(sel, 0.28)
    // top.lerp(sel, 0.2)
  }
  return { bottom, top }
}

const createReferenceWallFace = (
  start: Point,
  end: Point,
  baseZ: number,
  topZ: number,
  lineColor: number,
  selected: boolean,
  openDirection: OpenDirectionType,
  useGradient: boolean,
  uniformOpacityScale: number = UNIFORM_LAYER_OPACITY_SCALE,
  rotation: AxisRotationContext | null = null
) => {
  const positions = [
    ...toThreePositionWithAxisRotation(start, baseZ, rotation).toArray(),
    ...toThreePositionWithAxisRotation(end, baseZ, rotation).toArray(),
    ...toThreePositionWithAxisRotation(end, topZ, rotation).toArray(),
    ...toThreePositionWithAxisRotation(start, baseZ, rotation).toArray(),
    ...toThreePositionWithAxisRotation(end, topZ, rotation).toArray(),
    ...toThreePositionWithAxisRotation(start, topZ, rotation).toArray()
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

  let material: THREE.MeshStandardMaterial
  if (useGradient) {
    const { bottom, top } = wallGradientColors(openDirection, selected)
    const colors = new Float32Array([
      bottom.r,
      bottom.g,
      bottom.b,
      bottom.r,
      bottom.g,
      bottom.b,
      top.r,
      top.g,
      top.b,
      bottom.r,
      bottom.g,
      bottom.b,
      top.r,
      top.g,
      top.b,
      top.r,
      top.g,
      top.b
    ])
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    material = createGradientReferenceSurfaceMaterial(selected, GRADIENT_LAYER_OPACITY_SCALE)
  } else {
    material = createReferenceSurfaceMaterial(lineColor, selected, uniformOpacityScale)
  }

  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, material)
}

const createQuadFace = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  z: number,
  colorHex: number,
  selected: boolean,
  opacityScale: number,
  rotation: AxisRotationContext | null = null
) => {
  // 两个三角形填充四边形：p0-p1-p2 和 p0-p2-p3
  const v0 = toThreePositionWithAxisRotation(p0, z, rotation)
  const v1 = toThreePositionWithAxisRotation(p1, z, rotation)
  const v2 = toThreePositionWithAxisRotation(p2, z, rotation)
  const v3 = toThreePositionWithAxisRotation(p3, z, rotation)

  const positions = [
    ...v0.toArray(),
    ...v1.toArray(),
    ...v2.toArray(),
    ...v0.toArray(),
    ...v2.toArray(),
    ...v3.toArray()
  ]

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()

  const material = createReferenceSurfaceMaterial(colorHex, selected, opacityScale)
  return new THREE.Mesh(geometry, material)
}

/**
 * 在固定 z 平面上，用三角形带填充 “原始弧 ↔ 偏移弧” 之间的水平桥接面。
 * 约定：innerPoints[i] 与 outerPoints[i] 对应同一个扫掠角参数。
 */
const createSectorCapFace = (
  innerPoints: Point[],
  outerPoints: Point[],
  z: number,
  colorHex: number,
  selected: boolean,
  opacityScale: number,
  rotation: AxisRotationContext | null = null
) => {
  if (innerPoints.length < 2 || outerPoints.length < 2) return undefined
  const n = Math.min(innerPoints.length, outerPoints.length)
  if (n < 2) return undefined

  const positions: number[] = []
  // 两个边界之间的三角形带（inner[i]-inner[i+1]-outer[i+1]-outer[i]）
  for (let i = 0; i < n - 1; i += 1) {
    const a = toThreePositionWithAxisRotation(innerPoints[i], z, rotation)
    const b = toThreePositionWithAxisRotation(innerPoints[i + 1], z, rotation)
    const c = toThreePositionWithAxisRotation(outerPoints[i + 1], z, rotation)
    const d = toThreePositionWithAxisRotation(outerPoints[i], z, rotation)

    // tri1: a-b-c
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray())
    // tri2: a-c-d
    positions.push(...a.toArray(), ...c.toArray(), ...d.toArray())
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  const material = createReferenceSurfaceMaterial(colorHex, selected, opacityScale)
  return new THREE.Mesh(geometry, material)
}

const createGradientReferenceSurfaceMaterial = (selected: boolean, opacityScale = 1) =>
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity:
      (selected ? SELECTED_REFERENCE_SURFACE_OPACITY : BASE_REFERENCE_SURFACE_OPACITY) *
      opacityScale,
    side: THREE.DoubleSide,
    roughness: 0.62,
    metalness: 0.06,
    depthWrite: false,
    emissive: 0x0a0a12,
    emissiveIntensity: 0.12
  })

const createReferenceSurfaceMaterial = (color: number, selected: boolean, opacityScale = 1) =>
  new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity:
      (selected ? SELECTED_REFERENCE_SURFACE_OPACITY : BASE_REFERENCE_SURFACE_OPACITY) *
      opacityScale,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0.02,
    depthWrite: false,
    emissive: 0x05050a,
    emissiveIntensity: 0.06
  })

export const disposeThreeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    const meshChild = child as THREE.Mesh
    const lineChild = child as THREE.Line
    const spriteChild = child as THREE.Sprite
    const geometry = meshChild.geometry || lineChild.geometry
    if (geometry && typeof geometry.dispose === 'function') {
      geometry.dispose()
    }
    const materialCandidate = meshChild.material || lineChild.material || spriteChild.material
    if (Array.isArray(materialCandidate)) {
      materialCandidate.forEach((material) => material.dispose?.())
    } else {
      materialCandidate?.dispose?.()
    }
    if ((spriteChild.material as THREE.SpriteMaterial | undefined)?.map) {
      ;(spriteChild.material as THREE.SpriteMaterial).map?.dispose()
    }
  })
}

export const buildQomo5PSceneObjects = (entities: QomoEntityWithSurface[],selectedEntityIds: string[]) => {
  const selectedIdSet = new Set(selectedEntityIds)
  const endpointOffsetOverrides = buildOpenEntityOffsetOverrides(entities)
  return entities
    .map((entity) =>
      buildQomo5PEntityObject3d(
        entity,
        selectedIdSet.has(entity.id),
        endpointOffsetOverrides.get(entity.id)
      )
    )
    .filter((object): object is THREE.Object3D => Boolean(object))
}

export const buildQomo5PEntityObject3d = (entity: QomoEntityWithSurface,selected = false,endpointOffsetOverride?: EndpointOffsetOverride) => {
  const object = createEntityReferenceObject(entity, selected, endpointOffsetOverride)

  if (!object) return null

  object.userData.entityId = entity.id
  object.userData.entityType = entity.type
  return object
}

const buildProjectionToZ0ForEntity = (entity: QomoEntityWithSurface,selected: boolean): THREE.Object3D | undefined => {
  // 原始实体点先旋转，再投影到 z=0
  const surfaceAngleDeg = entity.surfaceAngle ?? 0
  const color = getReferenceDisplayColor(selected)
  const material = new THREE.LineBasicMaterial({color,transparent: true,opacity: selected ? 0.92 : 0.72,depthWrite: false})
  const offsetColor = getOffsetReferenceDisplayColor(selected, entity.openDirection)
  const offsetMaterial = new THREE.LineBasicMaterial({color: offsetColor,transparent: true,opacity: selected ? 0.95 : 0.76,depthWrite: false})
  const openSize = getEffectiveOpenSize(entity)
  const buildProjectedLine = (points: Point[]) => {
    if (points.length < 2) return undefined
    const projectedPts = points.map((p) =>projectRotatedEntityPointToThreeZPlane(p, entity.baseHeight, surfaceAngleDeg))
    console.log(projectedPts,"projectedPts===============")
    const projectedGeometry = new THREE.BufferGeometry().setFromPoints(projectedPts)
    const projectedLine = new THREE.Line(projectedGeometry, material)
    projectedLine.userData.entityId = entity.id
    projectedLine.userData.entityType = entity.type

    if (openSize < 1e-9) return projectedLine

    // 以“投影到 z=0 的点”为基准做开口方向偏移，再映射回 Three 的 XY 平面展示
    const projectedCanvasPts = projectedPts.map(canvasPointFromThreeZPlane)
    console.log(entity.openDirection,openSize,"==========================")
    // const offsetCanvasPts = offsetOpenPolylineByOpenDirection(projectedCanvasPts,entity.openDirection,openSize)
    const offsetCanvasPts = offsetOpenPolylineByOpenDirection(projectedCanvasPts,entity.openDirection,1)
    const offsetThreePts = offsetCanvasPts.map((p) => toThreePosition(p, 0))
    console.log(offsetThreePts,"offsetThreePts===============")
    const offsetGeometry = new THREE.BufferGeometry().setFromPoints(offsetThreePts)
    const offsetLine = new THREE.Line(offsetGeometry, offsetMaterial)
    offsetLine.userData.entityId = entity.id
    offsetLine.userData.entityType = entity.type
    offsetLine.userData.isOffsetProjection = true

    const group = new THREE.Group()
    group.add(projectedLine)
    group.add(offsetLine)
    group.userData.entityId = entity.id
    group.userData.entityType = entity.type
    return group
  }

  if (entity.type === 'LINE') return buildProjectedLine([entity.start, entity.end])

  if (entity.type === 'ARC') {
    const segments = 96
    const arcPts = createArcPoints(entity.center,entity.radius,entity.startAngle,entity.endAngle,segments)
    return buildProjectedLine(arcPts)
  }

  if (entity.type === 'CIRCLE') {
    const segments = 144
    const circlePts = createArcPoints(entity.center, entity.radius, 0, 360, segments)
    return buildProjectedLine(circlePts)
  }

  if (entity.type === 'BEZIER') {
    const segments = 96
    const bezierPts = createBezierPoints(entity.points, segments)
    return buildProjectedLine(bezierPts)
  }

  if (isEllipseLikeIrregularEntity(entity)) {
    const segments = 96
    const pts =
      entity.shape === 'marquise'
        ? createMarquisePoints(
            entity.center,
            entity.radiusX,
            entity.radiusY,
            entity.rotationDeg,
            segments
          )
        : entity.shape === 'pear'
          ? createPearPoints(
              entity.center,
              entity.radiusX,
              entity.radiusY,
              entity.rotationDeg,
              segments
            )
          : entity.shape === 'heart'
            ? createHeartPoints(
                entity.center,
                entity.radiusX,
                entity.radiusY,
                entity.rotationDeg,
                segments
              )
            : entity.shape === 'square'
              ? createSquarePoints(
                  entity.center,
                  entity.radiusX,
                  entity.radiusY,
                  entity.rotationDeg
                )
            : entity.shape === 'cushion'
              ? createCushionPoints(
                  entity.center,
                  entity.radiusX,
                  entity.radiusY,
                  entity.rotationDeg,
                  segments
                )
            : entity.shape === 'octagon'
              ? createOctagonPoints(
                  entity.center,
                  entity.radiusX,
                  entity.radiusY,
                  entity.rotationDeg
                )
            : createEllipsePoints(
                entity.center,
                entity.radiusX,
                entity.radiusY,
                entity.rotationDeg,
                0,
                360,
                segments
              )
    return buildProjectedLine(pts)
  }

  return undefined
}

export const buildQomo5PProjectionToZ0Objects = (entities: QomoEntityWithSurface[],selectedEntityIds: string[]) => {
  const selectedIdSet = new Set(selectedEntityIds)
  return entities
    .map((entity) => buildProjectionToZ0ForEntity(entity, selectedIdSet.has(entity.id)))
    .filter((object): object is THREE.Object3D => Boolean(object))
}
