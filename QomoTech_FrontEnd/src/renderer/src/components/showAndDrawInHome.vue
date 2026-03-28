<template>
  <!-- Home 页相机画面的叠加层：只做“平面展示实体位置”（不提供交互） -->
  <div ref="hostRef" class="pointer-events-none absolute inset-0 z-20">
    <!-- 左下角：倍率设置 -->
    <div class="pointer-events-auto absolute bottom-2 left-2">
      <button
        type="button"
        class="rounded bg-black/40 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/50"
        @click="showScalePanel = !showScalePanel"
      >
        倍率
      </button>
    </div>

    <div
      v-if="showScalePanel"
      class="pointer-events-auto absolute bottom-2 left-2 rounded-md bg-black/40 p-2 text-xs text-white backdrop-blur"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="font-medium">显示倍率</div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
            @click="resetScaleSettings"
          >
            重置
          </button>
          <button
            type="button"
            class="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
            @click="showScalePanel = false"
          >
            关闭
          </button>
        </div>
      </div>

      <div class="grid gap-2" style="grid-template-columns: auto 1fr auto">
        <div class="opacity-90">X 倍率</div>
        <div></div>
        <input
          v-model.number="scaleSettings.scaleX"
          type="number"
          min="0.001"
          max="1000"
          step="0.05"
          class="w-24 rounded bg-black/30 px-1"
        />

        <div class="opacity-90">Y 倍率</div>
        <div></div>
        <input
          v-model.number="scaleSettings.scaleY"
          type="number"
          min="0.001"
          max="1000"
          step="0.05"
          class="w-24 rounded bg-black/30 px-1"
        />

        <div class="opacity-90">十字线粗细</div>
        <div></div>
        <input
          v-model.number="scaleSettings.crosshairStrokeMul"
          type="number"
          min="0.1"
          max="50"
          step="0.1"
          class="w-24 rounded bg-black/30 px-1"
        />

        <div class="opacity-90">实体线粗细</div>
        <div></div>
        <input
          v-model.number="scaleSettings.entityStrokeMul"
          type="number"
          min="0.1"
          max="50"
          step="0.1"
          class="w-24 rounded bg-black/30 px-1"
        />
      </div>
    </div>

    <svg class="h-full w-full">
      <g :transform="worldTransform">
        <!-- 十字线固定在世界原点 (0,0)，不随机床 MPOS 平移 -->
        <line
          x1="-10000"
          y1="0"
          x2="10000"
          y2="0"
          stroke="rgba(248,113,113,0.35)"
          :stroke-width="crosshairStrokeWidth"
          vector-effect="non-scaling-stroke"
        />
        <line
          x1="0"
          y1="-10000"
          x2="0"
          y2="10000"
          stroke="rgba(96,165,250,0.35)"
          :stroke-width="crosshairStrokeWidth"
          vector-effect="non-scaling-stroke"
        />

        <!-- 仅实体随机床平移显示，不改 Pinia 几何 -->
        <g :transform="machineFollowTransform">
          <template v-for="entity in visibleEntities" :key="entity.id">
          <line
            v-if="entity.type === 'LINE'"
            :x1="entity.start.x"
            :y1="entity.start.y"
            :x2="entity.end.x"
            :y2="entity.end.y"
            stroke="rgba(255,255,255,0.92)"
            :stroke-width="entityStrokeWidth"
            vector-effect="non-scaling-stroke"
            stroke-linecap="round"
          />

          <path
            v-else-if="entity.type === 'ARC'"
            :d="describeArc(entity.center.x, entity.center.y, entity.radius, entity.startAngle, entity.endAngle)"
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            :stroke-width="entityStrokeWidth"
            vector-effect="non-scaling-stroke"
            stroke-linecap="round"
          />

          <circle
            v-else-if="entity.type === 'CIRCLE'"
            :cx="entity.center.x"
            :cy="entity.center.y"
            :r="entity.radius"
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            :stroke-width="entityStrokeWidth"
            vector-effect="non-scaling-stroke"
          />

          <path
            v-else-if="entity.type === 'BEZIER'"
            :d="getBezierCurvePathD(entity.points)"
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            :stroke-width="entityStrokeWidth"
            vector-effect="non-scaling-stroke"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <template v-else-if="isOvalEntity(entity)">
            <ellipse
              :cx="entity.center.x"
              :cy="entity.center.y"
              :rx="entity.radiusX"
              :ry="entity.radiusY"
              fill="none"
              stroke="rgba(255,255,255,0.92)"
              :stroke-width="entityStrokeWidth"
              vector-effect="non-scaling-stroke"
              :transform="`rotate(${entity.rotationDeg} ${entity.center.x} ${entity.center.y})`"
            />
          </template>

          <path
            v-else-if="isPathIrregularEntity(entity)"
            :d="getIrregularPathD(entity)"
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            :stroke-width="entityStrokeWidth"
            vector-effect="non-scaling-stroke"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          </template>

          <!-- 仅 Home：与 3D 偏移参考层一致的偏移几何（不影响其他编辑界面） -->
          <template v-for="item in visibleOffsetPaths" :key="`off-${item.entityId}`">
            <line
              v-if="item.points.length === 2"
              :x1="item.points[0].x"
              :y1="item.points[0].y"
              :x2="item.points[1].x"
              :y2="item.points[1].y"
              stroke="rgba(74, 170, 110, 0.92)"
              :stroke-width="entityStrokeWidth"
              vector-effect="non-scaling-stroke"
              stroke-linecap="round"
              stroke-dasharray="5 4"
            />
            <path
              v-else
              :d="offsetPathD(item.points)"
              fill="none"
              stroke="rgba(74, 170, 110, 0.92)"
              :stroke-width="entityStrokeWidth"
              vector-effect="non-scaling-stroke"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-dasharray="5 4"
            />
          </template>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useControllerSettingsStore } from '@renderer/stores/controllerSettingsStore'
import { useQomo5PStore } from '@renderer/stores/qomo5pEditor'
import type { Point, QomoEntityWithSurface } from '@renderer/types/Qomo5P'
import {
  computeOpenEntityOffsetPathsForCanvas,
  createBezierPoints,
  createHeartPoints,
  createMarquisePoints,
  createPearPoints
} from '@renderer/utils/Qomo5P/threeGeometry'

const props = withDefaults(
  defineProps<{
    /** 额外缩放倍率（通常保持 1；为了兼容 Home.vue 旧用法保留该参数） */
    scale?: number
    /** 配方面板计算的上开口（mm），与 `computeOpenEntityOffsetPathsForCanvas` 的开口尺寸一致 */
    upperOpeningMm?: number | null
  }>(),
  { scale: 1, upperOpeningMm: null }
)

const store = useQomo5PStore()
const { viewport, layers, entities } = storeToRefs(store)

const controllerStore = useControllerSettingsStore()
/** 轴 0/1 的编码器反馈（mm），仅作用于实体绘制；十字线不参与平移 */
const machineMposXY = computed(() => {
  const axes = controllerStore.controllerSettings.axes
  const ax = axes.find((a) => a.axisNo === 0)
  const ay = axes.find((a) => a.axisNo === 1)
  const x = ax != null ? Number(ax.mpos) : NaN
  const y = ay != null ? Number(ay.mpos) : NaN
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0
  }
})
const machineFollowTransform = computed(
  () => `translate(${-machineMposXY.value.x} ${-machineMposXY.value.y})`
)

const hostRef = ref<HTMLDivElement | null>(null)
let ro: ResizeObserver | null = null

const showScalePanel = ref(false)

type LocalScaleSettings = {
  scaleX: number
  scaleY: number
  crosshairStrokeMul: number
  entityStrokeMul: number
}

const STORAGE_KEY = 'qomo.showAndDrawInHome.localScale'

const coerceFinitePositive = (v: unknown, fallback: number) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const loadScaleSettings = (): LocalScaleSettings => {
  const defaults: LocalScaleSettings = { scaleX: 1, scaleY: 1, crosshairStrokeMul: 1, entityStrokeMul: 1 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const obj = JSON.parse(raw) as Partial<LocalScaleSettings>
    return {
      scaleX: coerceFinitePositive(obj.scaleX, defaults.scaleX),
      scaleY: coerceFinitePositive(obj.scaleY, defaults.scaleY),
      crosshairStrokeMul: coerceFinitePositive(obj.crosshairStrokeMul, defaults.crosshairStrokeMul),
      entityStrokeMul: coerceFinitePositive(obj.entityStrokeMul, defaults.entityStrokeMul)
    }
  } catch {
    return defaults
  }
}

const scaleSettings = reactive<LocalScaleSettings>(loadScaleSettings())

const persistScaleSettings = () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scaleX: scaleSettings.scaleX,
        scaleY: scaleSettings.scaleY,
        crosshairStrokeMul: scaleSettings.crosshairStrokeMul,
        entityStrokeMul: scaleSettings.entityStrokeMul
      } satisfies LocalScaleSettings)
    )
  } catch {
    // ignore storage errors
  }
}

watch(
  () => ({ ...scaleSettings }),
  () => {
    scaleSettings.scaleX = coerceFinitePositive(scaleSettings.scaleX, 1)
    scaleSettings.scaleY = coerceFinitePositive(scaleSettings.scaleY, 1)
    scaleSettings.crosshairStrokeMul = coerceFinitePositive(scaleSettings.crosshairStrokeMul, 1)
    scaleSettings.entityStrokeMul = coerceFinitePositive(scaleSettings.entityStrokeMul, 1)
    persistScaleSettings()
  },
  { deep: true }
)

const resetScaleSettings = () => {
  scaleSettings.scaleX = 1
  scaleSettings.scaleY = 1
  scaleSettings.crosshairStrokeMul = 1
  scaleSettings.entityStrokeMul = 1
  persistScaleSettings()
}

onMounted(() => {
  if (!hostRef.value) return
  ro = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (!rect) return
    store.setCanvasSize(rect.width, rect.height)
  })
  ro.observe(hostRef.value)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})

const effectiveZoomX = computed(() =>
  Math.max(viewport.value.zoom * (props.scale ?? 1) * coerceFinitePositive(scaleSettings.scaleX, 1), 1e-6)
)
const effectiveZoomY = computed(() =>
  Math.max(viewport.value.zoom * (props.scale ?? 1) * coerceFinitePositive(scaleSettings.scaleY, 1), 1e-6)
)
const worldTransform = computed(
  () => `translate(${viewport.value.panX} ${viewport.value.panY}) scale(${effectiveZoomX.value} ${-effectiveZoomY.value})`
)
const worldStrokeWidth = computed(() => Math.max(1 / Math.max(effectiveZoomX.value, effectiveZoomY.value), 0.5))
const crosshairStrokeWidth = computed(
  () => worldStrokeWidth.value * coerceFinitePositive(scaleSettings.crosshairStrokeMul, 1)
)
const entityStrokeWidth = computed(
  () => worldStrokeWidth.value * coerceFinitePositive(scaleSettings.entityStrokeMul, 1)
)

const visibleLayerIdSet = computed(() => new Set(layers.value.filter((l) => l.visible).map((l) => l.id)))
const visibleEntities = computed(() =>
  entities.value.filter((e) => visibleLayerIdSet.value.has(e.layerId))
)

/** 用全部实体算接缝斜接，再按可见层过滤；逻辑与 `threeGeometry` 中 3D 偏移层一致 */
const visibleOffsetPaths = computed(() => {
  const layerSet = visibleLayerIdSet.value
  const openSize =
    props.upperOpeningMm != null && Number.isFinite(props.upperOpeningMm) && props.upperOpeningMm > 0
      ? props.upperOpeningMm
      : 0
  const pathMap = new Map(
    computeOpenEntityOffsetPathsForCanvas(entities.value, openSize).map((p) => [p.entityId, p.points])
  )
  const list: { entityId: string; points: Point[] }[] = []
  for (const e of entities.value) {
    if (!layerSet.has(e.layerId)) continue
    const pts = pathMap.get(e.id)
    if (pts && pts.length >= 2) list.push({ entityId: e.id, points: pts })
  }
  return list
})

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

const describeArc = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(centerX, centerY, radius, startAngle)
  const end = polarToCartesian(centerX, centerY, radius, endAngle)
  let sweep = endAngle - startAngle
  while (sweep > 360) sweep -= 360
  while (sweep <= -360) sweep += 360
  if (Math.abs(sweep) < 1e-9) sweep = 360
  const absSweep = Math.abs(sweep)
  const largeArcFlag = absSweep > 180 ? 1 : 0
  const sweepFlag = sweep > 0 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`
}

const pointsToPathD = (points: Point[], closed = true) => {
  if (points.length === 0) return ''
  const commands = [`M ${points[0].x} ${points[0].y}`]
  for (let index = 1; index < points.length; index += 1) {
    commands.push(`L ${points[index].x} ${points[index].y}`)
  }
  if (closed) commands.push('Z')
  return commands.join(' ')
}

const getOpenPolylinePathD = (points: Point[]) => pointsToPathD(points, false)

/** 闭合圆等首尾重合时用 Z 闭合，其余为开放折线 */
const offsetPathD = (points: Point[]) => {
  if (points.length < 2) return ''
  const a = points[0]
  const b = points[points.length - 1]
  const closed =
    points.length > 2 && Math.abs(a.x - b.x) < 1e-5 && Math.abs(a.y - b.y) < 1e-5
  return closed ? pointsToPathD(points, true) : getOpenPolylinePathD(points)
}
const getBezierCurvePathD = (points: Point[]) => {
  if (points.length < 2) return ''
  return getOpenPolylinePathD(createBezierPoints(points, 96))
}

const isEllipseLikeIrregularEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  entity.type === 'IRREGULAR' &&
  (entity.shape === 'oval' ||
    entity.shape === 'marquise' ||
    entity.shape === 'pear' ||
    entity.shape === 'heart')

const isOvalEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  isEllipseLikeIrregularEntity(entity) && entity.shape === 'oval'

const isMarquiseEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  isEllipseLikeIrregularEntity(entity) && entity.shape === 'marquise'

const isPearEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  isEllipseLikeIrregularEntity(entity) && entity.shape === 'pear'

const isHeartEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  isEllipseLikeIrregularEntity(entity) && entity.shape === 'heart'

const isPathIrregularEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  isMarquiseEntity(entity) || isPearEntity(entity) || isHeartEntity(entity)

const getIrregularPathD = (entity: Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }>) =>
  pointsToPathD(
    entity.shape === 'heart'
      ? createHeartPoints(entity.center, entity.radiusX, entity.radiusY, entity.rotationDeg, 96)
      : entity.shape === 'pear'
        ? createPearPoints(entity.center, entity.radiusX, entity.radiusY, entity.rotationDeg, 96)
        : createMarquisePoints(entity.center, entity.radiusX, entity.radiusY, entity.rotationDeg, 96)
  )
</script>
