<script setup lang="ts">
import { reactive } from 'vue';
import { EntityKind, DiamondShape } from '../commons/types';
import { useEditorToolbar } from '../composables/useEditorToolbar'
import type { ActionDef } from '../shares/types'
import { getStrategies } from '../composables/canvas/drawStrategies';

const DIAMOND_SHAPE_LABELS: { shape: DiamondShape; label: string }[] = [
  { shape: 'ROUND', label: '圆形明亮式'},
  { shape: 'SQUARE', label: '公主方' },
  { shape: 'HEART', label: '心形' },
  { shape: 'EMERALD', label: '祖母绿' },
]

const { fileGroup, shapeGroup, diamondGroup, toolGroup, settingsGroup, toolTitle, reload } = useEditorToolbar()

defineExpose({ reload })

const emit = defineEmits<{
  'action': [action: ActionDef]
  'context-strategy': [{ kind: EntityKind; strategyId: string }]
  'context-diamond-shape': [shape: DiamondShape]
}>()

function onClick(a: ActionDef) {
  emit('action', a)
}
// ── 右键策略菜单 ──
const ctxMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  kind: null as EntityKind | null,
})
/** 将工具栏 action id 映射为 EntityKind */
function actionIdToKind(id: string): EntityKind | null {
  const map: Record<string, EntityKind> = {
    DRAW_LINE: 'LINE', DRAW_CIRCLE: 'CIRCLE', DRAW_ARC: 'ARC',
    DRAW_BEZIER: 'BEZIER', DRAW_POLYLINE: 'POLYLINE', DRAW_ELLIPSE: 'ELLIPSE',
  }
  return map[id] ?? null
}

function onShapeContextMenu(e: MouseEvent, kind: EntityKind) {
  e.preventDefault()
  ctxMenu.visible = true
  ctxMenu.x = e.clientX
  ctxMenu.y = e.clientY
  ctxMenu.kind = kind
}
function onCtxStrategySelect(strategyId: string) {
  if (ctxMenu.kind) {
    emit('context-strategy', { kind: ctxMenu.kind, strategyId })
  }
  closeCtxMenu()
}
function closeCtxMenu() {
  ctxMenu.visible = false
  ctxMenu.kind = null
}

// ── 钻石形状右键菜单 ──
const ctxDiamond = reactive({ visible: false, x: 0, y: 0 })
function onDiamondContextMenu(e: MouseEvent) {
  e.preventDefault()
  ctxDiamond.visible = true
  ctxDiamond.x = e.clientX
  ctxDiamond.y = e.clientY
}
function onDiamondShapeSelect(shape: DiamondShape) {
  emit('context-diamond-shape', shape)
  ctxDiamond.visible = false
}
function closeDiamondMenu() {
  ctxDiamond.visible = false
}

</script>

<template>
  <div class="toolbar">
    <!-- ▸ 文件操作 -->
    <div class="tool-panel">
      <span class="panel-label">文件</span>
      <div class="panel-btns">
        <button
          v-for="t in fileGroup" :key="t.id"
          class="tool-btn"
          :title="toolTitle(t)"
          @click="onClick(t)"
        >
          <span v-if="t.icon" class="tool-icon">{{ t.icon }}</span>
          <span v-if="t.key" class="tool-key">{{ t.key }}</span>
          <span class="tool-label">{{ t.label }}</span>
        </button>
      </div>
    </div>

    <span class="panel-sep" />

    <!-- ▸ 图形操作（支持右键切换策略） -->
    <div class="tool-panel">
      <span class="panel-label">图形</span>
      <div class="panel-btns">
        <button
          v-for="t in shapeGroup" :key="t.id"
          class="tool-btn"
          :title="toolTitle(t)"
          @click="onClick(t)"
          @contextmenu.prevent="onShapeContextMenu($event, actionIdToKind(t.id)!)"
        >
          <span v-if="t.key" class="tool-key">{{ t.key }}</span>
          <span class="tool-label">{{ t.label }}</span>
        </button>
      </div>
    </div>

    <span class="panel-sep" />

    <!-- ▸ 钻石操作 -->

    <div class="tool-panel">
      <span class="panel-label">钻石</span>
      <div class="panel-btns">
        <button
          v-for="t in diamondGroup" :key="t.id"
          class="tool-btn"
          :title="toolTitle(t) + ' (右键选择形状)'"
          @click="onClick(t)"
          @contextmenu="onDiamondContextMenu"
        >
          <span v-if="t.key" class="tool-key">{{ t.key }}</span>
          <span class="tool-label">{{ t.label }}</span>
        </button>
      </div>
    </div>

    <span class="panel-sep" />
    <!-- ▸ 工具操作 -->
    <div class="tool-panel">
      <span class="panel-label">工具</span>
      <div class="panel-btns">
        <button
          v-for="t in toolGroup" :key="t.id"
          class="tool-btn"
          :title="toolTitle(t)"
          @click="onClick(t)"
        >
          <span v-if="t.icon" class="tool-icon">{{ t.icon }}</span>
          <span v-if="t.key" class="tool-key">{{ t.key }}</span>
          <span class="tool-label">{{ t.label }}</span>
        </button>
      </div>
    </div>

    <span class="panel-sep" />

    <!-- ▸ 设置操作 -->
    <div class="tool-panel">
      <div class="panel-btns">
        <button
          v-for="t in settingsGroup" :key="t.id"
          class="tool-btn"
          :title="toolTitle(t)"
          @click="onClick(t)"
        >
          <span v-if="t.icon" class="tool-icon">{{ t.icon }}</span>
          <span class="tool-label">{{ t.label }}</span>
        </button>
      </div>
    </div>

    <!-- ▸ 预留窗口控制按钮空间 (Win: ~138px) -->
    <div class="window-controls-spacer" />

    <!-- ▸ 右键策略弹出菜单 -->
    <teleport to="body">
      <div
        v-if="ctxMenu.visible"
        class="ctx-menu-backdrop"
        @mousedown="closeCtxMenu"
      />
      <div
        v-if="ctxMenu.visible"
        class="ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      >
        <div class="ctx-header">{{ ctxMenu.kind }}</div>
        <button
          v-for="s in (ctxMenu.kind ? getStrategies(ctxMenu.kind) : [])"
          :key="s.id"
          class="ctx-item"
          :class="{ 'ctx-default': s.default }"
          @click="onCtxStrategySelect(s.id)"
        >
          <span class="ctx-dot">{{ s.default ? '●' : '○' }}</span>
          <span>{{ s.label }}</span>
        </button>
      </div>
    </teleport>

    <!-- ▸ 钻石形状选择菜单 -->
    <teleport to="body">
      <div
        v-if="ctxDiamond.visible"
        class="ctx-menu-backdrop"
        @mousedown="closeDiamondMenu"
      />
      <div
        v-if="ctxDiamond.visible"
        class="ctx-menu"
        :style="{ left: ctxDiamond.x + 'px', top: ctxDiamond.y + 'px' }"
      >
        <div class="ctx-header">钻石形状</div>
        <button
          v-for="ds in DIAMOND_SHAPE_LABELS"
          :key="ds.shape"
          class="ctx-item"
          :class="{ 'ctx-default': ds.shape === 'ROUND' }"
          @click="onDiamondShapeSelect(ds.shape)"
        >
          <span class="ctx-dot">{{ ds.shape === 'ROUND' ? '●' : '○' }}</span>
          <span>{{ ds.label }}</span>
        </button>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 8px;
  background: #18181b;
  border-bottom: 1px solid #27272a;
  height: 44px;
  min-height: 44px;
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.toolbar::-webkit-scrollbar { display: none; }

/* ── 面板组 ── */
.tool-panel {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.panel-label {
  font-size: 10px;
  font-weight: 500;
  color: #52525b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 4px;
  white-space: nowrap;
  user-select: none;
}
.panel-btns {
  display: flex;
  gap: 1px;
}

/* ── 面板分隔线 ── */
.panel-sep {
  width: 1px;
  height: 22px;
  background: #27272a;
  margin: 0 6px;
  flex-shrink: 0;
}

/* ── 按钮 ── */
.tool-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 7px;
  font-size: 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  height: 28px;
}
.tool-btn:hover { background: #27272a; color: #e4e4e7; }
.tool-icon { font-size: 13px; line-height: 1; }
.tool-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 2px;
  font-size: 9px;
  font-weight: 700;
  border-radius: 2px;
  background: #3f3f46;
  color: #a1a1aa;
  line-height: 1;
}

/* ── 窗口控制按钮预留位 ── */
.window-controls-spacer {
  width: 138px;
  flex-shrink: 0;
  margin-left: auto;
}

/* ── 手机端 ── */
@media (max-width: 1023px) {
  .toolbar { padding: 0 4px; height: 40px; min-height: 40px; }
  .panel-label { display: none; }
  .panel-sep { margin: 0 3px; }
  .tool-label { display: none; }
  .tool-btn { padding: 4px 5px; }
  .window-controls-spacer { display: none; }
}

/* ── 右键菜单 ── */
.ctx-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: transparent;
}
.ctx-menu {
  position: fixed;
  z-index: 1000;
  min-width: 140px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.ctx-header {
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: #52525b;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #27272a;
  margin-bottom: 2px;
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 10px;
  font-size: 12px;
  background: none;
  border: none;
  border-radius: 4px;
  color: #d4d4d8;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}
.ctx-item:hover {
  background: #27272a;
}
.ctx-dot {
  font-size: 10px;
  color: #52525b;
  width: 12px;
  text-align: center;
}
.ctx-default .ctx-dot {
  color: #3b82f6;
}
</style>