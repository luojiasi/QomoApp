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
// 【职责】
//   - screenToWorld / worldToScreen 坐标转换
//   - 网格绘制
//   - 遍历 store.entities 绘制全部图元（LINE/ARC/CIRCLE/BEZIER/POLYLINE/ELLIPSE）
//   - 选中/悬停高亮、框选矩形、绘制预览线
//   - SELECT 模式：点击选中、框选
//   - DRAW 模式：点击式绘制（委托给 useDrawInteraction 状态机）
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

import { ref, reactive, watch } from 'vue'
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
import { loadCanvas2DConfig, type Canvas2DConfig } from '@/modules/entitiesEditor/stores/canvas2DSettingsStore'
import {
  sampleBezierPoints,
  samplePolylineVertices,
  getEntityBounds,
} from '@/modules/entitiesEditor/utils/geometry'
import { cursorX, cursorY } from '@/modules/entitiesEditor/composables/useStatusBar'
import { useDrawInteraction } from './useDrawInteraction'

// ── composable ────────────────────────────────────────────────────────────

export function useCanvas2D() {
  const store = useEditorStore()

  const cfg = reactive<Canvas2DConfig>(loadCanvas2DConfig())

  function reloadConfig() {
    Object.assign(cfg, loadCanvas2DConfig())
    scheduleRender()
  }

  const canvasRef = ref<HTMLCanvasElement | null>(null)

  // ── 交互状态 ─────────────────────────────────────────────────────────
  /** 绘制交互状态机 */
  const drawInteraction = useDrawInteraction()
  
  /** 鼠标世界坐标（用于绘制预览线） */
  const cursorWorld = ref<Point2D>({ X: 0, Y: 0 })
  /** 框选矩形（世界坐标），null 表示无框选 */
  const selectionRect = ref<{ start: Point2D; end: Point2D } | null>(null)
  /** PAN 拖拽起点（屏幕坐标 + 初始 viewport.panX/Y） */
  const panStart = ref<{ sx: number; sy: number; panX: number; panY: number } | null>(null)
  /** 当前悬停的实体 id */
  const hoveredId = ref<string | null>(null)

  // ── rAF 脏标记 ──────────────────────────────────────────────────────
  // 作用：将同一帧内的多次重绘请求合并为一次实际渲染。
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

    // 实体（只绘制可见图层）
    const visibleLayerIds = new Set(
      store.layers.filter(l => l.visible).map(l => l.id)
    )
    const selectedSet = new Set(store.selectedIds)
    for (const entity of store.entities) {
      if (!visibleLayerIds.has(entity.layerId)) continue
      const selected = selectedSet.has(entity.id)
      const hovered = entity.id === hoveredId.value
      drawEntity(c, entity, selected, hovered)
    }

    // 框选矩形
    if (selectionRect.value) {
      drawSelectionRect(c, selectionRect.value)
    }

    // 绘制预览
    if (drawInteraction.isActive.value) {
      drawInteractionPreview(c)
    }

    c.restore()
  }

  // ── 网格 ─────────────────────────────────────────────────────────────

  function drawGrid(c: CanvasRenderingContext2D, vp: ViewportState) {
    const tl = screenToWorld(0, 0)
    const br = screenToWorld(vp.width, vp.height)

    const step = cfg.gridStep
    const minX = Math.floor(Math.min(tl.X, br.X) / step) * step
    const maxX = Math.ceil(Math.max(tl.X, br.X) / step) * step
    const minY = Math.floor(Math.min(tl.Y, br.Y) / step) * step
    const maxY = Math.ceil(Math.max(tl.Y, br.Y) / step) * step

    const lw = 1 / vp.zoom

    c.lineWidth = lw
    c.strokeStyle = cfg.gridColor

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
    c.lineWidth = cfg.axisLineWidth / vp.zoom
    c.strokeStyle = cfg.gridAxisColor

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
      c.strokeStyle = cfg.selectionStroke
      c.lineWidth = cfg.selectionLineWidth / store.viewport.zoom
    } else if (hovered) {
      c.strokeStyle = cfg.hoverStroke
      c.lineWidth = cfg.entityLineWidth / store.viewport.zoom
    } else {
      c.strokeStyle = cfg.entityStroke
      c.lineWidth = cfg.entityLineWidth / store.viewport.zoom
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

  /** 使用 Canvas 原生 ctx.arc() 绘制圆弧，替代折线采样 */
  function drawArc(e: ArcEntity) {
    const c = getCtx()!
    const startRad = (e.startAngle * Math.PI) / 180
    const endRad = (e.endAngle * Math.PI) / 180
    // 世界 CCW → counterclockwise=false（canvas CW = world CCW after Y-flip）
    // 世界 CW  → counterclockwise=true
    const ccw = e.startAngle > e.endAngle
    c.beginPath()
    c.arc(e.center.X, e.center.Y, e.radius, startRad, endRad, ccw)
    c.stroke()
  }

  function drawCircle(e: CircleEntity) {
    const c = getCtx()!; c.beginPath(); c.arc(e.center.X, e.center.Y, e.radius, 0, Math.PI * 2); c.stroke()
  }

  /**
   * 绘制贝塞尔曲线：
   * - 3 控制点 → 二次贝塞尔（quadraticCurveTo）
   * - 4 控制点 → 三次贝塞尔（bezierCurveTo）
   * - 其他阶数 → 保留 De Casteljau 采样
   */
  function drawBezier(e: BezierEntity) {
    const c = getCtx()!
    const pts = e.controlPoints
    if (pts.length < 2) return // 无足够点绘制
    if (pts.length === 3) {
      c.beginPath()
      c.moveTo(pts[0].X, pts[0].Y)
      c.quadraticCurveTo(pts[1].X, pts[1].Y, pts[2].X, pts[2].Y)
      c.stroke()
      return
    }
    if (pts.length === 4) {
      c.beginPath()
      c.moveTo(pts[0].X, pts[0].Y)
      c.bezierCurveTo(pts[1].X, pts[1].Y, pts[2].X, pts[2].Y, pts[3].X, pts[3].Y)
      c.stroke()
      return
    }
    const sampled = sampleBezierPoints(e.controlPoints, 64)
    c.beginPath(); c.moveTo(sampled[0].X, sampled[0].Y)
    for (let i = 1; i < sampled.length; i++) c.lineTo(sampled[i].X, sampled[i].Y)
    c.stroke()
  }

  function drawPolyline(e: PolylineEntity) {
    const pts = samplePolylineVertices(e.vertices)
    const c = getCtx()!; c.beginPath(); c.moveTo(pts[0].X, pts[0].Y)
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].X, pts[i].Y)
    if (e.closed) c.closePath()
    c.stroke()
  }

  /** 使用 Canvas 原生 ctx.ellipse() 绘制椭圆，替代折线采样 */
  function drawEllipse(e: EllipseEntity) {
    const c = getCtx()!
    const rx = Math.hypot(e.majorAxisEnd.X, e.majorAxisEnd.Y)
    const ry = rx * e.minorAxisRatio
    const rotationRad = Math.atan2(e.majorAxisEnd.Y, e.majorAxisEnd.X)
    const startRad = (e.startParamDeg * Math.PI) / 180
    const endRad = (e.endParamDeg * Math.PI) / 180
    // 与 ARC 相同的 CCW/CW 约定
    const ccw = e.startParamDeg > e.endParamDeg
    c.beginPath()
    c.ellipse(e.center.X, e.center.Y, rx, ry, rotationRad, startRad, endRad, ccw)
    c.stroke()
  }

  // ── 框选矩形 ─────────────────────────────────────────────────────────

  function drawSelectionRect(c: CanvasRenderingContext2D, rect: { start: Point2D; end: Point2D }) {
    const minX = Math.min(rect.start.X, rect.end.X)
    const minY = Math.min(rect.start.Y, rect.end.Y)
    const w = Math.abs(rect.end.X - rect.start.X)
    const h = Math.abs(rect.end.Y - rect.start.Y)

    c.fillStyle = cfg.selectionRectFill
    c.fillRect(minX, minY, w, h)

    c.strokeStyle = cfg.selectionRectStroke
    c.lineWidth = 1 / store.viewport.zoom
    c.setLineDash(cfg.selectionRectDash.map(d => d / store.viewport.zoom))
    c.strokeRect(minX, minY, w, h)
    c.setLineDash([])
  }

  // ── 交互预览绘制 ────────────────────────────────────────────────────
  //
  // 根据 drawInteraction 当前状态，在画布上绘制虚线预览：
  //   - 已确定的点与光标之间连线
  //   - 依赖 cursorWorld 获取当前鼠标世界坐标

  function drawInteractionPreview(c: CanvasRenderingContext2D) {
    const s = drawInteraction.session.value
    if (!s) return
    const kind = s.kind
    const v = s.values
    const cur = cursorWorld.value  //当前鼠标世界坐标

    //设置虚线样式
    c.strokeStyle = cfg.previewStroke
    c.lineWidth = cfg.entityLineWidth / store.viewport.zoom
    c.setLineDash(cfg.previewDash.map(d => d / store.viewport.zoom))

    /** 辅助：从 values 读取第 i 个 point 字段的值（仅已填的点有效） */
    function pointAt(i: number): Point2D | null {
      const fv = v[i]
      if (!fv || fv.kind !== 'point' || !fv.filled) return null
      return fv.value
    }

    if (kind === 'LINE') {
      const p0 = pointAt(0) // start
      const p1 = pointAt(1) // end
      if (p0 && !p1) {
        // 有起点，橡皮筋跟随鼠标
        c.beginPath(); c.moveTo(p0.X, p0.Y); c.lineTo(cur.X, cur.Y); c.stroke()
      }
    } else if (kind === 'ARC') {
      // 字段顺序：center(0), start(1), end(2)
      const center = pointAt(0)
      const start = pointAt(1)
      if (center && !start) {
        // 阶段1：圆心已定 → 画圆心到鼠标的直线
        c.beginPath(); c.moveTo(center.X, center.Y); c.lineTo(cur.X, cur.Y); c.stroke()
      } else if (center && start) {
        // 阶段2：圆心+起点已定 → 辅助线 + 圆弧预览
        const radius = Math.hypot(start.X - center.X, start.Y - center.Y)
        if (radius < 1e-6) return
        const startDeg = Math.atan2(start.Y - center.Y, start.X - center.X) * 180 / Math.PI
        const endDeg = Math.atan2(cur.Y - center.Y, cur.X - center.X) * 180 / Math.PI
        // 辅助线：圆心到光标（淡色）
        c.setLineDash([])
        c.globalAlpha = 0.3
        c.beginPath(); c.moveTo(center.X, center.Y); c.lineTo(cur.X, cur.Y); c.stroke()
        c.globalAlpha = 1
        c.setLineDash(cfg.previewDash.map(d => d / store.viewport.zoom))
        // 圆弧预览
        const startRad = startDeg * Math.PI / 180
        const endRad = endDeg * Math.PI / 180
        const ccw = startDeg > endDeg
        c.beginPath()
        c.arc(center.X, center.Y, radius, startRad, endRad, ccw)
        c.stroke()
      }
    } else if (kind === 'CIRCLE') {
      // 字段顺序：center(0), P2(1)
      const center = pointAt(0)
      if (center) {
        const radius = Math.hypot(cur.X - center.X, cur.Y - center.Y)
        // 辅助线：圆心到光标
        c.setLineDash([])
        c.globalAlpha = 0.3
        c.beginPath(); c.moveTo(center.X, center.Y); c.lineTo(cur.X, cur.Y); c.stroke()
        c.globalAlpha = 1
        c.setLineDash(cfg.previewDash.map(d => d / store.viewport.zoom))
        // 圆预览
        c.beginPath(); c.arc(center.X, center.Y, radius, 0, Math.PI * 2); c.stroke()
      }
    } else if (kind === 'POLYLINE') {
      const mv = v[0]
      if (mv && mv.kind === 'multiPoint' && mv.points.length > 0) {
        const pts = mv.points
        c.beginPath(); c.moveTo(pts[0].X, pts[0].Y)
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].X, pts[i].Y)
        // 连接到光标
        c.lineTo(cur.X, cur.Y)
        c.stroke()
      }
    } else if (kind === 'BEZIER') {
      const mv = v[0]
      if (mv && mv.kind === 'multiPoint' && mv.points.length >= 2) {
        const pts = mv.points
        // 以光标作为临时末控点，采样实际贝塞尔曲线预览
        const allPts = [...pts, { X: cur.X, Y: cur.Y }]
        const curve = sampleBezierPoints(allPts, 48)
        if (curve.length >= 2) {
          c.beginPath(); c.moveTo(curve[0].X, curve[0].Y)
          for (let i = 1; i < curve.length; i++) c.lineTo(curve[i].X, curve[i].Y)
          c.stroke()
        }
        // 控制多边形（淡色实线）
        c.setLineDash([])
        c.globalAlpha = 0.25
        c.beginPath(); c.moveTo(pts[0].X, pts[0].Y)
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].X, pts[i].Y)
        c.lineTo(cur.X, cur.Y)
        c.stroke()
        c.globalAlpha = 1
        c.setLineDash(cfg.previewDash.map(d => d / store.viewport.zoom))
      }
    } else if (kind === 'ELLIPSE') {
      const p0 = pointAt(0) // center
      const p1 = pointAt(1) // shortAxis
      if (p0 && !p1) {
        c.beginPath(); c.moveTo(p0.X, p0.Y); c.lineTo(cur.X, cur.Y); c.stroke()
      } else if (p0 && p1) {
        // 短轴端点，计算椭圆并用光标作为长轴端点
        const ry = Math.hypot(p1.X - p0.X, p1.Y - p0.Y)
        const rx = Math.hypot(cur.X - p0.X, cur.Y - p0.Y)
        const rot = Math.atan2(p1.Y - p0.Y, p1.X - p0.X)
        c.beginPath()
        c.ellipse(p0.X, p0.Y, rx, ry, rot, 0, Math.PI * 2)
        c.stroke()
      }
    }

    c.setLineDash([])
  }

  // ── 命中检测 ─────────────────────────────────────────────────────────

  function hitThreshold(): number {
    return cfg.hitPx / store.viewport.zoom
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

  /**
   * 椭圆命中检测：
   * 1. 将点变换到椭圆局部坐标系（平移+旋转）
   * 2. 计算归一化距离，判断是否在椭圆边界阈值内
   * 3. 检查参数角是否在起止范围内
   */
  function hitEllipseEntity(world: Point2D, e: EllipseEntity, threshold: number): boolean {
    const rx = Math.hypot(e.majorAxisEnd.X, e.majorAxisEnd.Y)
    const ry = rx * e.minorAxisRatio
    if (rx < 1e-9) return false
    const rot = Math.atan2(e.majorAxisEnd.Y, e.majorAxisEnd.X)

    // 世界 → 椭圆局部（平移 + 反向旋转）
    const dx = world.X - e.center.X
    const dy = world.Y - e.center.Y
    const cosR = Math.cos(-rot)
    const sinR = Math.sin(-rot)
    const lx = dx * cosR - dy * sinR
    const ly = dx * sinR + dy * cosR

    // 归一化距离
    const nd = Math.hypot(lx / rx, ly / ry)
    const scaleAvg = Math.max(rx, ry)
    if (Math.abs(nd - 1) * scaleAvg > threshold) return false

    // 部分椭圆：检查参数角
    const na = normDeg(e.startParamDeg)
    const ne = normDeg(e.endParamDeg)
    if (Math.abs(ne - na) < 0.01 && Math.abs(360 - Math.abs(e.endParamDeg - e.startParamDeg)) < 0.01) {
      return true // 接近全椭圆，不检查角度
    }

    const paramDeg = (Math.atan2(ly / ry, lx / rx) * 180) / Math.PI
    const np = normDeg(paramDeg)
    const angleTol = (threshold / scaleAvg) * (180 / Math.PI) + 2

    if (e.startParamDeg <= e.endParamDeg) {
      // CCW
      return np >= na - angleTol && np <= ne + angleTol
    }
    // CW
    return np <= na + angleTol && np >= ne - angleTol
  }

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
        return hitEllipseEntity(world, entity, threshold)
      default:
        return false
    }
  }

  /** 返回命中的实体 id（按绘制顺序反向，后绘制的优先），未命中返回 null */
  function hitTest(world: Point2D): string | null {
    const threshold = hitThreshold()
    const visibleLayerIds = new Set(
      store.layers.filter(l => l.visible).map(l => l.id)
    )
    for (let i = store.entities.length - 1; i >= 0; i--) {
      const e = store.entities[i]
      if (visibleLayerIds.has(e.layerId) && hitTestEntity(world, e, threshold)) {
        return e.id
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
    const visibleLayerIds = new Set(
      store.layers.filter(l => l.visible).map(l => l.id)
    )
    for (const e of store.entities) {
      if (!visibleLayerIds.has(e.layerId)) continue
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
      // 点击式绘制：委托给交互状态机
      drawInteraction.handleCanvasClick(world)
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

    cursorX.value = world.X
    cursorY.value = world.Y
    cursorWorld.value = world

    if (store.activeTool === 'SELECT') {
      if (selectionRect.value) {
        selectionRect.value = { start: selectionRect.value.start, end: { ...world } }
        scheduleRender()
      } else {
        const prev = hoveredId.value
        hoveredId.value = hitTest(world)
        if (prev !== hoveredId.value) scheduleRender()
      }
    } else if (store.activeTool === 'DRAW' && drawInteraction.isActive.value) {
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
    } else if (tool === 'DRAW') {
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

  // ── 键盘事件 ─────────────────────────────────────────────────────────

  function handleKeyDown(e: KeyboardEvent) {
    if (store.activeTool !== 'DRAW' || !drawInteraction.isActive.value) return

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        drawInteraction.cancel()
        scheduleRender()
        break
      case 'Enter':
        e.preventDefault()
        drawInteraction.commit()
        scheduleRender()
        break
      case 'Backspace':
        e.preventDefault()
        drawInteraction.popLastPoint()
        scheduleRender()
        break
    }
  }

  // ── 生命周期 ─────────────────────────────────────────────────────────

  function setup() {
    const canvas = canvasRef.value
    if (!canvas) return

    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    // 阻止 canvas 上的右键菜单，右键提交 multiPoint 工具
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault()
      if (store.activeTool === 'DRAW' && drawInteraction.isActive.value) {
        drawInteraction.commit()
        scheduleRender()
      }
    })
    window.addEventListener('keydown', handleKeyDown)

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
    window.removeEventListener('keydown', handleKeyDown)
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

  return { canvasRef, setup, cleanup, reloadConfig }
}