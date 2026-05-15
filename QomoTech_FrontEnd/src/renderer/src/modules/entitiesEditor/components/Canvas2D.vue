<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"
import { useCanvasTool } from "@/modules/entitiesEditor/composables/useCanvasTool"
import { useViewport } from "@/modules/entitiesEditor/composables/useViewport"
import type { Point2D } from "@/modules/entitiesEditor/commons/types"

const store = useEditorStore()
const { worldToScreen } = useViewport()
const { hoveredId, selectionRect, drawPreview, onMouseDown, onMouseMove, onMouseUp, onKeyDown } = useCanvasTool()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let rafId = 0
let observer: ResizeObserver | null = null

// ── 绘制实体到 canvas ──

function drawEntity(entity: typeof store.entities[number]) {
  if (!ctx) return
  const sel = store.selectedIds.includes(entity.id)
  const hovered = entity.id === hoveredId.value

  ctx.beginPath()
  ctx.strokeStyle = sel ? '#3b82f6' : hovered ? '#fbbf24' : '#94a3b8'
  ctx.lineWidth = sel ? 2.5 : hovered ? 2 : 1

  switch (entity.kind) {
    case 'LINE': {
      const s = worldToScreen(entity.start.X, entity.start.Y)
      const e = worldToScreen(entity.end.X, entity.end.Y)
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(e.x, e.y)
      break
    }
    case 'ARC': {
      drawArcOnCanvas(entity.center, entity.radius, entity.startAngleDeg, entity.endAngleDeg)
      break
    }
    case 'BEZIER': {
      if (entity.controlPoints.length < 2) break
      const pts = entity.controlPoints.map((p) => worldToScreen(p.X, p.Y))
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y)
      }
      break
    }
  }
  ctx.stroke()

  // 选中时画高亮框
  if (sel) {
    for (const cp of getControlPoints(entity)) {
      const sp = worldToScreen(cp.X, cp.Y)
      ctx.fillStyle = '#3b82f6'
      ctx.fillRect(sp.x - 3, sp.y - 3, 6, 6)
    }
  }
}

function drawArcOnCanvas(center: Point2D, radius: number, startDeg: number, endDeg: number) {
  if (!ctx) return
  // 用一系列短线段近似弧线
  const points: Point2D[] = []
  const sweep = endDeg - startDeg
  const segments = 48
  for (let i = 0; i <= segments; i++) {
    const a = startDeg + (sweep * i) / segments
    const rad = (a * Math.PI) / 180
    points.push({ X: center.X + radius * Math.cos(rad), Y: center.Y + radius * Math.sin(rad) })
  }
  if (points.length < 2) return
  const s = worldToScreen(points[0].X, points[0].Y)
  ctx.moveTo(s.x, s.y)
  for (let i = 1; i < points.length; i++) {
    const p = worldToScreen(points[i].X, points[i].Y)
    ctx.lineTo(p.x, p.y)
  }
}

function getControlPoints(entity: typeof store.entities[number]): Point2D[] {
  switch (entity.kind) {
    case 'LINE': return [entity.start, entity.end]
    case 'ARC': return [entity.center]
    case 'BEZIER': return entity.controlPoints
    default: return []
  }
}

// ── 渲染循环 ──

function render() {
  if (!ctx || !canvasRef.value) return
  const w = canvasRef.value.width
  const h = canvasRef.value.height
  ctx.clearRect(0, 0, w, h)

  // Grid
  ctx.strokeStyle = '#27272a'
  ctx.lineWidth = 0.5
  const gridSize = 50 * store.viewport.zoom
  const offsetX = ((store.viewport.panX * store.viewport.zoom) % gridSize + gridSize) % gridSize
  const offsetY = ((-store.viewport.panY * store.viewport.zoom) % gridSize + gridSize) % gridSize
  for (let x = offsetX; x < w; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = offsetY; y < h; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  // 实体
  for (const entity of store.entities) {
    const layer = store.layers.find((l) => l.id === entity.layerId)
    if (layer && !layer.visible) continue
    drawEntity(entity)
  }

  // 绘制预览
  if (drawPreview.value.length > 1) {
    ctx.beginPath()
    ctx.strokeStyle = '#fbbf24'
    ctx.setLineDash([4, 4])
    const pts = drawPreview.value.map((p) => worldToScreen(p.X, p.Y))
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // 框选矩形
  if (selectionRect.value) {
    const sr = selectionRect.value
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(sr.x, sr.y, sr.width, sr.height)
    ctx.fillStyle = 'rgba(59,130,246,0.08)'
    ctx.fillRect(sr.x, sr.y, sr.width, sr.height)
    ctx.setLineDash([])
  }

  rafId = requestAnimationFrame(render)
}

function handleResize() {
  if (!canvasRef.value) return
  const parent = canvasRef.value.parentElement
  if (!parent) return
  const w = parent.clientWidth
  const h = parent.clientHeight
  canvasRef.value.width = w
  canvasRef.value.height = h
  store.setViewportSize(w, h)
}

function handleMouseDown(e: MouseEvent) {
  if (canvasRef.value) onMouseDown(e, canvasRef.value)
}
function handleMouseMove(e: MouseEvent) {
  if (canvasRef.value) onMouseMove(e, canvasRef.value)
}
function handleMouseUp(e: MouseEvent) {
  if (canvasRef.value) onMouseUp(e, canvasRef.value)
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  handleResize()

  observer = new ResizeObserver(handleResize)
  observer.observe(canvas.parentElement ?? canvas)
  rafId = requestAnimationFrame(render)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  observer?.disconnect()
})
</script>

<template>
  <div class="canvas-2d">
    <canvas
      ref="canvasRef"
      class="draw-canvas"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @keydown="onKeyDown"
    />
  </div>
</template>

<style scoped>
.canvas-2d {
  width: 100%;
  height: 100%;
  background: #0c0c0f;
}
.draw-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}
</style>
