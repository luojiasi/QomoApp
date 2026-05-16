<script setup lang="ts">
import { ref } from 'vue'
import EditorToolbar from '../components/EditorToolbar.vue'
import Canvas2D from '../components/Canvas2D.vue'
import Preview3D from '../components/Preview3D.vue'
import SwitchableView from '../shares/SwitchableView.vue'
import LayoutPanel from '../components/panels/LayoutPanel.vue'
import InspectorPanel from '../components/panels/InspectorPanel.vue'
import SettingsDialog from '../components/SettingsDialog.vue'
import StatusBar from '../components/StatusBar.vue'
import { useRightPanel } from '../composables/useRightPanel'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import type { ActionDef } from '../shares/types'

const { activeTab, rightPanelTabs } = useRightPanel()

const settingsRef = ref<InstanceType<typeof SettingsDialog> | null>(null)

/** 工具栏点击 → 分发 */
function onToolbarAction(a: ActionDef) {
  dispatchAction(a)
}

/** 键盘快捷键 → 分发 */
useKeyboardShortcuts(dispatchAction)

/** 统一 action 分发入口 */
function dispatchAction(a: ActionDef) {
  switch (a.id) {
    case 'SETTINGS':
      settingsRef.value?.open()
      break
    // 其余 action 在 composables 重建后逐项接入
  }
}
</script>

<template>
  <div class="editor-page">
    <EditorToolbar @action="onToolbarAction" />

    <div class="main-area desktop-only">
      <div class="panel panel-3d">
        <Preview3D />
      </div>
      <div class="panel panel-2d">
        <Canvas2D />
      </div>
      <div class="panel panel-right">
        <SwitchableView v-model="activeTab" :tabs="rightPanelTabs">
          <LayoutPanel v-if="activeTab === 'layout'" />
          <InspectorPanel v-else />
        </SwitchableView>
      </div>
    </div>

    <StatusBar />

    <SettingsDialog ref="settingsRef" />
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
