<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useCanvas2D } from '@/modules/entitiesEditor/composables/canvas/useCanvas2D'

const { canvasRef, setup, cleanup, reloadConfig } = useCanvas2D()

onMounted(() => setup())
onUnmounted(() => cleanup())

defineExpose({ reloadConfig })
</script>

<template>
  <div class="canvas-2d">
    <canvas ref="canvasRef" class="canvas-surface" />
  </div>
</template>

<style scoped>
.canvas-2d {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #0f1117;
}

.canvas-surface {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}
</style>
