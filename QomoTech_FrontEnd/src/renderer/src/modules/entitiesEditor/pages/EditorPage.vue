<script setup lang="ts">
import { ref, provide } from 'vue'
import EditorToolbar from '../components/EditorToolbar.vue'
import Canvas2D from '../components/Canvas2D.vue'
import Preview3D from '../components/Preview3D.vue'
import SwitchableView from '../shares/SwitchableView.vue'
import LayoutPanel from '../components/panels/LayoutPanel.vue'
import InspectorPanel from '../components/panels/InspectorPanel.vue'
import StoreDebugger from '../components/panels/StoreDebugger.vue'
import SettingsDialog from '../components/SettingsDialog.vue'
import StatusBar from '../components/StatusBar.vue'
import { useRightPanel } from '../composables/useRightPanel'
import { useInspectorPanel } from '../composables/useInspectorPanel'
import { useLayoutPanel } from '../composables/useLayoutPanel'
import { useKeyboardShortcuts } from '../composables/shortcuts/useKeyboardShortcuts'
import { useShortCutsDetails } from '../composables/shortcuts/useShortCutsDetails'
import { SETTINGS_STATE_KEY } from '../shares/types'
import type { ActionDef, Scene3DConfig } from '../shares/types'
import { loadSceneConfig, saveSceneConfig } from '../stores/preview3dStore'
import { saveProject, exportProject, loadProjectIntoStore } from '../stores/projectStore'
import { importDxf } from '../composables/canvas/useImportCad'
import { EntityKind, DiamondShape } from '../commons/types'
import { useEditorStore } from '../stores/editorStore'

const { activeTab, rightPanelTabs } = useRightPanel()
const {selectedEntities, updateField } = useInspectorPanel()
const editorStore = useEditorStore()

// ── 图层面板桥接 ──
const { layers: panelLayers, addLayer, deleteLayer, toggleLayer } = useLayoutPanel()
function onAddLayer()           { addLayer() }
function onDeleteLayer(id: string) { deleteLayer(id) }
function onToggleLayer(id: string) { toggleLayer(id) }

const settingsRef = ref<InstanceType<typeof SettingsDialog> | null>(null)
const previewRef = ref<InstanceType<typeof Preview3D> | null>(null)
const toolbarRef = ref<InstanceType<typeof EditorToolbar> | null>(null)
const canvas2DRef = ref<InstanceType<typeof Canvas2D> | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// ── 页面初始化：从 localStorage 恢复上次保存的项目 ──
loadProjectIntoStore()

// ── 设置弹窗跨组件共享状态 ──
const settingsIsOpen = ref(false)
const settingsCapturing = ref<string | null>(null)
provide(SETTINGS_STATE_KEY, { isOpen: settingsIsOpen, capturing: settingsCapturing })

function toggleSceneConfig(patch: Partial<Scene3DConfig>) {
  const cfg = loadSceneConfig()
  const updated = { ...cfg, ...patch }
  saveSceneConfig(updated)
  previewRef.value?.applyConfig(updated)
}



const { dispatchAction } = useShortCutsDetails({
  onSettingsOpen: () => settingsRef.value?.open(),
  onToggleGrid: () => toggleSceneConfig({ showGrid: !loadSceneConfig().showGrid }),
  onToggleAxes: () => toggleSceneConfig({ showAxes: !loadSceneConfig().showAxes }),
  onSave: ()=>saveProject(),
  onExport: ()=> exportProject(),
  onImportDxf: () => fileInputRef.value?.click(),
})

function handleImportDxf(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    const result = importDxf(text)
    editorStore.replaceAllEntities(result.entities, result.layers, {
      name: file.name.replace(/\.dxf$/i, ''),
      sourceFileName: file.name,
    })
    saveProject()
  }
  reader.readAsText(file)
  input.value = ''
}

function onToolbarAction(a: ActionDef) {
  dispatchAction(a)
}
/** 右键切换绘制策略（EditorToolbar 冒泡上来） */
function onContextStrategy(payload: { kind: EntityKind; strategyId: string }) {
  editorStore.setTool('DRAW')
  editorStore.setDrawSubTool(payload.kind)
}

/** 钻石右键选择形状 */
function onDiamondShape(shape: DiamondShape) {
  editorStore.setTool('DRAW')
  editorStore.setDrawSubTool('DIAMOND')
  editorStore.setDiamondShape(shape)
}

function onSettingsSaved() {
  previewRef.value?.reloadConfig()
  toolbarRef.value?.reload()
  canvas2DRef.value?.reloadConfig()
}

useKeyboardShortcuts(dispatchAction, { isOpen: settingsIsOpen, capturing: settingsCapturing })
</script>

<template>
  <div class="editor-page">
    <!-- 首先我们要在这里去添加回传给到2D去画图 -->
    <EditorToolbar ref="toolbarRef" @action="onToolbarAction" @context-strategy="onContextStrategy" @context-diamond-shape="onDiamondShape" />

    <div class="main-area desktop-only">
      <div class="panel panel-3d">
        <Preview3D ref="previewRef" />
      </div>
      <div class="panel panel-2d">
        <Canvas2D ref="canvas2DRef" />
      </div>
      <div class="panel panel-right">
        <SwitchableView v-model="activeTab" :tabs="rightPanelTabs">
          <LayoutPanel
            v-if="activeTab === 'layout'"
            :layers="panelLayers"
            @add-layer="onAddLayer"
            @delete-layer="onDeleteLayer"
            @toggle-layer="onToggleLayer"
          />
          <InspectorPanel v-else-if="activeTab === 'inspector'" :entities="selectedEntities" @update="updateField" />
          <StoreDebugger v-else-if="activeTab === 'debug'" />
        </SwitchableView>
      </div>
    </div>

    <StatusBar />

    <input
      ref="fileInputRef"
      type="file"
      accept=".dxf"
      style="display: none"
      @change="handleImportDxf"
    />

    <SettingsDialog ref="settingsRef" @saved="onSettingsSaved" />
  </div>
</template>

<style>
.editor-page {
  --toolbar-h: 40px;
  --statusbar-h: 28px;

  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: #09090b;
  color: #d4d4d8;
  overflow: hidden;
}

.main-area {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.panel {
  min-height: 0;
  overflow: hidden;
}
.panel-3d  { flex: 4; }
.panel-2d  { flex: 4; }
.panel-right {
  flex: 2;
  min-width: 240px;
}

.desktop-only { display: flex; }
.mobile-only  { display: none; }

@media (max-width: 1023px) {
  .desktop-only { display: none; }
  .mobile-only  { display: flex; }
}
</style>