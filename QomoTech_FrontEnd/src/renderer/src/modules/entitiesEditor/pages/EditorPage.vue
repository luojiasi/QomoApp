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
import { useKeyboardShortcuts } from '../composables/shortcuts/useKeyboardShortcuts'
import { useShortCutsDetails } from '../composables/shortcuts/useShortCutsDetails'
import { SETTINGS_STATE_KEY } from '../shares/types'
import type { ActionDef, Scene3DConfig } from '../shares/types'
import { loadSceneConfig, saveSceneConfig } from '../stores/preview3dStore'

const { activeTab, rightPanelTabs } = useRightPanel()

const settingsRef = ref<InstanceType<typeof SettingsDialog> | null>(null)
const previewRef = ref<InstanceType<typeof Preview3D> | null>(null)
const toolbarRef = ref<InstanceType<typeof EditorToolbar> | null>(null)

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
})

function onToolbarAction(a: ActionDef) {
  dispatchAction(a)
}

function onSettingsSaved() {
  previewRef.value?.reloadConfig()
  toolbarRef.value?.reload()
}

useKeyboardShortcuts(dispatchAction, { isOpen: settingsIsOpen, capturing: settingsCapturing })
</script>

<template>
  <div class="editor-page">
    <EditorToolbar ref="toolbarRef" @action="onToolbarAction" />

    <div class="main-area desktop-only">
      <div class="panel panel-3d">
        <Preview3D ref="previewRef" />
      </div>
      <div class="panel panel-2d">
        <Canvas2D />
      </div>
      <div class="panel panel-right">
        <SwitchableView v-model="activeTab" :tabs="rightPanelTabs">
          <LayoutPanel v-if="activeTab === 'layout'" />
          <InspectorPanel v-else-if="activeTab === 'inspector'" />
          <StoreDebugger v-else-if="activeTab === 'debug'" />
        </SwitchableView>
      </div>
    </div>

    <StatusBar />

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
