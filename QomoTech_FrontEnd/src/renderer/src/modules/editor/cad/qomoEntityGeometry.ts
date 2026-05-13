/**
 * Qomo5P 实体几何工具——纯函数。
 * 从 stores/qomo5pEditor.ts 抽出，便于单独测试与跨场景复用。
 */
import type {
  Point,
  QomoBezierSurfacesEntity,
  QomoBounds,
  QomoEntityWithSurface,
  QomoIrregularSurfacesEntity,
  QomoLayer,
  QomoLineSurfacesEntity
} from '../qomo5pTypes'
import {
  createArcPoints,
  createBezierPoints,
  createEllipsePoints,
  createHeartPoints,
  createMarquisePoints,
  createOctagonPoints,
  createPearPoints,
  createSquarePoints,
  createCushionPoints
} from './threeGeometry'

/** 贝塞尔曲线点数上限（存储侧约束，与 QomoCanvas.vue 内的交互约束分离） */
export const MAX_BEZIER_POINTS = 128

const LINK_EPS = 1e-6

export const isPoint = (point: Point | undefined): point is Point =>
  point != null && typeof point.x === 'number' && typeof point.y === 'number'

export const isSamePoint = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) <= LINK_EPS && Math.abs(a.y - b.y) <= LINK_EPS

export const isEllipseLikeIrregularEntity = (
  entity: QomoEntityWithSurface
): entity is QomoIrregularSurfacesEntity =>
  entity.type === 'IRREGULAR' &&
  (entity.shape === 'oval' ||
    entity.shape === 'square' ||
    entity.shape === 'cushion' ||
    entity.shape === 'octagon' ||
    entity.shape === 'marquise' ||
    entity.shape === 'pear' ||
    entity.shape === 'heart')

export const isBezierEntity = (
  entity: QomoEntityWithSurface
): entity is QomoBezierSurfacesEntity => entity.type === 'BEZIER'

export const boundsFromPoints = (pts: Point[]): QomoBounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

export const normalizeBezierPoints = (
  entity: QomoBezierSurfacesEntity | (QomoEntityWithSurface & Record<string, unknown>)
): Point[] => {
  const anyEntity = entity as QomoBezierSurfacesEntity & {
    start?: Point
    control1?: Point
    control2?: Point
    end?: Point
  }
  const normalizedPoints = Array.isArray(anyEntity.points)
    ? anyEntity.points.filter(isPoint).slice(0, MAX_BEZIER_POINTS)
    : [anyEntity.start, anyEntity.control1, anyEntity.control2, anyEntity.end].filter(isPoint)
  return normalizedPoints.map((point) => ({ x: point.x, y: point.y }))
}

export const normalizeEntity = (entity: QomoEntityWithSurface): QomoEntityWithSurface => {
  if (!isBezierEntity(entity)) return entity
  return {
    ...entity,
    points: normalizeBezierPoints(entity)
  }
}

export const getEntityBounds = (entity: QomoEntityWithSurface): QomoBounds => {
  if (entity.type === 'LINE') {
    return {
      minX: Math.min(entity.start.x, entity.end.x),
      minY: Math.min(entity.start.y, entity.end.y),
      maxX: Math.max(entity.start.x, entity.end.x),
      maxY: Math.max(entity.start.y, entity.end.y)
    }
  }
  if (entity.type === 'ARC') {
    const pts = createArcPoints(
      entity.center,
      entity.radius,
      entity.startAngle,
      entity.endAngle,
      64
    )
    return boundsFromPoints(pts)
  }
  if (entity.type === 'CIRCLE') {
    return {
      minX: entity.center.x - entity.radius,
      minY: entity.center.y - entity.radius,
      maxX: entity.center.x + entity.radius,
      maxY: entity.center.y + entity.radius
    }
  }
  if (isBezierEntity(entity)) {
    return boundsFromPoints(createBezierPoints(entity.points, 96))
  }
  if (isEllipseLikeIrregularEntity(entity)) {
    const pts =
      entity.shape === 'marquise'
        ? createMarquisePoints(
            entity.center,
            entity.radiusX,
            entity.radiusY,
            entity.rotationDeg,
            64
          )
        : entity.shape === 'pear'
          ? createPearPoints(entity.center, entity.radiusX, entity.radiusY, entity.rotationDeg, 64)
          : entity.shape === 'heart'
            ? createHeartPoints(
                entity.center,
                entity.radiusX,
                entity.radiusY,
                entity.rotationDeg,
                64
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
                  64
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
                64
              )
    return boundsFromPoints(pts)
  }
  return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
}

export const getBoundsFromEntities = (
  entities: QomoEntityWithSurface[]
): QomoBounds | null => {
  if (entities.length === 0) {
    return null
  }

  return entities.reduce<QomoBounds | null>((acc, entity) => {
    const bounds = getEntityBounds(entity)
    if (!acc) {
      return bounds
    }

    return {
      minX: Math.min(acc.minX, bounds.minX),
      minY: Math.min(acc.minY, bounds.minY),
      maxX: Math.max(acc.maxX, bounds.maxX),
      maxY: Math.max(acc.maxY, bounds.maxY)
    }
  }, null)
}

export const recenterEntitiesAroundOrigin = (
  input: QomoEntityWithSurface[]
): QomoEntityWithSurface[] => {
  const bounds = getBoundsFromEntities(input)
  if (!bounds) return input
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return input
  if (Math.abs(centerX) < 1e-9 && Math.abs(centerY) < 1e-9) return input

  const dx = -centerX
  const dy = -centerY

  return input.map((entity) => {
    if (entity.type === 'LINE') {
      return {
        ...entity,
        start: { x: entity.start.x + dx, y: entity.start.y + dy },
        end: { x: entity.end.x + dx, y: entity.end.y + dy }
      }
    }
    if (entity.type === 'ARC') {
      return {
        ...entity,
        center: { x: entity.center.x + dx, y: entity.center.y + dy },
        startPoint: entity.startPoint
          ? { x: entity.startPoint.x + dx, y: entity.startPoint.y + dy }
          : undefined,
        endPoint: entity.endPoint
          ? { x: entity.endPoint.x + dx, y: entity.endPoint.y + dy }
          : undefined
      }
    }
    if (entity.type === 'CIRCLE') {
      return {
        ...entity,
        center: { x: entity.center.x + dx, y: entity.center.y + dy }
      }
    }
    if (isBezierEntity(entity)) {
      return {
        ...entity,
        points: entity.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
      }
    }
    if (isEllipseLikeIrregularEntity(entity)) {
      return {
        ...entity,
        center: { x: entity.center.x + dx, y: entity.center.y + dy }
      }
    }
    return entity
  })
}

export const rebuildLayerCounts = (
  layers: QomoLayer[],
  entities: QomoEntityWithSurface[]
): QomoLayer[] => {
  const countMap = new Map<string, number>()
  entities.forEach((entity) => {
    countMap.set(entity.layerId, (countMap.get(entity.layerId) || 0) + 1)
  })

  return layers.map((layer) => ({
    ...layer,
    entityCount: countMap.get(layer.id) || 0
  }))
}

export const applySelectionFlags = (
  entities: QomoEntityWithSurface[],
  selectedIds: string[]
): QomoEntityWithSurface[] => {
  const selectedIdSet = new Set(selectedIds)
  return entities.map((entity) => {
    const normalized = normalizeEntity(entity)
    return {
      ...normalized,
      selected: selectedIdSet.has(normalized.id)
    }
  })
}

// =====================================================================
// 导出实体节点连接（用于 export 时把开口实体首尾相连）
// =====================================================================

export type ExportLineNodeRef = { id: string; endpoint: 'start' | 'end' }
export type ExportLineNode = { start: ExportLineNodeRef | null; end: ExportLineNodeRef | null }
export type ExportEntity = QomoEntityWithSurface & { node?: ExportLineNode }
export type OpenEndedExportEntity = Extract<ExportEntity, { type: 'LINE' | 'ARC' | 'BEZIER' }>

const getArcEndpoint = (
  arc: Extract<ExportEntity, { type: 'ARC' }>,
  which: 'start' | 'end'
): Point => {
  const center = arc.center
  const radius = arc.radius
  const angle = which === 'start' ? arc.startAngle : arc.endAngle
  const endpoint = which === 'start' ? arc.startPoint : arc.endPoint
  if (endpoint) return endpoint
  const rad = (angle * Math.PI) / 180
  return { x: center.x + radius * Math.cos(rad), y: center.y + radius * Math.sin(rad) }
}

export const getOpenEntityEndpoints = (
  entity: OpenEndedExportEntity
): { start: Point; end: Point } => {
  if (entity.type === 'LINE') {
    return { start: entity.start, end: entity.end }
  }
  if (entity.type === 'ARC') {
    return { start: getArcEndpoint(entity, 'start'), end: getArcEndpoint(entity, 'end') }
  }
  return {
    start: entity.points[0],
    end: entity.points[entity.points.length - 1]
  }
}

export const attachNodeForOpenEntities = (entities: ExportEntity[]): ExportEntity[] => {
  type EndpointRef = { id: string; endpoint: 'start' | 'end'; point: Point }
  const keyOf = (p: Point) => `${p.x.toFixed(6)}|${p.y.toFixed(6)}`
  const endpointMap = new Map<string, EndpointRef[]>()

  entities.forEach((entity) => {
    if (entity.type !== 'LINE' && entity.type !== 'ARC' && entity.type !== 'BEZIER') return
    const endpoints = getOpenEntityEndpoints(entity)
    const refs: EndpointRef[] = [
      { id: entity.id, endpoint: 'start', point: endpoints.start },
      { id: entity.id, endpoint: 'end', point: endpoints.end }
    ]
    refs.forEach((ref) => {
      const key = keyOf(ref.point)
      const bucket = endpointMap.get(key) ?? []
      bucket.push(ref)
      endpointMap.set(key, bucket)
    })
  })

  const findNeighbor = (
    entityId: string,
    point: Point,
    endpoint: 'start' | 'end'
  ): ExportLineNodeRef | null => {
    const candidates = endpointMap
      .get(keyOf(point))
      ?.filter((item) => item.id !== entityId && isSamePoint(item.point, point))
      .sort((a, b) =>
        a.id === b.id ? a.endpoint.localeCompare(b.endpoint) : a.id.localeCompare(b.id)
      )
    if (!candidates || candidates.length === 0) return null
    const preferred =
      endpoint === 'start'
        ? candidates.find((item) => item.endpoint === 'end')
        : candidates.find((item) => item.endpoint === 'start')
    const selected = preferred ?? candidates[0]
    return { id: selected.id, endpoint: selected.endpoint }
  }

  return entities.map((entity) => {
    if (entity.type !== 'LINE' && entity.type !== 'ARC' && entity.type !== 'BEZIER') return entity
    const endpoints = getOpenEntityEndpoints(entity)
    return {
      ...entity,
      node: {
        start: findNeighbor(entity.id, endpoints.start, 'start'),
        end: findNeighbor(entity.id, endpoints.end, 'end')
      }
    }
  })
}

export const sortLinesAndAttachNodeForExport = (
  entities: QomoEntityWithSurface[]
): ExportEntity[] => {
  const lines = entities.filter(
    (entity): entity is QomoLineSurfacesEntity => entity.type === 'LINE'
  )
  const others = entities.filter((entity) => entity.type !== 'LINE') as ExportEntity[]
  if (lines.length === 0) return attachNodeForOpenEntities(entities as ExportEntity[])

  type DirectedLine = { entity: QomoLineSurfacesEntity; start: Point; end: Point }
  const used = new Set<string>()
  const degree = new Map<string, number>()
  const keyOf = (p: Point) => `${p.x.toFixed(6)}|${p.y.toFixed(6)}`
  lines.forEach((line) => {
    const a = keyOf(line.start)
    const b = keyOf(line.end)
    degree.set(a, (degree.get(a) || 0) + 1)
    degree.set(b, (degree.get(b) || 0) + 1)
  })
  const findNext = (target: Point): DirectedLine | null => {
    for (const line of lines) {
      if (used.has(line.id)) continue
      if (isSamePoint(line.start, target)) return { entity: line, start: line.start, end: line.end }
      if (isSamePoint(line.end, target)) return { entity: line, start: line.end, end: line.start }
    }
    return null
  }

  const chains: DirectedLine[][] = []
  while (used.size < lines.length) {
    let seed: DirectedLine | null = null
    for (const line of lines) {
      if (used.has(line.id)) continue
      const startDegree = degree.get(keyOf(line.start)) || 0
      const endDegree = degree.get(keyOf(line.end)) || 0
      if (startDegree === 1 && endDegree !== 1) {
        seed = { entity: line, start: line.start, end: line.end }
        break
      }
      if (endDegree === 1 && startDegree !== 1) {
        seed = { entity: line, start: line.end, end: line.start }
        break
      }
      if (startDegree === 1 && endDegree === 1) {
        seed = { entity: line, start: line.start, end: line.end }
        break
      }
    }
    if (!seed) {
      const fallback = lines.find((line) => !used.has(line.id))
      if (!fallback) break
      seed = { entity: fallback, start: fallback.start, end: fallback.end }
    }
    const chain: DirectedLine[] = [seed]
    used.add(seed.entity.id)
    while (true) {
      const next = findNext(chain[chain.length - 1].end)
      if (!next) break
      chain.push(next)
      used.add(next.entity.id)
    }
    chains.push(chain)
  }

  const exportedLines: ExportEntity[] = []
  chains.forEach((chain) => {
    chain.forEach((item) => {
      exportedLines.push({
        ...item.entity,
        start: { x: item.start.x, y: item.start.y },
        end: { x: item.end.x, y: item.end.y }
      })
    })
  })

  return attachNodeForOpenEntities([...exportedLines, ...others])
}
