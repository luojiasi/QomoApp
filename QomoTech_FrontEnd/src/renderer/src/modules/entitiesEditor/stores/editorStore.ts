// =============================================================================
// entitiesEditor 核心状态管理
// ~220 lines
// =============================================================================

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { EditorEntity, EditorLayer, ProjectMeta, SurfaceEntity, ToolMode, ViewportState } from '@/modules/entitiesEditor/commons/types'
import { PROJECT_VERSION, MAX_UNDO_STEPS, createDefaultViewport, createDefaultLayer, createEmptyMeta } from '@/modules/entitiesEditor/configs/defaults'
import { generateId } from '@/modules/entitiesEditor/utils/idgen'

/** 存储中的实体类型：基础实体 + 挤出参数 */
type StoreEntity = SurfaceEntity<EditorEntity>

export const useEditorStore = defineStore('entitiesEditor', () => {
  // ========== State ==========

  const viewport = ref<ViewportState>(createDefaultViewport())
  const layers = ref<EditorLayer[]>([createDefaultLayer()])
  const entities = ref<StoreEntity[]>([])
  const selectedIds = ref<string[]>([])
  const activeTool = ref<ToolMode>('SELECT')
  const projectMeta = ref<ProjectMeta>(createEmptyMeta())
  const undoStack = ref<string[]>([])
  const redoStack = ref<string[]>([])
  const dirtyEntityIds = ref<string[]>([])

  // ========== Computed ==========

  const selectedEntities = computed(() =>
    entities.value.filter((e) => selectedIds.value.includes(e.id)),
  )

  const layerEntityCounts = computed(() => {
    const counts: Record<string, number> = {}
    for (const e of entities.value) {
      counts[e.layerId] = (counts[e.layerId] ?? 0) + 1
    }
    return counts
  })

  const isDirty = computed(() => dirtyEntityIds.value.length > 0)

  // ========== Snapshot / Undo / Redo ==========

  function captureSnapshot(): void {
    const json = JSON.stringify({
      entities: entities.value,
      layers: layers.value,
      meta: projectMeta.value,
    })
    undoStack.value.push(json)
    if (undoStack.value.length > MAX_UNDO_STEPS) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  function applySnapshot(json: string): void {
    const snap = JSON.parse(json)
    entities.value = snap.entities
    layers.value = snap.layers
    projectMeta.value = snap.meta
  }

  function undo(): void {
    const prev = undoStack.value.pop()
    if (!prev) return
    redoStack.value.push(JSON.stringify({
      entities: entities.value,
      layers: layers.value,
      meta: projectMeta.value,
    }))
    applySnapshot(prev)
  }

  function redo(): void {
    const next = redoStack.value.pop()
    if (!next) return
    undoStack.value.push(JSON.stringify({
      entities: entities.value,
      layers: layers.value,
      meta: projectMeta.value,
    }))
    applySnapshot(next)
  }

  // ========== Tool / Selection ==========

  function setTool(tool: ToolMode): void {
    activeTool.value = tool
  }

  function setSelection(ids: string[]): void {
    // 取消旧选择
    for (const id of selectedIds.value) {
      const entity = entities.value.find((e) => e.id === id)
      if (entity) entity.selected = false
    }
    // 设置新选择
    for (const id of ids) {
      const entity = entities.value.find((e) => e.id === id)
      if (entity) entity.selected = true
    }
    selectedIds.value = ids
  }

  // ========== Entity CRUD ==========

  function addEntity(entity: StoreEntity): void {
    captureSnapshot()
    const layer = layers.value.find((l) => l.id === entity.layerId)
    if (layer) layer.entityCount++
    entities.value.push(entity)
    projectMeta.value.entityCount = entities.value.length
    projectMeta.value.updatedAt = new Date().toISOString()
  }

  function updateEntity(id: string, patch: Partial<StoreEntity>): void {
    const idx = entities.value.findIndex((e) => e.id === id)
    if (idx === -1) return
    captureSnapshot()
    entities.value[idx] = { ...entities.value[idx], ...patch } as StoreEntity
    if (!dirtyEntityIds.value.includes(id)) {
      dirtyEntityIds.value.push(id)
    }
    projectMeta.value.updatedAt = new Date().toISOString()
  }

  function deleteSelected(): void {
    if (selectedIds.value.length === 0) return
    captureSnapshot()
    const ids = new Set(selectedIds.value)
    for (const id of ids) {
      const layer = layers.value.find((l) => l.id === entities.value.find((e) => e.id === id)?.layerId)
      if (layer) layer.entityCount = Math.max(0, layer.entityCount - 1)
    }
    entities.value = entities.value.filter((e) => !ids.has(e.id))
    selectedIds.value = []
    projectMeta.value.entityCount = entities.value.length
    projectMeta.value.updatedAt = new Date().toISOString()
  }

  function replaceAllEntities(newEntities: StoreEntity[]): void {
    captureSnapshot()
    entities.value = newEntities
    selectedIds.value = []
    dirtyEntityIds.value = newEntities.map((e) => e.id)
    projectMeta.value.entityCount = newEntities.length
    projectMeta.value.updatedAt = new Date().toISOString()
    // 重建图层计数
    for (const layer of layers.value) {
      layer.entityCount = 0
    }
    for (const e of newEntities) {
      const layer = layers.value.find((l) => l.id === e.layerId)
      if (layer) layer.entityCount++
    }
  }

  // ========== Layer CRUD ==========

  function createLayer(name?: string): EditorLayer {
    captureSnapshot()
    const layer = createDefaultLayer(name)
    layers.value.push(layer)
    return layer
  }

  function deleteLayer(id: string): void {
    if (layers.value.length <= 1) return
    captureSnapshot()
    // 将该图层实体移到默认图层
    const fallbackId = layers.value[0].id === id ? layers.value[1]?.id : layers.value[0].id
    if (fallbackId) {
      for (const e of entities.value) {
        if (e.layerId === id) e.layerId = fallbackId
      }
    }
    layers.value = layers.value.filter((l) => l.id !== id)
  }

  function updateLayer(id: string, patch: Partial<EditorLayer>): void {
    const idx = layers.value.findIndex((l) => l.id === id)
    if (idx === -1) return
    captureSnapshot()
    layers.value[idx] = { ...layers.value[idx], ...patch }
  }

  // ========== Viewport ==========

  function setViewportSize(w: number, h: number): void {
    viewport.value.width = w
    viewport.value.height = h
  }

  function resetViewport(): void {
    viewport.value = createDefaultViewport(viewport.value.width, viewport.value.height)
  }

  // ========== Unified mutation entry ==========

  function applyMutation(mutator: () => void): void {
    captureSnapshot()
    mutator()
    projectMeta.value.updatedAt = new Date().toISOString()
  }

  /** 清除脏标记（3D composable 重建完成后调用） */
  function clearDirty(): void {
    dirtyEntityIds.value = []
  }

  // ========== Serialization helpers ==========

  function toJSON(): string {
    return JSON.stringify({
      entities: entities.value,
      layers: layers.value,
      meta: { ...projectMeta.value, version: PROJECT_VERSION },
    })
  }

  function fromJSON(json: string): void {
    captureSnapshot()
    const data = JSON.parse(json)
    entities.value = data.entities ?? []
    layers.value = data.layers ?? [createDefaultLayer()]
    projectMeta.value = data.meta ?? createEmptyMeta()
    selectedIds.value = []
    dirtyEntityIds.value = entities.value.map((e: StoreEntity) => e.id)
  }

  return {
    // state
    viewport,
    layers,
    entities,
    selectedIds,
    activeTool,
    projectMeta,
    undoStack,
    redoStack,
    dirtyEntityIds,
    // computed
    selectedEntities,
    layerEntityCounts,
    isDirty,
    // actions
    captureSnapshot,
    undo,
    redo,
    setTool,
    setSelection,
    addEntity,
    updateEntity,
    deleteSelected,
    replaceAllEntities,
    createLayer,
    deleteLayer,
    updateLayer,
    setViewportSize,
    resetViewport,
    applyMutation,
    clearDirty,
    toJSON,
    fromJSON,
  }
})
