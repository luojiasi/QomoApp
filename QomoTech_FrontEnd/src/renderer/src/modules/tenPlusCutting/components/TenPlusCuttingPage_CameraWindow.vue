<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import CameraPic from '@/modules/camera/CameraPic.vue'
import { useTenPlusPageUi } from '../composables/useTenPlusPageUi'
import {
  相机窗口底栏回退,
  相机窗口边距
} from '../constants/tenPlusCutting'
import TenPlusCuttingPage_CrosshairLines from './TenPlusCuttingPage_CrosshairLines.vue'
import TenPlusCuttingPage_CrosshairBar from './TenPlusCuttingPage_CrosshairBar.vue'

const props = defineProps<{
  docked?: boolean
}>()

const { cameraX, cameraY, crosshairBarVisible } = useTenPlusPageUi()

const rootRef = ref<HTMLElement | null>(null)

let dragging = false
let startX = 0
let startY = 0
let origX = 0
let origY = 0

function footerClearance(): number {
  const footer = document.querySelector('.tpc-footer')
  const footerH =
    footer instanceof HTMLElement
      ? footer.getBoundingClientRect().height
      : 相机窗口底栏回退
  return footerH + 相机窗口边距
}

function clampPos(nx: number, ny: number): { x: number; y: number } {
  const el = rootRef.value
  const w = el?.offsetWidth ?? 480
  const h = el?.offsetHeight ?? 360
  const maxX = Math.max(
    相机窗口边距,
    window.innerWidth - w - 相机窗口边距
  )
  const maxY = Math.max(相机窗口边距, window.innerHeight - h - footerClearance())
  return {
    x: Math.min(maxX, Math.max(相机窗口边距, nx)),
    y: Math.min(maxY, Math.max(相机窗口边距, ny))
  }
}

function applyPos(nx: number, ny: number): void {
  const next = clampPos(nx, ny)
  cameraX.value = next.x
  cameraY.value = next.y
}

function restoreOrPlace(): void {
  if (props.docked) return
  if (cameraX.value == null || cameraY.value == null) {
    const h = rootRef.value?.offsetHeight ?? 0
    applyPos(相机窗口边距, window.innerHeight - h - footerClearance())
    return
  }
  applyPos(cameraX.value, cameraY.value)
}

function onDragPointerDown(e: PointerEvent): void {
  if (props.docked || e.button !== 0) return
  dragging = true
  startX = e.clientX
  startY = e.clientY
  origX = cameraX.value ?? 相机窗口边距
  origY = cameraY.value ?? 相机窗口边距
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onDragPointerMove(e: PointerEvent): void {
  if (!dragging) return
  applyPos(origX + e.clientX - startX, origY + e.clientY - startY)
}

function onDragPointerUp(): void {
  dragging = false
}

function toggleCrosshairBar(): void {
  crosshairBarVisible.value = !crosshairBarVisible.value
}

watch(crosshairBarVisible, () => {
  void nextTick(restoreOrPlace)
})

watch(
  () => props.docked,
  (docked) => {
    if (!docked) void nextTick(restoreOrPlace)
  }
)

onMounted(() => {
  void nextTick(restoreOrPlace)
  window.addEventListener('resize', restoreOrPlace)
})

onUnmounted(() => {
  window.removeEventListener('resize', restoreOrPlace)
})
</script>

<template>
  <div
    ref="rootRef"
    class="tpc-cam-win"
    :class="{ docked }"
    role="dialog"
    aria-label="相机画面"
    :style="
      docked
        ? undefined
        : { left: `${cameraX ?? 相机窗口边距}px`, top: `${cameraY ?? 相机窗口边距}px` }
    "
  >
    <div
      class="tpc-cam-win-body"
      @pointerdown="onDragPointerDown"
      @pointermove="onDragPointerMove"
      @pointerup="onDragPointerUp"
      @pointercancel="onDragPointerUp"
    >
      <CameraPic object-fit="cover" />
      <TenPlusCuttingPage_CrosshairLines />
      <button
        type="button"
        class="tpc-cam-xh-toggle"
        :aria-pressed="crosshairBarVisible"
        :title="crosshairBarVisible ? '隐藏十字线调节' : '显示十字线调节'"
        @pointerdown.stop
        @click.stop="toggleCrosshairBar"
      >
        {{ crosshairBarVisible ? '完成' : '十字线' }}
      </button>
    </div>
    <TenPlusCuttingPage_CrosshairBar v-if="crosshairBarVisible" />
  </div>
</template>

<style scoped>
.tpc-cam-win {
  position: fixed;
  z-index: 80;
  width: min(480px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 0.5px solid color-mix(in srgb, #fff 55%, var(--app-border));
  border-radius: 14px;
  background: color-mix(in srgb, var(--app-card) 78%, transparent);
  box-shadow:
    0 0 0 0.5px color-mix(in srgb, #fff 28%, transparent) inset,
    0 12px 40px color-mix(in srgb, #000 18%, transparent);
  backdrop-filter: blur(28px) saturate(1.6);
  -webkit-backdrop-filter: blur(28px) saturate(1.6);
}
.tpc-cam-win-body {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #0b1220;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.tpc-cam-win-body:active {
  cursor: grabbing;
}
.tpc-cam-win.docked {
  position: relative;
  left: auto;
  top: auto;
  z-index: auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  background: #0b1220;
}
.tpc-cam-win.docked .tpc-cam-win-body {
  flex: 1;
  min-height: 0;
  aspect-ratio: auto;
  cursor: default;
}
.tpc-cam-win.docked .tpc-cam-win-body:active {
  cursor: default;
}
.tpc-cam-xh-toggle {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 2;
  padding: 4px 10px;
  border: 0;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 590;
  letter-spacing: -0.01em;
  color: #fff;
  background: color-mix(in srgb, #000 46%, transparent);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  cursor: pointer;
}
.tpc-cam-xh-toggle:hover {
  background: color-mix(in srgb, #000 58%, transparent);
}
.tpc-cam-xh-toggle[aria-pressed='true'] {
  background: color-mix(in srgb, var(--tpc-apple-blue, #007aff) 82%, transparent);
}
</style>
