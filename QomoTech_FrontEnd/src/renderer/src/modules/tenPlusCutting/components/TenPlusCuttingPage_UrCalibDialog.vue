<script setup lang="ts">
import { onUnmounted, provide, toRef } from 'vue'
import AxisCenterCalibPanel from '@/modules/motion/components/AxisCenterCalibPanel.vue'
import CameraPic from '@/modules/camera/CameraPic.vue'
import { useMotionKeyboard } from '@/modules/motion/composables/useMotionKeyboard'
import { useTenPlusAxisCenterCalib } from '../composables/useTenPlusAxisCenterCalib'

const props = defineProps<{
  slotIndex: number
}>()

const emit = defineEmits<{
  close: []
}>()

const axisCalib = useTenPlusAxisCenterCalib(toRef(props, 'slotIndex'))
provide('axisCalib', axisCalib)
const { abortAxisCenterCalib } = axisCalib
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
              <line x1="0" y1="50" x2="100" y2="50" />
              <line x1="50" y1="0" x2="50" y2="100" />
            </svg>
          </div>
          <div class="tpc-ur-keys">
            <p class="tpc-ur-keys-title">键盘点动（先点相机画面，避免焦点在输入框）</p>
            <ul>
              <li><kbd>← →</kbd> X　<kbd>↑ ↓</kbd> Y　<kbd>PgUp PgDn</kbd> Z</li>
              <li><kbd>Ctrl</kbd>+<kbd>↑ ↓</kbd> U　<kbd>Ctrl</kbd>+<kbd>← →</kbd> R</li>
              <li><kbd>F1</kbd>–<kbd>F4</kbd> 步长　<kbd>R</kbd> 点射　<kbd>W</kbd> 灯光</li>
            </ul>
          </div>
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
.tpc-ur-crosshair line {
  stroke: rgba(248, 113, 113, 0.55);
  stroke-width: 0.4;
  vector-effect: non-scaling-stroke;
}
.tpc-ur-crosshair line:last-child {
  stroke: rgba(96, 165, 250, 0.55);
}
.tpc-ur-keys {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 1.55;
  color: var(--app-text-secondary);
}
.tpc-ur-keys-title {
  margin: 0 0 4px;
  color: var(--app-text-primary);
}
.tpc-ur-keys ul {
  margin: 0;
  padding-left: 0;
  list-style: none;
}
.tpc-ur-keys kbd {
  display: inline-block;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-card-soft);
  color: var(--app-text-primary);
  font-size: 10px;
}
.tpc-ur-panel {
  min-height: 0;
  overflow: auto;
  color: var(--app-text-primary);
}
</style>
