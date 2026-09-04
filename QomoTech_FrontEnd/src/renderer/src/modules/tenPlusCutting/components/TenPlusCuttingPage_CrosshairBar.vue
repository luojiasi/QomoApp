<script setup lang="ts">
import { useTenPlusUrCrosshair } from '../composables/useTenPlusUrCrosshair'
import {
  TEN_PLUS_UR_CROSSHAIR_WIDTH_MAX,
  TEN_PLUS_UR_CROSSHAIR_WIDTH_MIN
} from '../constants/tenPlusCutting'

const { settings: crosshair, resetCrosshair } = useTenPlusUrCrosshair()
</script>

<template>
  <div class="tpc-xh-bar">
    <span class="tpc-xh-label">十字线</span>
    <label class="tpc-xh-item" title="横线颜色与宽度">
      <span>横</span>
      <input v-model="crosshair.hColor" type="color" />
      <input
        v-model.number="crosshair.hWidth"
        type="range"
        :min="TEN_PLUS_UR_CROSSHAIR_WIDTH_MIN"
        :max="TEN_PLUS_UR_CROSSHAIR_WIDTH_MAX"
        step="0.5"
      />
      <span class="tpc-xh-w">{{ crosshair.hWidth }}</span>
    </label>
    <label class="tpc-xh-item" title="竖线颜色与宽度">
      <span>竖</span>
      <input v-model="crosshair.vColor" type="color" />
      <input
        v-model.number="crosshair.vWidth"
        type="range"
        :min="TEN_PLUS_UR_CROSSHAIR_WIDTH_MIN"
        :max="TEN_PLUS_UR_CROSSHAIR_WIDTH_MAX"
        step="0.5"
      />
      <span class="tpc-xh-w">{{ crosshair.vWidth }}</span>
    </label>
    <button type="button" class="tpc-xh-reset" @click="resetCrosshair">复位</button>
  </div>
</template>

<style scoped>
.tpc-xh-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  flex-shrink: 0;
  padding: 7px 10px;
  border-top: 0.5px solid color-mix(in srgb, #fff 40%, var(--app-border));
  background: color-mix(in srgb, var(--app-card) 45%, transparent);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
}
.tpc-xh-label {
  font-size: 11px;
  font-weight: 590;
  letter-spacing: -0.01em;
  color: var(--app-text-primary);
}
.tpc-xh-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11px;
  color: var(--app-text-secondary);
}
.tpc-xh-item input[type='color'] {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0.5px solid color-mix(in srgb, #fff 40%, var(--app-border));
  border-radius: 6px;
  background: var(--app-input-bg);
  cursor: pointer;
}
.tpc-xh-item input[type='range'] {
  width: 64px;
  accent-color: var(--tpc-apple-blue, #007aff);
}
.tpc-xh-w {
  min-width: 1.6em;
  font-variant-numeric: tabular-nums;
  color: var(--app-text-primary);
}
.tpc-xh-reset {
  margin-left: auto;
  padding: 3px 9px;
  border: 0;
  border-radius: 7px;
  background: color-mix(in srgb, var(--app-text-primary) 6%, transparent);
  color: var(--tpc-apple-blue, #007aff);
  font-size: 11px;
  font-weight: 590;
  cursor: pointer;
}
.tpc-xh-reset:hover {
  background: color-mix(in srgb, var(--tpc-apple-blue, #007aff) 12%, transparent);
  color: var(--tpc-apple-blue, #007aff);
}
</style>
