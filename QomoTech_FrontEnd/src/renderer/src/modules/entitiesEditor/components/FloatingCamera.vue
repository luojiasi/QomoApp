<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import CameraPic from '@/modules/camera/CameraPic.vue'

const emit = defineEmits<{ close: [] }>()

const ASPECT = 4 / 3
const MIN_W = 200
const MAX_W = 800

// ── 位置 & 拖拽 ──
const x = ref(100)
const y = ref(100)

const dragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const posStartX = ref(0)
const posStartY = ref(0)

function onHeaderMouseDown(e: MouseEvent) {
  dragging.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  posStartX.value = x.value
  posStartY.value = y.value
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  x.value = posStartX.value + (e.clientX - dragStartX.value)
  y.value = posStartY.value + (e.clientY - dragStartY.value)
}

function onMouseUp() {
  dragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

// ── 等比缩放 ──
const w = ref(320)
const h = computed(() => w.value / ASPECT)

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const resizing = ref<ResizeDir | null>(null)
const resizeStartW = ref(0)
const resizeStartX = ref(0)
const resizeStartY = ref(0)
const resizeStartLeft = ref(0)
const resizeStartTop = ref(0)

function onResizeMouseDown(e: MouseEvent, dir: ResizeDir) {
  e.preventDefault()
  e.stopPropagation()
  resizing.value = dir
  resizeStartW.value = w.value
  resizeStartX.value = e.clientX
  resizeStartY.value = e.clientY
  resizeStartLeft.value = x.value
  resizeStartTop.value = y.value
  document.addEventListener('mousemove', onResizeMouseMove)
  document.addEventListener('mouseup', onResizeMouseUp)
}

function onResizeMouseMove(e: MouseEvent) {
  if (!resizing.value) return
  const dx = e.clientX - resizeStartX.value
  const dy = e.clientY - resizeStartY.value
  const dir = resizing.value

  let newW = resizeStartW.value
  let newX = resizeStartLeft.value
  let newY = resizeStartTop.value

  // 根据方向计算新宽度：水平移动分量映射为宽度变化
  if (dir.includes('e')) {
    newW = resizeStartW.value + dx
  } else if (dir.includes('w')) {
    newW = resizeStartW.value - dx
    newX = resizeStartLeft.value + dx
  }

  // 垂直分量：宽度为基准做等比，垂直移动影响高度 → 反推宽度
  if (dir === 'n' || dir === 's') {
    // 纯垂直边：用 dy 推算等比宽度变化
    const dh = dir === 's' ? dy : -dy
    newW = resizeStartW.value + dh * ASPECT
    if (dir === 'n') {
      newY = resizeStartTop.value - dh * ASPECT / ASPECT
      // Actually for 'n', the top moves up, and width increases
    }
  }

  // 对 n/s 方向调整 Y 位置
  if (dir.includes('n')) {
    const dw = newW - resizeStartW.value
    newY = resizeStartTop.value - dw / ASPECT
  }

  // 对角：综合 dx 和 dy，取变化量更大的一方决定等比缩放
  if (dir.length === 2) {
    const dwFromX = dir.includes('e') ? dx : -dx
    const dwFromY = (dir.includes('s') ? dy : -dy) * ASPECT
    // 取绝对变化量更大的方向
    const dw = Math.abs(dwFromX) > Math.abs(dwFromY) ? dwFromX : dwFromY
    newW = resizeStartW.value + dw

    if (dir.includes('w')) {
      newX = resizeStartLeft.value - dw
    }
    if (dir.includes('n')) {
      newY = resizeStartTop.value - dw / ASPECT
    }
  }

  w.value = Math.min(MAX_W, Math.max(MIN_W, Math.round(newW)))
  x.value = Math.round(newX)
  y.value = Math.round(newY)
}

function onResizeMouseUp() {
  resizing.value = null
  document.removeEventListener('mousemove', onResizeMouseMove)
  document.removeEventListener('mouseup', onResizeMouseUp)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('mousemove', onResizeMouseMove)
  document.removeEventListener('mouseup', onResizeMouseUp)
})
</script>

<template>
  <div
    class="floating-camera"
    :style="{ left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }"
  >
    <!-- 标题栏（拖拽手柄） -->
    <div class="fc-header" @mousedown="onHeaderMouseDown">
      <span class="fc-title">相机</span>
      <button class="fc-close" @click="emit('close')">✕</button>
    </div>

    <!-- 相机画面 + 十字线 -->
    <div class="fc-body">
      <CameraPic object-fit="cover" :show-hint="false" />

      <!-- 十字线叠加层 -->
      <svg class="fc-crosshair" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          x1="0" y1="50" x2="100" y2="50"
          stroke="rgba(248,113,113,0.45)"
          stroke-width="0.5"
          vector-effect="non-scaling-stroke"
        />
        <line
          x1="50" y1="0" x2="50" y2="100"
          stroke="rgba(96,165,250,0.45)"
          stroke-width="0.5"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>

    <!-- 等比缩放句柄 -->
    <div class="fc-resize-handle fc-resize-n"  @mousedown="onResizeMouseDown($event, 'n')" />
    <div class="fc-resize-handle fc-resize-s"  @mousedown="onResizeMouseDown($event, 's')" />
    <div class="fc-resize-handle fc-resize-e"  @mousedown="onResizeMouseDown($event, 'e')" />
    <div class="fc-resize-handle fc-resize-w"  @mousedown="onResizeMouseDown($event, 'w')" />
    <div class="fc-resize-handle fc-resize-ne" @mousedown="onResizeMouseDown($event, 'ne')" />
    <div class="fc-resize-handle fc-resize-nw" @mousedown="onResizeMouseDown($event, 'nw')" />
    <div class="fc-resize-handle fc-resize-se" @mousedown="onResizeMouseDown($event, 'se')" />
    <div class="fc-resize-handle fc-resize-sw" @mousedown="onResizeMouseDown($event, 'sw')" />
  </div>
</template>

<style scoped>
.floating-camera {
  position: fixed;
  z-index: 500;
  width: 320px;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  user-select: none;
  display: flex;
  flex-direction: column;
}

.fc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #27272a;
  cursor: move;
  flex-shrink: 0;
}

.fc-title {
  font-size: 12px;
  font-weight: 500;
  color: #a1a1aa;
}

.fc-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #71717a;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.fc-close:hover {
  background: #3f3f46;
  color: #f87171;
}

.fc-body {
  position: relative;
  flex: 1;
  overflow: hidden;
  background: #09090b;
}

.fc-crosshair {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* ── 缩放句柄 ── */
.fc-resize-handle {
  position: absolute;
  z-index: 10;
}

.fc-resize-n,
.fc-resize-s {
  left: 12px;
  right: 12px;
  height: 6px;
  cursor: ns-resize;
}
.fc-resize-n { top: 0; }
.fc-resize-s { bottom: 0; }

.fc-resize-e,
.fc-resize-w {
  top: 12px;
  bottom: 12px;
  width: 6px;
  cursor: ew-resize;
}
.fc-resize-e { right: 0; }
.fc-resize-w { left: 0; }

.fc-resize-ne,
.fc-resize-nw,
.fc-resize-se,
.fc-resize-sw {
  width: 14px;
  height: 14px;
}

.fc-resize-ne { top: 0;    right: 0;   cursor: nesw-resize; }
.fc-resize-nw { top: 0;    left: 0;    cursor: nwse-resize; }
.fc-resize-se { bottom: 0; right: 0;   cursor: nwse-resize; }
.fc-resize-sw { bottom: 0; left: 0;    cursor: nesw-resize; }
</style>
