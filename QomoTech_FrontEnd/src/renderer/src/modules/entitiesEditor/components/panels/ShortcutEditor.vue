<script setup lang="ts">
import type { ActionDef } from '../../shares/types'

defineProps<{
  actions: ActionDef[]
  capturing: string | null
}>()

const emit = defineEmits<{
  'start-capture': [id: string]
  'cancel-capture': []
  'reset': [id: string]
}>()

function formatShortcut(a: ActionDef): string {
  const parts: string[] = []
  if (a.ctrl) parts.push('Ctrl')
  if (a.shift) parts.push('Shift')
  if (a.alt) parts.push('Alt')
  if (a.key) parts.push(a.key.length === 1 ? a.key.toUpperCase() : a.key)
  return parts.join('+') || '未设置'
}
</script>

<template>
  <div class="shortcut-editor">
    <div class="se-header">
      <span class="se-title">快捷键设置</span>
      <span class="se-hint">点击快捷键格子，然后按下新组合键进行修改</span>
    </div>
    <div class="se-list">
      <div
        v-for="a in actions"
        :key="a.id"
        class="se-row"
        :class="{ capturing: capturing === a.id }"
      >
        <span class="se-label">{{ a.label }}</span>
        <button
          class="se-key-cell"
          :class="{ active: capturing === a.id }"
          @click="emit('start-capture', a.id)"
        >
          <template v-if="capturing === a.id">按下新组合键…</template>
          <template v-else>{{ formatShortcut(a) }}</template>
        </button>
        <button
          v-if="capturing !== a.id"
          class="se-reset-btn"
          title="恢复默认"
          @click="emit('reset', a.id)"
        >↺</button>
        <button
          v-else
          class="se-reset-btn"
          title="取消"
          @click="emit('cancel-capture')"
        >✕</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shortcut-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #d4d4d8;
}
.se-header {
  padding: 12px 14px 8px;
  flex-shrink: 0;
}
.se-title { font-size: 14px; font-weight: 600; }
.se-hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #52525b;
}
.se-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px;
}
.se-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 4px;
  border-bottom: 1px solid #1f1f23;
  transition: background 0.15s;
}
.se-row:hover { background: #1a1a20; }
.se-row.capturing { background: #1a1f2e; }
.se-label {
  flex: 1;
  font-size: 13px;
  color: #a1a1aa;
}
.se-key-cell {
  min-width: 110px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #e4e4e7;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;
}
.se-key-cell:hover { border-color: #52525b; }
.se-key-cell.active {
  border-color: #3b82f6;
  color: #3b82f6;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.se-reset-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  background: none;
  border: none;
  color: #52525b;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
}
.se-reset-btn:hover { color: #e4e4e7; background: #27272a; }
</style>
