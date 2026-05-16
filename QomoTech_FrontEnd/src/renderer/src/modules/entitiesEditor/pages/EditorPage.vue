<script setup lang="ts">
import EditorToolbar from '../components/EditorToolbar.vue'
import Canvas2D from '../components/Canvas2D.vue'
import Preview3D from '../components/Preview3D.vue'
import SwitchableView from '../shares/SwitchableView.vue'
import LayoutPanel from '../components/panels/LayoutPanel.vue'
import InspectorPanel from '../components/panels/InspectorPanel.vue'
import StatusBar from '../components/StatusBar.vue'
import { useSwitchableView } from '../composables/useSwitchableView'

const { activeTab, rightPanelTabs } = useSwitchableView()
</script>

<template>
  <div class="editor-page">
    <EditorToolbar />

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
