// =============================================================================
// useCanvas2D — Canvas 2D 渲染 + 鼠标交互
// =============================================================================
//
// 【职责】
//   - screenToWorld / worldToScreen 坐标转换
//   - 网格绘制
//   - 遍历 store.entities 绘制全部图元（LINE/ARC/CIRCLE/BEZIER/POLYLINE/ELLIPSE）
//   - 选中/悬停高亮、框选矩形、绘制预览线
//   - SELECT 模式：点击选中、框选
//   - DRAW 模式：拖拽绘制（LINE/CIRCLE 一步完成，ARC/BEZIER/POLYLINE 预留扩展）
//   - PAN 模式：拖拽平移
//   - 滚轮以鼠标为中心缩放
//
// 【使用方式】
//   在 Canvas2D.vue 中：
//
//     const { canvasRef, setup, cleanup } = useCanvas2D()
//     onMounted(() => setup())
//     onUnmounted(() => cleanup())
//     // <canvas ref="canvasRef" />
// =============================================================================

import { ref, watch } from 'vue'
import { useEditorStore } from '@/modules/entitiesEditor/stores/editorStore'
import type {
  Point2D,
  SurfaceEntity,
  EditorEntity,
  LineEntity,
  ArcEntity,
  CircleEntity,
  EllipseEntity,
  PolylineEntity,
  BezierEntity,
  ViewportState,
} from '@/modules/entitiesEditor/commons/types'
import { MIN_ZOOM, MAX_ZOOM } from '@/modules/entitiesEditor/configs/defaults'
import {
  sampleArcPoints,
  sampleBezierPoints,
  samplePolylineVertices,
  sampleEllipsePoints,
  getEntityBounds,
} from '@/modules/entitiesEditor/utils/geometry'

// ── 绘制常量 ─────────────────────────────────────────────────────────────

const GRID_STEP = 10
const GRID_COLOR = '#1e293b'
const GRID_AXIS_COLOR = '#334155'
const AXIS_LINE_WIDTH = 2

const ENTITY_STROKE = '#94a3b8'
const ENTITY_LINE_WIDTH = 1.5

const SELECTION_STROKE = '#3b82f6'
const SELECTION_LINE_WIDTH = 3

const HOVER_STROKE = '#818cf8'

const PREVIEW_STROKE = '#60a5fa'
const PREVIEW_DASH = [6, 4]

const SELECTION_RECT_STROKE = '#3b82f6'
const SELECTION_RECT_DASH = [6, 4]
const SELECTION_RECT_FILL = 'rgba(59, 130, 246, 0.08)'

const HIT_PX = 12

// ── composable ────────────────────────────────────────────────────────────

export function useCanvas2D() {
  const store = useEditorStore()

  const canvasRef = ref<HTMLCanvasElement | null>(null)

  // ── 交互状态 ─────────────────────────────────────────────────────────

  /** 绘制起点（世界坐标） */
  const drawStartPoint = ref<Point2D | null>(null)
  /** 绘制预览终点（世界坐标） */
  const drawPreviewPoint = ref<Point2D | null>(null)
  /** 是否正在绘制（DRAW 模式拖拽中） */
  const isDrawing = ref(false)
  /** 框选矩形（世界坐标），null 表示无框选 */
  const selectionRect = ref<{ start: Point2D; end: Point2D } | null>(null)
  /** PAN 拖拽起点（屏幕坐标 + 初始 viewport.panX/Y） */
  const panStart = ref<{ sx: number; sy: number; panX: number; panY: number } | null>(null)
  /** 当前悬停的实体 id */
  const hoveredId = ref<string | null>(null)

  // ── rAF 脏标记 ──────────────────────────────────────────────────────

  let rafId = 0
  let dirty = false

  function scheduleRender() {
    dirty = true
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = 0
        if (dirty) {
          dirty = false
          render()
        }
      })
    }
  }

  // ── 坐标转换 ─────────────────────────────────────────────────────────
  //
  // 公式来自 commons/types.ts 中 ViewportState 注释：
  //   screenToWorld(sx, sy) = (sx - w/2)/zoom - panX,  (h/2 - sy)/zoom - panY
  //   worldToScreen(wx, wy) = (wx + panX)*zoom + w/2,  h/2 - (wy + panY)*zoom

  function screenToWorld(sx: number, sy: number): Point2D {
    const vp: ViewportState = store.viewport
    return {
      X: (sx - vp.width / 2) / vp.zoom - vp.panX,
      Y: (vp.height / 2 - sy) / vp.zoom - vp.panY,
    }
  }

  function worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const vp: ViewportState = store.viewport
    return {
      x: (wx + vp.panX) * vp.zoom + vp.width / 2,
      y: vp.height / 2 - (wy + vp.panY) * vp.zoom,
    }
  }

  // ── Canvas 尺寸 ──────────────────────────────────────────────────────

  let resizeObserver: ResizeObserver | null = null

  function resizeCanvas() {
    const canvas = canvasRef.value
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const w = parent.clientWidth
    const h = parent.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    store.setViewportSize(w, h)
    scheduleRender()
  }

  // ── 渲染 ─────────────────────────────────────────────────────────────

  function getCtx(): CanvasRenderingContext2D | null {
    const canvas = canvasRef.value
    if (!canvas) return null
    return canvas.getContext('2d')
  }

  function render() {
    const c = getCtx()
    const canvas = canvasRef.value
    if (!c || !canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const vp: ViewportState = store.viewport
    const w = vp.width
    const h = vp.height

    // 清屏
    c.save()
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.clearRect(0, 0, w, h)
    c.restore()

    // 世界变换：Y 轴上翻（世界 Y-up → 屏幕 Y-down）
    c.save()
    c.setTransform(
      vp.zoom * dpr,
      0,
      0,
      -vp.zoom * dpr,
      (vp.panX * vp.zoom + w / 2) * dpr,
      (h / 2 - vp.panY * vp.zoom) * dpr,
    )

    // 网格
    drawGrid(c, vp)

    // 实体
    const selectedSet = new Set(store.selectedIds)
    for (const entity of store.entities) {
      const selected = selectedSet.has(entity.id)
      const hovered = entity.id === hoveredId.value
      drawEntity(c, entity, selected, hovered)
    }

    // 框选矩形
    if (selectionRect.value) {
      drawSelectionRect(c, selectionRect.value)
    }

    // 绘制预览
    if (isDrawing.value && drawStartPoint.value && drawPreviewPoint.value) {
      drawPreview(c, drawStartPoint.value, drawPreviewPoint.value)
    }

    c.restore()
  }

  // ── 网格 ─────────────────────────────────────────────────────────────

  function drawGrid(c: CanvasRenderingContext2D, vp: ViewportState) {
    const tl = screenToWorld(0, 0)
    const br = screenToWorld(vp.width, vp.height)

    const step = GRID_STEP
    const minX = Math.floor(Math.min(tl.X, br.X) / step) * step
    const maxX = Math.ceil(Math.max(tl.X, br.X) / step) * step
    const minY = Math.floor(Math.min(tl.Y, br.Y) / step) * step
    const maxY = Math.ceil(Math.max(tl.Y, br.Y) / step) * step

    const lw = 1 / vp.zoom

    c.lineWidth = lw
    c.strokeStyle = GRID_COLOR

    c.beginPath()
    for (let x = minX; x <= maxX; x += step) {
      c.moveTo(x, minY)
      c.lineTo(x, maxY)
    }
    for (let y = minY; y <= maxY; y += step) {
      c.moveTo(minX, y)
      c.lineTo(maxX, y)
    }
    c.stroke()

    // 坐标轴
    c.lineWidth = AXIS_LINE_WIDTH / vp.zoom
    c.strokeStyle = GRID_AXIS_COLOR

    c.beginPath()
    c.moveTo(minX, 0)
    c.lineTo(maxX, 0)
    c.stroke()

    c.beginPath()
    c.moveTo(0, minY)
    c.lineTo(0, maxY)
    c.stroke()
  }

  // ── 实体绘制 ─────────────────────────────────────────────────────────

  function drawEntity(
    c: CanvasRenderingContext2D,
    entity: SurfaceEntity<EditorEntity>,
    selected: boolean,
    hovered: boolean,
  ) {
    if (selected) {
      c.strokeStyle = SELECTION_STROKE
      c.lineWidth = SELECTION_LINE_WIDTH / store.viewport.zoom
    } else if (hovered) {
      c.strokeStyle = HOVER_STROKE
      c.lineWidth = ENTITY_LINE_WIDTH / store.viewport.zoom
    } else {
      c.strokeStyle = ENTITY_STROKE
      c.lineWidth = ENTITY_LINE_WIDTH / store.viewport.zoom
    }

    switch (entity.kind) {
      case 'LINE':     drawLine(entity); break
      case 'ARC':      drawArc(entity); break
      case 'CIRCLE':   drawCircle(entity); break
      case 'BEZIER':   drawBezier(entity); break
      case 'POLYLINE': drawPolyline(entity); break
      case 'ELLIPSE':  drawEllipse(entity); break
    }
  }

  function drawLine(e: LineEntity) {
    const c = getCtx()!; c.beginPath(); c.moveTo(e.start.X, e.start.Y); c.lineTo(e.end.X, e.end.Y); c.stroke()
  }

  function drawArc(e: ArcEntity) {
    const pts = sampleArcPoints(e.center, e.radius, e.startAngle, e.endAngle, 64)
    const c = getCtx()!; c.beginPath(); c.moveTo(pts[0].X, pts[0].Y)
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].X, pts[i].Y)
    c.stroke()
  }

  function drawCircle(e: CircleEntity) {
    const c = getCtx()!; c.beginPath(); c.arc(e.center.X, e.center.Y, e.radius, 0, Math.PI * 2); c.stroke()
  }

  function drawBezier(e: BezierEntity) {
    const pts = sampleBezierPoints(e.controlPoints, 64)
    const c = getCtx()!; c.beginPath(); c.moveTo(pts[0].X, pts[0].Y)
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].X, pts[i].Y)
    c.stroke()
  }

  function drawPolyline(e: PolylineEntity) {
    const pts = samplePolylineVertices(e.vertices)
    const c = getCtx()!; c.beginPath(); c.moveTo(pts[0].X, pts[0].Y)
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].X, pts[i].Y)
    if (e.closed) c.closePath()
    c.stroke()
  }

  function drawEllipse(e: EllipseEntity) {
    const pts = sampleEllipsePoints(e.center, e.majorAxisEnd, e.minorAxisRatio, e.startParamDeg, e.endParamDeg, 64)
    const c = getCtx()!; c.beginPath(); c.moveTo(pts[0].X, pts[0].Y)
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].X, pts[i].Y)
    c.stroke()
  }

  // ── 框选矩形 ─────────────────────────────────────────────────────────

  function drawSelectionRect(c: CanvasRenderingContext2D, rect: { start: Point2D; end: Point2D }) {
    const minX = Math.min(rect.start.X, rect.end.X)
    const minY = Math.min(rect.start.Y, rect.end.Y)
    const w = Math.abs(rect.end.X - rect.start.X)
    const h = Math.abs(rect.end.Y - rect.start.Y)

    c.fillStyle = SELECTION_RECT_FILL
    c.fillRect(minX, minY, w, h)

    c.strokeStyle = SELECTION_RECT_STROKE
    c.lineWidth = 1 / store.viewport.zoom
    c.setLineDash(SELECTION_RECT_DASH.map(d => d / store.viewport.zoom))
    c.strokeRect(minX, minY, w, h)
    c.setLineDash([])
  }

  // ── 绘制预览 ─────────────────────────────────────────────────────────

  function drawPreview(c: CanvasRenderingContext2D, start: Point2D, end: Point2D) {
    const kind = store.drawSubTool

    c.strokeStyle = PREVIEW_STROKE
    c.lineWidth = ENTITY_LINE_WIDTH / store.viewport.zoom
    c.setLineDash(PREVIEW_DASH.map(d => d / store.viewport.zoom))

    if (kind === 'LINE') {
      c.beginPath()
      c.moveTo(start.X, start.Y)
      c.lineTo(end.X, end.Y)
      c.stroke()
    } else if (kind === 'CIRCLE') {
      const r = Math.hypot(end.X - start.X, end.Y - start.Y)
      c.beginPath()
      c.arc(start.X, start.Y, r, 0, Math.PI * 2)
      c.stroke()
    } else if (kind === 'ARC') {
      // 简单预览：显示圆心到鼠标的圆
      const r = Math.hypot(end.X - start.X, end.Y - start.Y)
      c.beginPath()
      c.arc(start.X, start.Y, r, 0, Math.PI * 2)
      c.stroke()
      // 半径线
      c.beginPath()
      c.moveTo(start.X, start.Y)
      c.lineTo(end.X, end.Y)
      c.stroke()
    }

    c.setLineDash([])
  }

  // ── 命中检测 ─────────────────────────────────────────────────────────

  function hitThreshold(): number {
    return HIT_PX / store.viewport.zoom
  }

  /** 点到线段的最短距离 */
  function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    if (len2 === 0) return Math.hypot(px - ax, py - ay)
    let t = ((px - ax) * dx + (py - ay) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
  }

  /** 检查点是否在采样折线的阈值内 */
  function hitPolyline(px: number, py: number, pts: Point2D[], threshold: number): boolean {
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(px, py, pts[i].X, pts[i].Y, pts[i + 1].X, pts[i + 1].Y) <= threshold) {
        return true
      }
    }
    return false
  }

  /** 将角度归一化到 [0, 360) */
  function normDeg(a: number): number { return ((a % 360) + 360) % 360 }

  function hitArcEntity(world: Point2D, e: ArcEntity, threshold: number): boolean {
    const dist = Math.hypot(world.X - e.center.X, world.Y - e.center.Y)
    if (Math.abs(dist - e.radius) > threshold) return false

    const angleDeg = Math.atan2(world.Y - e.center.Y, world.X - e.center.X) * 180 / Math.PI
    const angleTol = (threshold / e.radius) * (180 / Math.PI)

    const na = normDeg(angleDeg)
    const ns = normDeg(e.startAngle)
    const ne = normDeg(e.endAngle)

    // CCW arc: startAngle -> endAngle
    if (e.startAngle <= e.endAngle) {
      if (ns <= ne) {
        return na >= ns - angleTol && na <= ne + angleTol
      } else {
        // 跨 0°
        return na >= ns - angleTol || na <= ne + angleTol
      }
    } else {
      // CW arc: startAngle -> endAngle (going down)
      if (ns >= ne) {
        return na <= ns + angleTol && na >= ne - angleTol
      } else {
        // 跨 0°（CW 方向跨 0°）
        return na <= ns + angleTol || na >= ne - angleTol
      }
    }
  }

  function hitTestEntity(world: Point2D, entity: SurfaceEntity<EditorEntity>, threshold: number): boolean {
    switch (entity.kind) {
      case 'LINE':
        return distToSegment(world.X, world.Y, entity.start.X, entity.start.Y, entity.end.X, entity.end.Y) <= threshold
      case 'ARC':
        return hitArcEntity(world, entity, threshold)
      case 'CIRCLE':
        return Math.abs(Math.hypot(world.X - entity.center.X, world.Y - entity.center.Y) - entity.radius) <= threshold
      case 'BEZIER':
        return hitPolyline(world.X, world.Y, sampleBezierPoints(entity.controlPoints, 64), threshold)
      case 'POLYLINE':
        return hitPolyline(world.X, world.Y, samplePolylineVertices(entity.vertices), threshold)
      case 'ELLIPSE':
        return hitPolyline(world.X, world.Y,
          sampleEllipsePoints(entity.center, entity.majorAxisEnd, entity.minorAxisRatio, entity.startParamDeg, entity.endParamDeg, 64),
          threshold)
      default:
        return false
    }
  }

  /** 返回命中的实体 id（按绘制顺序反向，后绘制的优先），未命中返回 null */
  function hitTest(world: Point2D): string | null {
    const threshold = hitThreshold()
    for (let i = store.entities.length - 1; i >= 0; i--) {
      if (hitTestEntity(world, store.entities[i], threshold)) {
        return store.entities[i].id
      }
    }
    return null
  }

  // ── 框选 ─────────────────────────────────────────────────────────────

  function entitiesInRect(rect: { start: Point2D; end: Point2D }): string[] {
    const minX = Math.min(rect.start.X, rect.end.X)
    const minY = Math.min(rect.start.Y, rect.end.Y)
    const maxX = Math.max(rect.start.X, rect.end.X)
    const maxY = Math.max(rect.start.Y, rect.end.Y)

    const ids: string[] = []
    for (const e of store.entities) {
      const bb = getEntityBounds(e)
      if (bb.maxX >= minX && bb.minX <= maxX && bb.maxY >= minY && bb.minY <= maxY) {
        ids.push(e.id)
      }
    }
    return ids
  }

  // ── 鼠标事件辅助 ─────────────────────────────────────────────────────

  function getCanvasPoint(e: MouseEvent | WheelEvent): { x: number; y: number } {
    const canvas = canvasRef.value!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // ── 缩放 ─────────────────────────────────────────────────────────────

  /** 以屏幕点 (sx, sy) 为中心缩放 */
  function zoomAt(sx: number, sy: number, factor: number) {
    const vp = store.viewport
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * factor))
    if (newZoom === vp.zoom) return

    const invDelta = 1 / newZoom - 1 / vp.zoom
    store.viewport.panX = (sx - vp.width / 2) * invDelta + vp.panX
    store.viewport.panY = (vp.height / 2 - sy) * invDelta + vp.panY
    store.viewport.zoom = newZoom

    scheduleRender()
  }

  // ── 鼠标事件处理 ─────────────────────────────────────────────────────

  function handleMouseDown(e: MouseEvent) {
    const pt = getCanvasPoint(e)
    const world = screenToWorld(pt.x, pt.y)
    const tool = store.activeTool

    if (e.button !== 0) return // 仅左键

    if (tool === 'SELECT') {
      const hitId = hitTest(world)
      if (hitId) {
        store.setSelection([hitId])
      } else {
        store.setSelection([])
        selectionRect.value = { start: { ...world }, end: { ...world } }
      }
      scheduleRender()
    } else if (tool === 'DRAW') {
      isDrawing.value = true
      drawStartPoint.value = { ...world }
      drawPreviewPoint.value = { ...world }
      scheduleRender()
    } else if (tool === 'PAN') {
      panStart.value = {
        sx: e.clientX,
        sy: e.clientY,
        panX: store.viewport.panX,
        panY: store.viewport.panY,
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const pt = getCanvasPoint(e)
    const world = screenToWorld(pt.x, pt.y)

    if (store.activeTool === 'SELECT') {
      if (selectionRect.value) {
        selectionRect.value = { start: selectionRect.value.start, end: { ...world } }
        scheduleRender()
      } else {
        const prev = hoveredId.value
        hoveredId.value = hitTest(world)
        if (prev !== hoveredId.value) scheduleRender()
      }
    } else if (store.activeTool === 'DRAW' && isDrawing.value) {
      drawPreviewPoint.value = { ...world }
      scheduleRender()
    } else if (store.activeTool === 'PAN' && panStart.value) {
      const dx = e.clientX - panStart.value.sx
      const dy = e.clientY - panStart.value.sy
      store.viewport.panX = panStart.value.panX + dx / store.viewport.zoom
      store.viewport.panY = panStart.value.panY - dy / store.viewport.zoom
      scheduleRender()
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (e.button !== 0) return

    const pt = getCanvasPoint(e)
    const world = screenToWorld(pt.x, pt.y)
    const tool = store.activeTool

    if (tool === 'SELECT' && selectionRect.value) {
      const ids = entitiesInRect({ start: selectionRect.value.start, end: world })
      store.setSelection(ids)
      selectionRect.value = null
      scheduleRender()
    } else if (tool === 'DRAW' && isDrawing.value && drawStartPoint.value) {
      finishDrawing(drawStartPoint.value, world)
      isDrawing.value = false
      drawStartPoint.value = null
      drawPreviewPoint.value = null
      scheduleRender()
    } else if (tool === 'PAN') {
      panStart.value = null
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    const pt = getCanvasPoint(e)
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    zoomAt(pt.x, pt.y, factor)
  }

  // ── 绘制完成 ─────────────────────────────────────────────────────────

  function finishDrawing(start: Point2D, end: Point2D) {
    const kind = store.drawSubTool
    const dist = Math.hypot(end.X - start.X, end.Y - start.Y)

    if (kind === 'LINE') {
      if (dist < 0.5) return
      store.addEntity({
        kind: 'LINE',
        start: { X: start.X, Y: start.Y },
        end: { X: end.X, Y: end.Y },
      } as any)
    } else if (kind === 'CIRCLE') {
      if (dist < 0.5) return
      store.addEntity({
        kind: 'CIRCLE',
        center: { X: start.X, Y: start.Y },
        radius: dist,
      } as any)
    }
    // ARC / BEZIER / POLYLINE / ELLIPSE — 多步绘制，预留扩展
  }

  // ── 监听 ─────────────────────────────────────────────────────────────
  //
  // 外部（undo、快捷键等）修改 store → 触发重绘。
  // 鼠标操作中已手动调用 scheduleRender()，此处为兜底。

  watch(
    () => ({
      z: store.viewport.zoom,
      px: store.viewport.panX,
      py: store.viewport.panY,
      w: store.viewport.width,
      h: store.viewport.height,
      entitiesLen: store.entities.length,
      selLen: store.selectedIds.length,
    }),
    () => scheduleRender(),
    { deep: true },
  )

  // ── 生命周期 ─────────────────────────────────────────────────────────

  function setup() {
    const canvas = canvasRef.value
    if (!canvas) return

    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    // 阻止 canvas 上的右键菜单
    canvas.addEventListener('contextmenu', e => e.preventDefault())

    // ResizeObserver
    const parent = canvas.parentElement
    if (parent) {
      resizeObserver = new ResizeObserver(() => resizeCanvas())
      resizeObserver.observe(parent)
    }

    resizeCanvas()
  }

  function cleanup() {
    const canvas = canvasRef.value
    if (canvas) {
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('contextmenu', e => e.preventDefault())
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  // ── Public API ───────────────────────────────────────────────────────

  return { canvasRef, setup, cleanup }
}
