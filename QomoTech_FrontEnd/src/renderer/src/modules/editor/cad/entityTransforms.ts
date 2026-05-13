import type { Point, QomoEntityWithSurface } from '../qomo5pTypes'
import { isBezierEntity, isEllipseLikeIrregularEntity } from './qomoEntityGeometry'

export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export function translateSelectedEntities(
  entities: QomoEntityWithSurface[],
  selectedIds: string[],
  dx: number,
  dy: number
): QomoEntityWithSurface[] {
  if (selectedIds.length === 0 || (dx === 0 && dy === 0)) return entities
  return entities.map((entity) => {
    if (!selectedIds.includes(entity.id)) return entity
    return translateEntity(entity, dx, dy)
  })
}

export function translateAllEntities(
  entities: QomoEntityWithSurface[],
  dx: number,
  dy: number
): QomoEntityWithSurface[] {
  if (entities.length === 0 || (dx === 0 && dy === 0)) return entities
  return entities.map((entity) => translateEntity(entity, dx, dy))
}

export function translateEntity(
  entity: QomoEntityWithSurface,
  dx: number,
  dy: number
): QomoEntityWithSurface {
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
}

export function moveLineEnd(
  entities: QomoEntityWithSurface[],
  entityId: string,
  end: 'start' | 'end',
  dx: number,
  dy: number
): QomoEntityWithSurface[] {
  if (dx === 0 && dy === 0) return entities
  return entities.map((entity) => {
    if (entity.id !== entityId || entity.type !== 'LINE') return entity
    if (end === 'start') {
      return { ...entity, start: { x: entity.start.x + dx, y: entity.start.y + dy } }
    }
    return { ...entity, end: { x: entity.end.x + dx, y: entity.end.y + dy } }
  })
}

export function moveArcEnd(
  entities: QomoEntityWithSurface[],
  entityId: string,
  end: 'start' | 'end',
  dx: number,
  dy: number
): QomoEntityWithSurface[] {
  if (dx === 0 && dy === 0) return entities
  return entities.map((entity) => {
    if (entity.id !== entityId || entity.type !== 'ARC') return entity

    const center = entity.center
    const radius = entity.radius
    const curPoint =
      end === 'start'
        ? (entity.startPoint ?? polarToCartesian(center.x, center.y, radius, entity.startAngle))
        : (entity.endPoint ?? polarToCartesian(center.x, center.y, radius, entity.endAngle))

    const movedRaw = { x: curPoint.x + dx, y: curPoint.y + dy }
    const dxp = movedRaw.x - center.x
    const dyp = movedRaw.y - center.y
    const len = Math.hypot(dxp, dyp)
    if (len < 1e-6) return entity

    const scale = radius / len
    const projected = { x: center.x + dxp * scale, y: center.y + dyp * scale }
    const angle = (Math.atan2(projected.y - center.y, projected.x - center.x) * 180) / Math.PI

    if (end === 'start') {
      return { ...entity, startPoint: projected, startAngle: angle }
    }
    return { ...entity, endPoint: projected, endAngle: angle }
  })
}

export function setCircleRadius(
  entities: QomoEntityWithSurface[],
  entityId: string,
  radius: number
): QomoEntityWithSurface[] {
  const nextR = Math.max(radius, 1e-6)
  return entities.map((entity) => {
    if (entity.id !== entityId || entity.type !== 'CIRCLE') return entity
    if (Math.abs(entity.radius - nextR) < 1e-9) return entity
    return { ...entity, radius: nextR }
  })
}

export function moveCircleCenter(
  entities: QomoEntityWithSurface[],
  entityId: string,
  dx: number,
  dy: number
): QomoEntityWithSurface[] {
  if (dx === 0 && dy === 0) return entities
  return entities.map((entity) => {
    if (entity.id !== entityId || entity.type !== 'CIRCLE') return entity
    return { ...entity, center: { x: entity.center.x + dx, y: entity.center.y + dy } }
  })
}

export function moveEllipseCenter(
  entities: QomoEntityWithSurface[],
  entityId: string,
  dx: number,
  dy: number
): QomoEntityWithSurface[] {
  if (dx === 0 && dy === 0) return entities
  return entities.map((entity) => {
    if (entity.id !== entityId || !isEllipseLikeIrregularEntity(entity)) return entity
    return { ...entity, center: { x: entity.center.x + dx, y: entity.center.y + dy } }
  })
}

export function moveBezierPoint(
  entities: QomoEntityWithSurface[],
  entityId: string,
  pointIndex: number,
  dx: number,
  dy: number
): QomoEntityWithSurface[] {
  if (dx === 0 && dy === 0) return entities
  return entities.map((entity) => {
    if (entity.id !== entityId || !isBezierEntity(entity)) return entity
    const point = entity.points[pointIndex]
    if (!point) return entity
    return {
      ...entity,
      points: entity.points.map((item, index) =>
        index === pointIndex ? { x: item.x + dx, y: item.y + dy } : item
      )
    }
  })
}

export function moveArcCenter(
  entities: QomoEntityWithSurface[],
  entityId: string,
  dx: number,
  dy: number
): QomoEntityWithSurface[] {
  if (dx === 0 && dy === 0) return entities
  return entities.map((entity) => {
    if (entity.id !== entityId || entity.type !== 'ARC') return entity
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
  })
}
