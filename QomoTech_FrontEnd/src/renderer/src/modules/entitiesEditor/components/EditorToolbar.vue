<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"
import { useShortcuts } from "@/modules/entitiesEditor/composables/useShortcuts"
import type { ToolMode } from "@/modules/entitiesEditor/commons/types"

const store = useEditorStore()
const { handleKeyDown } = useShortcuts()

const tools: { mode: ToolMode; label: string; key: string }[] = [
  { mode: 'SELECT', label: '选择', key: 'V' },
  { mode: 'DRAW_LINE', label: '线', key: 'L' },
  { mode: 'DRAW_ARC', label: '弧', key: 'A' },
  { mode: 'DRAW_BEZIER', label: '贝塞尔', key: 'B' },
  { mode: 'PAN', label: '平移', key: 'H' },
]

const canUndo = computed(() => store.undoStack.length > 0)
const canRedo = computed(() => store.redoStack.length > 0)

defineExpose({ handleKeyDown })
</script>

<template>
  <div class="toolbar">
    <div class="tool-group">
      <button
        v-for="t in tools"
        :key="t.mode"
        class="tool-btn"
        :class="{ active: store.activeTool === t.mode }"
        @click="store.setTool(t.mode)"
        :title="`${t.label} (${t.key})`"
      >
        {{ t.label }}
      </button>
    </div>
    <div class="tool-divider" />
    <div class="tool-group">
      <button class="tool-btn" :disabled="!canUndo" @click="store.undo()" title="撤销 (Ctrl+Z)">↩</button>
      <button class="tool-btn" :disabled="!canRedo" @click="store.redo()" title="重做 (Ctrl+Y)">↪</button>
      <button class="tool-btn" @click="store.deleteSelected()" title="删除 (Del)">🗑</button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: #18181b;
  border-bottom: 1px solid #27272a;
}
.tool-group { display: flex; gap: 2px; }
.tool-divider {
  width: 1px;
  height: 24px;
  background: #3f3f46;
  margin: 0 6px;
}
.tool-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
}
.tool-btn:hover { background: #27272a; color: #e4e4e7; }
.tool-btn.active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}
.tool-btn:disabled { opacity: 0.35; cursor: default; }
</style>
