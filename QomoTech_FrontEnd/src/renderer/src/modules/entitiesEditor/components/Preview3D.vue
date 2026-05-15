<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useThreeScene } from "@/modules/entitiesEditor/composables/useThreeScene"

const { init, resize, dispose } = useThreeScene()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let observer: ResizeObserver | null = null

onMounted(() => {
  if (!canvasRef.value) return
  init(canvasRef.value)

  observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) resize(width, height)
    }
  })
  observer.observe(canvasRef.value.parentElement ?? canvasRef.value)
})

onUnmounted(() => {
  observer?.disconnect()
  dispose()
})
</script>

<template>
  <div class="preview-3d">
    <canvas ref="canvasRef" class="three-canvas" />
  </div>
</template>

<style scoped>
.preview-3d {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.three-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
