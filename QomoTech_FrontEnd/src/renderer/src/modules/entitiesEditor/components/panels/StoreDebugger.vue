<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEditorStore } from '../../stores/editorStore'
import type { EntityKind, ToolMode, Point2D } from '../../commons/types'

const store = useEditorStore()

// ── 表单输入 ──
const lineStartX = ref(0)
const lineStartY = ref(0)
const lineEndX = ref(100)
const lineEndY = ref(100)

const circleCx = ref(0)
const circleCy = ref(0)
const circleR = ref(50)

const arcCx = ref(0)
const arcCy = ref(0)
const arcR = ref(50)
const arcStart = ref(0)
const arcEnd = ref(180)

const bezierPtsStr = ref('0,0 50,80 100,0')

const polylinePtsStr = ref('0,0 100,0 100,80 0,80')

// updateEntity 输入
const updateEntityId = ref('')
const updateHeight = ref(10)
const updateOpenSide = ref<'LEFT' | 'RIGHT'>('LEFT')

// createLayer
const newLayerName = ref('')

// updateLayer
const updateLayerId = ref('')
const updateLayerName = ref('')

// replaceAll
const replaceJsonStr = ref('[]')

// viewport
const vpWidth = ref(800)
const vpHeight = ref(600)

// ── 折叠状态 ──
const sections = ref<Record<string, boolean>>({
  entities: true,
  layers: true,
  undoRedo: true,
  viewport: true,
  meta: true,
  selection: true,
})

function toggleSection(key: string) {
  sections.value[key] = !sections.value[key]
}

// ── Entity CRUD ──
function addLine() {
  store.addEntity({
    kind: 'LINE',
    start: { X: lineStartX.value, Y: lineStartY.value },
    end: { X: lineEndX.value, Y: lineEndY.value },
  } as any)
}

function addCircle() {
  store.addEntity({
    kind: 'CIRCLE',
    center: { X: circleCx.value, Y: circleCy.value },
    radius: circleR.value,
  } as any)
}

function addArc() {
  store.addEntity({
    kind: 'ARC',
    center: { X: arcCx.value, Y: arcCy.value },
    radius: arcR.value,
    startAngle: arcStart.value,
    endAngle: arcEnd.value,
  } as any)
}

function addBezier() {
  const pts = bezierPtsStr.value.split(/\s+/).filter(Boolean).map(s => {
    const [x, y] = s.split(',').map(Number)
    return { X: x, Y: y } as Point2D
  })
  store.addEntity({ kind: 'BEZIER', controlPoints: pts } as any)
}

function addPolyline() {
  const verts = polylinePtsStr.value.split(/\s+/).filter(Boolean).map(s => {
    const [x, y] = s.split(',').map(Number)
    return { point: { X: x, Y: y }, bulge: 0 }
  })
  store.addEntity({ kind: 'POLYLINE', closed: true, vertices: verts } as any)
}

function doUpdateEntity() {
  store.updateEntity(updateEntityId.value, {
    height: updateHeight.value,
    openSide: updateOpenSide.value,
  } as any)
}

function doDeleteSelected() {
  store.deleteSelected()
}

// ── Selection ──
function toggleSelect(id: string) {
  const idx = store.selectedIds.indexOf(id)
  if (idx === -1) {
    store.setSelection([...store.selectedIds, id])
  } else {
    store.setSelection(store.selectedIds.filter(s => s !== id))
  }
}

function selectAll() {
  store.setSelection(store.entities.map(e => e.id))
}

function clearSelection() {
  store.setSelection([])
}

// ── Layers ──
function doCreateLayer() {
  store.createLayer(newLayerName.value || undefined)
}

function doDeleteLayer(id: string) {
  store.deleteLayer(id)
}

function doUpdateLayer() {
  store.updateLayer(updateLayerId.value, { name: updateLayerName.value })
}

// ── Viewport ──
function doSetViewportSize() {
  store.setViewportSize(vpWidth.value, vpHeight.value)
}

// ── Replace ──
function doReplaceAll() {
  try {
    const arr = JSON.parse(replaceJsonStr.value)
    store.replaceAllEntities(arr)
  } catch (e) {
    alert('JSON 解析失败: ' + (e as Error).message)
  }
}

// ── 快捷操作 ──
function add100Lines() {
  for (let i = 0; i < 100; i++) {
    store.addEntity({
      kind: 'LINE',
      start: { X: i * 10, Y: 0 },
      end: { X: i * 10 + 5, Y: 5 },
    } as any)
  }
}

function undoAll() {
  while (store.undoStack.length > 0) store.undo()
}

// ── 选中实体简要信息 ──
const selectedEntityPreviews = computed(() => {
  return store.entities.filter(e => store.selectedIds.includes(e.id))
})

// ── 快照预览 ──
const undoPreview = computed(() => {
  if (store.undoStack.length === 0) return ''
  const last = store.undoStack[store.undoStack.length - 1]
  try {
    const parsed = JSON.parse(last)
    return `entities: ${parsed.entities?.length ?? '?'} | layers: ${parsed.layers?.length ?? '?'}`
  } catch {
    return '(parse error)'
  }
})
</script>

<template>
  <div class="debugger">
    <!-- ═══ 顶部工具栏 ═══ -->
    <div class="db-toolbar">
      <span class="db-title">Store 调试器</span>
      <div class="db-stats">
        <span class="db-stat">实体: <b>{{ store.entities.length }}</b></span>
        <span class="db-stat">选中: <b>{{ store.selectedIds.length }}</b></span>
        <span class="db-stat">脏: <b>{{ store.dirtyEntityIds.length }}</b></span>
        <span class="db-stat">撤销栈: <b>{{ store.undoStack.length }}</b></span>
        <span class="db-stat">重做栈: <b>{{ store.redoStack.length }}</b></span>
        <span class="db-stat">工具: <b>{{ store.activeTool }}</b> / <b>{{ store.drawSubTool }}</b></span>
      </div>
    </div>

    <div class="db-body">
      <!-- ═══ 左侧：操作面板 ═══ -->
      <div class="db-left">

        <!-- ── Undo / Redo ── -->
        <div class="db-card">
          <div class="db-card-hd" @click="toggleSection('undoRedo')">
            <span class="db-arrow" :class="{ open: sections.undoRedo }">▸</span> 撤销/重做
            <span class="db-hint">undo: {{ store.undoStack.length }} / redo: {{ store.redoStack.length }}</span>
          </div>
          <div v-show="sections.undoRedo" class="db-card-bd">
            <div class="db-row">
              <button class="db-btn" @click="store.undo()" :disabled="store.undoStack.length === 0">↩ Undo</button>
              <button class="db-btn" @click="store.redo()" :disabled="store.redoStack.length === 0">↪ Redo</button>
              <button class="db-btn db-btn-grey" @click="store.captureSnapshot()">📸 手动快照</button>
              <button class="db-btn db-btn-grey" @click="undoAll" :disabled="store.undoStack.length === 0">↩↩ 全部撤销</button>
            </div>
            <div class="db-snapshot-preview" v-if="store.undoStack.length > 0">
              栈顶快照: {{ undoPreview }}
            </div>
          </div>
        </div>

        <!-- ── 添加实体 ── -->
        <div class="db-card">
          <div class="db-card-hd">
            <span class="db-arrow always-open">▸</span> 添加实体
          </div>
          <div class="db-card-bd">
            <!-- LINE -->
            <div class="db-entity-form">
              <span class="db-entity-label">LINE</span>
              <div class="db-fields">
                <label>sX <input type="number" v-model.number="lineStartX" class="db-inp" /></label>
                <label>sY <input type="number" v-model.number="lineStartY" class="db-inp" /></label>
                <label>eX <input type="number" v-model.number="lineEndX" class="db-inp" /></label>
                <label>eY <input type="number" v-model.number="lineEndY" class="db-inp" /></label>
                <button class="db-btn db-btn-blue" @click="addLine">+ LINE</button>
              </div>
            </div>
            <!-- CIRCLE -->
            <div class="db-entity-form">
              <span class="db-entity-label">CIRCLE</span>
              <div class="db-fields">
                <label>cX <input type="number" v-model.number="circleCx" class="db-inp" /></label>
                <label>cY <input type="number" v-model.number="circleCy" class="db-inp" /></label>
                <label>R <input type="number" v-model.number="circleR" class="db-inp" /></label>
                <button class="db-btn db-btn-blue" @click="addCircle">+ CIRCLE</button>
              </div>
            </div>
            <!-- ARC -->
            <div class="db-entity-form">
              <span class="db-entity-label">ARC</span>
              <div class="db-fields">
                <label>cX <input type="number" v-model.number="arcCx" class="db-inp" /></label>
                <label>cY <input type="number" v-model.number="arcCy" class="db-inp" /></label>
                <label>R <input type="number" v-model.number="arcR" class="db-inp" /></label>
                <label>s° <input type="number" v-model.number="arcStart" class="db-inp" /></label>
                <label>e° <input type="number" v-model.number="arcEnd" class="db-inp" /></label>
                <button class="db-btn db-btn-blue" @click="addArc">+ ARC</button>
              </div>
            </div>
            <!-- BEZIER -->
            <div class="db-entity-form">
              <span class="db-entity-label">BEZIER</span>
              <input v-model="bezierPtsStr" class="db-inp" style="flex:1" placeholder="x1,y1 x2,y2 x3,y3" />
              <button class="db-btn db-btn-blue" @click="addBezier">+ BEZIER</button>
            </div>
            <!-- POLYLINE -->
            <div class="db-entity-form">
              <span class="db-entity-label">POLYLINE</span>
              <input v-model="polylinePtsStr" class="db-inp" style="flex:1" placeholder="x1,y1 x2,y2 ..." />
              <button class="db-btn db-btn-blue" @click="addPolyline">+ POLY</button>
            </div>
            <!-- 快捷 -->
            <div class="db-row" style="margin-top: 4px">
              <button class="db-btn db-btn-grey" @click="add100Lines">+100 LINEs (测试)</button>
            </div>
          </div>
        </div>

        <!-- ── 更新 / 删除实体 ── -->
        <div class="db-card">
          <div class="db-card-hd"><span class="db-arrow always-open">▸</span> 更新 / 删除</div>
          <div class="db-card-bd">
            <div class="db-row">
              <label>ID <input v-model="updateEntityId" class="db-inp" style="width:180px" placeholder="实体ID" /></label>
              <label>挤出 <input type="number" v-model.number="updateHeight" class="db-inp" style="width:60px" /></label>
              <select v-model="updateOpenSide" class="db-inp" style="width:60px">
                <option>LEFT</option>
                <option>RIGHT</option>
              </select>
              <button class="db-btn db-btn-green" @click="doUpdateEntity">更新</button>
            </div>
            <div class="db-row" style="margin-top:4px">
              <button class="db-btn db-btn-red" @click="doDeleteSelected" :disabled="store.selectedIds.length === 0">
                删除已选中 ({{ store.selectedIds.length }})
              </button>
            </div>
          </div>
        </div>

        <!-- ── 图层 ── -->
        <div class="db-card">
          <div class="db-card-hd"><span class="db-arrow always-open">▸</span> 图层操作</div>
          <div class="db-card-bd">
            <div class="db-row">
              <input v-model="newLayerName" class="db-inp" placeholder="图层名" />
              <button class="db-btn db-btn-green" @click="doCreateLayer">+ 新建图层</button>
            </div>
            <div class="db-row" style="margin-top:4px">
              <label>图层ID <input v-model="updateLayerId" class="db-inp" style="width:180px" /></label>
              <label>改名 <input v-model="updateLayerName" class="db-inp" style="width:100px" /></label>
              <button class="db-btn db-btn-green" @click="doUpdateLayer">更新图层</button>
            </div>
            <div class="db-row" style="margin-top:4px" v-for="l in store.layers" :key="l.id">
              <span class="db-layer-item">[{{ l.id.slice(0,10) }}] {{ l.name }} ({{ l.entityCount }})</span>
              <button class="db-btn db-btn-red" style="font-size:10px;padding:2px 6px"
                @click="doDeleteLayer(l.id)" :disabled="store.layers.length <= 1">✕</button>
            </div>
          </div>
        </div>

        <!-- ── 工具 ── -->
        <div class="db-card">
          <div class="db-card-hd"><span class="db-arrow always-open">▸</span> 工具 / 选择</div>
          <div class="db-card-bd">
            <div class="db-row">
              <button v-for="t in (['SELECT','DRAW','PAN'] as ToolMode[])" :key="t"
                class="db-btn" :class="{ 'db-btn-active': store.activeTool === t }"
                @click="store.setTool(t)">{{ t }}</button>
            </div>
            <div class="db-row" style="margin-top:4px">
              <span style="font-size:11px;color:#71717a">DrawSub: </span>
              <button v-for="k in (['LINE','ARC','CIRCLE','BEZIER','POLYLINE','ELLIPSE'] as EntityKind[])" :key="k"
                class="db-btn db-btn-sm" :class="{ 'db-btn-active': store.drawSubTool === k }"
                @click="store.setDrawSubTool(k)">{{ k }}</button>
            </div>
            <div class="db-row" style="margin-top:4px">
              <button class="db-btn db-btn-grey" @click="selectAll">全选</button>
              <button class="db-btn db-btn-grey" @click="clearSelection">清空选择</button>
            </div>
          </div>
        </div>

        <!-- ── 视口 ── -->
        <div class="db-card">
          <div class="db-card-hd"><span class="db-arrow always-open">▸</span> 视口</div>
          <div class="db-card-bd">
            <div class="db-row">
              <label>W <input type="number" v-model.number="vpWidth" class="db-inp" style="width:60px" /></label>
              <label>H <input type="number" v-model.number="vpHeight" class="db-inp" style="width:60px" /></label>
              <button class="db-btn db-btn-green" @click="doSetViewportSize">设置</button>
              <button class="db-btn db-btn-grey" @click="store.resetViewport()">重置</button>
            </div>
            <div class="db-info-text">
              zoom: {{ store.viewport.zoom }} | pan: ({{ store.viewport.panX }}, {{ store.viewport.panY }}) |
              size: {{ store.viewport.width }}×{{ store.viewport.height }}
            </div>
          </div>
        </div>

        <!-- ── 导入 / 清脏 ── -->
        <div class="db-card">
          <div class="db-card-hd"><span class="db-arrow always-open">▸</span> 批量 / 清脏</div>
          <div class="db-card-bd">
            <div class="db-row">
              <input v-model="replaceJsonStr" class="db-inp" style="flex:1" placeholder='[{"id":"a","kind":"LINE",...}]' />
              <button class="db-btn db-btn-orange" @click="doReplaceAll">replaceAll</button>
            </div>
            <div class="db-row" style="margin-top:4px">
              <button class="db-btn db-btn-grey" @click="store.clearDirty()" :disabled="store.dirtyEntityIds.length === 0">
                清空 dirtyIds ({{ store.dirtyEntityIds.length }})
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- ═══ 右侧：状态展示 ═══ -->
      <div class="db-right">

        <!-- 实体列表 -->
        <div class="db-card">
          <div class="db-card-hd" @click="toggleSection('entities')">
            <span class="db-arrow" :class="{ open: sections.entities }">▸</span> 实体列表 ({{ store.entities.length }})
          </div>
          <div v-show="sections.entities" class="db-card-bd db-list">
            <div v-if="store.entities.length === 0" class="db-empty">无实体</div>
            <div v-for="e in store.entities" :key="e.id" class="db-list-row" :class="{ selected: store.selectedIds.includes(e.id) }"
              @click="toggleSelect(e.id)">
              <input type="checkbox" :checked="store.selectedIds.includes(e.id)" @click.stop="toggleSelect(e.id)" />
              <span class="db-kind-badge" :class="'kind-' + e.kind.toLowerCase()">{{ e.kind }}</span>
              <span class="db-id-text">{{ e.id.slice(0, 16) }}</span>
              <span class="db-small">H:{{ (e as any).height }} O:{{ e.openSide }}</span>
              <span v-if="store.dirtyEntityIds.includes(e.id)" class="db-dirty-dot" title="dirty">●</span>
            </div>
          </div>
        </div>

        <!-- 选中详情 -->
        <div class="db-card" v-if="selectedEntityPreviews.length > 0">
          <div class="db-card-hd"><span class="db-arrow always-open">▸</span> 选中实体详情</div>
          <div class="db-card-bd">
            <pre class="db-json">{{ JSON.stringify(selectedEntityPreviews, null, 2) }}</pre>
          </div>
        </div>

        <!-- 图层列表 -->
        <div class="db-card">
          <div class="db-card-hd" @click="toggleSection('layers')">
            <span class="db-arrow" :class="{ open: sections.layers }">▸</span> 图层列表 ({{ store.layers.length }})
          </div>
          <div v-show="sections.layers" class="db-card-bd">
            <div v-for="l in store.layers" :key="l.id" class="db-list-row">
              <span class="db-id-text">{{ l.id }}</span>
              <span>{{ l.name }}</span>
              <span class="db-small">{{ l.visible ? '👁' : '━' }} {{ l.locked ? '🔒' : '🔓' }}</span>
              <span class="db-small">实体:{{ l.entityCount }}</span>
            </div>
          </div>
        </div>

        <!-- Meta -->
        <div class="db-card">
          <div class="db-card-hd" @click="toggleSection('meta')">
            <span class="db-arrow" :class="{ open: sections.meta }">▸</span> 项目元信息
          </div>
          <div v-show="sections.meta" class="db-card-bd">
            <pre class="db-json">{{ JSON.stringify(store.projectMeta, null, 2) }}</pre>
          </div>
        </div>

        <!-- Selection -->
        <div class="db-card">
          <div class="db-card-hd" @click="toggleSection('selection')">
            <span class="db-arrow" :class="{ open: sections.selection }">▸</span> selectedIds ({{ store.selectedIds.length }})
          </div>
          <div v-show="sections.selection" class="db-card-bd">
            <div v-if="store.selectedIds.length === 0" class="db-empty">无选中</div>
            <div v-for="id in store.selectedIds" :key="id" class="db-list-row">
              <code>{{ id }}</code>
            </div>
          </div>
        </div>

        <!-- Dirty -->
        <div class="db-card">
          <div class="db-card-hd" @click="toggleSection('dirty')">
            <span class="db-arrow" :class="{ open: sections.dirty }">▸</span> dirtyEntityIds ({{ store.dirtyEntityIds.length }})
          </div>
          <div v-show="sections.dirty" class="db-card-bd">
            <div v-if="store.dirtyEntityIds.length === 0" class="db-empty">无脏实体</div>
            <div v-for="id in store.dirtyEntityIds" :key="id" class="db-list-row">
              <code>{{ id }}</code>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.debugger {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0a0a0f;
  color: #d4d4d8;
  font-size: 12px;
  user-select: none;
}

/* ── 工具栏 ── */
.db-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #16161c;
  border-bottom: 1px solid #27272a;
  flex-shrink: 0;
}
.db-title { font-size: 14px; font-weight: 700; color: #3b82f6; }
.db-stats { display: flex; gap: 10px; }
.db-stat { font-size: 11px; color: #71717a; }
.db-stat b { color: #a1a1aa; }

/* ── 主体 ── */
.db-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}
.db-left {
  width: 420px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid #27272a;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.db-right {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── 卡片 ── */
.db-card {
  background: #131316;
  border: 1px solid #1f1f23;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}
.db-card-hd {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  cursor: pointer;
  background: #18181b;
}
.db-card-hd:hover { color: #e4e4e7; }
.db-card-bd { padding: 6px 8px; }

.db-hint { margin-left: auto; font-size: 10px; color: #52525b; font-weight: 400; }
.db-arrow { font-size: 10px; transition: transform 0.15s; display: inline-block; width: 12px; }
.db-arrow.open { transform: rotate(90deg); }
.db-arrow.always-open { transform: rotate(90deg); color: #52525b; }

.db-empty { color: #3f3f46; font-style: italic; padding: 4px 0; }

/* ── 实体表单 ── */
.db-entity-form {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid #1a1a1f;
}
.db-entity-form:last-child { border-bottom: none; }
.db-entity-label {
  font-size: 10px;
  font-weight: 700;
  color: #52525b;
  width: 48px;
  flex-shrink: 0;
}
.db-fields {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  flex-wrap: wrap;
}
.db-fields label { font-size: 9px; color: #52525b; display: flex; align-items: center; gap: 2px; }

/* ── 组件 ── */
.db-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.db-inp {
  padding: 3px 6px;
  font-size: 11px;
  background: #0d0d11;
  border: 1px solid #27272a;
  border-radius: 4px;
  color: #d4d4d8;
  width: 50px;
  font-family: monospace;
}
.db-inp:focus { outline: none; border-color: #3b82f6; }
select.db-inp { cursor: pointer; }

.db-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
}
.db-btn:hover:not(:disabled) { background: #3f3f46; color: #e4e4e7; }
.db-btn:disabled { opacity: 0.3; cursor: default; }
.db-btn-blue { border-color: #2563eb; color: #60a5fa; }
.db-btn-blue:hover:not(:disabled) { background: #1d4ed8; color: #fff; }
.db-btn-green { border-color: #16a34a; color: #4ade80; }
.db-btn-green:hover:not(:disabled) { background: #15803d; color: #fff; }
.db-btn-red { border-color: #dc2626; color: #f87171; }
.db-btn-red:hover:not(:disabled) { background: #b91c1c; color: #fff; }
.db-btn-orange { border-color: #ea580c; color: #fb923c; }
.db-btn-orange:hover:not(:disabled) { background: #c2410c; color: #fff; }
.db-btn-grey { border-color: #3f3f46; color: #71717a; }
.db-btn-active { background: #3b82f6; border-color: #3b82f6; color: #fff !important; }
.db-btn-sm { padding: 2px 6px; font-size: 10px; }

/* ── 列表 ── */
.db-list { max-height: 300px; overflow-y: auto; }
.db-list-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.1s;
}
.db-list-row:hover { background: #1a1a22; }
.db-list-row.selected { background: #1e293b; }
.db-list-row input[type="checkbox"] { accent-color: #3b82f6; cursor: pointer; }

.db-kind-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  background: #27272a;
  color: #a1a1aa;
  text-transform: uppercase;
}
.db-id-text { font-family: monospace; font-size: 11px; color: #71717a; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.db-small { font-size: 10px; color: #52525b; }
.db-dirty-dot { color: #f59e0b; font-size: 10px; }
.db-layer-item { font-family: monospace; font-size: 10px; color: #a1a1aa; flex: 1; }

.db-json {
  font-size: 10px;
  color: #a1a1aa;
  background: #0d0d11;
  padding: 6px 8px;
  border-radius: 4px;
  max-height: 200px;
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.db-snapshot-preview {
  margin-top: 4px;
  font-size: 10px;
  color: #52525b;
  font-family: monospace;
  background: #0d0d11;
  padding: 3px 6px;
  border-radius: 3px;
}

.db-info-text {
  margin-top: 4px;
  font-size: 10px;
  color: #52525b;
  font-family: monospace;
}
</style>
