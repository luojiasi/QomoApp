<script setup lang="ts">
import { usePreview3D } from '../composables/preview/usePreview3D'

const { containerRef, reloadConfig, applyConfig } = usePreview3D()
void containerRef

defineExpose({ reloadConfig, applyConfig })
</script>

<template>
  <div ref="containerRef" class="preview-3d" />
</template>

<style scoped>
.preview-3d {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
