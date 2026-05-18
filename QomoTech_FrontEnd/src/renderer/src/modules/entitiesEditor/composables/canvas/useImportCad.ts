// =============================================================================
// useImportCad — DXF 文件导入，转换为 entitiesEditor 实体
//
// 参考 editor/cad/QomoDxf.ts 的解析逻辑，输出 entitiesEditor 类型。
// 支持：LINE / CIRCLE / ARC / ELLIPSE / LWPOLYLINE / POLYLINE / SPLINE
// =============================================================================

import DxfParser from 'dxf-parser'
import type { Point2D, EditorLayer, EditorEntity, SurfaceEntity, PolylineVertex } from '../../commons/types'
import { generateId } from '../../utils/idgen'
import { loadGeneralConfig } from '../../stores/generalSettingsStore'

// ── 类型 ──────────────────────────────────────────────

type DxfLikeEntity = Record<string, unknown>
type DxfLikeDocument = { entities?: DxfLikeEntity[] }

export interface DxfImportResult {
  layers: EditorLayer[]
  entities: SurfaceEntity<EditorEntity>[]
  unsupportedCount: number
}

// ── 辅助 ──────────────────────────────────────────────

const toNum = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

const toPoint2D = (v: unknown): Point2D | null => {
  if (!v || typeof v !== 'object') return null
  const p = v as { x?: unknown; y?: unknown }
  const x = toNum(p.x)
  const y = toNum(p.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { X: x, Y: y }
}

const isClosed = (e: DxfLikeEntity): boolean => {
  const shape = e.shape
  if (typeof shape === 'boolean') return shape
  if (typeof shape === 'number' && Number.isFinite(shape)) return (shape & 1) === 1
  return Boolean((e as { closed?: unknown }).closed)
}

const layerName = (e: DxfLikeEntity): string => {
  const l = e.layer
  return typeof l === 'string' && l.trim() ? l.trim() : '默认'
}

// ── 图层映射 ─────────────────────────────────────────

function buildLayerMap(entities: DxfLikeEntity[]): Map<string, EditorLayer> {
  const map = new Map<string, EditorLayer>()
  map.set('默认', { id: '0', name: '默认', visible: true, locked: false, entityCount: 0 })
  for (const e of entities) {
    const name = layerName(e)
    if (name === '默认') continue
    if (!map.has(name)) {
      map.set(name, { id: generateId('dxf-layer'), name, visible: true, locked: false, entityCount: 0 })
    }
  }
  return map
}

// ── 实体构造 ─────────────────────────────────────────

const config = loadGeneralConfig()
const extrudeDefaults = {
  height: config.defaultExtrudeHeight,
  openSize: config.defaultOpenSize,
  tiltAngleDeg: config.defaultTiltAngle,
}

function makeEntity<T extends EditorEntity>(kind: T['kind'], layerId: string, extra: Omit<T, 'id' | 'kind' | 'layerId' | 'openSide'>): SurfaceEntity<T> {
  return {
    id: generateId('dxf'),
    kind,
    layerId,
    openSide: 'LEFT' as const,
    ...extrudeDefaults,
    ...extra,
  } as unknown as SurfaceEntity<T>
}

// ── 各类型转换 ───────────────────────────────────────

function convertLine(e: DxfLikeEntity, layerId: string): SurfaceEntity<EditorEntity> | null {
  const start = toPoint2D(e.start) ?? toPoint2D((e.vertices as unknown[])?.[0])
  const end = toPoint2D(e.end) ?? toPoint2D((e.vertices as unknown[])?.[1])
  if (!start || !end) return null
  return makeEntity('LINE', layerId, { start, end })
}

function convertCircle(e: DxfLikeEntity, layerId: string): SurfaceEntity<EditorEntity> | null {
  const center = toPoint2D(e.center)
  const radius = toNum(e.radius)
  if (!center || radius <= 1e-9) return null
  return makeEntity('CIRCLE', layerId, { center, radius })
}

function convertArc(e: DxfLikeEntity, layerId: string): SurfaceEntity<EditorEntity> | null {
  const center = toPoint2D(e.center)
  const radius = toNum(e.radius)
  const startAngleRad = toNum(e.startAngle)
  const endAngleRad = toNum(e.endAngle)
  if (!center || radius <= 1e-9) return null

  const startAngle = (startAngleRad * 180) / Math.PI
  const endAngleRaw = (endAngleRad * 180) / Math.PI
  const sweep = ((endAngleRaw - startAngle) % 360 + 360) % 360
  const endAngle = startAngle + (sweep <= 1e-9 ? 360 : sweep)

  const sr = startAngleRad, er = endAngleRad
  return makeEntity('ARC', layerId, {
    center,
    radius,
    startAngle,
    endAngle,
    startPoint: { X: center.X + radius * Math.cos(sr), Y: center.Y + radius * Math.sin(sr) },
    endPoint: { X: center.X + radius * Math.cos(er), Y: center.Y + radius * Math.sin(er) },
  })
}

function convertEllipse(e: DxfLikeEntity, layerId: string): SurfaceEntity<EditorEntity> | null {
  const center = toPoint2D(e.center)
  const majorEnd = toPoint2D(e.majorAxisEndPoint)
  const ratio = toNum(e.axisRatio)
  if (!center || !majorEnd || ratio <= 1e-9) return null

  return makeEntity('ELLIPSE', layerId, {
    center,
    majorAxisEnd: majorEnd,
    minorAxisRatio: Math.min(ratio, 1),
    startParamDeg: 0,
    endParamDeg: 360,
  })
}

function convertPolyline(e: DxfLikeEntity, layerId: string): SurfaceEntity<EditorEntity> | null {
  const rawVerts = Array.isArray(e.vertices) ? e.vertices : []
  const vertices: PolylineVertex[] = []

  for (const rv of rawVerts) {
    const pt = toPoint2D(rv)
    if (!pt) continue
    const bulge = toNum((rv as { bulge?: unknown }).bulge)
    vertices.push({ point: pt, bulge })
  }
  if (vertices.length < 2) return null

  return makeEntity('POLYLINE', layerId, {
    closed: isClosed(e),
    vertices,
  })
}

function convertSpline(e: DxfLikeEntity, layerId: string): SurfaceEntity<EditorEntity> | null {
  const cps = Array.isArray(e.controlPoints) ? e.controlPoints : []
  const points = cps.map(toPoint2D).filter((p): p is Point2D => p !== null)
  if (points.length < 2) return null
  return makeEntity('BEZIER', layerId, { controlPoints: points })
}

// ── 主入口 ────────────────────────────────────────────

export function importDxf(text: string): DxfImportResult {
  console.log('[importDxf] 文本长度:', text.length, '前200字符:', text.slice(0, 200))

  const parser = new DxfParser()
  const dxf = parser.parseSync(text) as unknown as DxfLikeDocument
  const source = Array.isArray(dxf.entities) ? dxf.entities : []

  console.log('[importDxf] 解析到实体数:', source.length)

  // 统计各类型
  const typeCounts: Record<string, number> = {}

  const layerMap = buildLayerMap(source)
  const entities: SurfaceEntity<EditorEntity>[] = []
  let unsupported = 0

  for (const e of source) {
    const lid = layerMap.get(layerName(e))?.id ?? '0'
    const type = String(e.type ?? '').toUpperCase().trim()
    typeCounts[type] = (typeCounts[type] ?? 0) + 1

    let converted: SurfaceEntity<EditorEntity> | null = null

    if (type === 'LINE')                  converted = convertLine(e, lid)
    else if (type === 'CIRCLE')           converted = convertCircle(e, lid)
    else if (type === 'ARC')              converted = convertArc(e, lid)
    else if (type === 'ELLIPSE')          converted = convertEllipse(e, lid)
    else if (type === 'LWPOLYLINE' || type === 'POLYLINE') converted = convertPolyline(e, lid)
    else if (type === 'SPLINE')           converted = convertSpline(e, lid)

    if (converted) entities.push(converted)
    else unsupported++
  }

  console.log('[importDxf] 类型分布:', typeCounts)
  console.log('[importDxf] 成功转换:', entities.length, '不支持:', unsupported)
  console.log('[importDxf] 图层:', layerMap.size)

  const layers = Array.from(layerMap.values())
  return { layers, entities, unsupportedCount: unsupported }
}
