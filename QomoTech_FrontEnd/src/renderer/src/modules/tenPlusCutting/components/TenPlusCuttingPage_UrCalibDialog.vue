<script setup lang="ts">
import { onUnmounted, provide, toRef } from 'vue'
import AxisCenterCalibPanel from '@/modules/motion/components/AxisCenterCalibPanel.vue'
import CameraPic from '@/modules/camera/CameraPic.vue'
import { useMotionKeyboard } from '@/modules/motion/composables/useMotionKeyboard'
import { useTenPlusAxisCenterCalib } from '../composables/useTenPlusAxisCenterCalib'
import { useTenPlusUrCrosshair } from '../composables/useTenPlusUrCrosshair'
import {
  TEN_PLUS_UR_CROSSHAIR_WIDTH_MAX,
  TEN_PLUS_UR_CROSSHAIR_WIDTH_MIN
} from '../constants/tenPlusCutting'

const props = defineProps<{
  slotIndex: number
}>()

const emit = defineEmits<{
  close: []
}>()

const axisCalib = useTenPlusAxisCenterCalib(toRef(props, 'slotIndex'))
provide('axisCalib', axisCalib)
const { abortAxisCenterCalib } = axisCalib
const { settings: crosshair, resetCrosshair } = useTenPlusUrCrosshair()
useMotionKeyboard()

function tryClose(): void {
  abortAxisCenterCalib()
  emit('close')
}

onUnmounted(() => {
  abortAxisCenterCalib()
})
</script>

<template>
  <div class="tpc-ur-overlay" @click.self="tryClose">
    <div class="tpc-ur-card" role="dialog" aria-modal="true">
      <div class="tpc-ur-head">
        <span>工位 #{{ slotIndex }} UR补偿校准</span>
        <button
          type="button"
          class="tpc-ur-close"
          @click="tryClose"
        >
          关闭
        </button>
      </div>
      <div class="tpc-ur-body">
        <aside class="tpc-ur-cam">
          <div class="tpc-ur-cam-view" tabindex="0" title="点击画面后可用方向键点动">
            <CameraPic object-fit="cover" />
            <svg class="tpc-ur-crosshair" viewBox="0 0 100 100" preserveAspectRatio="none">
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
          </div>
          <div class="tpc-ur-hair-bar">
            <span class="tpc-ur-hair-label">十字线</span>
            <label class="tpc-ur-hair-item" title="横线颜色与宽度">
              <span>横</span>
              <input v-model="crosshair.hColor" type="color" />
              <input
                v-model.number="crosshair.hWidth"
                type="range"
                :min="TEN_PLUS_UR_CROSSHAIR_WIDTH_MIN"
                :max="TEN_PLUS_UR_CROSSHAIR_WIDTH_MAX"
                step="0.5"
              />
              <span class="tpc-ur-hair-w">{{ crosshair.hWidth }}</span>
            </label>
            <label class="tpc-ur-hair-item" title="竖线颜色与宽度">
              <span>竖</span>
              <input v-model="crosshair.vColor" type="color" />
              <input
                v-model.number="crosshair.vWidth"
                type="range"
                :min="TEN_PLUS_UR_CROSSHAIR_WIDTH_MIN"
                :max="TEN_PLUS_UR_CROSSHAIR_WIDTH_MAX"
                step="0.5"
              />
              <span class="tpc-ur-hair-w">{{ crosshair.vWidth }}</span>
            </label>
            <button type="button" class="tpc-ur-hair-reset" @click="resetCrosshair">复位</button>
          </div>
          <section class="tpc-ur-keys">
            <header class="tpc-ur-keys-head">
              <span class="tpc-ur-keys-title">键盘点动</span>
              <span class="tpc-ur-keys-hint">先点相机画面，避免焦点在输入框</span>
            </header>
            <div class="tpc-ur-key-grid">
              <div class="tpc-ur-key-cell axis-x">
                <span class="tpc-ur-kbds"><kbd>←</kbd><kbd>→</kbd></span>
                <span class="tpc-ur-key-name">X</span>
              </div>
              <div class="tpc-ur-key-cell axis-y">
                <span class="tpc-ur-kbds"><kbd>↑</kbd><kbd>↓</kbd></span>
                <span class="tpc-ur-key-name">Y</span>
              </div>
              <div class="tpc-ur-key-cell axis-z">
                <span class="tpc-ur-kbds"><kbd>PgUp</kbd><kbd>PgDn</kbd></span>
                <span class="tpc-ur-key-name">Z</span>
              </div>
              <div class="tpc-ur-key-cell axis-u">
                <span class="tpc-ur-kbds"><kbd>Ctrl</kbd><span>+</span><kbd>↑</kbd><kbd>↓</kbd></span>
                <span class="tpc-ur-key-name">U</span>
              </div>
              <div class="tpc-ur-key-cell axis-r">
                <span class="tpc-ur-kbds"><kbd>Ctrl</kbd><span>+</span><kbd>←</kbd><kbd>→</kbd></span>
                <span class="tpc-ur-key-name">R</span>
              </div>
              <div class="tpc-ur-key-cell axis-step">
                <span class="tpc-ur-kbds"><kbd>F1</kbd><span>–</span><kbd>F4</kbd></span>
                <span class="tpc-ur-key-name">步长</span>
              </div>
              <div class="tpc-ur-key-cell axis-shot">
                <span class="tpc-ur-kbds"><kbd>R</kbd></span>
                <span class="tpc-ur-key-name">点射</span>
              </div>
              <div class="tpc-ur-key-cell axis-light">
                <span class="tpc-ur-kbds"><kbd>W</kbd></span>
                <span class="tpc-ur-key-name">灯光</span>
              </div>
            </div>
          </section>
        </aside>
        <div class="tpc-ur-panel">
          <AxisCenterCalibPanel />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tpc-ur-overlay {
  position: fixed;
  inset: 0;
  z-index: 220;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--app-text-primary) 35%, transparent);
}
.tpc-ur-card {
  width: min(1280px, 96vw);
  height: min(88vh, 900px);
  display: flex;
  flex-direction: column;
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  color: var(--app-text-primary);
  box-shadow: 0 16px 48px color-mix(in srgb, var(--app-text-primary) 18%, transparent);
}
.tpc-ur-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
  border-bottom: 1px solid var(--app-border);
  flex-shrink: 0;
}
.tpc-ur-close {
  border: 1px solid var(--app-border);
  background: var(--app-card-soft);
  color: var(--app-text-primary);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.tpc-ur-close:hover {
  border-color: #0ea5e9;
}
.tpc-ur-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tpc-ur-body {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.2fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
  padding: 12px 16px 16px;
}
.tpc-ur-cam {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.tpc-ur-cam-view {
  position: relative;
  flex: 1;
  min-height: 220px;
  overflow: hidden;
  border-radius: 8px;
  background: #0b1220;
  outline: none;
}
.tpc-ur-cam-view:focus {
  box-shadow: 0 0 0 1px #0ea5e9;
}
.tpc-ur-crosshair {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.tpc-ur-hair-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  flex-shrink: 0;
  padding: 6px 8px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-card-soft);
}
.tpc-ur-hair-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--app-text-primary);
}
.tpc-ur-hair-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11px;
  color: var(--app-text-secondary);
}
.tpc-ur-hair-item input[type='color'] {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-input-bg);
  cursor: pointer;
}
.tpc-ur-hair-item input[type='range'] {
  width: 72px;
  accent-color: #0ea5e9;
}
.tpc-ur-hair-w {
  min-width: 1.6em;
  font-variant-numeric: tabular-nums;
  color: var(--app-text-primary);
}
.tpc-ur-hair-reset {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-card);
  color: var(--app-text-secondary);
  font-size: 11px;
  cursor: pointer;
}
.tpc-ur-hair-reset:hover {
  border-color: #0ea5e9;
  color: var(--app-text-primary);
}
.tpc-ur-keys {
  flex-shrink: 0;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-card);
}
.tpc-ur-keys-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.tpc-ur-keys-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--app-text-primary);
}
.tpc-ur-keys-hint {
  min-width: 0;
  font-size: 10px;
  color: var(--app-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tpc-ur-key-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}
.tpc-ur-key-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  grid-column: span 2;
  min-height: 52px;
  padding: 6px 4px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-input-bg);
}
.tpc-ur-key-cell.axis-shot,
.tpc-ur-key-cell.axis-light {
  grid-column: span 3;
}
.tpc-ur-kbds {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 3px;
}
.tpc-ur-kbds span {
  font-size: 10px;
  color: var(--app-text-muted);
}
.tpc-ur-keys kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: color-mix(in srgb, var(--app-card) 70%, #000);
  color: var(--app-text-primary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--app-text-primary) 8%, transparent);
}
.tpc-ur-key-name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
}
.tpc-ur-key-cell.axis-x .tpc-ur-key-name { color: #d97706; }
.tpc-ur-key-cell.axis-y .tpc-ur-key-name { color: #16a34a; }
.tpc-ur-key-cell.axis-z .tpc-ur-key-name { color: #2563eb; }
.tpc-ur-key-cell.axis-u {
  border-color: color-mix(in srgb, #0ea5e9 35%, var(--app-border));
}
.tpc-ur-key-cell.axis-u .tpc-ur-key-name { color: #0ea5e9; }
.tpc-ur-key-cell.axis-r {
  border-color: color-mix(in srgb, #f59e0b 40%, var(--app-border));
}
.tpc-ur-key-cell.axis-r .tpc-ur-key-name { color: #f59e0b; }
.tpc-ur-key-cell.axis-step .tpc-ur-key-name,
.tpc-ur-key-cell.axis-shot .tpc-ur-key-name,
.tpc-ur-key-cell.axis-light .tpc-ur-key-name {
  color: var(--app-text-secondary);
  letter-spacing: 0.04em;
  font-weight: 600;
}
.tpc-ur-panel {
  min-height: 0;
  overflow: auto;
  color: var(--app-text-primary);
}
</style>
