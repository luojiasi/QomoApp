<script setup lang="ts">
import { useTenPlusUrCrosshair } from '../composables/useTenPlusUrCrosshair'

const { settings: crosshair } = useTenPlusUrCrosshair()
</script>

<template>
  <svg class="tpc-xh-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
    <line
      x1="0"
      y1="50"
      x2="100"
      y2="50"
      :stroke="crosshair.hColor"
      :stroke-width="crosshair.hWidth"
      vector-effect="non-scaling-stroke"
    />
    <line
      x1="50"
      y1="0"
      x2="50"
      y2="100"
      :stroke="crosshair.vColor"
      :stroke-width="crosshair.vWidth"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style scoped>
.tpc-xh-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
