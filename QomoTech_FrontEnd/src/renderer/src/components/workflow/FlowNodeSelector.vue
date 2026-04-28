<script setup lang="ts">
import type { NodeType } from '../../types/selfProcessTypes'
import { NODE_TYPE_META } from '../../configs/selfProcessConfigs'

const props = defineProps<{
  x: number
  y: number
}>()

const emit = defineEmits<{
  select: [type: NodeType]
  close: []
}>()

const nodeTypes: NodeType[] = ['task', 'condition', 'delay', 'loop']

function onSelect(type: NodeType): void {
  emit('select', type)
}

function onBackdropClick(): void {
  emit('close')
}
</script>

<template>
  <div class="node-selector-backdrop" @click="onBackdropClick"></div>
  <div
    class="node-selector-popover"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <div class="selector-header">选择节点类型</div>
    <div class="selector-list">
      <button
        v-for="nt in nodeTypes"
        :key="nt"
        class="selector-item"
        @click="onSelect(nt)"
      >
        <span class="selector-icon" :style="{ background: NODE_TYPE_META[nt].color + '20' }">
          {{ NODE_TYPE_META[nt].icon }}
        </span>
        <div class="selector-info">
          <span class="selector-name">{{ NODE_TYPE_META[nt].label }}</span>
          <span class="selector-desc">{{ NODE_TYPE_META[nt].description }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.node-selector-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
}
.node-selector-popover {
  position: fixed;
  z-index: 110;
  width: 240px;
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  overflow: hidden;
}
.selector-header {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  border-bottom: 1px solid var(--app-border);
}
.selector-list {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.selector-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}
.selector-item:hover {
  background: var(--app-card-soft);
}
.selector-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.selector-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.selector-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
}
.selector-desc {
  font-size: 11px;
  color: var(--app-text-muted);
  line-height: 1.3;
}
</style>
