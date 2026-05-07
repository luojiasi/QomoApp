<script setup lang="ts">
import { computed, markRaw, ref, onBeforeUnmount } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type { Node, Edge, Connection } from '@vue-flow/core'
import { useSelfProcessStore } from '../../stores/selfProcessStores'
import { NODE_WIDTH, NODE_HEIGHT } from '../../configs/selfProcessConfigs'
import type { WorkflowNode, WorkflowEdge } from '../../types/selfProcessTypes'
import FlowNode from './FlowNode.vue'
import FlowNodeSelector from './FlowNodeSelector.vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const store = useSelfProcessStore()

const nodeTypes = {
  'workflow-node': markRaw(FlowNode)
}

// ──── 上下文菜单状态 ────────────────────────────────────────
const showSelector = ref(false)
const selectorPos = ref({ x: 0, y: 0 })
const newNodePos = ref<{ x: number; y: number } | null>(null)
const selectedEdgeId = ref<string | null>(null)

// ──── VueFlow nodes/edges 映射 ──────────────────────────────
const vfNodes = computed<Node[]>({
  get: () => {
    const wf = store.currentWorkflow
    if (!wf) return []
    return wf.nodes.map((n) => workflowNodeToVfNode(n))
  },
  set: () => {
    // 位置仅通过 @node-drag-stop 同步，不在 setter 中回写
    // 防止每次节点列表变化时 VueFlow 重算所有位置并覆盖 store
  }
})

const vfEdges = computed<Edge[]>({
  get: () => {
    const wf = store.currentWorkflow
    if (!wf) return []
    return wf.edges.map((e) => {
      const vfEdge = workflowEdgeToVfEdge(e)
      if (e.id === selectedEdgeId.value) {
        vfEdge.style = { stroke: '#facc15', strokeWidth: 2.5 }
      }
      return vfEdge
    })
  },
  set: () => {
    // edges 通过 @connect / store.removeEdge 管理
  }
})

function workflowNodeToVfNode(wn: WorkflowNode): Node {
  return {
    id: wn.id,
    type: 'workflow-node',
    position: { x: wn.position.x, y: wn.position.y },
    data: {
      type: wn.type,
      label: wn.label,
      description: wn.description,
      status: store.runContext?.nodeOutputs[wn.id]?.status ?? 'idle',
      workflowRunning: store.isRunning,
      extraInputs: wn.extraInputs ?? []
    }
  }
}

function workflowEdgeToVfEdge(we: WorkflowEdge): Edge {
  return {
    id: we.id,
    source: we.source,
    target: we.target,
    sourceHandle: we.sourceHandle,
    targetHandle: we.targetHandle
  }
}

// ──── VueFlow 事件处理 ─────────────────────────────────────
// 用户拖线连接两个节点时触发，通常在这里新增 edge/更新流程关系
function onConnect(connection: Connection): void {
  store.addEdge(connection.source, connection.target, connection.sourceHandle ?? undefined, connection.targetHandle ?? undefined)
}


// 点击节点时触发，一般用来”选中节点、打开配置
function onNodeClick({ node }: { node: Node }): void {
  store.selectNode(node.id)
  selectedEdgeId.value = null
}
// 双击节点 → 单独运行该节点进行调试
function onNodeDoubleClick({ node }: { node: Node }): void {
  store.runSingleNode(node.id)
}
//点击画布空白区域时触发，常用于取消选中、关闭弹层
function onPaneClick(): void {
  store.selectNode(null)
  showSelector.value = false
  selectedEdgeId.value = null
}
// 点击边时选中/取消选中，配合 Delete 键删除
function onEdgeClick({ edge }: { edge: Edge }): void {
  selectedEdgeId.value = selectedEdgeId.value === edge.id ? null : edge.id
}
// 右键画布空白区域时触发，通常用来弹“新增节点”菜单
function onPaneContextMenu(event: MouseEvent): void {
  event.preventDefault()
  // 选择器弹窗用屏幕坐标
  showSelector.value = true
  selectorPos.value = { x: event.clientX, y: event.clientY }
  // 节点位置用 flow 坐标（已考虑平移/缩放）
  const flowPos = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  newNodePos.value = {
    x: flowPos.x - NODE_WIDTH / 2,
    y: flowPos.y - NODE_HEIGHT / 2
  }
}

function onSelectorSelect(type: string): void {
  store.addNode(type, newNodePos.value?.x, newNodePos.value?.y)
  showSelector.value = false
  newNodePos.value = null
}

function onSelectorClose(): void {
  showSelector.value = false
  newNodePos.value = null
}

function onNodeDragStop({ node }: { node: Node }): void {
  store.updateNodePosition(node.id, node.position.x, node.position.y)
}

function onNodeRemove(nodeId: string): void {
  store.removeNode(nodeId)
}

// ──── 键盘删除边 ─────────────────────────────────────────
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Delete' && selectedEdgeId.value) {
    const edgeId = selectedEdgeId.value
    // 检查边是否仍存在于 store 中
    const wf = store.currentWorkflow
    if (wf && wf.edges.some((edge) => edge.id === edgeId)) {
      store.removeEdge(edgeId)
    }
    selectedEdgeId.value = null
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

const { onInit, screenToFlowCoordinate } = useVueFlow()

onInit(() => {
  window.addEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="relative h-full w-full overflow-hidden rounded-2xl border border-(--app-border) bg-(--app-card)">
    <VueFlow
      v-model:nodes="vfNodes"
      v-model:edges="vfEdges"
      :node-types="nodeTypes"
      :default-viewport="{ x: 0, y: 0, zoom: 1 }"
      :min-zoom="0.1"
      :max-zoom="4"
      :snap-to-grid="store.snapToGrid"
      :snap-grid="[store.snapGridSize, store.snapGridSize]"
      @connect="onConnect"
      @node-click="onNodeClick"
      @node-double-click="onNodeDoubleClick"
      @edge-click="onEdgeClick"
      @node-drag-stop="onNodeDragStop"
      @pane-click="onPaneClick"
      @pane-context-menu="onPaneContextMenu"
    >
      <Background :gap="store.bgGap" :size="store.bgSize" :pattern-color="store.bgColor" />
      <Controls position="bottom-right" />
      <MiniMap
        v-if="store.showMiniMap"
        :position="store.miniMapPosition"
        :width="store.miniMapWidth"
        :height="store.miniMapHeight"
      />

      <!-- 自定义节点插槽 -->
      <template #node-workflow-node="nodeProps">
        <FlowNode
          v-bind="nodeProps"
          @remove="onNodeRemove"
        />
      </template>
    </VueFlow>

    <!-- 空状态 -->
    <div
      v-if="vfNodes.length === 0"
      class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
    >
      <div
        class="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/10 text-3xl text-blue-400 shadow-[0_12px_28px_rgba(37,99,235,0.18)]"
      >
        +
      </div>
      <div class="text-center">
        <p class="text-sm font-semibold text-(--app-text-primary)">右键画布空白区域添加节点</p>
        <p class="mt-1 text-xs text-(--app-text-muted)">新的节点类型即将推出</p>
      </div>
    </div>

    <!-- 节点选择器 -->
    <FlowNodeSelector
      v-if="showSelector"
      :x="selectorPos.x"
      :y="selectorPos.y"
      @select="onSelectorSelect"
      @close="onSelectorClose"
    />
  </div>
</template>
