<script setup lang="ts">
import { useStatusBar } from '../composables/useStatusBar'
import { useEditorStore } from '../stores/editorStore'

const { statusText, cursorX, cursorY, zoomPercent, cameraDistance, lastShortcut } = useStatusBar()
const store = useEditorStore()
</script>

<template>
  <div class="status-bar">
    <span class="status-item">{{ statusText }}</span>
    <span class="status-spacer" />
    <span class="status-item">缩放距离: {{ cameraDistance.toFixed(0) }}</span>
    <span class="status-item">实体: {{ store.entities.length }}</span>
    <span class="status-item mobile-hidden">2D坐标:({{ cursorX.toFixed(2) }},{{ cursorY.toFixed(2) }})</span>
    <span class="status-item">缩放: {{ zoomPercent }}%</span>
    <span class="status-item">上次快捷键操作: {{ lastShortcut }}</span>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  height: 28px;
  font-size: 11px;
  color: #71717a;
  background: #18181b;
  border-top: 1px solid #27272a;
  flex-shrink: 0;
}
.status-spacer { flex: 1; }
.status-item { white-space: nowrap; }

@media (max-width: 1023px) {
  .mobile-hidden { display: none; }
}
</style>
