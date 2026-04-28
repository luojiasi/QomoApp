<script setup lang="ts">
import { ref, computed } from 'vue'
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
const connectingFrom = ref<string | null>(null)
const connectTarget = ref<{ x: number; y: number } | null>(null)
const dragNodeId = ref<string | null>(null)
const dragOffset = ref({ x: 0, y: 0 })

const nodes = computed(() => store.currentWorkflow?.nodes ?? [])

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

// 画布点击：取消选中、添加节点
function onCanvasClick(e: MouseEvent): void {
  if (showSelector.value) return
  const target = e.target as HTMLElement
  if (target === canvasRef.value || target.closest('.canvas-area')) {
    store.selectNode(null)
    showSelector.value = true
    selectorPos.value = { x: e.clientX, y: e.clientY }
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
  store.addNode(type)
  showSelector.value = false
}

function onSelectorClose(): void {
  showSelector.value = false
}

// 连线拖拽
function onStartConnect(nodeId: string): void {
  connectingFrom.value = nodeId
}

function onCanvasMouseMove(e: MouseEvent): void {
  if (connectingFrom.value && canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect()
    connectTarget.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  if (dragNodeId.value && canvasRef.value) {
    const x = e.clientX - dragOffset.value.x
    const y = e.clientY - dragOffset.value.y
    store.updateNodePosition(dragNodeId.value, x, y)
  }
}

function onCanvasMouseUp(e: MouseEvent): void {
  if (connectingFrom.value) {
    // 检查是否释放在某个节点上
    const target = (e.target as HTMLElement).closest('[data-node-id]')
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
}

// 节点拖拽
function onNodeMouseDown(nodeId: string, e: MouseEvent): void {
  if (store.isRunning) return
  const node = nodes.value.find((n) => n.id === nodeId)
  if (!node) return
  dragNodeId.value = nodeId
  dragOffset.value = {
    x: e.clientX - node.position.x,
    y: e.clientY - node.position.y
  }
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
    class="flow-canvas"
    :class="{ 'is-connecting': !!connectingFrom }"
    @click="onCanvasClick"
    @mousemove="onCanvasMouseMove"
    @mouseup="onCanvasMouseUp"
  >
    <!-- SVG 连线层 -->
    <svg class="flow-canvas-svg" :style="{ pointerEvents: 'none' }">
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
          class="edge-label"
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
        @start-connect="onStartConnect"
        @remove="onNodeRemove"
      />
    </div>

    <!-- 空状态 -->
    <div v-if="nodes.length === 0" class="flow-canvas-empty">
      <div class="empty-icon">+</div>
      <p class="empty-text">点击画布空白区域添加节点</p>
      <p class="empty-hint">或从左侧选择已有流程</p>
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
    <div v-if="connectingFrom" class="connect-hint">
      拖拽到目标节点上释放以建立连接
    </div>
  </div>
</template>

<style scoped>
.flow-canvas {
  position: relative;
  flex: 1;
  min-height: 400px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background:
    linear-gradient(45deg, var(--app-card-soft) 25%, transparent 25%),
    linear-gradient(-45deg, var(--app-card-soft) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--app-card-soft) 75%),
    linear-gradient(-45deg, transparent 75%, var(--app-card-soft) 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  cursor: default;
}
.flow-canvas.is-connecting {
  cursor: crosshair;
}
.flow-canvas-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}
.edge-label {
  fill: var(--app-text-muted);
  font-size: 10px;
  text-anchor: middle;
}
.flow-canvas-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 0;
}
.empty-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px dashed var(--app-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--app-text-muted);
}
.empty-text {
  font-size: 14px;
  color: var(--app-text-secondary);
}
.empty-hint {
  font-size: 12px;
  color: var(--app-text-muted);
}
.connect-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #2563eb;
  background: var(--app-card);
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid #2563eb;
  z-index: 50;
}
</style>
