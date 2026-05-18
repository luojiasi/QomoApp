// =============================================================================
// useDrawParamerBar — 参数面板逻辑
//
// 通过 inject 获取 drawInteraction 实例，提供坐标输入、按钮操作的桥接。
// 支持四种字段类型：point / multiPoint / toggle / number。
// =============================================================================

import { inject, ref, watch, computed } from 'vue'
import type { DrawSession } from './useDrawInteraction'
import type { FieldDef } from './drawStrategies'
import type { Point2D } from '../../commons/types'

/** drawInteraction 实例类型（最小接口） */
interface DrawInteractionApi {
  session: { value: DrawSession | null }
  isActive: { value: boolean }
  handleCanvasClick: (world: Point2D) => void
  commit: () => void
  cancel: () => void
  popLastPoint: () => void
}

/** 实体类型 → 中文名称 */
const KIND_NAME: Record<string, string> = {
  LINE: '直线',
  ARC: '圆弧',
  CIRCLE: '圆',
  ELLIPSE: '椭圆',
  POLYLINE: '多段线',
  BEZIER: '贝塞尔曲线',
}

export function useDrawParamerBar() {
  const di = inject<DrawInteractionApi>('drawInteraction')

  const pointX = ref(0)
  const pointY = ref(0)

  // ── 派生 ──────────────────────────────────────────────

  const session = computed(() => di?.session.value ?? null)
  const isActive = computed(() => di?.isActive.value ?? false)

  /** 当前实体类型中文名 */
  const kindName = computed(() => {
    const s = session.value
    return s ? (KIND_NAME[s.kind] ?? s.kind) : ''
  })

  /** 当前等待输入的字段定义 */
  const activeFieldDef = computed<FieldDef | null>(() => {
    const s = session.value
    if (!s || s.activeIdx >= s.strategy.fields.length) return null
    return s.strategy.fields[s.activeIdx]
  })

  /** 当前已添加的 multiPoint 顶点 */
  const multiPoints = computed<Point2D[]>(() => {
    const s = session.value
    if (!s) return []
    for (const fv of s.values) {
      if (fv.kind === 'multiPoint') return fv.points
    }
    return []
  })

  /** 当前 multiPoint 的 bulge 数组 */
  const bulges = computed<number[]>(() => {
    const s = session.value
    if (!s) return []
    for (const fv of s.values) {
      if (fv.kind === 'multiPoint') return fv.bulges
    }
    return []
  })

  /** multiPoint 是否可提交（≥2 个顶点） */
  const canComplete = computed(() => multiPoints.value.length >= 2)

  /** 当前 toggle 字段的值 */
  const toggleValue = computed(() => {
    const s = session.value
    if (!s) return false
    const def = activeFieldDef.value
    if (def?.kind === 'toggle') {
      const fv = s.values[s.activeIdx]
      if (fv?.kind === 'toggle') return fv.value
    }
    // 也检查前一个字段（activeIdx 已推进，toggle 在后面）
    for (const fv of s.values) {
      if (fv.kind === 'toggle') return fv.value
    }
    return false
  })

  /** 翻转 toggle 值 */
  function toggleToggle() {
    if (!di) return
    const s = session.value
    if (!s) return
    for (const fv of s.values) {
      if (fv.kind === 'toggle') {
        fv.value = !fv.value
        return
      }
    }
  }

  // ── 监听：字段切换时重置坐标输入 ──────────────────────
  watch(
    () => session.value?.activeIdx,
    () => {
      pointX.value = 0
      pointY.value = 0
    },
  )

  // ── 操作 ──────────────────────────────────────────────

  /** point 字段：填入坐标并推进 */
  function completePoint() {
    if (!di) return
    di.handleCanvasClick({ X: pointX.value, Y: pointY.value })
  }

  /** multiPoint 字段：追加顶点 */
  function addPoint() {
    if (!di) return
    di.handleCanvasClick({ X: pointX.value, Y: pointY.value })
    pointX.value = 0
    pointY.value = 0
  }

  /** 更新指定顶点的 bulge 值 */
  function updateBulge(idx: number, value: number) {
    const s = session.value
    if (!s) return
    for (const fv of s.values) {
      if (fv.kind === 'multiPoint' && idx < fv.bulges.length) {
        fv.bulges[idx] = value
        return
      }
    }
  }

  /** 完成绘制（对 multiPoint / toggle 字段） */
  function complete() {
    di?.commit()
  }

  /** 撤销：删除最后一个顶点或回退一个字段 */
  function undo() {
    di?.popLastPoint()
  }

  /** 取消绘制 */
  function cancel() {
    di?.cancel()
  }

  return {
    pointX,
    pointY,
    session,
    isActive,
    kindName,
    activeFieldDef,
    multiPoints,
    bulges,
    canComplete,
    toggleValue,
    toggleToggle,
    completePoint,
    addPoint,
    updateBulge,
    complete,
    undo,
    cancel,
  }
}
