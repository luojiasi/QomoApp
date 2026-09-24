import type { Point, QomoBounds, QomoSelectionRect, QomoViewport } from '../qomo5pTypes'

export const MIN_ZOOM = 1
export const MAX_ZOOM = 200
const FIT_PADDING = 48

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

export const normalizeRect = (startX: number, startY: number, endX: number, endY: number): QomoSelectionRect => ({
  x: Math.min(startX, endX),
  y: Math.min(startY, endY),
  width: Math.abs(endX - startX),
  height: Math.abs(endY - startY)
})

export const worldToScreen = (point: Point, viewport: QomoViewport): Point => ({
  x: viewport.panX + point.x * viewport.zoom,
  y: viewport.panY - point.y * viewport.zoom
})

export const screenToWorld = (point: Point, viewport: QomoViewport): Point => ({
  x: (point.x - viewport.panX) / viewport.zoom,
  y: (viewport.panY - point.y) / viewport.zoom
})

export const fitViewportToBounds = (
  bounds: QomoBounds | null,
  width: number,
  height: number,
  padding = FIT_PADDING
): QomoViewport => {
  const safeWidth = Math.max(width, 1)
  const safeHeight = Math.max(height, 1)

  if (!bounds) {
    return {
      width: safeWidth,
      height: safeHeight,
      zoom: 1,
      panX: safeWidth / 2,
      panY: safeHeight / 2
    }
  }

  const worldWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const worldHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const zoom = clampZoom(Math.min((safeWidth - padding * 2) / worldWidth, (safeHeight - padding * 2) / worldHeight))
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  return {
    width: safeWidth,
    height: safeHeight,
    zoom,
    panX: safeWidth / 2 - centerX * zoom,
    panY: safeHeight / 2 + centerY * zoom
  }
}

export const zoomViewportAtPoint = (
  viewport: QomoViewport,
  factor: number,
  screenPoint: Point
): QomoViewport => {
  const nextZoom = clampZoom(viewport.zoom * factor)
  const worldPoint = screenToWorld(screenPoint, viewport)

  return {
    ...viewport,
    zoom: nextZoom,
    panX: screenPoint.x - worldPoint.x * nextZoom,
    panY: screenPoint.y + worldPoint.y * nextZoom
  }
}
