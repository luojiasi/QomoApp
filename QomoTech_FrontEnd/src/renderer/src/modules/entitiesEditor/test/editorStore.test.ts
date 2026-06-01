// =============================================================================
// editorStore 集成测试 —— 运行：npx tsx editorStore.test.ts
// 覆盖 15 个 action + 撤销重做 + 边界情况
// =============================================================================

import * as assert from 'node:assert'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '../stores/editorStore'
import type { LineEntity, Point2D } from '../commons/types'

// =============================================================================
// polyfill localStorage for Node.js
// =============================================================================
if (typeof globalThis.localStorage === 'undefined') {
  const storeMap = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => storeMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storeMap.set(key, value)
    },
    removeItem: (key: string) => {
      storeMap.delete(key)
    },
    clear: () => {
      storeMap.clear()
    },
    get length() {
      return storeMap.size
    },
    key: (index: number) => [...storeMap.keys()][index] ?? null
  }
}

// =============================================================================
// 测试辅助
// =============================================================================

let passed = 0
let failed = 0
const failures: string[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
  } catch (e) {
    failed++
    const msg = `  FAIL: ${name}\n        ${(e as Error).message}`
    failures.push(msg)
    console.error(msg)
  }
}

/**
 * 为每个 test group 创建独立的 store 实例（通过 fresh Pinia）
 * 确保测试之间状态隔离
 */
function createStore() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return useEditorStore()
}

// =============================================================================
// 1. 初始状态
// =============================================================================

console.log('\n=== 1. 初始状态 ===')

test('初始 entities 为空', () => {
  const store = createStore()
  assert.strictEqual(store.entities.length, 0)
})

test('初始有默认图层', () => {
  const store = createStore()
  assert.strictEqual(store.layers.length, 1)
  assert.strictEqual(store.layers[0].visible, true)
  assert.strictEqual(store.layers[0].locked, false)
})

test('初始工具为 SELECT', () => {
  const store = createStore()
  assert.strictEqual(store.activeTool, 'SELECT')
})

test('初始 drawSubTool 为 LINE', () => {
  const store = createStore()
  assert.strictEqual(store.drawSubTool, 'LINE')
})

test('初始 undoStack / redoStack 为空', () => {
  const store = createStore()
  assert.strictEqual(store.undoStack.length, 0)
  assert.strictEqual(store.redoStack.length, 0)
})

test('初始 selectedIds 为空', () => {
  const store = createStore()
  assert.strictEqual(store.selectedIds.length, 0)
})

test('初始 dirtyEntityIds 为空', () => {
  const store = createStore()
  assert.strictEqual(store.dirtyEntityIds.length, 0)
})

test('viewport 有默认宽高', () => {
  const store = createStore()
  assert.ok(store.viewport.zoom > 0)
  assert.strictEqual(store.viewport.width, 800)
  assert.strictEqual(store.viewport.height, 600)
})

test('projectMeta 有默认名称', () => {
  const store = createStore()
  assert.ok(store.projectMeta.name.length > 0)
  assert.ok(store.projectMeta.version.length > 0)
})

test('activeLayerId 指向默认图层', () => {
  const store = createStore()
  assert.strictEqual(store.activeLayerId, store.layers[0].id)
})

// =============================================================================
// 2. addEntity — 各种实体类型
// =============================================================================

console.log('\n=== 2. addEntity ===')

test('addEntity LINE → entities 长度 +1', () => {
  const store = createStore()
  const input: Omit<LineEntity, 'id' | 'layerId' | 'openSide'> = {
    kind: 'LINE',
    start: { X: 0, Y: 0 },
    end: { X: 100, Y: 100 }
  }
  store.addEntity(input as any)
  assert.strictEqual(store.entities.length, 1)
})

test('addEntity 自动生成 id', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const e = store.entities[0]
  assert.ok(e.id.startsWith('ent_'))
  assert.ok(e.id.length > 4)
})

test('addEntity 使用默认图层', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  assert.strictEqual(store.entities[0].layerId, store.layers[0].id)
})

test('addEntity 默认 openSide 为 LEFT', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  assert.strictEqual(store.entities[0].openSide, 'LEFT')
})

test('addEntity 补全挤出参数', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const e = store.entities[0]
  assert.ok(typeof e.height === 'number' && e.height > 0)
  assert.ok(typeof e.openSize === 'number')
  assert.ok(typeof e.tiltAngleDeg === 'number')
})

test('addEntity → dirtyEntityIds 包含新增实体', () => {
  const store = createStore()
  store.addEntity({ kind: 'CIRCLE', center: { X: 0, Y: 0 }, radius: 10 } as any)
  assert.strictEqual(store.dirtyEntityIds.length, 1)
  assert.strictEqual(store.dirtyEntityIds[0], store.entities[0].id)
})

test('addEntity → captureSnapshot → undoStack +1', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  assert.strictEqual(store.undoStack.length, 1)
})

test('addEntity → redoStack 清空', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  assert.strictEqual(store.redoStack.length, 0)
})

test('addEntity ARC', () => {
  const store = createStore()
  store.addEntity({
    kind: 'ARC',
    center: { X: 0, Y: 0 },
    radius: 50,
    startAngle: 0,
    endAngle: 180
  } as any)
  assert.strictEqual(store.entities.length, 1)
  assert.strictEqual(store.entities[0].kind, 'ARC')
})

test('addEntity CIRCLE', () => {
  const store = createStore()
  store.addEntity({ kind: 'CIRCLE', center: { X: 5, Y: 5 }, radius: 20 } as any)
  assert.strictEqual(store.entities[0].kind, 'CIRCLE')
})

test('addEntity BEZIER', () => {
  const store = createStore()
  const cp: Point2D[] = [
    { X: 0, Y: 0 },
    { X: 10, Y: 20 },
    { X: 30, Y: 10 }
  ]
  store.addEntity({ kind: 'BEZIER', controlPoints: cp } as any)
  assert.strictEqual(store.entities[0].kind, 'BEZIER')
})

test('addEntity POLYLINE', () => {
  const store = createStore()
  store.addEntity({
    kind: 'POLYLINE',
    closed: false,
    vertices: [
      { point: { X: 0, Y: 0 }, bulge: 0 },
      { point: { X: 10, Y: 10 }, bulge: 0 }
    ]
  } as any)
  assert.strictEqual(store.entities[0].kind, 'POLYLINE')
})

test('addEntity ELLIPSE', () => {
  const store = createStore()
  store.addEntity({
    kind: 'ELLIPSE',
    center: { X: 0, Y: 0 },
    majorAxisEnd: { X: 10, Y: 0 },
    minorAxisRatio: 0.5,
    startParamDeg: 0,
    endParamDeg: 360
  } as any)
  assert.strictEqual(store.entities[0].kind, 'ELLIPSE')
})

test('addEntity 多次调用 → entities 递增', () => {
  const store = createStore()
  for (let i = 0; i < 5; i++) {
    store.addEntity({
      kind: 'LINE',
      start: { X: i * 10, Y: 0 },
      end: { X: i * 10 + 5, Y: 5 }
    } as any)
  }
  assert.strictEqual(store.entities.length, 5)
})

test('addEntity → projectMeta.entityCount 同步', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.addEntity({ kind: 'CIRCLE', center: { X: 0, Y: 0 }, radius: 5 } as any)
  assert.strictEqual(store.projectMeta.entityCount, 2)
})

test('addEntity → 图层 entityCount 同步', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  assert.strictEqual(store.layers[0].entityCount, 2)
})

// =============================================================================
// 3. updateEntity
// =============================================================================

console.log('\n=== 3. updateEntity ===')

test('updateEntity 修改字段', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const id = store.entities[0].id
  store.updateEntity(id, { height: 99, openSide: 'RIGHT' } as any)
  assert.strictEqual(store.entities[0].height, 99)
  assert.strictEqual(store.entities[0].openSide, 'RIGHT')
})

test('updateEntity 保留未修改字段', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const id = store.entities[0].id
  store.updateEntity(id, { height: 99 } as any)
  assert.strictEqual(store.entities[0].openSide, 'LEFT')
  assert.strictEqual(store.entities[0].kind, 'LINE')
})

test('updateEntity 不存在的 id 无影响', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.updateEntity('nonexistent', { height: 99 } as any)
  assert.strictEqual(store.entities[0].height, 5) // default
})

test('updateEntity → dirtyEntityIds 去重', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const id = store.entities[0].id
  store.clearDirty()
  store.updateEntity(id, { height: 10 } as any)
  store.updateEntity(id, { height: 20 } as any)
  assert.strictEqual(store.dirtyEntityIds.length, 1)
  assert.strictEqual(store.dirtyEntityIds[0], id)
})

test('updateEntity → captureSnapshot → undoStack 累积', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const id = store.entities[0].id
  store.updateEntity(id, { height: 50 } as any)
  assert.strictEqual(store.undoStack.length, 2)
})

// =============================================================================
// 4. deleteSelected
// =============================================================================

console.log('\n=== 4. deleteSelected ===')

test('deleteSelected 空 selectedIds 无操作', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.deleteSelected()
  assert.strictEqual(store.entities.length, 1)
})

test('deleteSelected 删除选中实体', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.addEntity({ kind: 'CIRCLE', center: { X: 0, Y: 0 }, radius: 5 } as any)
  store.setSelection([store.entities[0].id])
  store.deleteSelected()
  assert.strictEqual(store.entities.length, 1)
  assert.strictEqual(store.entities[0].kind, 'CIRCLE')
})

test('deleteSelected 批量删除', () => {
  const store = createStore()
  for (let i = 0; i < 5; i++) {
    store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  }
  const ids = store.entities.slice(0, 3).map((e) => e.id)
  store.setSelection(ids)
  store.deleteSelected()
  assert.strictEqual(store.entities.length, 2)
})

test('deleteSelected → selectedIds 清空', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.setSelection([store.entities[0].id])
  store.deleteSelected()
  assert.strictEqual(store.selectedIds.length, 0)
})

test('deleteSelected → dirtyEntityIds 清理已删除实体', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  // both are dirty
  store.setSelection([store.entities[0].id])
  store.deleteSelected()
  // dirtyEntityIds should no longer contain the deleted entity
  const remaining = store.entities.map((e) => e.id)
  for (const id of store.dirtyEntityIds) {
    assert.ok(remaining.includes(id), `dirty id ${id} should belong to a remaining entity`)
  }
})

test('deleteSelected → meta 同步', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.setSelection([store.entities[0].id])
  store.deleteSelected()
  assert.strictEqual(store.projectMeta.entityCount, 1)
})

// =============================================================================
// 5. undo / redo
// =============================================================================

console.log('\n=== 5. undo / redo ===')

test('空 undoStack 无操作', () => {
  const store = createStore()
  store.undo()
  assert.strictEqual(store.entities.length, 0)
})

test('空 redoStack 无操作', () => {
  const store = createStore()
  store.redo()
  assert.strictEqual(store.entities.length, 0)
})

test('addEntity → undo → 实体消失', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  assert.strictEqual(store.entities.length, 1)
  store.undo()
  assert.strictEqual(store.entities.length, 0)
})

test('addEntity → undo → redo → 实体恢复', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const idBeforeUndo = store.entities[0].id
  store.undo()
  assert.strictEqual(store.entities.length, 0)
  store.redo()
  assert.strictEqual(store.entities.length, 1)
  assert.strictEqual(store.entities[0].id, idBeforeUndo)
})

test('undo → selectedIds 清空', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.setSelection([store.entities[0].id])
  store.undo()
  assert.strictEqual(store.selectedIds.length, 0)
})

test('多次 add → undo × N → 全部撤销', () => {
  const store = createStore()
  for (let i = 0; i < 5; i++) {
    store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  }
  for (let i = 0; i < 5; i++) store.undo()
  assert.strictEqual(store.entities.length, 0)
})

test('undo 后 redoStack 包含已撤销状态', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.undo()
  assert.strictEqual(store.redoStack.length, 1)
})

test('undo 后新操作 → redoStack 清空', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.undo()
  assert.strictEqual(store.redoStack.length, 1)
  store.addEntity({ kind: 'CIRCLE', center: { X: 0, Y: 0 }, radius: 5 } as any)
  assert.strictEqual(store.redoStack.length, 0)
})

test('undo/redo 恢复图层状态', () => {
  const store = createStore()
  assert.strictEqual(store.layers.length, 1)
  store.createLayer('测试图层')
  assert.strictEqual(store.layers.length, 2)
  store.undo()
  assert.strictEqual(store.layers.length, 1)
})

test('undo/redo 恢复 projectMeta', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const countAfterAdd = store.projectMeta.entityCount
  store.undo()
  assert.strictEqual(store.projectMeta.entityCount, 0)
  store.redo()
  assert.strictEqual(store.projectMeta.entityCount, countAfterAdd)
})

test('MAX_UNDO_STEPS 限制—超出时 shift 最早快照', () => {
  const store = createStore()
  // 添加 MAX_UNDO_STEPS + 5 个实体
  for (let i = 0; i < 55; i++) {
    store.addEntity({ kind: 'LINE', start: { X: i, Y: 0 }, end: { X: i + 1, Y: 1 } } as any)
  }
  // undoStack 应 ≤ 50
  assert.ok(store.undoStack.length <= 50)
})

// =============================================================================
// 6. captureSnapshot
// =============================================================================

console.log('\n=== 6. captureSnapshot ===')

test('captureSnapshot 手动调用压入快照', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const lenBefore = store.undoStack.length
  store.captureSnapshot()
  assert.strictEqual(store.undoStack.length, lenBefore + 1)
})

test('captureSnapshot → redoStack 清空', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.undo()
  assert.strictEqual(store.redoStack.length, 1)
  store.captureSnapshot()
  assert.strictEqual(store.redoStack.length, 0)
})

// =============================================================================
// 7. Layer CRUD
// =============================================================================

console.log('\n=== 7. Layer CRUD ===')

test('createLayer 新建图层', () => {
  const store = createStore()
  assert.strictEqual(store.layers.length, 1)
  store.createLayer('自定义图层')
  assert.strictEqual(store.layers.length, 2)
  assert.strictEqual(store.layers[1].name, '自定义图层')
})

test('createLayer 无名称时自动生成', () => {
  const store = createStore()
  store.createLayer()
  assert.strictEqual(store.layers.length, 2)
  assert.ok(store.layers[1].name.includes('默认图层'))
})

test('createLayer 生成 layer_ 前缀 id', () => {
  const store = createStore()
  store.createLayer()
  assert.ok(store.layers[1].id.startsWith('layer_'))
})

test('deleteLayer 删除指定图层', () => {
  const store = createStore()
  store.createLayer('临时')
  assert.strictEqual(store.layers.length, 2)
  store.deleteLayer(store.layers[1].id)
  assert.strictEqual(store.layers.length, 1)
})

test('deleteLayer 不能删除最后一个图层', () => {
  const store = createStore()
  const id = store.layers[0].id
  store.deleteLayer(id)
  assert.strictEqual(store.layers.length, 1)
})

test('deleteLayer 级联删除实体', () => {
  const store = createStore()
  store.createLayer('第二层')
  // activeLayerId 指向第一个图层（默认图层），实体归属到默认图层
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  assert.strictEqual(store.entities.length, 1)
  // 删除默认图层 → 实体级联删除
  store.deleteLayer(store.layers[0].id)
  assert.strictEqual(store.entities.length, 0)
})

test('updateLayer 修改图层属性', () => {
  const store = createStore()
  store.updateLayer(store.layers[0].id, { name: '改名', visible: false, locked: true })
  assert.strictEqual(store.layers[0].name, '改名')
  assert.strictEqual(store.layers[0].visible, false)
  assert.strictEqual(store.layers[0].locked, true)
})

test('updateLayer 不存在 id 无操作', () => {
  const store = createStore()
  store.updateLayer('noop', { name: 'x' })
  assert.strictEqual(store.layers[0].name, '默认图层')
})

test('createLayer → undo → 图层消失', () => {
  const store = createStore()
  store.createLayer('临时')
  store.undo()
  assert.strictEqual(store.layers.length, 1)
})

// =============================================================================
// 8. Tool / Selection
// =============================================================================

console.log('\n=== 8. Tool / Selection ===')

test('setTool 切换工具', () => {
  const store = createStore()
  store.setTool('DRAW')
  assert.strictEqual(store.activeTool, 'DRAW')
  store.setTool('PAN')
  assert.strictEqual(store.activeTool, 'PAN')
  store.setTool('SELECT')
  assert.strictEqual(store.activeTool, 'SELECT')
})

test('setDrawSubTool 切换子工具', () => {
  const store = createStore()
  store.setDrawSubTool('CIRCLE')
  assert.strictEqual(store.drawSubTool, 'CIRCLE')
  store.setDrawSubTool('BEZIER')
  assert.strictEqual(store.drawSubTool, 'BEZIER')
})

test('setSelection 替换选中', () => {
  const store = createStore()
  store.setSelection(['a', 'b', 'c'])
  assert.strictEqual(store.selectedIds.length, 3)
  store.setSelection(['d'])
  assert.strictEqual(store.selectedIds.length, 1)
  assert.strictEqual(store.selectedIds[0], 'd')
})

test('setSelection 空数组清空选中', () => {
  const store = createStore()
  store.setSelection(['x', 'y'])
  store.setSelection([])
  assert.strictEqual(store.selectedIds.length, 0)
})

// =============================================================================
// 9. Viewport
// =============================================================================

console.log('\n=== 9. Viewport ===')

test('setViewportSize 更新宽高', () => {
  const store = createStore()
  store.setViewportSize(1024, 768)
  assert.strictEqual(store.viewport.width, 1024)
  assert.strictEqual(store.viewport.height, 768)
})

test('setViewportSize 保留 zoom/pan', () => {
  const store = createStore()
  const z = store.viewport.zoom
  store.setViewportSize(1920, 1080)
  assert.strictEqual(store.viewport.zoom, z)
})

test('resetViewport 恢复默认值', () => {
  const store = createStore()
  store.setViewportSize(3000, 2000)
  store.resetViewport()
  assert.strictEqual(store.viewport.width, 800)
  assert.strictEqual(store.viewport.height, 600)
  assert.strictEqual(store.viewport.zoom, 1)
  assert.strictEqual(store.viewport.panX, 0)
  assert.strictEqual(store.viewport.panY, 0)
})

// =============================================================================
// 10. replaceAllEntities
// =============================================================================

console.log('\n=== 10. replaceAllEntities ===')

function makeSurfaceLine(id: string, x1: number, y1: number, x2: number, y2: number): any {
  return {
    id,
    kind: 'LINE',
    layerId: 'L99',
    openSide: 'LEFT' as const,
    start: { X: x1, Y: y1 },
    end: { X: x2, Y: y2 },
    height: 10,
    zBase: 0,
    openSize: 1,
    tiltAngleDeg: 0
  }
}

test('replaceAllEntities 全量替换实体', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const imported = [makeSurfaceLine('abc', 0, 0, 100, 100)]
  store.replaceAllEntities(imported)
  assert.strictEqual(store.entities.length, 1)
  assert.strictEqual(store.entities[0].id, 'abc')
})

test('replaceAllEntities 可替换图层', () => {
  const store = createStore()
  store.replaceAllEntities(
    [],
    [{ id: 'Lx', name: '导入图层', visible: true, locked: false, entityCount: 0 }]
  )
  assert.strictEqual(store.layers.length, 1)
  assert.strictEqual(store.layers[0].id, 'Lx')
})

test('replaceAllEntities 可替换 meta', () => {
  const store = createStore()
  store.replaceAllEntities([], undefined, { name: '导入的项目' })
  assert.strictEqual(store.projectMeta.name, '导入的项目')
})

test('replaceAllEntities → selectedIds 清空', () => {
  const store = createStore()
  store.setSelection(['a', 'b'])
  store.replaceAllEntities([])
  assert.strictEqual(store.selectedIds.length, 0)
})

test('replaceAllEntities → dirtyEntityIds 清空', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  assert.strictEqual(store.dirtyEntityIds.length, 1)
  store.replaceAllEntities([])
  assert.strictEqual(store.dirtyEntityIds.length, 0)
})

test('replaceAllEntities → undo 恢复', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.replaceAllEntities([makeSurfaceLine('new', 0, 0, 1, 1)])
  assert.strictEqual(store.entities.length, 1)
  store.undo()
  assert.strictEqual(store.entities.length, 1)
  assert.ok(store.entities[0].id !== 'new')
})

// =============================================================================
// 11. clearDirty
// =============================================================================

console.log('\n=== 11. clearDirty ===')

test('clearDirty 清空', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  assert.strictEqual(store.dirtyEntityIds.length, 2)
  store.clearDirty()
  assert.strictEqual(store.dirtyEntityIds.length, 0)
})

// =============================================================================
// 12. 边界 / 复合场景
// =============================================================================

console.log('\n=== 12. 边界 / 复合场景 ===')

test('大量实体 CRUD 不抛错', () => {
  const store = createStore()
  for (let i = 0; i < 200; i++) {
    store.addEntity({ kind: 'CIRCLE', center: { X: i, Y: i }, radius: 5 } as any)
  }
  assert.strictEqual(store.entities.length, 200)
  // 删除一半
  const ids = store.entities.slice(0, 100).map((e) => e.id)
  store.setSelection(ids)
  store.deleteSelected()
  assert.strictEqual(store.entities.length, 100)
  // Update 剩下一半
  for (const e of store.entities) {
    store.updateEntity(e.id, { height: 999 } as any)
  }
  assert.strictEqual(store.entities[0].height, 999)
})

test('add → update → delete → undo × 3 回到初始', () => {
  const store = createStore()
  assert.strictEqual(store.entities.length, 0)
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  const id = store.entities[0].id
  store.updateEntity(id, { openSide: 'RIGHT' } as any)
  store.setSelection([id])
  store.deleteSelected()
  assert.strictEqual(store.entities.length, 0)
  store.undo() // undo delete
  assert.strictEqual(store.entities.length, 1)
  store.undo() // undo update
  assert.strictEqual(store.entities[0].openSide, 'LEFT')
  store.undo() // undo add
  assert.strictEqual(store.entities.length, 0)
})

test('undo 后 updateEntity 不可 undo（redoStack 清空）', () => {
  const store = createStore()
  store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  store.undo()
  assert.strictEqual(store.redoStack.length, 1)
  store.addEntity({ kind: 'CIRCLE', center: { X: 0, Y: 0 }, radius: 5 } as any)
  assert.strictEqual(store.redoStack.length, 0)
})

test('多图层实体同步 — 各图层 entityCount 正确', () => {
  const store = createStore()
  store.createLayer('图层A')
  store.createLayer('图层B')
  // 图层顺序: 默认 → A → B
  // 在当前设计下，activeLayerId 始终指向第一个图层
  // 无法直接切换活动图层来给其他图层添加实体，这里验证基础计数
  for (let i = 0; i < 3; i++) {
    store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
  }
  assert.strictEqual(store.layers[0].entityCount, 3)
  assert.strictEqual(store.layers[1].entityCount, 0)
  assert.strictEqual(store.layers[2].entityCount, 0)
})

test('addEntity 多次 → 每个 id 唯一', () => {
  const store = createStore()
  const ids = new Set<string>()
  for (let i = 0; i < 100; i++) {
    store.addEntity({ kind: 'LINE', start: { X: 0, Y: 0 }, end: { X: 10, Y: 10 } } as any)
    ids.add(store.entities[i].id)
  }
  assert.strictEqual(ids.size, 100)
})

// =============================================================================
// 结果
// =============================================================================

console.log(`\n${'═'.repeat(50)}`)
console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`)
console.log(`${'═'.repeat(50)}`)

if (failed > 0) {
  console.error(`\n失败详情:`)
  for (const f of failures) console.error(f)
  process.exit(1)
}
