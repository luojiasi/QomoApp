// =============================================================================
// entitiesEditor 核心 Store —— 实体 CRUD + 撤销重做 + 图层管理 + 视口
// =============================================================================
//
// 【职责】
//   本 Store 是 entitiesEditor 模块的单一数据源（SSOT），集中管理：
//   - 2D 画布视口（缩放、平移、尺寸）
//   - 图层列表与当前活动图层
//   - 带 3D 挤出参数的 CAD 实体集合
//   - 当前选中实体、活动工具、绘制子工具
//   - 项目元信息、撤销/重做栈、未保存变更追踪
//
// 【使用方式】
//   在 Vue 组件或 composable 中：
//
//     import { useEditorStore } from '@/modules/entitiesEditor/stores/editorStore'
//     const store = useEditorStore()
//
//     // 读取状态（响应式，可直接用于模板）
//     store.entities
//     store.activeLayerId
//
//     // 修改状态（通过 actions，会自动触发撤销快照）
//     store.addEntity({ kind: 'LINE', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } })
//     store.undo()
//
// 【与快捷键的对应关系】（见 configs/defaults.ts ACTIONS）
//   UNDO  → store.undo()
//   REDO  → store.redo()
//   DELETE_SELECTED → store.deleteSelected()
//   SELECT / PAN / DRAW_* → store.setTool() / store.setDrawSubTool()
//
// 【注意事项】
//   - 所有会改变 entities / layers / projectMeta 的写操作会先调用 captureSnapshot()
//   - setViewportSize / resetViewport 不记入撤销栈（纯视图操作）
//   - 当前仅支持「第一个图层」为活动图层（activeLayerId = layers[0]）
// =============================================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ViewportState,
  EditorLayer,
  EditorEntity,
  SurfaceEntity,
  ToolMode,
  EntityKind,
  ProjectMeta,
} from '../commons/types'
import {
  MAX_UNDO_STEPS,
  DEFAULT_LAYER_NAME,
  INITIAL_ZOOM,
  INITIAL_PAN_X,
  INITIAL_PAN_Y,
  INITIAL_VIEWPORT_WIDTH,
  INITIAL_VIEWPORT_HEIGHT,
  PROJECT_VERSION,
} from '../configs/defaults'
import { generateId } from '../utils/idgen'
import { loadGeneralConfig } from './generalSettingsStore'

/**
 * 新增实体时的输入类型。
 * 调用方只需提供几何与 kind，id / layerId / openSide 由 addEntity 自动填充；
 * height / openSize / tiltAngleDeg 从 generalSettingsStore 的默认配置注入。
 *
 * @example
 * store.addEntity({
 *   kind: 'CIRCLE',
 *   center: { x: 50, y: 50 },
 *   radius: 25,
 * })
 */
type AddEntityInput = Omit<EditorEntity, 'id' | 'layerId' | 'openSide'>

/**
 * 创建初始视口状态。
 * 用于 Store 初始化及 resetViewport()。
 *
 * @returns 默认 zoom、pan、宽高（来自 configs/defaults）
 */
function createInitialViewport(): ViewportState {
  return {
    zoom: INITIAL_ZOOM,
    panX: INITIAL_PAN_X,
    panY: INITIAL_PAN_Y,
    width: INITIAL_VIEWPORT_WIDTH,
    height: INITIAL_VIEWPORT_HEIGHT,
  }
}

/**
 * 创建初始项目元信息。
 * 项目名称取自 generalSettingsStore；时间戳为 ISO 字符串。
 *
 * @returns 空项目 meta（entityCount = 0）
 */
function createInitialMeta(): ProjectMeta {
  const config = loadGeneralConfig()
  return {
    version: PROJECT_VERSION,
    name: config.defaultProjectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceFileName: '',
    entityCount: 0,
    unsupportedCount: 0,
  }
}

/**
 * 创建单个图层对象（尚未加入 layers 数组）。
 *
 * @param name - 图层显示名，默认 DEFAULT_LAYER_NAME（「图层 1」）
 * @returns 带新 id 的 EditorLayer，entityCount 初始为 0
 */
function createDefaultLayer(name?: string): EditorLayer {
  return {
    id: generateId('layer'),
    name: name ?? DEFAULT_LAYER_NAME,
    visible: true,
    locked: false,
    entityCount: 0,
  }
}

/**
 * entitiesEditor Pinia Store（Composition API 风格）。
 *
 * Pinia id: `'entitiesEditor'`
 * 在测试中可用 `setActivePinia(createPinia())` 后 `useEditorStore()` 获取独立实例。
 */
export const useEditorStore = defineStore('entitiesEditor', () => {
  // ── State（响应式状态）──────────────────────────────────────────────

  /** 2D 画布视口：zoom、panX/Y、画布像素宽高。用于 screen↔world 坐标转换与重绘。 */
  const viewport       = ref<ViewportState>(createInitialViewport())

  /** 图层列表。新建实体归属 layers[0]（见 activeLayerId）。 */
  const layers         = ref<EditorLayer[]>([createDefaultLayer()])

  /** 全部 CAD 实体（含挤出 height / openSize / tiltAngleDeg）。 */
  const entities       = ref<SurfaceEntity<EditorEntity>[]>([])

  /** 当前选中的实体 id 列表（支持多选）。 */
  const selectedIds    = ref<string[]>([])

  /** 当前主工具：SELECT | DRAW | PAN。 */
  const activeTool     = ref<ToolMode>('SELECT')

  /** DRAW 模式下的子图元类型：LINE | ARC | CIRCLE 等。 */
  const drawSubTool    = ref<EntityKind>('LINE')

  /** 项目元信息：名称、版本、实体数、更新时间等。 */
  const projectMeta    = ref<ProjectMeta>(createInitialMeta())

  /** 撤销栈：每项为 JSON 字符串快照（entities + layers + projectMeta）。 */
  const undoStack      = ref<string[]>([])

  /** 重做栈：结构与 undoStack 相同。执行新写操作后 redoStack 会被清空。 */
  const redoStack      = ref<string[]>([])

  /**
   * 自上次 clearDirty() 以来被修改过的实体 id。
   * 用于增量保存、3D 预览局部更新等场景。
   */
  const dirtyEntityIds = ref<string[]>([])

  // ── Getters（派生状态）──────────────────────────────────────────────

  /**
   * 当前活动图层 id（固定为 layers 的第一项）。
   * addEntity 会将新实体 layerId 设为该值。
   *
   * @example
   * const layerId = store.activeLayerId
   */
  const activeLayerId = computed(() => layers.value[0]?.id ?? '')

  // ── Internal helpers（内部辅助，不对外导出）────────────────────────

  /**
   * 根据 entities 同步 projectMeta.entityCount、updatedAt 及各 layer.entityCount。
   * 在每次实体/图层变更后由 CRUD 方法调用。
   */
  function syncMeta() {
    projectMeta.value.entityCount = entities.value.length
    projectMeta.value.updatedAt = new Date().toISOString()
    for (const layer of layers.value) {
      layer.entityCount = entities.value.filter(e => e.layerId === layer.id).length
    }
  }

  // ── Undo / Redo（撤销 / 重做）──────────────────────────────────────

  /**
   * 将当前 { entities, layers, projectMeta } 序列化为 JSON 并压入 undoStack。
   * 超过 MAX_UNDO_STEPS 时丢弃最旧快照；同时清空 redoStack。
   *
   * 一般由其他 action 内部调用；也可在批量自定义操作前手动调用一次。
   *
   * @example
   * store.captureSnapshot()
   * // ... 自定义批量修改 entities ...
   */
  function captureSnapshot() {
    const snapshot = JSON.stringify({
      entities: entities.value,
      layers: layers.value,
      projectMeta: projectMeta.value,
    })
    undoStack.value.push(snapshot)
    if (undoStack.value.length > MAX_UNDO_STEPS) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  /**
   * 撤销一步：从 undoStack 弹出快照并恢复；当前状态压入 redoStack。
   * 撤销后清空 selectedIds。栈空时无操作。
   *
   * @example
   * store.undo()  // 对应快捷键 Ctrl+Z / ACTION UNDO
   */
  function undo() {
    if (undoStack.value.length === 0) return
    const current = JSON.stringify({
      entities: entities.value,
      layers: layers.value,
      projectMeta: projectMeta.value,
    })
    redoStack.value.push(current)
    const state = JSON.parse(undoStack.value.pop()!)
    entities.value    = state.entities
    layers.value      = state.layers
    projectMeta.value = state.projectMeta
    selectedIds.value = []
  }

  /**
   * 重做一步：从 redoStack 弹出快照并恢复；当前状态压入 undoStack。
   * 重做后清空 selectedIds。栈空时无操作。
   *
   * @example
   * store.redo()  // 对应快捷键 Ctrl+Y / ACTION REDO
   */
  function redo() {
    if (redoStack.value.length === 0) return
    const current = JSON.stringify({
      entities: entities.value,
      layers: layers.value,
      projectMeta: projectMeta.value,
    })
    undoStack.value.push(current)
    const state = JSON.parse(redoStack.value.pop()!)
    entities.value    = state.entities
    layers.value      = state.layers
    projectMeta.value = state.projectMeta
    selectedIds.value = []
  }

  // ── Tool / Selection（工具与选择）──────────────────────────────────

  /**
   * 切换主工具模式。
   *
   * @param tool - 'SELECT' | 'DRAW' | 'PAN'
   *
   * @example
   * store.setTool('DRAW')
   * store.setDrawSubTool('CIRCLE')
   */
  function setTool(tool: ToolMode) {
    activeTool.value = tool
  }

  /**
   * 在 DRAW 模式下设置要绘制的图元类型。
   *
   * @param kind - EntityKind，如 'LINE'、'ARC'
   *
   * @example
   * store.setTool('DRAW')
   * store.setDrawSubTool('POLYLINE')
   */
  function setDrawSubTool(kind: EntityKind) {
    drawSubTool.value = kind
  }

  /**
   * 设置当前选中的实体 id 列表（替换整表，非追加）。
   *
   * @param ids - 实体 id 数组；空数组表示取消全部选择
   *
   * @example
   * store.setSelection([entityId])
   * store.setSelection([])  // 清空选择
   */
  function setSelection(ids: string[]) {
    selectedIds.value = ids
  }

  // ── Entity CRUD（实体增删改）────────────────────────────────────────

  /**
   * 新增一条实体到当前活动图层。
   * 自动：generateId()、layerId、openSide='LEFT'、默认挤出参数。
   * 会 captureSnapshot、标记 dirty、syncMeta。
   *
   * @param input - 不含 id / layerId / openSide 的实体几何数据
   *
   * @example
   * store.addEntity({
   *   kind: 'LINE',
   *   start: { x: 0, y: 0 },
   *   end: { x: 100, y: 50 },
   * })
   */
  function addEntity(input: AddEntityInput) {
    captureSnapshot()
    const config = loadGeneralConfig()
    const entity: SurfaceEntity<EditorEntity> = {
      ...input,
      id: generateId(),
      layerId: activeLayerId.value,
      openSide: 'LEFT',
      height: config.defaultExtrudeHeight,
      openSize: config.defaultOpenSize,
      tiltAngleDeg: config.defaultTiltAngle,
    } as SurfaceEntity<EditorEntity>
    entities.value.push(entity)
    dirtyEntityIds.value.push(entity.id)
    syncMeta()
  }

  /**
   * 按 id 局部更新实体字段（浅合并 patch）。
   * 找不到 id 时静默返回。会 captureSnapshot、标记 dirty、syncMeta。
   *
   * @param id - 实体 id
   * @param patch - 要覆盖的字段（可含几何或挤出参数）
   *
   * @example
   * store.updateEntity(id, { radius: 30 })
   * store.updateEntity(id, { height: 5, tiltAngleDeg: 15 })
   */
  function updateEntity(id: string, patch: Partial<SurfaceEntity<EditorEntity>>) {
    captureSnapshot()
    const idx = entities.value.findIndex(e => e.id === id)
    if (idx === -1) return
    entities.value[idx] = { ...entities.value[idx], ...patch } as SurfaceEntity<EditorEntity>
    if (!dirtyEntityIds.value.includes(id)) {
      dirtyEntityIds.value.push(id)
    }
    syncMeta()
  }

  /**
   * 删除 selectedIds 中的所有实体。
   * 无选中时直接返回。会 captureSnapshot、清空选择、syncMeta。
   *
   * @example
   * store.setSelection([id1, id2])
   * store.deleteSelected()  // 对应 Delete 键 / ACTION DELETE_SELECTED
   */
  function deleteSelected() {
    if (selectedIds.value.length === 0) return
    captureSnapshot()
    const ids = new Set(selectedIds.value)
    entities.value = entities.value.filter(e => !ids.has(e.id))
    dirtyEntityIds.value = dirtyEntityIds.value.filter(id => !ids.has(id))
    selectedIds.value = []
    syncMeta()
  }

  /**
   * 整体替换实体列表（及可选的图层、meta 补丁）。
   * 用于：打开项目文件、导入 DXF、重置场景等。
   * 会 captureSnapshot、清空选择与 dirty、syncMeta。
   *
   * @param newEntities - 新的完整实体数组
   * @param newLayers - 可选；非空时替换 layers
   * @param newMeta - 可选；与现有 projectMeta 浅合并
   *
   * @example
   * store.replaceAllEntities(parsed.entities, parsed.layers, {
   *   name: 'imported.dxf',
   *   sourceFileName: 'imported.dxf',
   * })
   */
  function replaceAllEntities(
    newEntities: SurfaceEntity<EditorEntity>[],
    newLayers?: EditorLayer[],
    newMeta?: Partial<ProjectMeta>,
  ) {
    captureSnapshot()
    entities.value = newEntities
    if (newLayers && newLayers.length > 0) {
      layers.value = newLayers
    }
    if (newMeta) {
      projectMeta.value = { ...projectMeta.value, ...newMeta }
    }
    selectedIds.value = []
    dirtyEntityIds.value = []
    syncMeta()
  }

  // ── Layer CRUD（图层管理）──────────────────────────────────────────

  /**
   * 新建图层并追加到 layers 末尾。
   * 不改变 activeLayerId（仍为 layers[0]）。
   *
   * @param name - 可选显示名；默认「图层 N」（N = 当前层数 + 1）
   *
   * @example
   * store.createLayer('轮廓')
   * store.createLayer()  // 自动命名
   */
  function createLayer(name?: string) {
    captureSnapshot()
    const layer = createDefaultLayer(
      name ?? `${DEFAULT_LAYER_NAME} ${layers.value.length + 1}`
    )
    layers.value.push(layer)
    syncMeta()
  }

  /**
   * 删除指定图层及其上全部实体。
   * 至少保留一个图层（仅剩一层时无操作）。
   * 会清理已失效的 selectedIds。
   *
   * @param layerId - 要删除的图层 id
   *
   * @example
   * store.deleteLayer(layerId)
   */
  function deleteLayer(layerId: string) {
    if (layers.value.length <= 1) return
    captureSnapshot()
    layers.value = layers.value.filter(l => l.id !== layerId)
    entities.value = entities.value.filter(e => e.layerId !== layerId)
    selectedIds.value = selectedIds.value.filter(id =>
      entities.value.some(e => e.id === id)
    )
    syncMeta()
  }

  /**
   * 更新图层属性（name / visible / locked 等，不可改 id）。
   * 找不到 layerId 时无操作。
   *
   * @param layerId - 图层 id
   * @param patch - 要合并的字段
   *
   * @example
   * store.updateLayer(layerId, { visible: false })
   * store.updateLayer(layerId, { locked: true, name: '参考' })
   */
  function updateLayer(layerId: string, patch: Partial<Omit<EditorLayer, 'id'>>) {
    const layer = layers.value.find(l => l.id === layerId)
    if (!layer) return
    captureSnapshot()
    Object.assign(layer, patch)
    syncMeta()
  }

  /**
   * 将实体移动到指定图层。
   * 目标图层不存在或与当前图层相同时无操作。
   *
   * @param entityId - 实体 id
   * @param targetLayerId - 目标图层 id
   */
  function moveEntityToLayer(entityId: string, targetLayerId: string) {
    const entity = entities.value.find(e => e.id === entityId)
    if (!entity) return
    if (entity.layerId === targetLayerId) return
    if (!layers.value.some(l => l.id === targetLayerId)) return
    captureSnapshot()
    entity.layerId = targetLayerId
    if (!dirtyEntityIds.value.includes(entityId)) {
      dirtyEntityIds.value.push(entityId)
    }
    syncMeta()
  }

  // ── Viewport（视口，不进入撤销栈）────────────────────────────────────

  /**
   * 更新画布 DOM 的像素宽高（如 resize 观察者回调）。
   * 不触发 captureSnapshot。
   *
   * @param w - 画布宽度（px）
   * @param h - 画布高度（px）
   *
   * @example
   * store.setViewportSize(canvas.clientWidth, canvas.clientHeight)
   */
  function setViewportSize(w: number, h: number) {
    viewport.value.width = w
    viewport.value.height = h
  }

  /**
   * 将视口恢复为初始 zoom / pan / 默认尺寸。
   * 不触发 captureSnapshot。
   *
   * @example
   * store.resetViewport()  // 可与 FIT_VIEW 等组合使用
   */
  function resetViewport() {
    viewport.value = createInitialViewport()
  }

  // ── Dirty tracking（未保存变更追踪）────────────────────────────────

  /**
   * 清空 dirtyEntityIds（通常在成功保存或导出后调用）。
   *
   * @example
   * await saveProject()
   * store.clearDirty()
   */
  function clearDirty() {
    dirtyEntityIds.value = []
  }

  // ── Public API（对外暴露的 state / getters / actions）────────────────

  return {
    // state — 可直接解构或 storeToRefs(store) 保持响应式
    viewport,
    layers,
    entities,
    selectedIds,
    activeTool,
    drawSubTool,
    projectMeta,
    undoStack,
    redoStack,
    dirtyEntityIds,
    // getters
    activeLayerId,
    // actions
    captureSnapshot,
    undo,
    redo,
    setTool,
    setDrawSubTool,
    setSelection,
    addEntity,
    updateEntity,
    deleteSelected,
    replaceAllEntities,
    createLayer,
    deleteLayer,
    updateLayer,
    moveEntityToLayer,
    setViewportSize,
    resetViewport,
    clearDirty,
  }
})
