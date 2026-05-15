<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"

const store = useEditorStore()

const entityInfo = computed(() => {
  const total = store.entities.length
  const sel = store.selectedIds.length
  return sel > 0 ? `${sel} / ${total} 选中` : `${total} 实体`
})

const zoomPercent = computed(() => `${Math.round(store.viewport.zoom * 100)}%`)
const toolName = computed(() => store.activeTool)
const dirtyFlag = computed(() => (store.dirtyEntityIds.length > 0 ? ' ●' : ''))
</script>

<template>
  <div class="status-bar">
    <span class="status-item">{{ entityInfo }}</span>
    <span class="status-item">工具: {{ toolName }}</span>
    <span class="status-item">缩放: {{ zoomPercent }}</span>
    <span class="status-item dirty" v-if="dirtyFlag">未保存</span>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 4px 12px;
  font-size: 12px;
  color: #71717a;
  background: #18181b;
  border-top: 1px solid #27272a;
}
.dirty { color: #fbbf24; }
</style>
