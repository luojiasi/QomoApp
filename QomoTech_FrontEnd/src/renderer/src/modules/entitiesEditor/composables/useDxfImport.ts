// =============================================================================
// DXF 导入（复用现有 QomoDxf 解析器，映射到新类型）
// =============================================================================

import DxfParser from 'dxf-parser'
import type {
  EditorLayer,
  LineEntity,
  ArcEntity,
  BezierEntity,
  CircleEntity,
  IrregularEntity,
  SurfaceEntity,
  Point2D,
  OpenSide,
} from "@/modules/entitiesEditor/commons/types"
import { createDefaultExtrusion } from "@/modules/entitiesEditor/configs/defaults"
import { generateId } from "@/modules/entitiesEditor/utils/idgen"

// ── 轻量 DXF 解析（不依赖旧模块类型，直接使用 dxf-parser） ──

type DxfLikeEntity = Record<string, unknown>
type DxfLikeDocument = { entities?: DxfLikeEntity[] }

export interface DxfImportResult {
  layers: EditorLayer[]
  entities: SurfaceEntity[]
  unsupportedEntities: number
}

const toNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const toPoint2D = (value: unknown): Point2D | null => {
  if (!value || typeof value !== 'object') return null
  const p = value as { x?: unknown; y?: unknown }
  if (typeof p.x !== 'number' || typeof p.y !== 'number') return null
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null
  return { X: p.x, Y: p.y }
}

const toLayerName = (entity: DxfLikeEntity): string => {
  const layer = entity.layer
  return typeof layer === 'string' && layer.trim().length > 0 ? layer.trim() : 'default'
}

const isPolylineClosed = (entity: DxfLikeEntity): boolean => {
  const shape = entity.shape
  if (typeof shape === 'boolean') return shape
  if (typeof shape === 'number' && Number.isFinite(shape)) return (shape & 1) === 1
  return Boolean((entity as { closed?: unknown }).closed)
}

// ── 图层映射 ──

const buildLayerMap = (entities: DxfLikeEntity[]) => {
  const map = new Map<string, EditorLayer>()
  map.set('default', { id: '0', name: 'default', visible: true, locked: false, entityCount: 0 })
  let idx = 1
  for (const e of entities) {
    const name = toLayerName(e)
    if (name === 'default' || map.has(name)) continue
    map.set(name, { id: `dxf-layer-${idx}`, name, visible: true, locked: false, entityCount: 0 })
    idx++
  }
  return map
}

// ── 各图元转换（新版类型） ──

function makeBase(kind: string, layerId: string): { id: string; kind: typeof kind; layerId: string; openSide: OpenSide; selected: false } {
  return { id: generateId('dxf'), kind: kind as never, layerId, openSide: 'RIGHT', selected: false }
}

function wrap(entity: LineEntity | ArcEntity | BezierEntity | CircleEntity | IrregularEntity): SurfaceEntity {
  return { ...entity, ...createDefaultExtrusion() } as SurfaceEntity
}

function tryLine(dxf: DxfLikeEntity, layerId: string): SurfaceEntity | null {
  const start = toPoint2D(dxf.start) ?? toPoint2D((dxf.vertices as Point2D[])?.[0])
  const end = toPoint2D(dxf.end) ?? toPoint2D((dxf.vertices as Point2D[])?.[1])
  if (!start || !end) return null
  const base = makeBase('LINE', layerId)
  return wrap({ ...base, start, end } as LineEntity)
}

function tryCircle(dxf: DxfLikeEntity, layerId: string): SurfaceEntity | null {
  const center = toPoint2D(dxf.center)
  const radius = toNumber(dxf.radius, 0)
  if (!center || radius <= 1e-9) return null
  const base = makeBase('CIRCLE', layerId)
  return wrap({ ...base, center, radius } as CircleEntity)
}

function tryArc(dxf: DxfLikeEntity, layerId: string): SurfaceEntity | null {
  const center = toPoint2D(dxf.center)
  const radius = toNumber(dxf.radius, 0)
  if (!center || radius <= 1e-9) return null
  const startAngleRad = toNumber(dxf.startAngle, 0)
  const endAngleRad = toNumber(dxf.endAngle, 0)
  const startAngleDeg = (startAngleRad * 180) / Math.PI
  const endAngleRaw = (endAngleRad * 180) / Math.PI
  const sweep = ((endAngleRaw - startAngleDeg) % 360 + 360) % 360
  const endAngleDeg = startAngleDeg + (sweep <= 1e-9 ? 360 : sweep)
  const base = makeBase('ARC', layerId)
  return wrap({ ...base, center, radius, startAngleDeg, endAngleDeg } as ArcEntity)
}

function tryEllipse(dxf: DxfLikeEntity, layerId: string): SurfaceEntity | null {
  const center = toPoint2D(dxf.center)
  const majorEnd = toPoint2D(dxf.majorAxisEndPoint)
  const ratio = toNumber(dxf.axisRatio, 0)
  if (!center || !majorEnd || ratio <= 1e-9) return null
  const radiusX = Math.hypot(majorEnd.X, majorEnd.Y)
  if (radiusX <= 1e-9) return null
  const radiusY = Math.max(radiusX * ratio, 1e-6)
  const rotationDeg = (Math.atan2(majorEnd.Y, majorEnd.X) * 180) / Math.PI
  const base = makeBase('IRREGULAR', layerId)
  return wrap({ ...base, variant: 'oval', center, radiusX, radiusY, rotationDeg } as IrregularEntity)
}

// ── POLYLINE / LWPOLYLINE ──

interface PolyVertex { point: Point2D; bulge: number }

function verticesToList(dxf: DxfLikeEntity): PolyVertex[] {
  const verts = Array.isArray(dxf.vertices) ? dxf.vertices : []
  return verts.map((v) => {
    const point = toPoint2D(v)
    if (!point) return null
    const bulge = toNumber((v as { bulge?: unknown }).bulge, 0)
    return { point, bulge }
  }).filter((item): item is PolyVertex => item !== null)
}

function bulgeToArc(start: Point2D, end: Point2D, bulge: number, layerId: string): SurfaceEntity | null {
  const chordX = end.X - start.X
  const chordY = end.Y - start.Y
  const chordLen = Math.hypot(chordX, chordY)
  if (chordLen < 1e-9 || Math.abs(bulge) <= 1e-9) return null
  const sweepRad = 4 * Math.atan(bulge)
  const absHalf = Math.abs(sweepRad) / 2
  const sinHalf = Math.sin(absHalf)
  if (Math.abs(sinHalf) <= 1e-12) return null
  const radius = chordLen / (2 * sinHalf)
  if (!Number.isFinite(radius) || radius <= 1e-9) return null
  const halfChord = chordLen / 2
  const offset = Math.sqrt(Math.max(0, radius * radius - halfChord * halfChord))
  const midX = (start.X + end.X) / 2
  const midY = (start.Y + end.Y) / 2
  const nx = -chordY / chordLen
  const ny = chordX / chordLen
  const side = sweepRad >= 0 ? 1 : -1
  const center: Point2D = { X: midX + nx * offset * side, Y: midY + ny * offset * side }
  const startAngleDeg = (Math.atan2(start.Y - center.Y, start.X - center.X) * 180) / Math.PI
  const endAngleDeg = startAngleDeg + (sweepRad * 180) / Math.PI
  const base = makeBase('ARC', layerId)
  return wrap({ ...base, center, radius, startAngleDeg, endAngleDeg } as ArcEntity)
}

function tryPolyline(dxf: DxfLikeEntity, layerId: string): SurfaceEntity[] {
  const verts = verticesToList(dxf)
  if (verts.length < 2) return []
  const closed = isPolylineClosed(dxf)
  const result: SurfaceEntity[] = []

  const push = (a: PolyVertex, b: PolyVertex, segIdx: number) => {
    if (Math.hypot(b.point.X - a.point.X, b.point.Y - a.point.Y) < 1e-9) return
    const arc = bulgeToArc(a.point, b.point, a.bulge, layerId)
    if (arc) { result.push(arc); return }
    const base = makeBase('LINE', layerId)
    const line: LineEntity = { ...base, start: a.point, end: b.point } as LineEntity
    result.push(wrap(line))
  }

  for (let i = 0; i < verts.length - 1; i++) push(verts[i], verts[i + 1], i)
  if (closed && verts.length > 2) push(verts[verts.length - 1], verts[0], verts.length)
  return result
}

// ── SPLINE ──

function trySpline(dxf: DxfLikeEntity, layerId: string): SurfaceEntity | null {
  const controlPoints = Array.isArray(dxf.controlPoints) ? dxf.controlPoints : []
  const points = controlPoints.map((v) => toPoint2D(v)).filter((p): p is Point2D => p !== null)
  if (points.length < 2) return null
  const base = makeBase('BEZIER', layerId)
  return wrap({ ...base, controlPoints: points } as BezierEntity)
}

// ── 主入口 ──

export function useDxfImport() {
  function parseDxf(text: string): DxfImportResult {
    const parser = new DxfParser()
    const dxf = parser.parseSync(text) as unknown as DxfLikeDocument
    const srcEntities = Array.isArray(dxf.entities) ? dxf.entities : []
    const layerMap = buildLayerMap(srcEntities)
    const entities: SurfaceEntity[] = []
    let unsupported = 0

    for (const e of srcEntities) {
      const type = String(e.type ?? '').toUpperCase()
      const layerId = layerMap.get(toLayerName(e))?.id ?? '0'

      let converted: SurfaceEntity | SurfaceEntity[] | null = null

      if (type === 'LINE') converted = tryLine(e, layerId)
      else if (type === 'CIRCLE') converted = tryCircle(e, layerId)
      else if (type === 'ARC') converted = tryArc(e, layerId)
      else if (type === 'ELLIPSE') converted = tryEllipse(e, layerId)
      else if (type === 'LWPOLYLINE' || type === 'POLYLINE') converted = tryPolyline(e, layerId)
      else if (type === 'SPLINE') converted = trySpline(e, layerId)
      else { unsupported++; continue }

      if (Array.isArray(converted)) {
        if (converted.length > 0) entities.push(...converted)
        else unsupported++
      } else if (converted) {
        entities.push(converted)
      } else {
        unsupported++
      }
    }

    // 同步图层计数
    for (const ent of entities) {
      const layer = layerMap.get(
        [...layerMap.values()].find((l) => l.id === ent.layerId)?.name ?? 'default',
      )
      if (layer) layer.entityCount++
    }

    return {
      layers: [...layerMap.values()],
      entities,
      unsupportedEntities: unsupported,
    }
  }

  return { parseDxf }
}
