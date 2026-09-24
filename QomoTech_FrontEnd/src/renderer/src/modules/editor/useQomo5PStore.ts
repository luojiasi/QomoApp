import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { QomoViewport, QomoSelectionRect } from './qomo5pTypes'
import type {
  IrregularShapeType,
  OpenDirectionType,
  Point,
  QomoArcSurfacesEntity,
  QomoBezierSurfacesEntity,
  QomoCircleSurfacesEntity,
  QomoEntityWithSurface,
  QomoIrregularSurfacesEntity,
  QomoLayer,
  QomoLineSurfacesEntity,
  QomoProjectMeta,
  QomoWeldingBase
} from './qomo5pTypes'
import { parseDxfToQomoEntities } from './cad/QomoDxf'
import { parseQomoProject, serializeQomoProject } from './cad/QomoProject'
import { downloadTextFile } from './cad/QomoProject'
import {
  applySelectionFlags,
  getBoundsFromEntities,
  isBezierEntity,
  isEllipseLikeIrregularEntity,
  MAX_BEZIER_POINTS,
  normalizeEntity,
  rebuildLayerCounts,
  recenterEntitiesAroundOrigin,
  sortLinesAndAttachNodeForExport
} from './cad/qomoEntityGeometry'

import { CENTER_ROTATION_STORAGE_KEY, QOMO5P_DRAFT_KEY } from '@/shared/constants/storageKeys'
import {
  QOMO5P_PROJECT_VERSION,
  DEFAULT_ENTITY_BASE_HEIGHT,
  createDefaultViewport,
  createDefaultLayer,
  createDefaultWelding
} from './configs/qomo5pConfigs'
import { zoomViewportAtPoint } from './cad/viewport'

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

type QomoSnapshot = {
  viewport: QomoViewport
  layers: QomoLayer[]
  entities: QomoEntityWithSurface[]
  selectedEntityIds: string[]
  projectMeta: QomoProjectMeta
}


const getUnifiedBaseHeight = () => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return DEFAULT_ENTITY_BASE_HEIGHT
  try {
    const raw = window.localStorage.getItem(CENTER_ROTATION_STORAGE_KEY)
    if (!raw) return DEFAULT_ENTITY_BASE_HEIGHT
    const parsed = JSON.parse(raw) as Partial<{ Zoffset: unknown }>
    const zoffset = Number(parsed.Zoffset)
    if (!Number.isFinite(zoffset)) return DEFAULT_ENTITY_BASE_HEIGHT
    return Math.abs(zoffset)
  } catch {
    return DEFAULT_ENTITY_BASE_HEIGHT
  }
}

const normalizeEntitiesBaseHeight = (items: QomoEntityWithSurface[]): QomoEntityWithSurface[] => {
  const baseHeight = getUnifiedBaseHeight()
  return items.map((entity) => ({ ...entity, baseHeight }))
}

const createEmptyMeta = (projectName = 'untitled'): QomoProjectMeta => {
  const now = new Date().toISOString()
  return {
    version: QOMO5P_PROJECT_VERSION,
    sourceFileName: projectName,
    createdAt: now,
    importedAt: now,
    updatedAt: now,
    unsupportedEntities: 0,
    entityCount: 0
  }
}

const createUserEntityId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`


export const useQomo5PStore = defineStore('qomo5p', () => {
  const viewport = ref<QomoViewport>(createDefaultViewport())
  const layers = ref<QomoLayer[]>([createDefaultLayer()])
  const entities = ref<QomoEntityWithSurface[]>([])
  const selectedEntityIds = ref<string[]>([])
  const selectionRect = ref<QomoSelectionRect | null>(null)
  const projectMeta = ref<QomoProjectMeta>(createEmptyMeta())
  const past = ref<QomoSnapshot[]>([])
  const future = ref<QomoSnapshot[]>([])
  /** 导入 DXF/LJS 时是否将图形包围盒中心平移到原点；默认 false 保留原始坐标 */
  const importRecenterToOrigin = ref(false)
  /** 画布几何拖动（平移/拖端点）：按下时截取，抬起时若发生过移动则入撤销栈 */
  const interactiveTransformBaseline = ref<QomoSnapshot | null>(null)

  const captureSnapshot = (): QomoSnapshot => ({
    viewport: deepClone(viewport.value),
    layers: deepClone(layers.value),
    entities: deepClone(entities.value),
    selectedEntityIds: [...selectedEntityIds.value],
    projectMeta: deepClone(projectMeta.value)
  })

  // 本地暂存函数
  const persistDraft = () => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(QOMO5P_DRAFT_KEY, JSON.stringify(captureSnapshot()))
  }

  const downloadDraftToFile = (projectName: string) => {
    const snap = captureSnapshot()
    const exportEntities = sortLinesAndAttachNodeForExport(snap.entities)
    const content = JSON.stringify(
      serializeQomoProject({
        meta: snap.projectMeta,
        layers: snap.layers,
        entities: exportEntities as QomoEntityWithSurface[]
      }),
      null,
      2
    )
    console.log(exportEntities)
    // TODO: 下载文件
    downloadTextFile(projectName, content)
  }

  const exportEntitiesToHomeVue = ():QomoEntityWithSurface[]=>{
    const snap = captureSnapshot()
    return sortLinesAndAttachNodeForExport(snap.entities) as QomoEntityWithSurface[]
  }

  const applySnapshot = (snapshot: QomoSnapshot, resetHistory = false) => {
    const normalizedEntities = normalizeEntitiesBaseHeight(snapshot.entities)
    viewport.value = deepClone(snapshot.viewport)
    layers.value = rebuildLayerCounts(snapshot.layers, normalizedEntities)
    entities.value = applySelectionFlags(normalizedEntities, snapshot.selectedEntityIds)
    // 图层0的名称固定为 default，确保历史快照/加载后数据一致
    entities.value.forEach((e) => {
      if (e.layerId === '0') e.layerName = 'default'
    })
    selectedEntityIds.value = [...snapshot.selectedEntityIds]
    projectMeta.value = {
      ...snapshot.projectMeta,
      updatedAt: new Date().toISOString(),
      entityCount: normalizedEntities.length
    }

    if (resetHistory) {
      past.value = []
      future.value = []
    }

    persistDraft()
  }

  const pushHistory = (snapshot: QomoSnapshot) => {
    past.value.push(deepClone(snapshot))
    if (past.value.length > 30) past.value.shift()
    future.value = []
  }

  // 移动主体===================================
  const beginInteractiveTransform = () => {
    interactiveTransformBaseline.value = captureSnapshot()
  }

  const cancelInteractiveTransform = () => {
    interactiveTransformBaseline.value = null
  }

  const endInteractiveTransform = () => {
    const baseline = interactiveTransformBaseline.value
    if (!baseline) return
    pushHistory(baseline)
    interactiveTransformBaseline.value = null
    projectMeta.value = {
      ...projectMeta.value,
      updatedAt: new Date().toISOString()
    }
    persistDraft()
  }

  /** 拖动中直接改几何，不写历史（须配合 begin/endInteractiveTransform） */
  const moveSelectedEntitiesInPlace = (dx: number, dy: number) => {
    if (selectedEntityIds.value.length === 0 || (dx === 0 && dy === 0)) return
    entities.value = entities.value.map((entity) => {
      if (!selectedEntityIds.value.includes(entity.id)) return entity
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
          points: entity.points.map((point) => ({
            x: point.x + dx,
            y: point.y + dy
          }))
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

  /** 拖动中直接改几何：移动所有实体（不依赖 selectedEntityIds） */
  const moveAllEntitiesInPlace = (dx: number, dy: number) => {
    if (entities.value.length === 0 || (dx === 0 && dy === 0)) return
    entities.value = entities.value.map((entity) => {
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
          startPoint: entity.startPoint ? { x: entity.startPoint.x + dx, y: entity.startPoint.y + dy } : undefined,
          endPoint: entity.endPoint ? { x: entity.endPoint.x + dx, y: entity.endPoint.y + dy } : undefined
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
          points: entity.points.map((point) => ({
            x: point.x + dx,
            y: point.y + dy
          }))
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

  const moveLineEndpointInPlace = (
    entityId: string,
    end: 'start' | 'end',
    dx: number,
    dy: number
  ) => {
    if (dx === 0 && dy === 0) return
    entities.value = entities.value.map((entity) => {
      if (entity.id !== entityId || entity.type !== 'LINE') return entity
      if (end === 'start') {
        return {
          ...entity,
          start: { x: entity.start.x + dx, y: entity.start.y + dy }
        }
      }
      return {
        ...entity,
        end: { x: entity.end.x + dx, y: entity.end.y + dy }
      }
    })
  }

  // 移动主体===================================
  // 移动 ARC 的端点：保持 center 和 radius 不变（端点会投影到圆上）
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
  const moveArcEndpointInPlace = (
    entityId: string,
    end: 'start' | 'end',
    dx: number,
    dy: number
  ) => {
    if (dx === 0 && dy === 0) return
    entities.value = entities.value.map((entity) => {
      if (entity.id !== entityId || entity.type !== 'ARC') return entity

      const center = entity.center
      const radius = entity.radius

      const curPoint =
        end === 'start'
          ? (entity.startPoint ?? polarToCartesian(center.x, center.y, radius, entity.startAngle))
          : (entity.endPoint ?? polarToCartesian(center.x, center.y, radius, entity.endAngle))

      const movedRaw = { x: curPoint.x + dx, y: curPoint.y + dy }

      // 投影到圆上，保证端点仍然落在 (center, radius) 定义的圆上
      const dxp = movedRaw.x - center.x
      const dyp = movedRaw.y - center.y
      const len = Math.hypot(dxp, dyp)
      if (len < 1e-6) return entity

      const scale = radius / len
      const projected = { x: center.x + dxp * scale, y: center.y + dyp * scale }

      const angle = (Math.atan2(projected.y - center.y, projected.x - center.x) * 180) / Math.PI

      if (end === 'start') {
        return {
          ...entity,
          startPoint: projected,
          startAngle: angle
        }
      }

      return {
        ...entity,
        endPoint: projected,
        endAngle: angle
      }
    })
  }
  // 移动 CIRCLE 的半径：保持 center 不变（用于“圆周点”拖动缩放）
  const moveCircleRadiusInPlace = (entityId: string, radius: number) => {
    const nextR = Math.max(radius, 1e-6)
    entities.value = entities.value.map((entity) => {
      if (entity.id !== entityId || entity.type !== 'CIRCLE') return entity
      if (Math.abs(entity.radius - nextR) < 1e-9) return entity
      return {
        ...entity,
        radius: nextR
      }
    })
  }

  // 移动 CIRCLE 的圆心：仅影响指定的当前圆
  const moveCircleCenterInPlace = (entityId: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return
    entities.value = entities.value.map((entity) => {
      if (entity.id !== entityId || entity.type !== 'CIRCLE') return entity
      return {
        ...entity,
        center: { x: entity.center.x + dx, y: entity.center.y + dy }
      }
    })
  }

  const moveEllipseCenterInPlace = (entityId: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return
    entities.value = entities.value.map((entity) => {
      if (entity.id !== entityId || !isEllipseLikeIrregularEntity(entity)) return entity
      return {
        ...entity,
        center: { x: entity.center.x + dx, y: entity.center.y + dy }
      }
    })
  }

  const moveBezierPointInPlace = (entityId: string, pointIndex: number, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return
    entities.value = entities.value.map((entity) => {
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

  // 移动 ARC 的圆心：仅影响指定的当前弧（保持 radius/startAngle/endAngle；若有 startPoint/endPoint 也整体平移）
  const moveArcCenterInPlace = (entityId: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return
    entities.value = entities.value.map((entity) => {
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
  // 移动主体===================================

  // 所有状态修改都走 applyMutation，避免重复写「快照捕获、状态修复」的逻辑
  const applyMutation = (mutator: (draft: QomoSnapshot) => void) => {
    // 记录修改前的完整状态
    const before = captureSnapshot()
    const draft = captureSnapshot()
    mutator(draft)
    draft.entities = normalizeEntitiesBaseHeight(draft.entities)

    // 重新计算层级和选中状态
    draft.layers = rebuildLayerCounts(draft.layers, draft.entities)
    // 根据 selectedEntityIds 给实体打 selected 标记
    draft.entities = applySelectionFlags(draft.entities, draft.selectedEntityIds)
    // 保证 updatedAt（最后修改时间）、entityCount（实体总数）始终是最新的
    draft.projectMeta = {
      ...draft.projectMeta,
      updatedAt: new Date().toISOString(),
      entityCount: draft.entities.length
    }
    // 应用修改后的状态
    applySnapshot(draft)
    // 记录修改前的完整状态到历史记录中
    pushHistory(before)
  }

  const sceneBounds = computed(() => getBoundsFromEntities(entities.value))
  const isLoaded = computed(() => entities.value.length > 0 || layers.value.length > 0)

  const createNewProject = (projectName: string) => {
    const nextViewport = {
      ...createDefaultViewport(),
      width: viewport.value.width,
      height: viewport.value.height,
      panX: viewport.value.width / 2,
      panY: viewport.value.height / 2
    }

    applySnapshot(
      {
        viewport: nextViewport,
        layers: [createDefaultLayer()],
        entities: [],
        selectedEntityIds: [],
        projectMeta: createEmptyMeta(projectName)
      },
      true
    )
  }

  const setSelection = (ids: string[]) => {
    selectedEntityIds.value = [...new Set(ids)]
    entities.value = applySelectionFlags(entities.value, selectedEntityIds.value)
  }

  const clearSelection = () => {
    setSelection([])
  }

  const selectSingleEntity = (id: string) => {
    setSelection([id])
  }

  const setCanvasSize = (width: number, height: number) => {
    viewport.value = {
      ...viewport.value,
      width,
      height
    }

    if (entities.value.length === 0) {
      viewport.value.panX = width / 2
      viewport.value.panY = height / 2
    }
  }

  const zoomAt = (screenPoint: Point, factor: number) => {
    viewport.value = zoomViewportAtPoint(viewport.value, factor, screenPoint)
  }

  const panBy = (dx: number, dy: number) => {
    viewport.value = {
      ...viewport.value,
      panX: viewport.value.panX + dx,
      panY: viewport.value.panY + dy
    }
  }

  //   const fitView = () => {
  //     viewport.value = fitViewportToBounds(sceneBounds.value, viewport.value.width, viewport.value.height)
  //   }

  //   const setSelection = (ids: string[]) => {
  //     selectedEntityIds.value = [...new Set(ids)]
  //     entities.value = applySelectionFlags(entities.value, selectedEntityIds.value)
  //   }

  //   const clearSelection = () => {
  //     setSelection([])
  //   }

  //   const selectSingleEntity = (id: string) => {
  //     setSelection([id])
  //   }

  const addLineEntity = (start: Point, end: Point) => {
    const targetLayer = layers.value[0] || createDefaultLayer()
    const nextEntity: QomoLineSurfacesEntity = {
      id: createUserEntityId('QOMO-LINE'),
      type: 'LINE',
      layerId: targetLayer.id,
      layerName: targetLayer.name,
      openDirection: 'RIGHT',
      selected: false,
      start,
      end,
      baseHeight: getUnifiedBaseHeight(),
      extrudeHeight: 5,
      surfaceAngle: 0,
      welding: createDefaultWelding()
    }
    applyMutation((draft) => {
      // 把新创建的实体（nextEntity）添加到草稿的实体数组中
      draft.entities.push(nextEntity)
      // 把选中状态设置为「只选中这个新实体」
      draft.selectedEntityIds = [nextEntity.id]
    })
  }

  const addArcEntity = (
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    startPoint: Point,
    endPoint: Point
  ) => {
    const targetLayer = layers.value[0] || createDefaultLayer()
    const nextEntity: QomoArcSurfacesEntity = {
      id: createUserEntityId('QOMO-ARC'),
      type: 'ARC',
      layerId: targetLayer.id,
      layerName: targetLayer.name,
      openDirection: 'RIGHT',
      selected: false,
      center,
      radius,
      startAngle,
      endAngle,
      startPoint,
      endPoint,
      baseHeight: getUnifiedBaseHeight(),
      extrudeHeight: 5,
      surfaceAngle: 0,
      welding: createDefaultWelding()
    }

    applyMutation((draft) => {
      draft.entities.push(nextEntity)
      draft.selectedEntityIds = [nextEntity.id]
    })
  }

  const addCircleEntity = (center: Point, radius: number) => {
    const targetLayer = layers.value[0] || createDefaultLayer()
    const nextEntity: QomoCircleSurfacesEntity = {
      id: createUserEntityId('QOMO-CIRCLE'),
      type: 'CIRCLE',
      layerId: targetLayer.id,
      layerName: targetLayer.name,
      openDirection: 'RIGHT',
      selected: false,
      center,
      radius,
      baseHeight: getUnifiedBaseHeight(),
      extrudeHeight: 5,
      surfaceAngle: 0,
      welding: createDefaultWelding()
    }

    applyMutation((draft) => {
      draft.entities.push(nextEntity)
      draft.selectedEntityIds = [nextEntity.id]
    })
  }

  const addBezierEntity = (points: Point[]) => {
    const normalizedPoints = points
      .filter(
        (point): point is Point =>
          Boolean(point) && typeof point.x === 'number' && typeof point.y === 'number'
      )
      .slice(0, MAX_BEZIER_POINTS)
      .map((point) => ({ x: point.x, y: point.y }))
    if (normalizedPoints.length < 2) return
    const targetLayer = layers.value[0] || createDefaultLayer()
    const nextEntity: QomoBezierSurfacesEntity = {
      id: createUserEntityId('QOMO-BEZIER'),
      type: 'BEZIER',
      layerId: targetLayer.id,
      layerName: targetLayer.name,
      openDirection: 'RIGHT',
      selected: false,
      points: normalizedPoints,
      baseHeight: getUnifiedBaseHeight(),
      extrudeHeight: 5,
      surfaceAngle: 0,
      welding: createDefaultWelding()
    }

    applyMutation((draft) => {
      draft.entities.push(nextEntity)
      draft.selectedEntityIds = [nextEntity.id]
    })
  }

  const addIrregularEntity = (
    shape: IrregularShapeType,
    center: Point,
    radiusX: number,
    radiusY: number,
    rotationDeg: number
  ) => {
    const targetLayer = layers.value[0] || createDefaultLayer()
    const nextEntity: QomoIrregularSurfacesEntity = {
      id: createUserEntityId(`QOMO-${shape.toUpperCase()}`),
      type: 'IRREGULAR',
      shape,
      layerId: targetLayer.id,
      layerName: targetLayer.name,
      openDirection: 'RIGHT',
      selected: false,
      center,
      radiusX: Math.max(radiusX, 1e-6),
      radiusY: Math.max(radiusY, 1e-6),
      rotationDeg,
      baseHeight: getUnifiedBaseHeight(),
      extrudeHeight: 5,
      surfaceAngle: 0,
      welding: createDefaultWelding()
    }

    applyMutation((draft) => {
      draft.entities.push(nextEntity)
      draft.selectedEntityIds = [nextEntity.id]
    })
  }

  const deleteSelectedEntities = () => {
    if (selectedEntityIds.value.length === 0) return

    applyMutation((draft) => {
      draft.entities = draft.entities.filter(
        (entity) => !draft.selectedEntityIds.includes(entity.id)
      )
      draft.selectedEntityIds = []
    })
  }

  //   const moveSelectedEntitiesBy = (dx: number, dy: number) => {
  //     if (selectedEntityIds.value.length === 0) {
  //       return
  //     }

  //     applyMutation((draft) => {
  //       draft.entities = draft.entities.map((entity) =>
  //         draft.selectedEntityIds.includes(entity.id) ? moveEntity(entity, dx, dy) : entity
  //       )
  //     })
  //   }

  const saveDraft = (projectName: string, isLocal: boolean = false) => {
    if (isLocal) persistDraft()
    downloadDraftToFile(projectName)
  }

  const importProjectFromLjs = (text: string, sourceFileName: string) => {
    const parsed = parseQomoProject(text)
    const parsedData = parsed.data
    const normalizedEntitiesRaw = (parsedData.entities ?? []).map((entity) =>
      normalizeEntity(entity as QomoEntityWithSurface)
    )
    const normalizedEntities = importRecenterToOrigin.value
      ? recenterEntitiesAroundOrigin(normalizedEntitiesRaw)
      : normalizedEntitiesRaw
    const nextMeta: QomoProjectMeta = {
      ...createEmptyMeta(sourceFileName),
      ...parsedData.meta,
      sourceFileName,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entityCount: normalizedEntities.length
    }
    const nextLayers =
      Array.isArray(parsedData.layers) && parsedData.layers.length > 0
        ? parsedData.layers
        : [createDefaultLayer()]
    const nextViewport = {
      ...createDefaultViewport(),
      width: viewport.value.width,
      height: viewport.value.height,
      panX: viewport.value.width / 2,
      panY: viewport.value.height / 2
    }

    applySnapshot(
      {
        viewport: nextViewport,
        layers: nextLayers,
        entities: normalizedEntities,
        selectedEntityIds: [],
        projectMeta: nextMeta
      },
      true
    )
  }

  // 接入DXF格式
  const importProjectFromDxf = (text: string, sourceFileName: string) => {
    const parsed = parseDxfToQomoEntities(text)
    const normalizedEntitiesRaw = parsed.entities.map((entity) => normalizeEntity(entity))
    const normalizedEntities = importRecenterToOrigin.value
      ? recenterEntitiesAroundOrigin(normalizedEntitiesRaw)
      : normalizedEntitiesRaw
    const nextMeta: QomoProjectMeta = {
      ...createEmptyMeta(sourceFileName),
      sourceFileName,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unsupportedEntities: parsed.unsupportedEntities,
      entityCount: normalizedEntities.length
    }
    const nextLayers = parsed.layers.length > 0 ? parsed.layers : [createDefaultLayer()]
    const nextViewport = {
      ...createDefaultViewport(),
      width: viewport.value.width,
      height: viewport.value.height,
      panX: viewport.value.width / 2,
      panY: viewport.value.height / 2
    }
    applySnapshot(
      {
        viewport: nextViewport,
        layers: nextLayers,
        entities: normalizedEntities,
        selectedEntityIds: [],
        projectMeta: nextMeta
      },
      true
    )
  }
  // 接入dxf格式



  const undo = () => {
    const snapshot = past.value.pop()
    if (!snapshot) return

    future.value.unshift(captureSnapshot())
    applySnapshot(snapshot)
  }

  const redo = () => {
    const snapshot = future.value.shift()
    if (!snapshot) return

    past.value.push(captureSnapshot())
    applySnapshot(snapshot)
  }
  const setSelectionRect = (rect: QomoSelectionRect | null) => {
    selectionRect.value = rect
  }

  // 更新实体的“可编辑参数”（不影响选中状态），用于参数信息面板的编辑弹窗
  const updateEntityParams = (
    id: string,
    updates: {
      openDirection?: OpenDirectionType
      baseHeight?: number
      extrudeHeight?: number
      surfaceAngle?: number
      welding?: Partial<QomoWeldingBase>
      start?: Point
      end?: Point
      points?: Point[]
      bezierPoint?: { index: number; value: Point }
      /** ARC / CIRCLE / IRREGULAR(oval/marquise/pear/heart) 圆心 */
      center?: Point
      /** ARC / CIRCLE 半径 */
      radius?: number
      /** IRREGULAR(oval/marquise/pear/heart) 半轴 */
      radiusX?: number
      radiusY?: number
      rotationDeg?: number
      /** ARC 起始角、终止角（度） */
      startAngle?: number
      endAngle?: number
      /** ARC 起点（世界坐标，会投影到当前圆上并回写 startAngle） */
      arcStartPoint?: Point
      /** ARC 终点 */
      arcEndPoint?: Point
    }
  ) => {
    applyMutation((draft) => {
      const entity = draft.entities.find((e) => e.id === id)
      if (!entity) return

      if (updates.openDirection) entity.openDirection = updates.openDirection
      if (typeof updates.baseHeight === 'number') entity.baseHeight = updates.baseHeight
      if (typeof updates.extrudeHeight === 'number') entity.extrudeHeight = updates.extrudeHeight
      if (typeof updates.surfaceAngle === 'number') entity.surfaceAngle = updates.surfaceAngle
      if (updates.welding) {
        entity.welding = {
          ...entity.welding,
          ...updates.welding
        }
      }
      if (entity.type === 'LINE') {
        if (
          updates.start &&
          typeof updates.start.x === 'number' &&
          typeof updates.start.y === 'number'
        ) {
          entity.start = { x: updates.start.x, y: updates.start.y }
        }
        if (updates.end && typeof updates.end.x === 'number' && typeof updates.end.y === 'number') {
          entity.end = { x: updates.end.x, y: updates.end.y }
        }
      }

      if (isBezierEntity(entity)) {
        if (Array.isArray(updates.points)) {
          entity.points = updates.points
            .filter(
              (point): point is Point =>
                Boolean(point) && typeof point.x === 'number' && typeof point.y === 'number'
            )
            .slice(0, MAX_BEZIER_POINTS)
            .map((point) => ({ x: point.x, y: point.y }))
        }
        if (
          updates.bezierPoint &&
          Number.isInteger(updates.bezierPoint.index) &&
          updates.bezierPoint.index >= 0 &&
          updates.bezierPoint.index < entity.points.length
        ) {
          const { index, value } = updates.bezierPoint
          if (typeof value.x === 'number' && typeof value.y === 'number') {
            entity.points = entity.points.map((point, pointIndex) =>
              pointIndex === index ? { x: value.x, y: value.y } : point
            )
          }
        }
      }

      const projectPointToCircle = (c: Point, r: number, raw: Point): Point => {
        const dxp = raw.x - c.x
        const dyp = raw.y - c.y
        const len = Math.hypot(dxp, dyp)
        if (len < 1e-9) return polarToCartesian(c.x, c.y, r, 0)
        const scale = r / len
        return { x: c.x + dxp * scale, y: c.y + dyp * scale }
      }
      const angleDegFromPoint = (c: Point, pt: Point) =>
        (Math.atan2(pt.y - c.y, pt.x - c.x) * 180) / Math.PI

      if (entity.type === 'ARC') {
        if (
          updates.center &&
          typeof updates.center.x === 'number' &&
          typeof updates.center.y === 'number'
        ) {
          entity.center = { x: updates.center.x, y: updates.center.y }
        }
        if (typeof updates.radius === 'number' && Number.isFinite(updates.radius)) {
          entity.radius = Math.max(1e-6, updates.radius)
        }
        if (typeof updates.startAngle === 'number' && Number.isFinite(updates.startAngle)) {
          entity.startAngle = updates.startAngle
        }
        if (typeof updates.endAngle === 'number' && Number.isFinite(updates.endAngle)) {
          entity.endAngle = updates.endAngle
        }

        if (
          updates.arcStartPoint &&
          typeof updates.arcStartPoint.x === 'number' &&
          typeof updates.arcStartPoint.y === 'number'
        ) {
          const p = projectPointToCircle(entity.center, entity.radius, updates.arcStartPoint)
          entity.startPoint = p
          entity.startAngle = angleDegFromPoint(entity.center, p)
        } else if (
          updates.center ||
          typeof updates.radius === 'number' ||
          typeof updates.startAngle === 'number'
        ) {
          entity.startPoint = polarToCartesian(
            entity.center.x,
            entity.center.y,
            entity.radius,
            entity.startAngle
          )
        }

        if (
          updates.arcEndPoint &&
          typeof updates.arcEndPoint.x === 'number' &&
          typeof updates.arcEndPoint.y === 'number'
        ) {
          const p = projectPointToCircle(entity.center, entity.radius, updates.arcEndPoint)
          entity.endPoint = p
          entity.endAngle = angleDegFromPoint(entity.center, p)
        } else if (
          updates.center ||
          typeof updates.radius === 'number' ||
          typeof updates.endAngle === 'number'
        ) {
          entity.endPoint = polarToCartesian(
            entity.center.x,
            entity.center.y,
            entity.radius,
            entity.endAngle
          )
        }
      }

      if (entity.type === 'CIRCLE') {
        if (
          updates.center &&
          typeof updates.center.x === 'number' &&
          typeof updates.center.y === 'number'
        ) {
          entity.center = { x: updates.center.x, y: updates.center.y }
        }
        if (typeof updates.radius === 'number' && Number.isFinite(updates.radius)) {
          entity.radius = Math.max(1e-6, updates.radius)
        }
      }

      if (isEllipseLikeIrregularEntity(entity)) {
        if (
          updates.center &&
          typeof updates.center.x === 'number' &&
          typeof updates.center.y === 'number'
        ) {
          entity.center = { x: updates.center.x, y: updates.center.y }
        }
        if (typeof updates.radiusX === 'number' && Number.isFinite(updates.radiusX)) {
          entity.radiusX = Math.max(1e-6, updates.radiusX)
        }
        if (typeof updates.radiusY === 'number' && Number.isFinite(updates.radiusY)) {
          entity.radiusY = Math.max(1e-6, updates.radiusY)
        }
        if (typeof updates.rotationDeg === 'number' && Number.isFinite(updates.rotationDeg)) {
          entity.rotationDeg = updates.rotationDeg
        }
      }
    })
  }

  // 更新图层信息（改名/显示开关），并同步更新该图层下实体名称
  const updateLayer = (layerId: string, updates: { name?: string; visible?: boolean }) => {
    applyMutation((draft) => {
      const layer = draft.layers.find((l) => l.id === layerId)
      if (!layer) return

      // 图层0 永远固定为 default，不允许改名
      if (layerId === '0') {
        layer.name = 'default'
        if (typeof updates.visible === 'boolean') layer.visible = updates.visible
        draft.entities.forEach((e) => {
          if (e.layerId === layerId) e.layerName = 'default'
        })
        return
      }

      if (typeof updates.name === 'string') layer.name = updates.name
      if (typeof updates.visible === 'boolean') layer.visible = updates.visible

      if (typeof updates.name === 'string') {
        draft.entities.forEach((e) => {
          if (e.layerId === layerId) e.layerName = updates.name as string
        })
      }
    })
  }

  // 新建图层：名字 = 图层 + 当前图层数量（layer.length）
  // 返回新图层 id，方便 UI 在创建后把选中实体自动切到新图层
  const addLayer = (): string => {
    let nextLayerId = ''
    applyMutation((draft) => {
      const nextIndex = draft.layers.length // 当前数量（包含图层0）
      nextLayerId = createUserEntityId('QOMO-LAYER')
      const nextLayerName = `图层${nextIndex}`
      draft.layers.push({
        id: nextLayerId,
        name: nextLayerName,
        visible: true,
        entityCount: 0
      })
    })
    return nextLayerId
  }

  // 把指定实体切换到目标图层
  const moveEntitiesToLayer = (entityIds: string[], targetLayerId: string) => {
    applyMutation((draft) => {
      const targetLayer = draft.layers.find((l) => l.id === targetLayerId)
      if (!targetLayer || entityIds.length === 0) return

      draft.entities.forEach((e) => {
        if (!entityIds.includes(e.id)) return
        e.layerId = targetLayer.id
        e.layerName = targetLayer.name
      })
    })
  }

  // 删除图层：图层0永远不允许删除，删除后把该层实体移动到图层0
  const deleteLayer = (layerId: string) => {
    if (layerId === '0') return

    applyMutation((draft) => {
      const layerToDelete = draft.layers.find((l) => l.id === layerId)
      if (!layerToDelete) return

      // 确保默认图层存在
      const defaultLayer = draft.layers.find((l) => l.id === '0') || createDefaultLayer()
      if (!draft.layers.find((l) => l.id === '0')) {
        draft.layers.unshift(defaultLayer)
      }

      // 移动实体到默认图层，并同步 layerName
      draft.entities.forEach((e) => {
        if (e.layerId !== layerId) return
        e.layerId = '0'
        e.layerName = 'default'
      })

      // 删除图层
      draft.layers = draft.layers.filter((l) => l.id !== layerId)
    })
  }

  return {
    viewport,
    layers,
    entities,
    selectedEntityIds,
    projectMeta,
    importRecenterToOrigin,
    isLoaded,
    sceneBounds,
    selectionRect,
    createNewProject,
    setSelection,
    clearSelection,
    selectSingleEntity,
    setCanvasSize,
    zoomAt,
    panBy,
    // fitView,
    // setSelection,
    // clearSelection,
    // selectSingleEntity,
    addLineEntity,
    addArcEntity,
    addCircleEntity,
    addBezierEntity,
    addIrregularEntity,
    // moveSelectedEntitiesBy,
    deleteSelectedEntities,
    setSelectionRect,
    saveDraft,
    // 导入文件方法
    importProjectFromLjs,
    importProjectFromDxf,
    // 操作
    undo,
    redo,
    updateEntityParams,
    updateLayer,
    addLayer,
    moveEntitiesToLayer,
    deleteLayer,
    // 移动主体===================================
    beginInteractiveTransform,
    cancelInteractiveTransform,
    endInteractiveTransform,
    moveSelectedEntitiesInPlace,
    moveAllEntitiesInPlace,
    moveLineEndpointInPlace,
    moveArcEndpointInPlace,
    moveArcCenterInPlace,
    moveCircleRadiusInPlace,
    moveCircleCenterInPlace,
    moveEllipseCenterInPlace,
    moveBezierPointInPlace,

    // 给HomeVue用的
    exportEntitiesToHomeVue

    // 移动主体===================================
  }
})
