// =============================================================================
// entitiesEditor 实体节点连接 —— 导出时给开放实体附加邻接拓扑
// =============================================================================
//
// 与 editor/cad/qomoEntityGeometry.ts 中的实现等价，适配 entitiesEditor 类型：
//   - 坐标字段：editor 用 {x,y}，entitiesEditor 用 {X,Y}
//   - 实体类型字段：editor 用 `type`，entitiesEditor 用 `kind`
//   - BEZIER 点列表：editor 用 `points`，entitiesEditor 用 `controlPoints`
//   - 新增 POLYLINE 开放路径支持

import type {
  Point2D,
  SurfaceEntity,
  LineEntity,
  ArcEntity,
  BezierEntity,
  PolylineEntity,
} from '../commons/types'

// =============================================================================
// 常量
// =============================================================================

const POINT_EPS = 1e-6

// =============================================================================
// 类型定义
// =============================================================================

/** 端点引用：指向另一个实体的特定端点 */
export type NodeEndpointRef = { id: string; endpoint: 'start' | 'end' }

/** 实体两端的邻接引用 */
export type EntityNode = {
  start: NodeEndpointRef | null
  end: NodeEndpointRef | null
}

/** 带 node 的导出实体 */
export type ExportEntity = SurfaceEntity & { node?: EntityNode }

/** 可参与 node 连接的开放实体类型 */
export type OpenEntityKind = 'LINE' | 'ARC' | 'BEZIER' | 'POLYLINE'

// =============================================================================
// 工具函数
// =============================================================================

const isSamePoint = (a: Point2D, b: Point2D): boolean =>
  Math.abs(a.X - b.X) <= POINT_EPS && Math.abs(a.Y - b.Y) <= POINT_EPS

const keyOf = (p: Point2D): string =>
  `${p.X.toFixed(6)}|${p.Y.toFixed(6)}`

// =============================================================================
// 端点提取
// =============================================================================

/** 判断实体是否为开放类型（有明确首尾端点，可参与 node 连接） */
const isOpenEntity = (
  entity: SurfaceEntity
): entity is SurfaceEntity<LineEntity | ArcEntity | BezierEntity | PolylineEntity> => {
  return entity.kind === 'LINE' || entity.kind === 'ARC' || entity.kind === 'BEZIER' || entity.kind === 'POLYLINE'
}

/** 提取 ARC 端点（优先用预计算的 startPoint/endPoint，否则从 center+angle 算） */
const getArcEndpoint = (arc: SurfaceEntity<ArcEntity>, which: 'start' | 'end'): Point2D => {
  const endpoint = which === 'start' ? arc.startPoint : arc.endPoint
  if (endpoint) return endpoint
  const angle = which === 'start' ? arc.startAngle : arc.endAngle
  const rad = (angle * Math.PI) / 180
  return {
    X: arc.center.X + arc.radius * Math.cos(rad),
    Y: arc.center.Y + arc.radius * Math.sin(rad),
  }
}

/** 获取开放实体的首尾世界坐标 */
const getEndpoints = (
  entity: SurfaceEntity<LineEntity | ArcEntity | BezierEntity | PolylineEntity>
): { start: Point2D; end: Point2D } => {
  switch (entity.kind) {
    case 'LINE':
      return { start: entity.start, end: entity.end }
    case 'ARC':
      return { start: getArcEndpoint(entity, 'start'), end: getArcEndpoint(entity, 'end') }
    case 'BEZIER': {
      const pts = entity.controlPoints
      return { start: pts[0], end: pts[pts.length - 1] }
    }
    case 'POLYLINE': {
      const verts = entity.vertices
      return { start: verts[0].point, end: verts[verts.length - 1].point }
    }
  }
}

// =============================================================================
// attachNodeForOpenEntities —— 给所有开放实体附加邻接引用
// =============================================================================

/**
 * 遍历所有开放实体，在同一坐标的端点之间建立双向引用。
 * start 优先连邻居的 end，end 优先连邻居的 start。
 */
export const attachNodeForOpenEntities = (
  entities: SurfaceEntity[]
): ExportEntity[] => {
  type EndpointRef = { id: string; endpoint: 'start' | 'end'; point: Point2D }
  const endpointMap = new Map<string, EndpointRef[]>()

  entities.forEach((entity) => {
    if (!isOpenEntity(entity)) return
    if (entity.kind === 'POLYLINE' && entity.closed) return
    const endpoints = getEndpoints(entity)
    const refs: EndpointRef[] = [
      { id: entity.id, endpoint: 'start', point: endpoints.start },
      { id: entity.id, endpoint: 'end', point: endpoints.end },
    ]
    refs.forEach((ref) => {
      const k = keyOf(ref.point)
      const bucket = endpointMap.get(k) ?? []
      bucket.push(ref)
      endpointMap.set(k, bucket)
    })
  })

  const findNeighbor = (
    selfId: string,
    point: Point2D,
    selfEndpoint: 'start' | 'end'
  ): NodeEndpointRef | null => {
    const candidates = endpointMap
      .get(keyOf(point))
      ?.filter((item) => item.id !== selfId && isSamePoint(item.point, point))
      .sort((a, b) =>
        a.id === b.id
          ? a.endpoint.localeCompare(b.endpoint)
          : a.id.localeCompare(b.id)
      )
    if (!candidates || candidates.length === 0) return null
    const preferred =
      selfEndpoint === 'start'
        ? candidates.find((item) => item.endpoint === 'end')
        : candidates.find((item) => item.endpoint === 'start')
    const selected = preferred ?? candidates[0]
    return { id: selected.id, endpoint: selected.endpoint }
  }

  return entities.map((entity) => {
    if (!isOpenEntity(entity)) return entity as ExportEntity
    if (entity.kind === 'POLYLINE' && entity.closed) return entity as ExportEntity
    const endpoints = getEndpoints(entity)
    return {
      ...entity,
      node: {
        start: findNeighbor(entity.id, endpoints.start, 'start'),
        end: findNeighbor(entity.id, endpoints.end, 'end'),
      },
    } as ExportEntity
  })
}

// =============================================================================
// sortLinesAndAttachNodeForExport —— LINE 排序成链 + 全量 attachNode
// =============================================================================

/**
 * 先将 LINE 实体按首尾相接排序成链（让激光路径连贯），再对所有开放实体附加 node。
 */
export const sortLinesAndAttachNodeForExport = (entities: SurfaceEntity[]): ExportEntity[] => {
  const lines = entities.filter(
    (e): e is SurfaceEntity<LineEntity> => e.kind === 'LINE'
  )
  const others = entities.filter((e) => e.kind !== 'LINE') as ExportEntity[]

  if (lines.length === 0) return attachNodeForOpenEntities(entities)

  type DirectedLine = {
    entity: SurfaceEntity<LineEntity>
    start: Point2D
    end: Point2D
  }

  const used = new Set<string>()
  const degree = new Map<string, number>()

  lines.forEach((line) => {
    const a = keyOf(line.start)
    const b = keyOf(line.end)
    degree.set(a, (degree.get(a) || 0) + 1)
    degree.set(b, (degree.get(b) || 0) + 1)
  })

  const findNext = (target: Point2D): DirectedLine | null => {
    for (const line of lines) {
      if (used.has(line.id)) continue
      if (isSamePoint(line.start, target))
        return { entity: line, start: line.start, end: line.end }
      if (isSamePoint(line.end, target))
        return { entity: line, start: line.end, end: line.start }
    }
    return null
  }

  const chains: DirectedLine[][] = []

  while (used.size < lines.length) {
    let seed: DirectedLine | null = null
    for (const line of lines) {
      if (used.has(line.id)) continue
      const sd = degree.get(keyOf(line.start)) || 0
      const ed = degree.get(keyOf(line.end)) || 0
      if (sd === 1 && ed !== 1) {
        seed = { entity: line, start: line.start, end: line.end }
        break
      }
      if (ed === 1 && sd !== 1) {
        seed = { entity: line, start: line.end, end: line.start }
        break
      }
      if (sd === 1 && ed === 1) {
        seed = { entity: line, start: line.start, end: line.end }
        break
      }
    }
    if (!seed) {
      const fallback = lines.find((l) => !used.has(l.id))
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
        start: { X: item.start.X, Y: item.start.Y },
        end: { X: item.end.X, Y: item.end.Y },
      } as ExportEntity)
    })
  })

  return attachNodeForOpenEntities([...exportedLines, ...others])
}
