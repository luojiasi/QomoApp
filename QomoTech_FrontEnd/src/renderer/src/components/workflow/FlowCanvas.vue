<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import type { WorkflowNode } from '../../types/selfProcessTypes'
import { useSelfProcessStore } from '../../stores/selfProcessStores'
import FlowNode from './FlowNode.vue'
import FlowNodeSelector from './FlowNodeSelector.vue'
import type { NodeType } from '../../types/selfProcessTypes'
import { NODE_WIDTH, NODE_HEIGHT } from '../../configs/selfProcessConfigs'

const store = useSelfProcessStore()

const canvasRef = ref<HTMLElement | null>(null)
const showSelector = ref(false)
const selectorPos = ref({ x: 0, y: 0 })
const newNodePos = ref<{ x: number; y: number } | null>(null)
const connectingFrom = ref<string | null>(null)
const connectTarget = ref<{ x: number; y: number } | null>(null)
const dragNodeId = ref<string | null>(null)
const dragOffset = ref({ x: 0, y: 0 })
const dragMoved = ref(false)

const nodes = computed(() => store.currentWorkflow?.nodes ?? [])

function startPointerTracking(): void {
  window.addEventListener('mousemove', onCanvasMouseMove)
  window.addEventListener('mouseup', onCanvasMouseUp)
}

function stopPointerTracking(): void {
  window.removeEventListener('mousemove', onCanvasMouseMove)
  window.removeEventListener('mouseup', onCanvasMouseUp)
}

onBeforeUnmount(() => {
  stopPointerTracking()
})

// 根据节点的 nextNodeId 构建连线
const edges = computed(() => {
  const result: Array<{ from: WorkflowNode; to: WorkflowNode }> = []
  const nodeMap = new Map(nodes.value.map((n) => [n.id, n]))
  for (const node of nodes.value) {
    if (node.nextNodeId) {
      const target = nodeMap.get(node.nextNodeId)
      if (target) result.push({ from: node, to: target })
    }
  }
  return result
})

// SVG 贝塞尔曲线路径
function edgePath(from: WorkflowNode, to: WorkflowNode): string {
  const x1 = from.position.x + NODE_WIDTH / 2
  const y1 = from.position.y + NODE_HEIGHT + 12
  const x2 = to.position.x + NODE_WIDTH / 2
  const y2 = to.position.y
  const mid = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`
}

// 画布左键点击：仅取消选中
function onCanvasClick(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (!canvasRef.value?.contains(target)) return
  if (target.closest('[data-node-id]')) return

  store.selectNode(null)
}

// 画布右键：打开节点选择器
function onCanvasContextMenu(e: MouseEvent): void {
  if (showSelector.value) return
  const target = e.target as HTMLElement
  if (!canvasRef.value?.contains(target)) return
  if (target.closest('[data-node-id]')) return
  const rect = canvasRef.value.getBoundingClientRect()
  store.selectNode(null)
  showSelector.value = true
  selectorPos.value = { x: e.clientX, y: e.clientY }
  newNodePos.value = {
    x: e.clientX - rect.left - NODE_WIDTH / 2,
    y: e.clientY - rect.top - NODE_HEIGHT / 2
  }
}

function onNodeSelect(nodeId: string): void {
  store.selectNode(nodeId)
  showSelector.value = false
}

function onNodeRemove(nodeId: string): void {
  store.removeNode(nodeId)
}

function onSelectorSelect(type: NodeType): void {
  const pos = newNodePos.value
  store.addNode(type, pos?.x, pos?.y)
  showSelector.value = false
  newNodePos.value = null
}

function onSelectorClose(): void {
  showSelector.value = false
}

// 连线拖拽
function onStartConnect(nodeId: string): void {
  connectingFrom.value = nodeId
  startPointerTracking()
}

function onCanvasMouseMove(e: MouseEvent): void {
  if (connectingFrom.value && canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect()
    connectTarget.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  if (dragNodeId.value && canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect()
    const x = e.clientX - rect.left - dragOffset.value.x
    const y = e.clientY - rect.top - dragOffset.value.y
    store.updateNodePosition(dragNodeId.value, x, y)
    dragMoved.value = true
  }
}

function onCanvasMouseUp(e: MouseEvent): void {
  if (connectingFrom.value) {
    // 检查是否释放在某个节点上
    const target = e.target instanceof Element ? e.target.closest('[data-node-id]') : null
    if (target) {
      const targetId = target.getAttribute('data-node-id')
      if (targetId && targetId !== connectingFrom.value) {
        store.connectNodes(connectingFrom.value, targetId)
      }
    }
    connectingFrom.value = null
    connectTarget.value = null
  }
  dragNodeId.value = null
  dragMoved.value = false
  stopPointerTracking()
}

// 节点拖拽
function onNodeMouseDown(nodeId: string, e: MouseEvent): void {
  if (store.isRunning || !canvasRef.value) return
  const node = nodes.value.find((n) => n.id === nodeId)
  if (!node) return
  const rect = canvasRef.value.getBoundingClientRect()
  dragNodeId.value = nodeId
  dragMoved.value = false
  dragOffset.value = {
    x: e.clientX - rect.left - node.position.x,
    y: e.clientY - rect.top - node.position.y
  }
  startPointerTracking()
}

// 节点之间的连线箭头
const svgEdges = computed(() => {
  return edges.value.map((e) => ({
    from: e.from,
    to: e.to,
    path: edgePath(e.from, e.to)
  }))
})
</script>

<template>
  <div
    ref="canvasRef"
    class="relative min-h-0 flex-1 cursor-default overflow-hidden rounded-2xl border border-(--app-border) bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.24)_1px,transparent_0)] bg-size-[22px_22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_12px_32px_rgba(0,0,0,0.18)]"
    :class="{ 'cursor-crosshair': !!connectingFrom }"
    @click="onCanvasClick"
    @contextmenu.prevent="onCanvasContextMenu"
    @mousemove="onCanvasMouseMove"
    @mouseup="onCanvasMouseUp"
  >
    <!-- SVG 连线层 -->
    <svg class="pointer-events-none absolute inset-0 z-1 h-full w-full">
      <defs>
        <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path fill="var(--app-text-muted)" d="M0,0 L8,4 L0,8 z" />
        </marker>
      </defs>

      <g v-for="edge in svgEdges" :key="`${edge.from.id}-${edge.to.id}`">
        <path
          :d="edge.path"
          fill="none"
          stroke="var(--app-text-muted)"
          stroke-width="1.5"
          marker-end="url(#flow-arrow)"
        />
        <text
          class="fill-(--app-text-muted) text-[10px] [text-anchor:middle]"
          :x="(edge.from.position.x + NODE_WIDTH / 2 + edge.to.position.x + NODE_WIDTH / 2) / 2"
          :y="(edge.from.position.y + NODE_HEIGHT + edge.to.position.y) / 2"
        >
          {{ edge.to.label }}
        </text>
      </g>

      <!-- 拖拽中的临时连线 -->
      <path
        v-if="connectingFrom && connectTarget"
        :d="`M ${(nodes.find(n => n.id === connectingFrom)?.position.x ?? 0) + NODE_WIDTH / 2} ${(nodes.find(n => n.id === connectingFrom)?.position.y ?? 0) + NODE_HEIGHT + 12} C ${(nodes.find(n => n.id === connectingFrom)?.position.x ?? 0) + NODE_WIDTH / 2} ${(connectTarget.y)}, ${connectTarget.x} ${connectTarget.y}, ${connectTarget.x} ${connectTarget.y}`"
        fill="none"
        stroke="#2563eb"
        stroke-width="2"
        stroke-dasharray="6,3"
      />
    </svg>

    <!-- 节点层 -->
    <div
      v-for="node in nodes"
      :key="node.id"
      :data-node-id="node.id"
      @mousedown="onNodeMouseDown(node.id, $event)"
    >
      <FlowNode
        :node="node"
        :is-selected="store.selectedNodeId === node.id"
        :is-running="store.isRunning"
        @select="onNodeSelect"
        @drag-start="onNodeMouseDown"
        @start-connect="onStartConnect"
        @remove="onNodeRemove"
      />
    </div>

    <!-- 空状态 -->
    <div
      v-if="nodes.length === 0"
      class="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.08),transparent_42%)]"
    >
      <div
        class="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/10 text-3xl text-blue-400 shadow-[0_12px_28px_rgba(37,99,235,0.18)]"
      >
        +
      </div>
      <div class="text-center">
        <p class="text-sm font-semibold text-(--app-text-primary)">右键画布空白区域添加节点</p>
        <p class="mt-1 text-xs text-(--app-text-muted)">添加任务、条件、延时或循环节点后开始编排流程</p>
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

    <!-- 连接提示 -->
    <div
      v-if="connectingFrom"
      class="absolute bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-blue-600 bg-(--app-card) px-3.5 py-1.5 text-xs text-blue-600"
    >
      拖拽到目标节点上释放以建立连接
    </div>
  </div>
</template>
