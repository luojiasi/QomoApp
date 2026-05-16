<script setup lang="ts">
import type { TabItem } from './types'

defineProps<{
  tabs: TabItem[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string]
}>()
</script>

<template>
  <div class="switchable-view">
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: modelValue === tab.id }"
        @click="emit('update:modelValue', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="tab-content">
      <slot :activeTab="modelValue" />
    </div>
  </div>
</template>

<style scoped>
.switchable-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0d0d10;
  border-left: 1px solid #27272a;
}
.tab-bar {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid #27272a;
}
.tab-btn {
  flex: 1;
  padding: 8px 0;
  font-size: 12px;
  font-weight: 500;
  background: none;
  border: none;
  color: #71717a;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.tab-btn:hover { color: #a1a1aa; }
.tab-btn.active {
  color: #e4e4e7;
  border-bottom-color: #3b82f6;
}
.tab-content {
  flex: 1;
  overflow: hidden;
}
</style>
