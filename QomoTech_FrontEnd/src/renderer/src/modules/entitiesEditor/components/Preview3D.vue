<script setup lang="ts">
import { usePreview3D } from '../composables/usePreview3D'

const {} = usePreview3D()
</script>

<template>
  <div class="preview-3d">
    <div class="placeholder">
      <span class="placeholder-icon">◈</span>
      <span class="placeholder-text">3D Preview</span>
    </div>
  </div>
</template>

<style scoped>
.preview-3d {
  width: 100%;
  height: 100%;
  background: #0a0a10;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #27272a;
}
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0.35;
}
.placeholder-icon { font-size: 32px; color: #3b82f6; }
.placeholder-text { font-size: 13px; color: #71717a; letter-spacing: 1px; text-transform: uppercase; }
</style>
