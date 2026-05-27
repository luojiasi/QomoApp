<script setup lang="ts">
// SelfProcessPage_WorkflowCanvas.vue — 中间的 VueFlow 画布区域
import { VueFlow }   from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls }   from '@vue-flow/controls'
import { MiniMap }    from '@vue-flow/minimap'
import { useWorkflowCanvas } from '../composables/useWorkflowCanvas'
import WorkflowCanvas_Menu from './WorkflowCanvas_Menu.vue'
import { resolveMiniMapNodeColor } from '../utils/minimapNodeColor'
import {
  MINIMAP_MASK_COLOR,
  MINIMAP_MASK_STROKE_COLOR,
  MINIMAP_NODE_BORDER_RADIUS,
  MINIMAP_NODE_STROKE_COLOR,
  MINIMAP_NODE_STROKE_WIDTH
} from '../constants/minimapStyles'
import { WORKFLOW_VUE_FLOW_ID } from '../constants/workflowCanvas'
import { toConnectionLineType } from '../utils/edgePathUtils'

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
  onNodeDragStop,
  onContextMenu, onMenuAdd, closeMenu
} = useWorkflowCanvas()
</script>

<template>
  <div class="relative h-full w-full overflow-hidden rounded-2xl border border-(--app-border) bg-(--app-card)">

    <VueFlow
      :id="WORKFLOW_VUE_FLOW_ID"
      :nodes="vfNodes"
      :edges="vfEdges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :default-viewport="defaultViewport"
      :min-zoom="settings.effective.value.minZoom"
      :max-zoom="settings.effective.value.maxZoom"
      :snap-to-grid="settings.snapToGrid.value"
      :snap-grid="[settings.snapGridSize.value, settings.snapGridSize.value]"
      :connection-line-type="toConnectionLineType(settings.effective.value.edgeType)"
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
        v-show="settings.showMiniMap.value"
        pannable
        zoomable
        :position="settings.miniMapPosition.value"
        :width="settings.miniMapWidth.value"
        :height="settings.miniMapHeight.value"
        :node-color="resolveMiniMapNodeColor"
        :node-stroke-color="MINIMAP_NODE_STROKE_COLOR"
        :node-stroke-width="MINIMAP_NODE_STROKE_WIDTH"
        :node-border-radius="MINIMAP_NODE_BORDER_RADIUS"
        :mask-color="MINIMAP_MASK_COLOR"
        :mask-stroke-color="MINIMAP_MASK_STROKE_COLOR"
        :mask-stroke-width="2"
      />
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

<style scoped>
/* 小地图容器：深色底，与主画布节点缩略图对比清晰 */
:deep(.vue-flow__minimap) {
  background-color: var(--app-card-soft) !important;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
</style>
