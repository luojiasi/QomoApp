// =============================================================================
// 2D Canvas 交互（绘制 / 选择 / 平移 / 框选）
// =============================================================================

import { ref, computed } from 'vue'
import type { Point2D, SelectionRect, SurfaceEntity } from "@/modules/entitiesEditor/commons/types"
import { createDefaultExtrusion } from "@/modules/entitiesEditor/configs/defaults"
import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"
import { useViewport } from "@/modules/entitiesEditor/composables/useViewport"
import { generateId } from "@/modules/entitiesEditor/utils/idgen"

export function useCanvasTool() {
  const store = useEditorStore()
  const { screenToWorld } = useViewport()

  // ── 状态 ──

  const isDrawing = ref(false)
  const drawPreview = ref<Point2D[]>([])
  const hoveredId = ref<string | null>(null)
  const selectionRect = ref<SelectionRect | null>(null)
  const drawStartPoint = ref<Point2D | null>(null)
  const isPanning = ref(false)
  const panStart = ref<{ x: number; y: number } | null>(null)

  // ── 计算 ──

  const activeTool = computed(() => store.activeTool)

  // ── 命中检测 ──

  function hitTest(world: Point2D): string | null {
    const threshold = 8 / store.viewport.zoom
    let closest: string | null = null
    let closestDist = Infinity

    for (const entity of store.entities) {
      const dist = entityPointDistance(entity, world)
      if (dist < threshold && dist < closestDist) {
        closestDist = dist
        closest = entity.id
      }
    }
    return closest
  }

  function entityPointDistance(entity: SurfaceEntity, point: Point2D): number {
    switch (entity.kind) {
      case 'LINE': return pointToSegmentDist(point, entity.start, entity.end)
      case 'ARC': return pointToArcDist(point, entity.center, entity.radius, entity.startAngleDeg, entity.endAngleDeg)
      case 'BEZIER': {
        if (entity.controlPoints.length < 2) return Infinity
        let minDist = Infinity
        for (let i = 0; i < entity.controlPoints.length - 1; i++) {
          const d = pointToSegmentDist(point, entity.controlPoints[i], entity.controlPoints[i + 1])
          if (d < minDist) minDist = d
        }
        return minDist
      }
      default: return Infinity
    }
  }

  // ── 事件处理 ──

  function onMouseDown(event: MouseEvent, canvasEl: HTMLElement): void {
    const rect = canvasEl.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const world = screenToWorld(sx, sy)

    const tool = store.activeTool

    if (tool === 'PAN' || event.button === 1) {
      isPanning.value = true
      panStart.value = { x: event.clientX, y: event.clientY }
      return
    }

    if (tool === 'SELECT') {
      const hitId = hitTest(world)
      if (hitId) {
        store.setSelection(event.ctrlKey || event.metaKey
          ? store.selectedIds.includes(hitId)
            ? store.selectedIds.filter((id) => id !== hitId)
            : [...store.selectedIds, hitId]
          : [hitId])
      } else {
        selectionRect.value = { x: sx, y: sy, width: 0, height: 0 }
      }
      return
    }

    // 绘制模式
    isDrawing.value = true
    drawStartPoint.value = world
    drawPreview.value = [world]
  }

  function onMouseMove(event: MouseEvent, canvasEl: HTMLElement): void {
    const rect = canvasEl.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const world = screenToWorld(sx, sy)

    if (isPanning.value && panStart.value) {
      const dx = event.clientX - panStart.value.x
      const dy = event.clientY - panStart.value.y
      store.viewport.panX += dx / store.viewport.zoom
      store.viewport.panY -= dy / store.viewport.zoom
      panStart.value = { x: event.clientX, y: event.clientY }
      return
    }

    if (selectionRect.value) {
      selectionRect.value.width = sx - selectionRect.value.x
      selectionRect.value.height = sy - selectionRect.value.y
      return
    }

    // 悬停检测
    hoveredId.value = hitTest(world)

    if (isDrawing.value && drawStartPoint.value) {
      const tool = store.activeTool
      if (tool === 'DRAW_LINE') {
        drawPreview.value = [drawStartPoint.value, world]
      } else if (tool === 'DRAW_ARC') {
        const cx = (drawStartPoint.value.X + world.X) / 2
        const cy = drawStartPoint.value.Y
        drawPreview.value = [drawStartPoint.value, { X: cx, Y: cy }, world]
      }
    }
  }

  function onMouseUp(event: MouseEvent, canvasEl: HTMLElement): void {
    if (isPanning.value) { isPanning.value = false; panStart.value = null; return }

    const rect = canvasEl.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const world = screenToWorld(sx, sy)

    // 框选完成
    if (selectionRect.value) {
      const sr = selectionRect.value
      const ids = store.entities.filter((e) => {
        const pos = entityCenter(e)
        return pos &&
          pos.X >= Math.min(sr.x, sr.x + sr.width) / store.viewport.zoom - store.viewport.panX &&
          pos.X <= Math.max(sr.x, sr.x + sr.width) / store.viewport.zoom - store.viewport.panX &&
          -pos.Y >= Math.min(sr.y, sr.y + sr.height) / store.viewport.zoom + store.viewport.panY &&
          -pos.Y <= Math.max(sr.y, sr.y + sr.height) / store.viewport.zoom + store.viewport.panY
      }).map((e) => e.id)
      store.setSelection(ids)
      selectionRect.value = null
      return
    }

    // 绘制完成
    if (isDrawing.value && drawStartPoint.value) {
      const tool = store.activeTool
      finishDrawing(tool, drawStartPoint.value, world)
    }

    isDrawing.value = false
    drawPreview.value = []
    drawStartPoint.value = null
  }

  function finishDrawing(tool: string, start: Point2D, end: Point2D): void {
    const ext = createDefaultExtrusion()
    const layerId = store.layers[0]?.id ?? '0'

    if (tool === 'DRAW_LINE') {
      if (Math.hypot(end.X - start.X, end.Y - start.Y) < 1) return
      const entity: SurfaceEntity = {
        id: generateId('line'), kind: 'LINE', layerId, openSide: 'RIGHT', selected: false,
        start, end, ...ext,
      } as SurfaceEntity
      store.applyMutation(() => store.entities.push(entity))
    }

    // DRAW_ARC 和 DRAW_BEZIER 留待后续细化
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      store.setTool('SELECT')
      isDrawing.value = false
      drawPreview.value = []
      selectionRect.value = null
    }
  }

  return {
    isDrawing, drawPreview, hoveredId, selectionRect,
    onMouseDown, onMouseMove, onMouseUp, onKeyDown,
  }
}

// ── 几何辅助 ──

function pointToSegmentDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.X - a.X, dy = b.Y - a.Y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.X - a.X, p.Y - a.Y)
  let t = ((p.X - a.X) * dx + (p.Y - a.Y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.X - (a.X + t * dx), p.Y - (a.Y + t * dy))
}

function pointToArcDist(p: Point2D, center: Point2D, radius: number, startDeg: number, endDeg: number): number {
  const dx = p.X - center.X, dy = p.Y - center.Y
  const dist = Math.hypot(dx, dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const sweep = ((endDeg - startDeg) % 360 + 360) % 360 || 360
  const a = ((angle - startDeg) % 360 + 360) % 360
  if (a <= sweep) return Math.abs(dist - radius)
  // 点到端点的最小距离
  const rad = (d: number) => d * Math.PI / 180
  const sx = center.X + radius * Math.cos(rad(startDeg)), sy = center.Y + radius * Math.sin(rad(startDeg))
  const ex = center.X + radius * Math.cos(rad(endDeg)), ey = center.Y + radius * Math.sin(rad(endDeg))
  return Math.min(Math.hypot(p.X - sx, p.Y - sy), Math.hypot(p.X - ex, p.Y - ey))
}

function entityCenter(entity: SurfaceEntity): Point2D | null {
  switch (entity.kind) {
    case 'LINE': return { X: (entity.start.X + entity.end.X) / 2, Y: (entity.start.Y + entity.end.Y) / 2 }
    case 'ARC':
    case 'CIRCLE': return entity.center
    case 'BEZIER': {
      if (entity.controlPoints.length === 0) return null
      let sx = 0, sy = 0
      for (const p of entity.controlPoints) { sx += p.X; sy += p.Y }
      return { X: sx / entity.controlPoints.length, Y: sy / entity.controlPoints.length }
    }
    default: return null
  }
}
