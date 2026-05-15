// =============================================================================
// .ljs 项目文件序列化 / 反序列化 / v1→v2 静默迁移
// =============================================================================

import type { EditorLayer, Point2D, ProjectData, ProjectMeta, SerializedProject, SurfaceEntity } from "@/modules/entitiesEditor/commons/types"
import { PROJECT_VERSION } from "@/modules/entitiesEditor/configs/defaults"
import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"
import { generateId } from "@/modules/entitiesEditor/utils/idgen"

const FORMAT = 'QOMO5P-Project'
const LEGACY_FORMAT = 'QOMO-Project'

// ── 旧版格式原始结构（仅迁移用） ──

interface LegacyPoint { x: number; y: number }
interface LegacyBaseEntity {
  id: string
  type: string
  layerId: string
  layerName?: string
  openDirection: string
  selected: boolean
}
interface LegacyLineEntity extends LegacyBaseEntity { type: 'LINE'; start: LegacyPoint; end: LegacyPoint }
interface LegacyArcEntity extends LegacyBaseEntity { type: 'ARC'; center: LegacyPoint; radius: number; startAngle: number; endAngle: number }
interface LegacyBezierEntity extends LegacyBaseEntity { type: 'BEZIER'; points: LegacyPoint[] }
interface LegacyCircleEntity extends LegacyBaseEntity { type: 'CIRCLE'; center: LegacyPoint; radius: number }
interface LegacyIrregularEntity extends LegacyBaseEntity {
  type: 'IRREGULAR'
  shape: string
  center: LegacyPoint
  radiusX: number
  radiusY: number
  rotationDeg: number
}
interface LegacyExtrusion {
  baseHeight: number
  extrudeHeight: number
  surfaceAngle: number
  welding?: { openSize?: number }
}
type LegacyEntity = (LegacyLineEntity | LegacyArcEntity | LegacyBezierEntity | LegacyCircleEntity | LegacyIrregularEntity) & LegacyExtrusion
interface LegacyLayer { id: string; name: string; visible: boolean; entityCount: number }
interface LegacyMeta {
  version: string
  sourceFileName: string
  updatedAt: string
  unsupportedEntities: number
  entityCount: number
  createdAt?: string
}
interface LegacyProject {
  format: string
  version: string
  savedAt: string
  data: {
    meta: LegacyMeta
    layers: LegacyLayer[]
    entities: LegacyEntity[]
  }
}

// ── 坐标转换 ──

function legacyPointToP2D(p: LegacyPoint): Point2D {
  return { X: p.x, Y: p.y }
}

// ── 旧版实体 → 新版实体（★ 静默迁移 baseHeight+extrudeHeight → height） ──

const SHAPE_TO_VARIANT: Record<string, string> = {
  oval: 'oval', heart: 'heart', pear: 'pear',
  square: 'square', marquise: 'marquise', cushion: 'cushion', octagon: 'octagon',
}

function migrateEntity(legacy: LegacyEntity): SurfaceEntity {
  const base = {
    id: legacy.id || generateId('migrated'),
    layerId: legacy.layerId ?? '0',
    openSide: (legacy.openDirection === 'LEFT' ? 'LEFT' : 'RIGHT') as 'LEFT' | 'RIGHT',
    selected: legacy.selected ?? false,
  }

  // ★ 静默转换：height = extrudeHeight
  const extrusion = {
    height: legacy.extrudeHeight ?? 5,
    tiltAngleDeg: legacy.surfaceAngle ?? 0,
    openSize: legacy.welding?.openSize ?? 1,
  }

  switch (legacy.type) {
    case 'LINE':
      return { ...base, kind: 'LINE', start: legacyPointToP2D(legacy.start), end: legacyPointToP2D(legacy.end), ...extrusion } as SurfaceEntity
    case 'ARC':
      return { ...base, kind: 'ARC', center: legacyPointToP2D(legacy.center), radius: legacy.radius, startAngleDeg: legacy.startAngle, endAngleDeg: legacy.endAngle, ...extrusion } as SurfaceEntity
    case 'BEZIER':
      return { ...base, kind: 'BEZIER', controlPoints: (legacy.points || []).map(legacyPointToP2D), ...extrusion } as SurfaceEntity
    case 'CIRCLE':
      return { ...base, kind: 'CIRCLE', center: legacyPointToP2D(legacy.center), radius: legacy.radius, ...extrusion } as SurfaceEntity
    case 'IRREGULAR':
      return { ...base, kind: 'IRREGULAR', variant: (SHAPE_TO_VARIANT[legacy.shape] ?? 'oval') as SurfaceEntity['variant'], center: legacyPointToP2D(legacy.center), radiusX: legacy.radiusX, radiusY: legacy.radiusY, rotationDeg: legacy.rotationDeg ?? 0, ...extrusion } as SurfaceEntity
    default:
      return { ...base, kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 0, Y: 0 }, ...extrusion } as SurfaceEntity
  }
}

// ── 新版序列化 ──

export function useLjsIO() {
  const store = useEditorStore()

  function serialize(name?: string): string {
    const data: ProjectData = {
      meta: { ...store.projectMeta, version: PROJECT_VERSION, updatedAt: new Date().toISOString() },
      layers: store.layers,
      entities: store.entities,
    }
    const project: SerializedProject = {
      format: FORMAT,
      version: PROJECT_VERSION,
      savedAt: new Date().toISOString(),
      data,
    }
    return JSON.stringify(project, null, 2)
  }

  function deserialize(json: string): { success: boolean; migrated?: boolean; error?: string } {
    let raw: unknown
    try {
      raw = JSON.parse(json)
    } catch {
      return { success: false, error: 'JSON 解析失败' }
    }

    const obj = raw as Record<string, unknown>

    // 检测格式
    const format = obj?.format as string | undefined
    if (format !== FORMAT && format !== LEGACY_FORMAT) {
      return { success: false, error: '不是有效的 .ljs 工程文件' }
    }

    const isLegacy = format === LEGACY_FORMAT

    if (isLegacy) {
      const legacy = raw as LegacyProject
      if (!legacy?.data?.entities) {
        return { success: false, error: '旧版工程文件数据为空' }
      }

      // 迁移图层
      const layers: EditorLayer[] = (legacy.data.layers || []).map((l) => ({
        id: l.id || generateId('lyr'),
        name: l.name,
        visible: l.visible !== false,
        locked: false,
        entityCount: 0,
      }))
      if (layers.length === 0) {
        layers.push({ id: '0', name: 'default', visible: true, locked: false, entityCount: 0 })
      }

      // 迁移实体
      const entities = legacy.data.entities.map(migrateEntity)
      for (const e of entities) {
        const layer = layers.find((l) => l.id === e.layerId)
        if (layer) layer.entityCount++
      }

      store.fromJSON(JSON.stringify({ entities, layers, meta: migrateMeta(legacy.data.meta) }))
      return { success: true, migrated: true }
    }

    // 新版格式直接加载
    const project = raw as SerializedProject
    if (!project?.data?.entities) {
      return { success: false, error: '工程文件数据为空' }
    }

    // 确保图层有 locked 字段
    const layers: EditorLayer[] = (project.data.layers || []).map((l) => ({
      ...l,
      locked: l.locked ?? false,
    }))
    if (layers.length === 0) {
      layers.push({ id: '0', name: 'default', visible: true, locked: false, entityCount: 0 })
    }

    store.fromJSON(JSON.stringify({
      entities: project.data.entities,
      layers,
      meta: {
        ...project.data.meta,
        name: project.data.meta.name ?? 'Untitled',
        createdAt: project.data.meta.createdAt ?? project.savedAt,
      },
    }))
    return { success: true }
  }

  function download(fileName: string, content: string): void {
    const name = fileName.endsWith('.ljs') ? fileName : `${fileName}.ljs`
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return { serialize, deserialize, download }
}

function migrateMeta(legacy: LegacyMeta): ProjectMeta {
  return {
    version: PROJECT_VERSION,
    name: 'Migrated',
    createdAt: legacy.createdAt ?? legacy.updatedAt,
    updatedAt: new Date().toISOString(),
    sourceFileName: legacy.sourceFileName ?? '',
    entityCount: legacy.entityCount ?? 0,
    unsupportedCount: legacy.unsupportedEntities ?? 0,
  }
}
