<!--
  ShowAndDrawEntitiesEditorInHome.vue
  Home 页相机画面叠加层：展示 entitiesEditor 模块的实体位置（2D SVG，非交互）

  与 editor/panels/ShowAndDrawPanel.vue 对等，数据源为 useEditorStore()
-->
<template>
  <div ref="hostRef" class="pointer-events-none absolute inset-0 z-20">
    <!-- 左下角：倍率设置 -->
    <div class="pointer-events-auto absolute bottom-2 left-2 flex items-center gap-2">
      <button
        type="button"
        class="rounded bg-black/40 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/50"
        @click="showScalePanel = !showScalePanel"
      >
        大小
      </button>
      <button
        type="button"
        class="rounded bg-black/40 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/50"
        @click="showColorPanel = !showColorPanel"
      >
        颜色
      </button>
    </div>

    <!-- 倍率面板 -->
    <div
      v-if="showScalePanel"
      class="pointer-events-auto absolute bottom-2 left-2 rounded-md bg-black/40 p-2 text-xs text-white backdrop-blur"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="font-medium">显示大小</div>
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
        <div />
        <input
          v-model.number="scaleSettings.scaleX"
          type="number"
          min="0.001"
          max="1000"
          step="0.05"
          class="w-24 rounded bg-black/30 px-1"
        />
        <div class="opacity-90">Y 倍率</div>
        <div />
        <input
          v-model.number="scaleSettings.scaleY"
          type="number"
          min="0.001"
          max="1000"
          step="0.05"
          class="w-24 rounded bg-black/30 px-1"
        />
        <div class="opacity-90">十字线粗细</div>
        <div />
        <input
          v-model.number="scaleSettings.crosshairStrokeMul"
          type="number"
          min="0.1"
          max="50"
          step="0.1"
          class="w-24 rounded bg-black/30 px-1"
        />
        <div class="opacity-90">实体线粗细</div>
        <div />
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

    <!-- 颜色面板 -->
    <div
      v-if="showColorPanel"
      class="pointer-events-auto absolute bottom-14 left-2 rounded-md bg-black/40 p-2 text-xs text-white backdrop-blur"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="font-medium">线条颜色</div>
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
            @click="showColorPanel = false"
          >
            关闭
          </button>
        </div>
      </div>
      <div class="grid gap-2" style="grid-template-columns: auto auto">
        <div class="opacity-90">实体线颜色</div>
        <input
          v-model="scaleSettings.entityStrokeColor"
          type="color"
          class="h-6 w-24 rounded bg-black/30 p-0.5"
        />
      </div>
    </div>

    <!-- SVG 叠加层 -->
    <svg class="h-full w-full">
      <g :transform="worldTransform">
        <!-- 十字线（固定在世界原点） -->
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

        <!-- 实体（随机床 MPOS 平移） -->
        <g :transform="machineFollowTransform">
          <template v-for="entity in visibleEntities" :key="entity.id">
            <!-- LINE -->
            <line
              v-if="entity.kind === 'LINE'"
              :x1="entity.start.X"
              :y1="entity.start.Y"
              :x2="entity.end.X"
              :y2="entity.end.Y"
              :stroke="getEntityStrokeColor(entity.id)"
              :stroke-width="getEntityStrokeWidth(entity.id)"
              vector-effect="non-scaling-stroke"
              stroke-linecap="round"
            />

            <!-- ARC -->
            <path
              v-else-if="entity.kind === 'ARC'"
              :d="getArcPath(entity as any)"
              fill="none"
              :stroke="getEntityStrokeColor(entity.id)"
              :stroke-width="getEntityStrokeWidth(entity.id)"
              vector-effect="non-scaling-stroke"
              stroke-linecap="round"
            />

            <!-- CIRCLE -->
            <circle
              v-else-if="entity.kind === 'CIRCLE'"
              :cx="entity.center.X"
              :cy="entity.center.Y"
              :r="entity.radius"
              fill="none"
              :stroke="getEntityStrokeColor(entity.id)"
              :stroke-width="getEntityStrokeWidth(entity.id)"
              vector-effect="non-scaling-stroke"
            />

            <!-- BEZIER（控制点折线） -->
            <path
              v-else-if="entity.kind === 'BEZIER'"
              :d="getBezierPath(entity as any)"
              fill="none"
              :stroke="getEntityStrokeColor(entity.id)"
              :stroke-width="getEntityStrokeWidth(entity.id)"
              vector-effect="non-scaling-stroke"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <!-- POLYLINE（线段序列） -->
            <template v-else-if="entity.kind === 'POLYLINE'">
              <line
                v-for="(seg, si) in getPolylineSegments(entity as any)"
                :key="`${entity.id}-${si}`"
                :x1="seg.x1"
                :y1="seg.y1"
                :x2="seg.x2"
                :y2="seg.y2"
                :stroke="getEntityStrokeColor(entity.id)"
                :stroke-width="getEntityStrokeWidth(entity.id)"
                vector-effect="non-scaling-stroke"
                stroke-linecap="round"
              />
            </template>

            <!-- ELLIPSE -->
            <ellipse
              v-else-if="entity.kind === 'ELLIPSE'"
              :cx="entity.center.X"
              :cy="entity.center.Y"
              :rx="getEllipseAttrs(entity as any).rx"
              :ry="getEllipseAttrs(entity as any).ry"
              fill="none"
              :stroke="getEntityStrokeColor(entity.id)"
              :stroke-width="getEntityStrokeWidth(entity.id)"
              vector-effect="non-scaling-stroke"
              :transform="`rotate(${getEllipseAttrs(entity as any).rotationDeg} ${entity.center.X} ${entity.center.Y})`"
            />
          </template>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import {
  useShowAndDrawEntitiesEditorInHome,
  type ShowAndDrawEntitiesEditorInHomeProps
} from './ShowAndDrawEntitiesEditorInHome'

const props = withDefaults(defineProps<ShowAndDrawEntitiesEditorInHomeProps>(), {
  scale: 1,
  upperOpeningMm: null,
  xyOffset: null,
  runTrigger: false
})

const {
  hostRef,
  showScalePanel,
  showColorPanel,
  scaleSettings,
  resetScaleSettings,
  worldTransform,
  machineFollowTransform,
  crosshairStrokeWidth,
  visibleEntities,
  getEntityStrokeColor,
  getEntityStrokeWidth,
  getArcPath,
  getBezierPath,
  getPolylineSegments,
  getEllipseAttrs
} = useShowAndDrawEntitiesEditorInHome(props)

// 以下变量仅在模板中使用，此处显式引用以满足 noUnusedLocals
void hostRef
</script>
