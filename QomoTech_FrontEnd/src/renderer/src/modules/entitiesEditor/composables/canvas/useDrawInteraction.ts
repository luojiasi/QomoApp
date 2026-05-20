// =============================================================================
// useDrawInteraction — 绘制状态机
//
// 管理"点击画布→填写参数→完成实体"的节拍驱动流程。
// 策略定义与几何构造委托给 drawStrategies.ts。
//
// 老 editor (QomoCanvas.vue) 的等价物：
//   - 每个工具一组 draft refs（lineDraftStart/End, arcDraftCenter/Start/End, etc.）
//   - handlePointerMove 更新 draft 以驱动 SVG 预览
//   - handle…ToolPoint 管理点击→阶段推进→最终 commit
//
// 本模块将这些逻辑抽象为统一的 DrawSession 状态机。
// =============================================================================

import { computed, ref, watch } from 'vue'
import type { Point2D, EntityKind, DiamondShape, ContourSegment } from '../../commons/types'
import type { DrawStrategyDef, FieldDef } from './drawStrategies'
import { useEditorStore } from '../../stores/editorStore'
import { getDefaultStrategy } from './drawStrategies'
import { DIAMOND_PRESETS } from '../../configs/defaults'
import { getShapeDef } from '../preview/diamount'

// ── 字段运行时值 ────────────────────────────────────────

type FieldValue =
  | { kind: 'point'; value: Point2D; filled: boolean }
  | { kind: 'number'; value: number }
  | { kind: 'multiPoint'; points: Point2D[]; bulges: number[] }
  | { kind: 'toggle'; value: boolean }

/** 当前绘制会话 */
export interface DrawSession {
  kind: EntityKind           //类型
  strategy: DrawStrategyDef  //策略
  values: FieldValue[]       //值
  activeIdx: number          // 当前等待输入的字段索引
}

// ── 辅助 ───────────────────────────────────────────────

/** 根据 FieldDef 创建对应的空值 */
function emptyValue(def: FieldDef): FieldValue {
  switch (def.kind) {
    case 'point':
      return { kind: 'point', value: { X: 0, Y: 0 }, filled: false }
    case 'number':
      return { kind: 'number', value: (def.default as number) ?? 0 }
    case 'multiPoint':
      return { kind: 'multiPoint', points: [], bulges: [] }
    case 'toggle':
      return { kind: 'toggle', value: (def.default as boolean) ?? false }
  }
}

// ── 几何工具（内联，避免循环依赖） ──────────────────────

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.X - b.X, a.Y - b.Y)
}

function pointToAngleDeg(center: Point2D, p: Point2D): number {
  return (Math.atan2(p.Y - center.Y, p.X - center.X) * 180) / Math.PI
}

/** CCW 角度差 [0, 360) */
function ccwDelta(fromDeg: number, toDeg: number): number {
  const norm = (a: number) => ((a % 360) + 360) % 360
  return (norm(toDeg) - norm(fromDeg) + 360) % 360
}

// =============================================================================

export function useDrawInteraction() {
  const store = useEditorStore()

  // ── 响应式状态 ──
  const session = ref<DrawSession | null>(null)

  // ── 派生 ──
  const isActive = computed(() => session.value !== null)

  // ── 内部方法 ──────────────────────────────────────────

  /** 启动新会话
  DrawSession {
    kind: 'LINE',
    strategy: { id: 'two-point', fields: [{id:'start',kind:'point'}, {id:'end',kind:'point'}] },
    values: [ {kind:'point', filled:false}, {kind:'point', filled:false} ],
    activeIdx: 0,   // 当前等待输入第几个字段
  }
   */
  function _start(kind: EntityKind) {
    const strategy = getDefaultStrategy(kind)   //获取默认策略
    session.value = {
      kind,
      strategy,
      values: strategy.fields.map(emptyValue),
      activeIdx: 0,
    }
  }

  /**
   * 获取当前活动字段定义。
   * activeIdx 可能已越界（全部填完但未 commit），此时返回 null。
   */
  function _activeFieldDef(): FieldDef | null {
    const s = session.value
    if (!s) return null
    if (s.activeIdx >= s.strategy.fields.length) return null
    return s.strategy.fields[s.activeIdx]
  }

  /** 推进到下一个字段 */
  function _advance() {
    const s = session.value
    if (!s) return
    s.activeIdx++
  }

  /** 检查是否全部字段已填写完毕 */
  function _allFieldsFilled(): boolean {
    const s = session.value
    if (!s) return false
    return s.activeIdx >= s.strategy.fields.length
  }

  /** 构建实体数据并提交到 store */
  function _commit() {
    const s = session.value
    if (!s) return
    const v = s.values
    const input = buildEntityInput(s.kind, s.strategy.id, v, store.diamondShape)
    if (input) {
      if (s.kind === 'DIAMOND') store.setDiamondShape(null)
      store.addEntity(input as any)
    }
    session.value = null
  }

  // ── 公开 API ──────────────────────────────────────────

  /**
   * 画布点击处理。
   * - point 字段：填入世界坐标 → 推进
   * - multiPoint 字段：追加顶点（不推进，持续收集）
   * - toggle 字段：不通过点击操作（由工具栏控制）
   *
   * @param world - 点击位置的世界坐标
   */
  function handleCanvasClick(world: Point2D) {
    // 无活动 session 但仍在 DRAW 模式 → 自动重启
    if (!session.value) {
      if (store.activeTool === 'DRAW' && store.drawSubTool) {
        _start(store.drawSubTool)
      }
      if (!session.value) return
    }

    // 获取当前等待的字段定义
    const s = session.value!
    const def = _activeFieldDef()
    if (!def) {
      // 全部字段已填完：可以作为"额外顶点"追加到最后一个 multiPoint
      _tryAppendToLastMultiPoint(world)
      return
    }

    switch (def.kind) {
      case 'point': {
        const fv = s.values[s.activeIdx]
        if (fv.kind === 'point') {
          fv.value = { X: world.X, Y: world.Y }
          fv.filled = true
        }
        _advance()

        // 所有 point 字段填完后自动 commit
        if (_allFieldsFilled()) _commit()
        break
      }
      case 'multiPoint':
        // 第一个点：初始化为数组并填入
        // 后续点：追加
        _tryAppendToLastMultiPoint(world)
        break
      case 'toggle':
        // 不处理（通过 UI 切换）
        break
      case 'number':
        // 不处理（通过 UI 输入）
        break
    }
  }

  /** 尝试将点追加到当前或最后一个 multiPoint 字段 */
  function _tryAppendToLastMultiPoint(world: Point2D) {
    const s = session.value
    if (!s) return

    // 先看当前 activeIdx 的字段
    let fv = s.values[s.activeIdx]
    if (fv && fv.kind === 'multiPoint') {
      fv.points.push({ X: world.X, Y: world.Y })
      fv.bulges.push(0)
      return
    }

    // 回看上一个字段（activeIdx 已落后的情况）
    const prevIdx = s.activeIdx - 1
    if (prevIdx >= 0) {
      fv = s.values[prevIdx]
      if (fv && fv.kind === 'multiPoint') {
        fv.points.push({ X: world.X, Y: world.Y })
        fv.bulges.push(0)
      }
    }
  }

  /**
   * 提交当前绘制。
   * - 对于 point-only 策略：全部字段填完自动调用
   * - 对于 multiPoint 策略：用户按 Enter / 右键 / 双击 触发
   * - toggle 字段保持当前值
   */
  function commit() {
    const s = session.value
    if (!s) return

    // 确保 toggle 字段被推进（如果它是最后一步）
    while (s.activeIdx < s.strategy.fields.length) {
      const def = s.strategy.fields[s.activeIdx]
      if (def.kind === 'toggle') {
        _advance()
      } else if (def.kind === 'multiPoint') {
        // multiPoint 至少需要一个点
        const fv = s.values[s.activeIdx]
        if (fv.kind === 'multiPoint' && fv.points.length === 0) {
          // 没有点，不提交
          return
        }
        _advance()
      } else {
        // 还有未填充的 point/number，不提交
        return
      }
    }

    _commit()
  }

  /** 取消当前绘制（不提交） */
  function cancel() {
    session.value = null
  }

  /** 删除 multiPoint 的最后一个顶点（Undo 点） */
  function popLastPoint() {
    const s = session.value
    if (!s) return
    // 找到最后一个 multiPoint 字段
    for (let i = s.values.length - 1; i >= 0; i--) {
      const fv = s.values[i]
      if (fv.kind === 'multiPoint' && fv.points.length > 0) {
        fv.points.pop()
        fv.bulges.pop()
        // 如果清空了，回退 activeIdx
        if (fv.points.length === 0 && s.activeIdx > i) {
          // 保持 activeIdx 不变（让用户重新从 multiPoint 开始）
        }
        return
      }
    }
    // 没有 multiPoint → 回退上一个 point 字段
    if (s.activeIdx > 0) {
      s.activeIdx--
    }
  }

  // ── 监听 ──────────────────────────────────────────────

  // 切换到 DRAW 以外的模式 → 取消绘制
  watch(
    () => store.activeTool,
    (tool) => {
      if (tool !== 'DRAW') {
        cancel()
      } else if (!session.value && store.drawSubTool) {
        _start(store.drawSubTool)
      }
    },
  )

  // drawSubTool 变化 → 切换图元类型，启动新会话
  watch(
    () => store.drawSubTool,
    (kind) => {
      if (store.activeTool === 'DRAW' && kind) _start(kind)
    },
  )

  // ── Public API ────────────────────────────────────────

  return {
    session,
    isActive,
    handleCanvasClick,
    commit,
    cancel,
    popLastPoint,
  }
}

// =============================================================================
// 实体构造器 — 根据策略和字段值构建 AddEntityInput
// =============================================================================

function buildEntityInput(
  kind: EntityKind,
  _strategyId: string,
  values: FieldValue[],
  diamondShape: DiamondShape | null,
): object | null {
  switch (kind) {
    case 'LINE':
      return buildLine(values)
    case 'ARC':
      return buildArc(_strategyId, values)
    case 'CIRCLE':
      return buildCircle(_strategyId, values)
    case 'POLYLINE':
      return buildPolyline(values)
    case 'BEZIER':
      return buildBezier(values)
    case 'ELLIPSE':
      return buildEllipse(values)
    case 'DIAMOND':
      return buildDiamond(values, diamondShape)
    default:
      return null
  }
}

function buildLine(values: FieldValue[]): object | null {
  const start = (values[0] as any)?.value as Point2D | undefined
  const end = (values[1] as any)?.value as Point2D | undefined
  if (!start || !end) return null
  return { kind: 'LINE' as const, start, end }
}

function buildArc(_strategyId: string, values: FieldValue[]): object | null {
  // center-radius-angle: 字段顺序 center, start, end
  const center = (values[0] as any)?.value as Point2D | undefined
  const start = (values[1] as any)?.value as Point2D | undefined
  const end = (values[2] as any)?.value as Point2D | undefined
  if (!center || !start || !end) return null

  const radius = dist(center, start)
  if (radius < 1e-6) return null

  const startAngle = pointToAngleDeg(center, start)
  const rawEndAngle = pointToAngleDeg(center, end)

  // 将终点角度归一化到从 startAngle 开始 CCW 的那个方向
  const sweep = ccwDelta(startAngle, rawEndAngle)
  const endAngle = startAngle + (sweep < 1e-6 ? 360 : sweep)

  return {
    kind: 'ARC' as const,
    center,
    radius,
    startAngle,
    endAngle,
    startPoint: start,
    endPoint: end,
  }
}

function buildCircle(_strategyId: string, values: FieldValue[]): object | null {
  // two-point: 字段顺序 center, P2
  const center = (values[0] as any)?.value as Point2D | undefined
  const p2 = (values[1] as any)?.value as Point2D | undefined
  if (!center || !p2) return null

  const radius = dist(center, p2)
  if (radius < 1e-6) return null

  return { kind: 'CIRCLE' as const, center, radius }
}

function buildPolyline(values: FieldValue[]): object | null {
  const fv = values[0]
  if (fv.kind !== 'multiPoint' || fv.points.length < 2) return null
  const toggle = values[1]
  const closed = toggle?.kind === 'toggle' ? toggle.value : false

  return {
    kind: 'POLYLINE' as const,
    closed,
    vertices: fv.points.map((p, i) => ({ point: p, bulge: fv.bulges[i] ?? 0 })),
  }
}

function buildBezier(values: FieldValue[]): object | null {
  const fv = values[0]
  if (fv.kind !== 'multiPoint' || fv.points.length < 2) return null

  return {
    kind: 'BEZIER' as const,
    controlPoints: fv.points.map((p) => ({ ...p })),
  }
}

function buildEllipse(values: FieldValue[]): object | null {
  // center-axes: 字段顺序 center, shortAxis, longAxis
  const center = (values[0] as any)?.value as Point2D | undefined
  const shortAxis = (values[1] as any)?.value as Point2D | undefined
  const longAxis = (values[2] as any)?.value as Point2D | undefined
  if (!center || !shortAxis || !longAxis) return null

  const rx = dist(center, longAxis)
  const ry = dist(center, shortAxis)
  if (rx < 1e-6 || ry < 1e-6) return null

  const majorAxisEnd: Point2D = {
    X: longAxis.X - center.X,
    Y: longAxis.Y - center.Y,
  }
  const minorAxisRatio = ry / rx

  return {
    kind: 'ELLIPSE' as const,
    center,
    majorAxisEnd,
    minorAxisRatio,
    startParamDeg: 0,
    endParamDeg: 360,
  }
}

function buildDiamond(values: FieldValue[], diamondShape: DiamondShape | null): object | null {
  const center = (values[0] as any)?.value as Point2D | undefined
  const p2 = (values[1] as any)?.value as Point2D | undefined
  if (!center || !p2) return null

  const radius = dist(center, p2)
  if (radius < 1e-6) return null

  const shape = diamondShape ?? 'ROUND'
  const diameter = radius * 2

  const L = radius
  const W = radius

  let contours: ContourSegment[] | undefined
  if (shape !== 'ROUND') {
    const shapeDef = getShapeDef(shape)
    contours = shapeDef.get2DContours(center, L, W)
  }

  return {
    kind: 'DIAMOND' as const,
    center,
    radius,
    contours,
    diamondParams: { ...DIAMOND_PRESETS[shape], shape, L: diameter, W: diameter },
  }
}