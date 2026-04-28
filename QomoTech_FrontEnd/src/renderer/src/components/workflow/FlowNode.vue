<script setup lang="ts">
import type { WorkflowNode } from '../../types/selfProcessTypes'
import { NODE_TYPE_META, NODE_STATUS_COLOR, NODE_WIDTH } from '../../configs/selfProcessConfigs'
import { computed } from 'vue'

const props = defineProps<{
  node: WorkflowNode
  isSelected: boolean
  isRunning: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  startConnect: [id: string]
  remove: [id: string]
}>()

const meta = computed(() => NODE_TYPE_META[props.node.type])
const statusColor = computed(() => NODE_STATUS_COLOR[props.node.runStatus] ?? '#94a3b8')
const borderColor = computed(() => {
  if (props.isSelected) return '#2563eb'
  if (props.node.runStatus === 'running') return '#2563eb'
  if (props.node.runStatus === 'success') return '#16a34a'
  if (props.node.runStatus === 'failed') return '#dc2626'
  return meta.value.color
})

const statusLabel: Record<string, string> = {
  idle: '空闲',
  running: '运行中',
  success: '成功',
  failed: '失败',
  skipped: '跳过'
}

function onMousedown(e: MouseEvent): void {
  if (props.isRunning) return
  emit('select', props.node.id)
  e.stopPropagation()
}

function onConnectClick(e: MouseEvent): void {
  e.stopPropagation()
  if (!props.isRunning) emit('startConnect', props.node.id)
}
</script>

<template>
  <div
    class="flow-node"
    :class="{ 'is-running': node.runStatus === 'running' }"
    :style="{
      left: node.position.x + 'px',
      top: node.position.y + 'px',
      width: NODE_WIDTH + 'px',
      borderColor: borderColor,
      boxShadow: isSelected ? '0 0 0 2px rgba(37,99,235,0.3)' : undefined
    }"
    @mousedown.prevent="onMousedown"
  >
    <div class="flow-node-header" :style="{ background: meta.color + '18' }">
      <span class="flow-node-icon">{{ meta.icon }}</span>
      <span class="flow-node-type">{{ meta.label }}</span>
      <button
        v-if="!isRunning"
        class="flow-node-delete"
        @mousedown.stop
        @click="emit('remove', node.id)"
        title="删除节点"
      >×</button>
    </div>

    <div class="flow-node-body">
      <span class="flow-node-label">{{ node.label }}</span>
    </div>

    <div class="flow-node-footer">
      <span class="flow-node-status" :style="{ color: statusColor }">
        ● {{ statusLabel[node.runStatus] ?? '空闲' }}
      </span>
    </div>

    <!-- 输出连接点 -->
    <div
      class="flow-node-connector output"
      :class="{ 'is-connecting': isRunning }"
      @mousedown="onConnectClick"
      title="拖拽连接下一个节点"
    >
      <div class="connector-dot" :style="{ background: meta.color }"></div>
    </div>

    <!-- 输入连接点 -->
    <div class="flow-node-connector input">
      <div class="connector-dot" :style="{ background: meta.color }"></div>
    </div>
  </div>
</template>

<style scoped>
.flow-node {
  position: absolute;
  background: var(--app-card);
  border: 2px solid;
  border-radius: 12px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
  user-select: none;
  overflow: visible;
  z-index: 10;
}
.flow-node:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.flow-node.is-running {
  animation: node-pulse 1.5s ease-in-out infinite;
}
@keyframes node-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0.3); }
  50% { box-shadow: 0 0 0 8px rgba(37,99,235,0); }
}

.flow-node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 10px 10px 0 0;
  font-size: 12px;
  font-weight: 600;
}
.flow-node-icon { font-size: 14px; }
.flow-node-type { flex: 1; }
.flow-node-delete {
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  border-radius: 4px;
}
.flow-node-delete:hover {
  background: rgba(220,38,38,0.1);
  color: #dc2626;
}

.flow-node-body {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--app-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.flow-node-footer {
  padding: 4px 12px 6px;
  font-size: 11px;
}

.flow-node-connector {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}
.flow-node-connector.output {
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  cursor: crosshair;
}
.flow-node-connector.input {
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
}
.connector-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--app-card);
  box-shadow: 0 0 0 1px var(--app-border);
}
.flow-node-connector.is-connecting {
  cursor: default;
}
</style>
