<script setup lang="ts">
// SelfProcessPage_WorkflowCanvas.vue — 中间的 VueFlow 画布区域
import { VueFlow }   from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls }   from '@vue-flow/controls'
import { MiniMap }    from '@vue-flow/minimap'
import { useWorkflowCanvas } from '../composables/useWorkflowCanvas'
import WorkflowCanvas_Menu from './WorkflowCanvas_Menu.vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const {
  nodeTypes,
  edgeTypes,
  vfNodes, vfEdges,
  settings,
  defaultViewport,
  showMenu, menuPos,
  onConnect, onNodeClick, onPaneClick, onEdgeClick,
  onNodeDragStop, onNodeRemove,
  onContextMenu, onMenuAdd, closeMenu
} = useWorkflowCanvas()
</script>

<template>
  <div class="relative h-full w-full overflow-hidden rounded-2xl border border-(--app-border) bg-(--app-card)">

    <VueFlow
      v-model:nodes="vfNodes"
      v-model:edges="vfEdges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :default-viewport="defaultViewport"
      :min-zoom="settings.effective.value.minZoom"
      :max-zoom="settings.effective.value.maxZoom"
      :snap-to-grid="settings.snapToGrid.value"
      :snap-grid="[settings.snapGridSize.value, settings.snapGridSize.value]"
      @connect="onConnect"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
      @node-drag-stop="onNodeDragStop"
      @pane-click="onPaneClick"
      @pane-context-menu="onContextMenu"
    >
      <Background
        :gap="settings.bgGap.value"
        :size="settings.bgSize.value"
        :pattern-color="settings.bgColor.value"
      />
      <Controls position="bottom-right" />
      <MiniMap
        v-if="settings.showMiniMap.value"
        :position="settings.miniMapPosition.value"
        :width="settings.miniMapWidth.value"
        :height="settings.miniMapHeight.value"
      />

      <template #node-workflow-node="nodeProps">
        <component :is="nodeTypes['workflow-node']" v-bind="nodeProps" @remove="onNodeRemove" />
      </template>
    </VueFlow>

    <div
      v-if="vfNodes.length === 0"
      class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
    >
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/10 text-3xl text-blue-400">
        ＋
      </div>
      <div class="text-center">
        <p class="text-sm font-semibold text-(--app-text-primary)">右键画布添加节点</p>
        <p class="mt-1 text-xs text-(--app-text-muted)">拖拽节点、连线来编排流程</p>
      </div>
    </div>

    <WorkflowCanvas_Menu
      :show="showMenu"
      :x="menuPos.x"
      :y="menuPos.y"
      @add="(type) => onMenuAdd(type)"
      @close="closeMenu"
    />

  </div>
</template>
