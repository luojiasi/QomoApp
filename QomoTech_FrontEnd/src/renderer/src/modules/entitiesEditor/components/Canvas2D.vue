<script setup lang="ts">
import { onMounted, onUnmounted, provide } from 'vue'
import { useCanvas2D } from '@/modules/entitiesEditor/composables/canvas/useCanvas2D'
import DrawParamerBar from './panels/DrawParamerBar.vue'

const canvas2D = useCanvas2D()
const { setup, cleanup, reloadConfig, drawInteraction } = canvas2D
const canvasRef = canvas2D.canvasRef

provide('drawInteraction', drawInteraction)

onMounted(() => setup())
onUnmounted(() => cleanup())

defineExpose({ canvasRef, reloadConfig })
</script>

<template>
  <div class="canvas-2d">
    <DrawParamerBar />
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
