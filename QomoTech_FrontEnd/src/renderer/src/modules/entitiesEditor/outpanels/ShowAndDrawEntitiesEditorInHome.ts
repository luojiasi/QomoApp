// ShowAndDrawEntitiesEditorInHome.ts
// entitiesEditor 实体在 Home 页相机画面上的 2D SVG 叠加展示
//
// 与 editor/panels/ShowAndDrawPanel.vue 对等，但数据源为 useEditorStore()
// 支持 LINE / ARC / CIRCLE / POLYLINE / BEZIER / ELLIPSE / DIAMOND

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '../stores/editorStore'
import { useHardwareState } from '@/shared/api/hardware'
import type { Point2D, EditorEntity, SurfaceEntity } from '../commons/types'
import type { Ref, ComputedRef } from 'vue'

export interface ShowAndDrawEntitiesEditorInHomeProps {
  scale?: number
  upperOpeningMm?: number | null
  xyOffset?: { x: number; y: number } | null
  runTrigger?: boolean
}

const STORAGE_KEY = 'qomo.entitiesEditor.showAndDrawInHome.localScale'

// ── 倍率/颜色设置 ────────────────────────────────────────

export interface LocalScaleSettings {
  scaleX: number
  scaleY: number
  crosshairStrokeMul: number
  entityStrokeMul: number
  entityStrokeColor: string
}

function coerceFinitePositive(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function coerceHexColor(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback
}

function loadScaleSettings(): LocalScaleSettings {
  const defaults: LocalScaleSettings = {
    scaleX: 1,
    scaleY: 1,
    crosshairStrokeMul: 1,
    entityStrokeMul: 1,
    entityStrokeColor: '#00ccff'
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const obj = JSON.parse(raw) as Partial<LocalScaleSettings>
    return {
      scaleX: coerceFinitePositive(obj.scaleX, defaults.scaleX),
      scaleY: coerceFinitePositive(obj.scaleY, defaults.scaleY),
      crosshairStrokeMul: coerceFinitePositive(obj.crosshairStrokeMul, defaults.crosshairStrokeMul),
      entityStrokeMul: coerceFinitePositive(obj.entityStrokeMul, defaults.entityStrokeMul),
      entityStrokeColor: coerceHexColor(obj.entityStrokeColor, defaults.entityStrokeColor)
    }
  } catch {
    return defaults
  }
}

// ── SVG 路径工具 ──────────────────────────────────────────

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(centerX, centerY, radius, startAngle)
  const end = polarToCartesian(centerX, centerY, radius, endAngle)
  let sweep = endAngle - startAngle
  while (sweep > 360) sweep -= 360
  while (sweep <= -360) sweep += 360
  if (Math.abs(sweep) < 1e-9) sweep = 360
  const largeArcFlag = Math.abs(sweep) > 180 ? 1 : 0
  const sweepFlag = sweep > 0 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`
}

function pointsToPolylineD(points: Point2D[]): string {
  if (points.length === 0) return ''
  const cmds = [`M ${points[0].X} ${points[0].Y}`]
  for (let i = 1; i < points.length; i++) {
    cmds.push(`L ${points[i].X} ${points[i].Y}`)
  }
  return cmds.join(' ')
}

// ── 主 composable ────────────────────────────────────────

export interface ShowAndDrawEntitiesEditorInHomeReturn {
  hostRef: Ref<HTMLDivElement | null>
  showScalePanel: Ref<boolean>
  showColorPanel: Ref<boolean>
  scaleSettings: LocalScaleSettings
  resetScaleSettings: () => void
  worldTransform: ComputedRef<string>
  machineFollowTransform: ComputedRef<string>
  crosshairStrokeWidth: ComputedRef<number>
  entityStrokeWidth: ComputedRef<number>
  visibleEntities: ComputedRef<SurfaceEntity<EditorEntity>[]>
  selectedIdSet: ComputedRef<Set<string>>
  getEntityStrokeColor: (entityId: string) => string
  getEntityStrokeWidth: (entityId: string) => number
  getArcPath: (e: Extract<EditorEntity, { kind: 'ARC' }>) => string
  getBezierPath: (e: Extract<EditorEntity, { kind: 'BEZIER' }>) => string
  getPolylineSegments: (
    e: Extract<EditorEntity, { kind: 'POLYLINE' }>
  ) => { x1: number; y1: number; x2: number; y2: number }[]
  getEllipseAttrs: (e: Extract<EditorEntity, { kind: 'ELLIPSE' }>) => {
    rx: number
    ry: number
    rotationDeg: number
  }
}

export function useShowAndDrawEntitiesEditorInHome(
  props: ShowAndDrawEntitiesEditorInHomeProps = {}
): ShowAndDrawEntitiesEditorInHomeReturn {
  const store = useEditorStore()
  const { viewport, layers, entities, selectedIds } = storeToRefs(store)

  const { mposition } = useHardwareState()

  const machineMposXY = computed(() => ({
    x: Number.isFinite(mposition.value.X) ? mposition.value.X : 0,
    y: Number.isFinite(mposition.value.Y) ? mposition.value.Y : 0
  }))

  const machineFollowTransform = computed(() => {
    if (!props.runTrigger) return 'translate(0 0)'
    return `translate(${-machineMposXY.value.x + (props.xyOffset?.x ?? 0)} ${-machineMposXY.value.y + (props.xyOffset?.y ?? 0)})`
  })

  // ── 宿主容器尺寸 ────────────────────────────────────────

  const hostRef = ref<HTMLDivElement | null>(null)
  let ro: ResizeObserver | null = null

  onMounted(() => {
    if (!hostRef.value) return
    ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      store.setViewportSize(rect.width, rect.height)
    })
    ro.observe(hostRef.value)
  })

  onBeforeUnmount(() => {
    ro?.disconnect()
    ro = null
  })

  // ── 倍率/颜色设置面板 ──────────────────────────────────────

  const showScalePanel = ref(false)
  const showColorPanel = ref(false)

  const scaleSettings = reactive<LocalScaleSettings>(loadScaleSettings())

  const persistScaleSettings = (): void => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          scaleX: scaleSettings.scaleX,
          scaleY: scaleSettings.scaleY,
          crosshairStrokeMul: scaleSettings.crosshairStrokeMul,
          entityStrokeMul: scaleSettings.entityStrokeMul,
          entityStrokeColor: scaleSettings.entityStrokeColor
        } satisfies LocalScaleSettings)
      )
    } catch {
      /* ignore */
    }
  }

  watch(
    () => ({ ...scaleSettings }),
    () => {
      scaleSettings.scaleX = coerceFinitePositive(scaleSettings.scaleX, 1)
      scaleSettings.scaleY = coerceFinitePositive(scaleSettings.scaleY, 1)
      scaleSettings.crosshairStrokeMul = coerceFinitePositive(scaleSettings.crosshairStrokeMul, 1)
      scaleSettings.entityStrokeMul = coerceFinitePositive(scaleSettings.entityStrokeMul, 1)
      scaleSettings.entityStrokeColor = coerceHexColor(scaleSettings.entityStrokeColor, '#00ccff')
      persistScaleSettings()
    },
    { deep: true }
  )

  function resetScaleSettings(): void {
    scaleSettings.scaleX = 1
    scaleSettings.scaleY = 1
    scaleSettings.crosshairStrokeMul = 1
    scaleSettings.entityStrokeMul = 1
    scaleSettings.entityStrokeColor = '#00ccff'
    persistScaleSettings()
  }

  // ── 坐标变换 ────────────────────────────────────────────

  const effectiveZoomX = computed(() =>
    Math.max(
      viewport.value.zoom * (props.scale ?? 1) * coerceFinitePositive(scaleSettings.scaleX, 1),
      1e-6
    )
  )
  const effectiveZoomY = computed(() =>
    Math.max(
      viewport.value.zoom * (props.scale ?? 1) * coerceFinitePositive(scaleSettings.scaleY, 1),
      1e-6
    )
  )

  const worldTransform = computed(() => {
    const centerX = viewport.value.width / 2
    const centerY = viewport.value.height / 2
    return `translate(${centerX} ${centerY}) scale(${effectiveZoomX.value} ${-effectiveZoomY.value})`
  })

  const worldStrokeWidth = computed(() =>
    Math.max(1 / Math.max(effectiveZoomX.value, effectiveZoomY.value), 0.5)
  )

  const crosshairStrokeWidth = computed(
    () => worldStrokeWidth.value * coerceFinitePositive(scaleSettings.crosshairStrokeMul, 1)
  )

  const entityStrokeWidth = computed(
    () => worldStrokeWidth.value * coerceFinitePositive(scaleSettings.entityStrokeMul, 1)
  )

  // ── 可见实体过滤 ─────────────────────────────────────────

  const visibleLayerIdSet = computed(
    () => new Set(layers.value.filter((l) => l.visible).map((l) => l.id))
  )

  const visibleEntities = computed(() =>
    entities.value.filter((e) => visibleLayerIdSet.value.has(e.layerId))
  )

  // ── 选中高亮 ────────────────────────────────────────────

  const selectedIdSet = computed<Set<string>>(() => new Set(selectedIds.value))

  function getEntityStrokeColor(entityId: string): string {
    return selectedIdSet.value.has(entityId) ? '#facc15' : scaleSettings.entityStrokeColor
  }

  function getEntityStrokeWidth(entityId: string): number {
    return selectedIdSet.value.has(entityId) ? entityStrokeWidth.value * 2 : entityStrokeWidth.value
  }

  // ── 各类型实体的 SVG 路径 / 属性 ──────────────────────────

  function getArcPath(e: Extract<EditorEntity, { kind: 'ARC' }>): string {
    return describeArc(e.center.X, e.center.Y, e.radius, e.startAngle, e.endAngle)
  }

  function getBezierPath(e: Extract<EditorEntity, { kind: 'BEZIER' }>): string {
    return pointsToPolylineD(e.controlPoints)
  }

  function getPolylineSegments(
    e: Extract<EditorEntity, { kind: 'POLYLINE' }>
  ): { x1: number; y1: number; x2: number; y2: number }[] {
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = []
    const verts = e.vertices
    for (let i = 0; i < verts.length; i++) {
      const curr = verts[i].point
      const next = e.closed ? verts[(i + 1) % verts.length].point : verts[i + 1]?.point
      if (!next) break
      segs.push({ x1: curr.X, y1: curr.Y, x2: next.X, y2: next.Y })
    }
    return segs
  }

  function getEllipseAttrs(e: Extract<EditorEntity, { kind: 'ELLIPSE' }>): {
    rx: number
    ry: number
    rotationDeg: number
  } {
    const rx = Math.sqrt(e.majorAxisEnd.X ** 2 + e.majorAxisEnd.Y ** 2)
    const ry = rx * e.minorAxisRatio
    const rotationDeg = Math.atan2(e.majorAxisEnd.Y, e.majorAxisEnd.X) * (180 / Math.PI)
    return { rx, ry, rotationDeg }
  }

  return {
    hostRef,
    // panels
    showScalePanel,
    showColorPanel,
    scaleSettings,
    resetScaleSettings,
    // transforms
    worldTransform,
    machineFollowTransform,
    crosshairStrokeWidth,
    entityStrokeWidth,
    // entities
    visibleEntities,
    selectedIdSet,
    getEntityStrokeColor,
    getEntityStrokeWidth,
    // SVG helpers
    getArcPath,
    getBezierPath,
    getPolylineSegments,
    getEllipseAttrs
  }
}
