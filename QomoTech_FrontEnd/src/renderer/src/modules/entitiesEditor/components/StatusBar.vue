<script setup lang="ts">
import { useStatusBar } from '../composables/useStatusBar'

const { statusText, cursorX, cursorY, zoomPercent } = useStatusBar()
</script>

<template>
  <div class="status-bar">
    <span class="status-item">{{ statusText }}</span>
    <span class="status-spacer" />
    <span class="status-item mobile-hidden">X: {{ cursorX.toFixed(2) }} Y: {{ cursorY.toFixed(2) }}</span>
    <span class="status-item">缩放: {{ zoomPercent }}%</span>
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
