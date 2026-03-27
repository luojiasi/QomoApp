import DxfParser from 'dxf-parser'
import type {
  Point,
  QomoArcSurfacesEntity,
  QomoBezierSurfacesEntity,
  QomoCircleSurfacesEntity,
  QomoEntityWithSurface,
  QomoIrregularSurfacesEntity,
  QomoLayer,
  QomoLineSurfacesEntity,
  QomoWeldingBase
} from '@renderer/types/Qomo5P'

type DxfLikeEntity = Record<string, unknown>
type DxfLikeDocument = {
  entities?: DxfLikeEntity[]
}

type DxfImportResult = {
  layers: QomoLayer[]
  entities: QomoEntityWithSurface[]
  unsupportedEntities: number
}

const DEFAULT_OPEN_DIRECTION = 'RIGHT' as const
const DEFAULT_BASE_HEIGHT = 60
const DEFAULT_EXTRUDE_HEIGHT = 5
const DEFAULT_SURFACE_ANGLE = 0

const defaultWelding = (): QomoWeldingBase => ({
  id: 'default-welding',
  name: '默认焊接',
  openAngle: 0.54,
  openSize: 1
})

const toNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const toPoint = (value: unknown): Point | null => {
  if (!value || typeof value !== 'object') return null
  const point = value as { x?: unknown; y?: unknown }
  if (typeof point.x !== 'number' || typeof point.y !== 'number') return null
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  return { x: point.x, y: point.y }
}

const toId = (prefix: string, index: number) =>
  `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`

const toLayerName = (entity: DxfLikeEntity) => {
  const layer = entity.layer
  return typeof layer === 'string' && layer.trim().length > 0 ? layer.trim() : 'default'
}

const buildLayerMap = (entities: DxfLikeEntity[]) => {
  const map = new Map<string, { id: string; name: string; count: number }>()
  map.set('default', { id: '0', name: 'default', count: 0 })
  let nextIndex = 1
  for (const entity of entities) {
    const name = toLayerName(entity)
    if (name === 'default') continue
    if (!map.has(name)) {
      map.set(name, {
        id: `dxf-layer-${nextIndex}`,
        name,
        count: 0
      })
      nextIndex += 1
    }
  }
  return map
}

const buildEntityBase = (
  entity: DxfLikeEntity,
  index: number,
  layerMap: Map<string, { id: string; name: string; count: number }>
) => {
  const layerName = toLayerName(entity)
  const layer = layerMap.get(layerName) ?? layerMap.get('default')
  if (!layer) return null
  layer.count += 1
  return {
    idPrefix: `QOMO-DXF-${String(entity.type ?? 'UNKNOWN').toUpperCase()}`,
    entityId: toId('QOMO-DXF', index),
    layerId: layer.id,
    layerName: layer.name
  }
}

const tryLineEntity = (
  dxfEntity: DxfLikeEntity,
  index: number,
  layerMap: Map<string, { id: string; name: string; count: number }>
): QomoLineSurfacesEntity | null => {
  const base = buildEntityBase(dxfEntity, index, layerMap)
  if (!base) return null
  const startFromNamedField = toPoint(dxfEntity.start)
  const endFromNamedField = toPoint(dxfEntity.end)
  const vertices = Array.isArray(dxfEntity.vertices) ? dxfEntity.vertices : []
  const startFromVertices = vertices.length > 0 ? toPoint(vertices[0]) : null
  const endFromVertices = vertices.length > 1 ? toPoint(vertices[1]) : null
  const start = startFromNamedField ?? startFromVertices
  const end = endFromNamedField ?? endFromVertices
  if (!start || !end) return null
  return {
    id: base.entityId,
    type: 'LINE',
    layerId: base.layerId,
    layerName: base.layerName,
    openDirection: DEFAULT_OPEN_DIRECTION,
    selected: false,
    start,
    end,
    baseHeight: DEFAULT_BASE_HEIGHT,
    extrudeHeight: DEFAULT_EXTRUDE_HEIGHT,
    surfaceAngle: DEFAULT_SURFACE_ANGLE,
    welding: defaultWelding()
  }
}

const tryCircleEntity = (
  dxfEntity: DxfLikeEntity,
  index: number,
  layerMap: Map<string, { id: string; name: string; count: number }>
): QomoCircleSurfacesEntity | null => {
  const base = buildEntityBase(dxfEntity, index, layerMap)
  if (!base) return null
  const center = toPoint(dxfEntity.center)
  const radius = toNumber(dxfEntity.radius, 0)
  if (!center || radius <= 1e-9) return null
  return {
    id: base.entityId,
    type: 'CIRCLE',
    layerId: base.layerId,
    layerName: base.layerName,
    openDirection: DEFAULT_OPEN_DIRECTION,
    selected: false,
    center,
    radius,
    baseHeight: DEFAULT_BASE_HEIGHT,
    extrudeHeight: DEFAULT_EXTRUDE_HEIGHT,
    surfaceAngle: DEFAULT_SURFACE_ANGLE,
    welding: defaultWelding()
  }
}

const tryArcEntity = (
  dxfEntity: DxfLikeEntity,
  index: number,
  layerMap: Map<string, { id: string; name: string; count: number }>
): QomoArcSurfacesEntity | null => {
  const base = buildEntityBase(dxfEntity, index, layerMap)
  if (!base) return null
  const center = toPoint(dxfEntity.center)
  const radius = toNumber(dxfEntity.radius, 0)
  const startAngleRad = toNumber(dxfEntity.startAngle, 0)
  const endAngleRad = toNumber(dxfEntity.endAngle, 0)
  if (!center || radius <= 1e-9) return null
  const startAngle = (startAngleRad * 180) / Math.PI
  const endAngleRaw = (endAngleRad * 180) / Math.PI
  // DXF ARC 语义：始终按 CCW（逆时针）从 startAngle 走到 endAngle。
  // 不能直接用 end-start（那会在 start>end 时错误地走成 CW 小弧）。
  const ccwSweep = ((endAngleRaw - startAngle) % 360 + 360) % 360
  const endAngle = startAngle + (ccwSweep <= 1e-9 ? 360 : ccwSweep)
  return {
    id: base.entityId,
    type: 'ARC',
    layerId: base.layerId,
    layerName: base.layerName,
    openDirection: DEFAULT_OPEN_DIRECTION,
    selected: false,
    center,
    radius,
    startAngle,
    endAngle,
    startPoint: {
      x: center.x + radius * Math.cos(startAngleRad),
      y: center.y + radius * Math.sin(startAngleRad)
    },
    endPoint: {
      x: center.x + radius * Math.cos(endAngleRad),
      y: center.y + radius * Math.sin(endAngleRad)
    },
    baseHeight: DEFAULT_BASE_HEIGHT,
    extrudeHeight: DEFAULT_EXTRUDE_HEIGHT,
    surfaceAngle: DEFAULT_SURFACE_ANGLE,
    welding: defaultWelding()
  }
}

const tryEllipseEntity = (
  dxfEntity: DxfLikeEntity,
  index: number,
  layerMap: Map<string, { id: string; name: string; count: number }>
): QomoIrregularSurfacesEntity | null => {
  const base = buildEntityBase(dxfEntity, index, layerMap)
  if (!base) return null
  const center = toPoint(dxfEntity.center)
  const majorAxisEndPoint = toPoint(dxfEntity.majorAxisEndPoint)
  const axisRatio = toNumber(dxfEntity.axisRatio, 0)
  if (!center || !majorAxisEndPoint || axisRatio <= 1e-9) return null
  const radiusX = Math.hypot(majorAxisEndPoint.x, majorAxisEndPoint.y)
  if (radiusX <= 1e-9) return null
  const radiusY = Math.max(radiusX * axisRatio, 1e-6)
  const rotationDeg = (Math.atan2(majorAxisEndPoint.y, majorAxisEndPoint.x) * 180) / Math.PI
  return {
    id: base.entityId,
    type: 'IRREGULAR',
    shape: 'oval',
    layerId: base.layerId,
    layerName: base.layerName,
    openDirection: DEFAULT_OPEN_DIRECTION,
    selected: false,
    center,
    radiusX,
    radiusY,
    rotationDeg,
    baseHeight: DEFAULT_BASE_HEIGHT,
    extrudeHeight: DEFAULT_EXTRUDE_HEIGHT,
    surfaceAngle: DEFAULT_SURFACE_ANGLE,
    welding: defaultWelding()
  }
}

const verticesToPoints = (entity: DxfLikeEntity): Point[] => {
  const vertices = Array.isArray(entity.vertices) ? entity.vertices : []
  return vertices.map((v) => toPoint(v)).filter((v): v is Point => Boolean(v))
}

const tryPolylineEntities = (
  dxfEntity: DxfLikeEntity,
  index: number,
  layerMap: Map<string, { id: string; name: string; count: number }>
): QomoLineSurfacesEntity[] => {
  const base = buildEntityBase(dxfEntity, index, layerMap)
  if (!base) return []
  const points = verticesToPoints(dxfEntity)
  if (points.length < 2) return []
  const shape = toNumber(dxfEntity.shape, 0)
  const closed = shape === 1 || Boolean((dxfEntity as { closed?: unknown }).closed)
  const lines: QomoLineSurfacesEntity[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]
    const end = points[i + 1]
    if (Math.hypot(end.x - start.x, end.y - start.y) < 1e-9) continue
    lines.push({
      id: toId('QOMO-DXF-POLY', index * 1000 + i),
      type: 'LINE',
      layerId: base.layerId,
      layerName: base.layerName,
      openDirection: DEFAULT_OPEN_DIRECTION,
      selected: false,
      start,
      end,
      baseHeight: DEFAULT_BASE_HEIGHT,
      extrudeHeight: DEFAULT_EXTRUDE_HEIGHT,
      surfaceAngle: DEFAULT_SURFACE_ANGLE,
      welding: defaultWelding()
    })
  }
  if (closed && points.length > 2) {
    const start = points[points.length - 1]
    const end = points[0]
    if (Math.hypot(end.x - start.x, end.y - start.y) >= 1e-9) {
      lines.push({
        id: toId('QOMO-DXF-POLY', index * 1000 + points.length),
        type: 'LINE',
        layerId: base.layerId,
        layerName: base.layerName,
        openDirection: DEFAULT_OPEN_DIRECTION,
        selected: false,
        start,
        end,
        baseHeight: DEFAULT_BASE_HEIGHT,
        extrudeHeight: DEFAULT_EXTRUDE_HEIGHT,
        surfaceAngle: DEFAULT_SURFACE_ANGLE,
        welding: defaultWelding()
      })
    }
  }
  return lines
}

const trySplineEntity = (
  dxfEntity: DxfLikeEntity,
  index: number,
  layerMap: Map<string, { id: string; name: string; count: number }>
): QomoBezierSurfacesEntity | null => {
  const base = buildEntityBase(dxfEntity, index, layerMap)
  if (!base) return null
  const controlPoints = Array.isArray(dxfEntity.controlPoints) ? dxfEntity.controlPoints : []
  const points = controlPoints.map((v) => toPoint(v)).filter((v): v is Point => Boolean(v))
  if (points.length < 2) return null
  return {
    id: base.entityId,
    type: 'BEZIER',
    layerId: base.layerId,
    layerName: base.layerName,
    openDirection: DEFAULT_OPEN_DIRECTION,
    selected: false,
    points: points,
    baseHeight: DEFAULT_BASE_HEIGHT,
    extrudeHeight: DEFAULT_EXTRUDE_HEIGHT,
    surfaceAngle: DEFAULT_SURFACE_ANGLE,
    welding: defaultWelding()
  }
}

export const parseDxfToQomoEntities = (text: string): DxfImportResult => {
  const parser = new DxfParser()
  const dxf = parser.parseSync(text) as unknown as DxfLikeDocument
  const sourceEntities = Array.isArray(dxf.entities) ? dxf.entities : []
  const layerMap = buildLayerMap(sourceEntities)
  const entities: QomoEntityWithSurface[] = []
  let unsupportedEntities = 0

  sourceEntities.forEach((entity, index) => {
    const type = String(entity.type ?? '').toUpperCase()
    if (type === 'LINE') {
      const converted = tryLineEntity(entity, index, layerMap)
      if (converted) entities.push(converted)
      else unsupportedEntities += 1
      return
    }
    if (type === 'CIRCLE') {
      const converted = tryCircleEntity(entity, index, layerMap)
      if (converted) entities.push(converted)
      else unsupportedEntities += 1
      return
    }
    if (type === 'ARC') {
      const converted = tryArcEntity(entity, index, layerMap)
      if (converted) entities.push(converted)
      else unsupportedEntities += 1
      return
    }
    if (type === 'ELLIPSE') {
      const converted = tryEllipseEntity(entity, index, layerMap)
      if (converted) entities.push(converted)
      else unsupportedEntities += 1
      return
    }
    if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
      const converted = tryPolylineEntities(entity, index, layerMap)
      if (converted.length > 0) entities.push(...converted)
      else unsupportedEntities += 1
      return
    }
    if (type === 'SPLINE') {
      const converted = trySplineEntity(entity, index, layerMap)
      if (converted) entities.push(converted)
      else unsupportedEntities += 1
      return
    }
    // 常见“剪裁相关”对象（如 XCLIP/IMAGE/UNDERLAY）的图元在很多 DXF 中是通过块引用/代理对象表达，
    // 这里先按不支持计数，避免静默丢失。
    unsupportedEntities += 1
  })

  const layers: QomoLayer[] = Array.from(layerMap.values()).map((layer) => ({
    id: layer.id,
    name: layer.name,
    visible: true,
    entityCount: 0
  }))

  return { layers, entities, unsupportedEntities }
}
