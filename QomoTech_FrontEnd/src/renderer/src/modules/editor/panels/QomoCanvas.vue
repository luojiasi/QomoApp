<template>
  <div class="h-full w-full">
    <div
      ref="canvasHost"
      class="relative h-full w-full overflow-hidden"
      :class="overlayMode ? 'rounded-none bg-transparent' : 'rounded-2xl bg-slate-900/95'"
    >
      <svg
        ref="svgRef"
        class="h-full w-full touch-none select-none"
        @contextmenu.prevent
        @pointerdown="handleBackgroundPointerDown"
      >
        <template v-if="!overlayMode">
          <defs>
            <pattern id="cad-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                stroke-width="1"
              />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#cad-grid)" />
        </template>

        <g :transform="worldTransform">
          <!-- 直角坐标系Start -->
          <line
            x1="-10000"
            y1="0"
            x2="10000"
            y2="0"
            stroke="rgba(248,113,113,0.35)"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
          />
          <line
            x1="0"
            y1="-10000"
            x2="0"
            y2="10000"
            stroke="rgba(96,165,250,0.35)"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
          />
          <!-- 直角坐标系End -->

          <!-- 画直线之前的虚线Start -->
          <line
            v-if="lineDraftStart && lineDraftEnd"
            :x1="lineDraftStart.x"
            :y1="lineDraftStart.y"
            :x2="lineDraftEnd.x"
            :y2="lineDraftEnd.y"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />
          <!-- 画直线之前的虚线End -->
          <!-- 捕捉环 -->
          <circle
            v-if="snapRingWorld"
            :cx="snapRingWorld.x"
            :cy="snapRingWorld.y"
            r="1"
            fill="rgba(251,191,36,0.22)"
            stroke="#fbbf24"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
          />
          <!-- 捕捉环 -->

          <!-- 画圆弧的虚线Start -->
          <line
            v-if="
              activeTool === 'arc' &&
              (drawingShapeTool === 'center_start_end' ||
                drawingShapeTool === 'start_center_end') &&
              arcDraftCenter &&
              arcDraftEnd
            "
            :x1="arcDraftCenter.x"
            :y1="arcDraftCenter.y"
            :x2="arcDraftEnd.x"
            :y2="arcDraftEnd.y"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />
          <line
            v-if="
              activeTool === 'arc' &&
              drawingShapeTool === 'start_center_end' &&
              arcDraftStart &&
              arcDraftEnd &&
              !arcDraftCenter
            "
            :x1="arcDraftStart.x"
            :y1="arcDraftStart.y"
            :x2="arcDraftEnd.x"
            :y2="arcDraftEnd.y"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />
          <line
            v-if="
              activeTool === 'arc' &&
              drawingShapeTool === 'three_points_arc' &&
              arcDraftStart &&
              arcDraftEnd &&
              !arcDraftMid
            "
            :x1="arcDraftStart.x"
            :y1="arcDraftStart.y"
            :x2="arcDraftEnd.x"
            :y2="arcDraftEnd.y"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />
          <!-- 三点圆弧：第三点阶段中间点(mid) -> 当前鼠标/投影端点预览线 -->
          <line
            v-if="
              activeTool === 'arc' &&
              drawingShapeTool === 'three_points_arc' &&
              arcDraftMid &&
              arcDraftEnd
            "
            :x1="arcDraftMid.x"
            :y1="arcDraftMid.y"
            :x2="arcDraftEnd.x"
            :y2="arcDraftEnd.y"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />

          <!-- 路径画弧 -->
          <path
            v-if="activeTool === 'arc' && arcDraftPathD"
            :d="arcDraftPathD"
            fill="none"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />
          <!-- 画圆弧的虚线End -->

          <!-- 路径画圆（预览虚线） -->
          <line
            v-if="
              activeTool === 'circle' &&
              (drawingShapeTool === 'two_points' || drawingShapeTool === 'three_points_circle') &&
              circleDraftP1 &&
              circleDraftP2
            "
            :x1="circleDraftP1.x"
            :y1="circleDraftP1.y"
            :x2="circleDraftP2.x"
            :y2="circleDraftP2.y"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />
          <line
            v-if="
              activeTool === 'circle' &&
              drawingShapeTool === 'three_points_circle' &&
              circleDraftP3 &&
              circleDraftP2
            "
            :x1="circleDraftP3.x"
            :y1="circleDraftP3.y"
            :x2="circleDraftP2.x"
            :y2="circleDraftP2.y"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />
          <line
            v-if="
              activeTool === 'circle' &&
              (drawingShapeTool === 'center_radius' ||
                drawingShapeTool === 'center_diameter' ||
                drawingShapeTool === 'three_points_circle') &&
              circleDraftCenter &&
              circleDraftP1 &&
              !circleDraftP2
            "
            :x1="circleDraftCenter.x"
            :y1="circleDraftCenter.y"
            :x2="circleDraftP1.x"
            :y2="circleDraftP1.y"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />

          <circle
            v-if="activeTool === 'circle' && circleDraftCenter && circleDraftRadius > 1e-6"
            :cx="circleDraftCenter.x"
            :cy="circleDraftCenter.y"
            :r="circleDraftRadius"
            fill="none"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />

          <!-- 椭圆：圆心→长轴→短轴预览 -->
          <line
            v-if="activeTool === 'ellipse' && ellipseDraftPreview?.mode === 'line'"
            :x1="ellipseDraftPreview.x1"
            :y1="ellipseDraftPreview.y1"
            :x2="ellipseDraftPreview.x2"
            :y2="ellipseDraftPreview.y2"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />
          <ellipse
            v-if="activeTool === 'ellipse' && ellipseDraftPreview?.mode === 'ellipse'"
            :cx="ellipseDraftPreview.center.x"
            :cy="ellipseDraftPreview.center.y"
            :rx="ellipseDraftPreview.radiusX"
            :ry="ellipseDraftPreview.radiusY"
            fill="none"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
            :transform="`rotate(${ellipseDraftPreview.rotationDeg} ${ellipseDraftPreview.center.x} ${ellipseDraftPreview.center.y})`"
          />
          <path
            v-if="activeTool === 'ellipse' && ellipseDraftPreview?.mode === 'path'"
            :d="ellipseDraftPreview.d"
            fill="none"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />

          <line
            v-for="(segment, segmentIndex) in activeTool === 'bezier' && bezierDraftPreviewPoints
              ? getControlPolylineSegments(bezierDraftPreviewPoints)
              : []"
            :key="`bezier-draft-segment-${segmentIndex}`"
            :x1="segment.start.x"
            :y1="segment.start.y"
            :x2="segment.end.x"
            :y2="segment.end.y"
            stroke="rgba(251,191,36,0.7)"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="4 4"
          />
          <path
            v-if="activeTool === 'bezier' && bezierDraftPathD"
            :d="bezierDraftPathD"
            fill="none"
            stroke="#f59e0b"
            :stroke-width="worldStrokeWidth"
            vector-effect="non-scaling-stroke"
            class="pointer-events-none"
            stroke-dasharray="6 4"
          />

          <template v-for="entity in visibleEntities" :key="entity.id">
            <!-- 宽透明命中区在下层；可见线在上层且不参与命中，避免视觉变粗 -->
            <line
              v-if="entity.type === 'LINE'"
              :x1="entity.start.x"
              :y1="entity.start.y"
              :x2="entity.end.x"
              :y2="entity.end.y"
              stroke="rgba(0,0,0,0)"
              :stroke-width="ENTITY_HIT_STROKE_SCREEN_PX"
              vector-effect="non-scaling-stroke"
              style="pointer-events: stroke"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
              @pointerdown.stop="handleEntityPointerDown(entity.id, $event)"
            />
            <line
              v-if="entity.type === 'LINE'"
              :x1="entity.start.x"
              :y1="entity.start.y"
              :x2="entity.end.x"
              :y2="entity.end.y"
              :stroke="selectedEntityIds.includes(entity.id) ? '#60a5fa' : 'rgba(255,255,255,0.92)'"
              :stroke-width="worldStrokeWidth"
              vector-effect="non-scaling-stroke"
              class="pointer-events-none"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
            />
            <!-- 移动line的时候的主体 -->
            <template
              v-if="
                entity.type === 'LINE' &&
                activeTool === 'move' &&
                selectedEntityIds.includes(entity.id)
              "
            >
              <circle
                :cx="entity.start.x"
                :cy="entity.start.y"
                :r="endpointHandleRadiusWorld"
                fill="rgba(251,191,36,0.35)"
                stroke="#fbbf24"
                :stroke-width="worldStrokeWidth"
                vector-effect="non-scaling-stroke"
                class="cursor-crosshair"
                @pointerdown.stop="handleLineEndpointPointerDown(entity.id, 'start', $event)"
              />
              <circle
                :cx="entity.end.x"
                :cy="entity.end.y"
                :r="endpointHandleRadiusWorld"
                fill="rgba(251,191,36,0.35)"
                stroke="#fbbf24"
                :stroke-width="worldStrokeWidth"
                vector-effect="non-scaling-stroke"
                class="cursor-crosshair"
                @pointerdown.stop="handleLineEndpointPointerDown(entity.id, 'end', $event)"
              />
            </template>

            <template
              v-if="
                entity.type === 'ARC' &&
                activeTool === 'move' &&
                selectedEntityIds.includes(entity.id)
              "
            >
              <!-- ARC 的中心捕捉环：拖动中心只做整体平移（保持图形不变性） -->
              <circle
                :cx="entity.center.x"
                :cy="entity.center.y"
                :r="endpointHandleRadiusWorld"
                fill="rgba(251,191,36,0.25)"
                stroke="#fbbf24"
                :stroke-width="worldStrokeWidth"
                vector-effect="non-scaling-stroke"
                class="cursor-crosshair"
                @pointerdown.stop="handleArcCenterPointerDown(entity.id, $event)"
              />
              <circle
                v-if="entity.startPoint || entity.type === 'ARC'"
                :cx="
                  entity.startPoint?.x ??
                  polarToCartesian(
                    entity.center.x,
                    entity.center.y,
                    entity.radius,
                    entity.startAngle
                  ).x
                "
                :cy="
                  entity.startPoint?.y ??
                  polarToCartesian(
                    entity.center.x,
                    entity.center.y,
                    entity.radius,
                    entity.startAngle
                  ).y
                "
                :r="endpointHandleRadiusWorld"
                fill="rgba(251,191,36,0.35)"
                stroke="#fbbf24"
                :stroke-width="worldStrokeWidth"
                vector-effect="non-scaling-stroke"
                class="cursor-crosshair"
                @pointerdown.stop="handleArcEndpointPointerDown(entity.id, 'start', $event)"
              />
              <circle
                v-if="entity.endPoint || entity.type === 'ARC'"
                :cx="
                  entity.endPoint?.x ??
                  polarToCartesian(entity.center.x, entity.center.y, entity.radius, entity.endAngle)
                    .x
                "
                :cy="
                  entity.endPoint?.y ??
                  polarToCartesian(entity.center.x, entity.center.y, entity.radius, entity.endAngle)
                    .y
                "
                :r="endpointHandleRadiusWorld"
                fill="rgba(251,191,36,0.35)"
                stroke="#fbbf24"
                :stroke-width="worldStrokeWidth"
                vector-effect="non-scaling-stroke"
                class="cursor-crosshair"
                @pointerdown.stop="handleArcEndpointPointerDown(entity.id, 'end', $event)"
              />
            </template>

            <path
              v-if="entity.type === 'ARC'"
              :d="
                describeArc(
                  entity.center.x,
                  entity.center.y,
                  entity.radius,
                  entity.startAngle,
                  entity.endAngle
                )
              "
              fill="none"
              stroke="rgba(0,0,0,0)"
              :stroke-width="ENTITY_HIT_STROKE_SCREEN_PX"
              vector-effect="non-scaling-stroke"
              style="pointer-events: stroke"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
              @pointerdown.stop="handleEntityPointerDown(entity.id, $event)"
            />
            <path
              v-if="entity.type === 'ARC'"
              :d="
                describeArc(
                  entity.center.x,
                  entity.center.y,
                  entity.radius,
                  entity.startAngle,
                  entity.endAngle
                )
              "
              fill="none"
              :stroke="selectedEntityIds.includes(entity.id) ? '#60a5fa' : 'rgba(255,255,255,0.92)'"
              :stroke-width="worldStrokeWidth"
              vector-effect="non-scaling-stroke"
              class="pointer-events-none"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
            />

            <circle
              v-if="entity.type === 'CIRCLE'"
              :cx="entity.center.x"
              :cy="entity.center.y"
              :r="entity.radius"
              fill="none"
              stroke="rgba(0,0,0,0)"
              :stroke-width="ENTITY_HIT_STROKE_SCREEN_PX"
              vector-effect="non-scaling-stroke"
              style="pointer-events: stroke"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
              @pointerdown.stop="handleEntityPointerDown(entity.id, $event)"
            />
            <circle
              v-if="entity.type === 'CIRCLE'"
              :cx="entity.center.x"
              :cy="entity.center.y"
              :r="entity.radius"
              fill="none"
              :stroke="selectedEntityIds.includes(entity.id) ? '#60a5fa' : 'rgba(255,255,255,0.92)'"
              :stroke-width="worldStrokeWidth"
              vector-effect="non-scaling-stroke"
              class="pointer-events-none"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
            />
            <!-- CIRCLE 的移动句柄：圆心整体平移 / 圆周点缩放(保持圆心不变) -->
            <template
              v-if="
                entity.type === 'CIRCLE' &&
                activeTool === 'move' &&
                selectedEntityIds.includes(entity.id)
              "
            >
              <!-- 圆心句柄：仅平移 -->
              <circle
                :cx="entity.center.x"
                :cy="entity.center.y"
                :r="endpointHandleRadiusWorld"
                fill="rgba(251,191,36,0.25)"
                stroke="#fbbf24"
                :stroke-width="worldStrokeWidth"
                vector-effect="non-scaling-stroke"
                class="cursor-crosshair"
                @pointerdown.stop="handleCircleCenterPointerDown(entity.id, $event)"
              />
              <!-- 圆周半径句柄：改变 radius，center 不变 -->
              <circle
                :cx="getCircleRadiusHandlePoint(entity).x"
                :cy="getCircleRadiusHandlePoint(entity).y"
                :r="endpointHandleRadiusWorld"
                fill="rgba(251,191,36,0.35)"
                stroke="#fbbf24"
                :stroke-width="worldStrokeWidth"
                vector-effect="non-scaling-stroke"
                class="cursor-crosshair"
                @pointerdown.stop="handleCircleRadiusPointerDown(entity.id, $event)"
              />
            </template>

            <path
              v-if="entity.type === 'BEZIER'"
              :d="getBezierCurvePathD(entity.points)"
              fill="none"
              stroke="rgba(0,0,0,0)"
              :stroke-width="ENTITY_HIT_STROKE_SCREEN_PX"
              vector-effect="non-scaling-stroke"
              style="pointer-events: stroke"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
              @pointerdown.stop="handleEntityPointerDown(entity.id, $event)"
            />
            <path
              v-if="entity.type === 'BEZIER'"
              :d="getBezierCurvePathD(entity.points)"
              fill="none"
              :stroke="selectedEntityIds.includes(entity.id) ? '#60a5fa' : 'rgba(255,255,255,0.92)'"
              :stroke-width="worldStrokeWidth"
              vector-effect="non-scaling-stroke"
              class="pointer-events-none"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
            />
            <template
              v-if="
                entity.type === 'BEZIER' &&
                activeTool === 'move' &&
                selectedEntityIds.includes(entity.id)
              "
            >
              <line
                v-for="(segment, segmentIndex) in getControlPolylineSegments(entity.points)"
                :key="`${entity.id}-segment-${segmentIndex}`"
                :x1="segment.start.x"
                :y1="segment.start.y"
                :x2="segment.end.x"
                :y2="segment.end.y"
                stroke="rgba(251,191,36,0.7)"
                :stroke-width="worldStrokeWidth"
                vector-effect="non-scaling-stroke"
                class="pointer-events-none"
                stroke-dasharray="4 4"
              />
              <circle
                v-for="(point, pointIndex) in entity.points"
                :key="`${entity.id}-${pointIndex}`"
                :cx="point.x"
                :cy="point.y"
                :r="endpointHandleRadiusWorld"
                :fill="
                  pointIndex === 0 || pointIndex === entity.points.length - 1
                    ? 'rgba(251,191,36,0.35)'
                    : 'rgba(96,165,250,0.35)'
                "
                :stroke="
                  pointIndex === 0 || pointIndex === entity.points.length - 1
                    ? '#fbbf24'
                    : '#60a5fa'
                "
                :stroke-width="worldStrokeWidth"
                vector-effect="non-scaling-stroke"
                class="cursor-crosshair"
                @pointerdown.stop="handleBezierPointPointerDown(entity.id, pointIndex, $event)"
              />
            </template>

            <ellipse
              v-if="isOvalEntity(entity)"
              :cx="entity.center.x"
              :cy="entity.center.y"
              :rx="entity.radiusX"
              :ry="entity.radiusY"
              fill="none"
              stroke="rgba(0,0,0,0)"
              :stroke-width="ENTITY_HIT_STROKE_SCREEN_PX"
              vector-effect="non-scaling-stroke"
              style="pointer-events: stroke"
              :transform="`rotate(${entity.rotationDeg} ${entity.center.x} ${entity.center.y})`"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
              @pointerdown.stop="handleEntityPointerDown(entity.id, $event)"
            />
            <ellipse
              v-if="isOvalEntity(entity)"
              :cx="entity.center.x"
              :cy="entity.center.y"
              :rx="entity.radiusX"
              :ry="entity.radiusY"
              fill="none"
              :stroke="selectedEntityIds.includes(entity.id) ? '#60a5fa' : 'rgba(255,255,255,0.92)'"
              :stroke-width="worldStrokeWidth"
              vector-effect="non-scaling-stroke"
              class="pointer-events-none"
              :transform="`rotate(${entity.rotationDeg} ${entity.center.x} ${entity.center.y})`"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
            />
            <template
              v-if="
                isEllipseLikeIrregularEntity(entity) &&
                activeTool === 'move' &&
                selectedEntityIds.includes(entity.id)
              "
            >
              <circle
                :cx="entity.center.x"
                :cy="entity.center.y"
                :r="endpointHandleRadiusWorld"
                fill="rgba(251,191,36,0.25)"
                stroke="#fbbf24"
                :stroke-width="worldStrokeWidth"
                vector-effect="non-scaling-stroke"
                class="cursor-crosshair"
                @pointerdown.stop="handleEllipseCenterPointerDown(entity.id, $event)"
              />
            </template>
            <path
              v-if="isPathIrregularEntity(entity)"
              :d="getIrregularPathD(entity)"
              fill="none"
              stroke="rgba(0,0,0,0)"
              :stroke-width="ENTITY_HIT_STROKE_SCREEN_PX"
              vector-effect="non-scaling-stroke"
              style="pointer-events: stroke"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
              @pointerdown.stop="handleEntityPointerDown(entity.id, $event)"
            />
            <path
              v-if="isPathIrregularEntity(entity)"
              :d="getIrregularPathD(entity)"
              fill="none"
              :stroke="selectedEntityIds.includes(entity.id) ? '#60a5fa' : 'rgba(255,255,255,0.92)'"
              :stroke-width="worldStrokeWidth"
              vector-effect="non-scaling-stroke"
              class="pointer-events-none"
              :class="activeTool === 'move' ? 'cursor-grab' : 'cursor-pointer'"
            />
          </template>
        </g>

        <!-- 选择框 -->
        <rect
          v-if="selectionRect"
          :x="selectionRect.x"
          :y="selectionRect.y"
          :width="selectionRect.width"
          :height="selectionRect.height"
          fill="rgba(59,130,246,0.12)"
          stroke="rgba(96,165,250,0.95)"
          stroke-dasharray="6 4"
        />
        <!-- 选择框 -->
      </svg>

      <div
        v-if="!overlayMode && visibleEntities.length === 0"
        class="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/40 text-center text-sm text-slate-200"
      >
        <div>
          <div class="text-lg font-semibold">新建工程后，在左侧开始绘图</div>
          <div class="mt-2 text-slate-300">
            当前支持直线、多段线、圆、圆弧、贝塞尔与多变形，右侧会自动进行 3D 预览。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useNotification } from '@/composables/useNotification'
import { subscribeQomoToCanvasAction } from '@/utils/Qomo5P/QomoToCanvas'
import type { Point, QomoEntityWithSurface } from '@renderer/types/Qomo5P'
import { useQomo5PStore } from '@/stores/qomo5pEditor'
import { screenToWorld } from '@/utils/Qomo5P/viewport'
import type { DrawingShapeTools } from '@renderer/utils/Qomo5P/QomoToCanvas'

import {
  createBezierPoints,
  createCushionPoints,
  createHeartPoints,
  createMarquisePoints,
  createOctagonPoints,
  createPearPoints,
  createSquarePoints
} from '@renderer/utils/Qomo5P/threeGeometry'

const props = withDefaults(
  defineProps<{
    /** Home 页叠加到相机画面时使用：不绘制网格/不铺底色/不显示空状态遮罩 */
    overlayMode?: boolean
  }>(),
  { overlayMode: false }
)

const overlayMode = computed(() => props.overlayMode)

const store = useQomo5PStore()
const { viewport, layers, entities, selectedEntityIds, selectionRect } = storeToRefs(store)
const { success, info } = useNotification()


type CanvasTool = 'select' | 'move' | 'line' | 'arc' | 'circle' | 'ellipse' | 'bezier'
type PanState = {
  startX: number
  startY: number
  lastX: number
  lastY: number
} | null
type SelectionState = {
  startX: number
  startY: number
  lastX: number
  lastY: number
  append: boolean
  moved: boolean
} | null

type MoveDragState =
  | { mode: 'entity'; lastWorld: Point }
  | { mode: 'arc_center'; entityId: string; lastWorld: Point }
  | { mode: 'endpoint'; entityId: string; end: 'start' | 'end'; lastWorld: Point }
  | { mode: 'circle_center'; entityId: string; lastWorld: Point }
  | { mode: 'circle_radius'; entityId: string; center: Point; lastWorld: Point }
  | { mode: 'ellipse_center'; entityId: string; lastWorld: Point }
  | {
      mode: 'bezier_point'
      entityId: string
      pointIndex: number
      lastWorld: Point
    }

const MAX_BEZIER_POINTS = 6

const svgRef = ref<SVGSVGElement | null>(null)
const activeTool = ref<CanvasTool>('select')
const drawingShapeTool = ref<DrawingShapeTools | null>(null)
const panState = ref<PanState>(null)
const selectionState = ref<SelectionState>(null)
const resizeObserver = ref<ResizeObserver | null>(null)
const canvasHost = ref<HTMLDivElement | null>(null)

const worldTransform = computed(
  () =>
    `translate(${viewport.value.panX} ${viewport.value.panY}) scale(${viewport.value.zoom} ${-viewport.value.zoom})`
)
const worldStrokeWidth = computed(() => Math.max(1 / Math.max(viewport.value.zoom, 0.001), 0.5))
/** 实体点击命中宽度（屏幕像素）：透明描边加粗，细线/圆弧/圆环更易点选 */
const ENTITY_HIT_STROKE_SCREEN_PX = 18
/** 框选时 AABB 在世界坐标中的扩展量（约等于屏幕上的像素厚度），避免细线很难被框进 */
const selectionBoundsMarginWorld = computed(() => 10 / Math.max(viewport.value.zoom, 0.001))
/** 平移模式下端点句柄半径（世界单位），屏幕上约 6px    移动主体*/
const endpointHandleRadiusWorld = computed(() => 6 / Math.max(viewport.value.zoom, 0.001))

const visibleLayerIdSet = computed(
  () => new Set(layers.value.filter((l) => l.visible).map((l) => l.id))
)
const visibleEntities = computed(() =>
  entities.value.filter((e) => visibleLayerIdSet.value.has(e.layerId))
)
const isEllipseLikeIrregularEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  entity.type === 'IRREGULAR' &&
  (entity.shape === 'oval' ||
    entity.shape === 'square' ||
    entity.shape === 'cushion' ||
    entity.shape === 'octagon' ||
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
const isSquareEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  isEllipseLikeIrregularEntity(entity) && entity.shape === 'square'
const isCushionEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  isEllipseLikeIrregularEntity(entity) && entity.shape === 'cushion'
const isOctagonEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  isEllipseLikeIrregularEntity(entity) && entity.shape === 'octagon'
const isPathIrregularEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  isMarquiseEntity(entity) ||
  isPearEntity(entity) ||
  isHeartEntity(entity) ||
  isSquareEntity(entity) ||
  isCushionEntity(entity) ||
  isOctagonEntity(entity)
const pointsToPathD = (points: Point[], closed = true) => {
  if (points.length === 0) return ''
  const commands = [`M ${points[0].x} ${points[0].y}`]
  for (let index = 1; index < points.length; index += 1) {
    commands.push(`L ${points[index].x} ${points[index].y}`)
  }
  if (closed) commands.push('Z')
  return commands.join(' ')
}
const getIrregularPathD = (entity: Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }>) =>
  pointsToPathD(
    entity.shape === 'heart'
      ? createHeartPoints(entity.center, entity.radiusX, entity.radiusY, entity.rotationDeg, 96)
      : entity.shape === 'pear'
        ? createPearPoints(entity.center, entity.radiusX, entity.radiusY, entity.rotationDeg, 96)
        : entity.shape === 'square'
          ? createSquarePoints(entity.center, entity.radiusX, entity.radiusY, entity.rotationDeg)
        : entity.shape === 'cushion'
          ? createCushionPoints(entity.center, entity.radiusX, entity.radiusY, entity.rotationDeg, 96)
        : entity.shape === 'octagon'
          ? createOctagonPoints(entity.center, entity.radiusX, entity.radiusY, entity.rotationDeg)
        : createMarquisePoints(
            entity.center,
            entity.radiusX,
            entity.radiusY,
            entity.rotationDeg,
            96
          )
  )

let unsubscribeAction: (() => void) | null = null
const lineDraftStart = ref<Point | null>(null)
const lineDraftEnd = ref<Point | null>(null)
/** 画线时吸附成功后的世界坐标，用于指示（端点/网格） */
const lineSnapPreviewWorld = ref<Point | null>(null)
/** 平移工具拖动端点时，吸附到其他端点上的预览位置 */
const moveEndpointSnapPreview = ref<Point | null>(null)
/** 圆半径句柄拖动时，用于让圆周点跟随鼠标的预览位置 */
const circleRadiusHandlePreviewWorld = ref<Point | null>(null)

// ===================== 圆草稿 =====================
const circleDraftCenter = ref<Point | null>(null)
const circleDraftRadius = ref<number>(0)
// 三点圆弧/圆：分别用作“1/2/3 点”的暂存（具体含义取决于 drawingShapeTool）
const circleDraftP1 = ref<Point | null>(null)
const circleDraftP2 = ref<Point | null>(null)
const circleDraftP3 = ref<Point | null>(null)
/** 画圆时吸附成功后的世界坐标，用于指示（当前半径/第三点） */
const circleSnapPreviewWorld = ref<Point | null>(null)

/** 椭圆：圆心 → 长轴端点 → 第三点定短轴 */
const ellipseDraftCenter = ref<Point | null>(null)
const ellipseDraftMajorEnd = ref<Point | null>(null)
/** 绘制椭圆时鼠标世界坐标（预览） */
const ellipseDraftMouse = ref<Point | null>(null)
/** 椭圆工具吸附指示（与圆类似） */
const ellipseSnapPreviewWorld = ref<Point | null>(null)
const bezierDraftPoints = ref<Point[]>([])
const bezierDraftEnd = ref<Point | null>(null)
const bezierDraftMouse = ref<Point | null>(null)
const bezierSnapPreviewWorld = ref<Point | null>(null)

const snapRingWorld = computed(() => {
  if (activeTool.value === 'line' && lineSnapPreviewWorld.value) return lineSnapPreviewWorld.value
  if (activeTool.value === 'arc' && lineSnapPreviewWorld.value) return lineSnapPreviewWorld.value
  if (activeTool.value === 'circle' && circleSnapPreviewWorld.value)
    return circleSnapPreviewWorld.value
  if (activeTool.value === 'ellipse' && ellipseSnapPreviewWorld.value)
    return ellipseSnapPreviewWorld.value
  if (activeTool.value === 'bezier' && bezierSnapPreviewWorld.value)
    return bezierSnapPreviewWorld.value
  if (activeTool.value === 'move' && moveEndpointSnapPreview.value)
    return moveEndpointSnapPreview.value
  return null
})
const arcDraftCenter = ref<Point | null>(null)
const arcDraftStart = ref<Point | null>(null)
const arcDraftEnd = ref<Point | null>(null)
/** 三点圆弧第二个点击点（mid），用于“起点、mid、终点”计算圆弧 */
const arcDraftMid = ref<Point | null>(null)
const arcDraftRadius = ref(0)
/**
 * 弧线扫掠方向（由 Shift 控制）
 * 默认 CCW（+）
 * 按住 Shift 则 CW（-）
 */
const arcDraftDirection = ref<number>(1)

// 移动主体
const moveDragState = ref<MoveDragState | null>(null)
const moveDragMoved = ref(false)

const getCircleRadiusHandlePoint = (entity: { id: string; center: Point; radius: number }) => {
  if (
    activeTool.value === 'move' &&
    moveDragState.value?.mode === 'circle_radius' &&
    moveDragState.value.entityId === entity.id &&
    circleRadiusHandlePreviewWorld.value
  ) {
    return circleRadiusHandlePreviewWorld.value
  }
  // 默认半径句柄放在圆的“右侧”（0度方向）
  return { x: entity.center.x + entity.radius, y: entity.center.y }
}

const createProject = (projectName: string) => {
  store.createNewProject(projectName)
  success(`已新建 ${projectName}.dxf 工程`, '可以开始进行绘制', 1000)
}

const resetLineDraft = () => {
  lineDraftStart.value = null
  lineDraftEnd.value = null
  lineSnapPreviewWorld.value = null
  moveEndpointSnapPreview.value = null
}

const resetArcDraft = () => {
  arcDraftCenter.value = null
  arcDraftStart.value = null
  arcDraftMid.value = null
  arcDraftEnd.value = null
  arcDraftRadius.value = 0
  arcDraftDirection.value = 1
}

const resetCircleDraft = () => {
  circleDraftCenter.value = null
  circleDraftRadius.value = 0
  circleDraftP1.value = null
  circleDraftP2.value = null
  circleDraftP3.value = null
  circleSnapPreviewWorld.value = null
}

const resetEllipseDraft = () => {
  ellipseDraftCenter.value = null
  ellipseDraftMajorEnd.value = null
  ellipseDraftMouse.value = null
  ellipseSnapPreviewWorld.value = null
}

const resetBezierDraft = () => {
  bezierDraftPoints.value = []
  bezierDraftEnd.value = null
  bezierDraftMouse.value = null
  bezierSnapPreviewWorld.value = null
}

const resetDrafts = () => {
  resetLineDraft()
  resetArcDraft()
  resetCircleDraft()
  resetEllipseDraft()
  resetBezierDraft()
}

/** 圆心、长轴端点、第三点（短轴方向由第三点投影确定） */
const computeEllipseFromThreePoints = (c: Point, majorEnd: Point, third: Point) => {
  const dx = majorEnd.x - c.x
  const dy = majorEnd.y - c.y
  const radiusX = Math.hypot(dx, dy)
  if (radiusX < 1e-9) return null
  const ux = dx / radiusX
  const uy = dy / radiusX
  const vx = -uy
  const vy = ux
  const wx = third.x - c.x
  const wy = third.y - c.y
  const radiusY = Math.abs(wx * vx + wy * vy)
  const rotationDeg = (Math.atan2(dy, dx) * 180) / Math.PI
  return { center: c, radiusX, radiusY: Math.max(radiusY, 1e-6), rotationDeg }
}

const currentIrregularShape = computed(() => {
  if (drawingShapeTool.value === 'marquise') return 'marquise'
  if (drawingShapeTool.value === 'heart') return 'heart'
  if (drawingShapeTool.value === 'pear') return 'pear'
  if (drawingShapeTool.value === 'square') return 'square'
  if (drawingShapeTool.value === 'cushion') return 'cushion'
  if (drawingShapeTool.value === 'octagon') return 'octagon'
  return 'oval'
})

const ellipseDraftPreview = computed(() => {
  const c = ellipseDraftCenter.value
  const majorEnd = ellipseDraftMajorEnd.value
  const mouse = ellipseDraftMouse.value
  if (!c || !mouse) return null
  if (!majorEnd) {
    return { mode: 'line' as const, x1: c.x, y1: c.y, x2: mouse.x, y2: mouse.y }
  }
  const p = computeEllipseFromThreePoints(c, majorEnd, mouse)
  if (!p) return null
  if (
    currentIrregularShape.value === 'marquise' ||
    currentIrregularShape.value === 'pear' ||
    currentIrregularShape.value === 'heart' ||
    currentIrregularShape.value === 'square' ||
    currentIrregularShape.value === 'cushion' ||
    currentIrregularShape.value === 'octagon'
  ) {
    return {
      mode: 'path' as const,
      d: pointsToPathD(
        currentIrregularShape.value === 'heart'
          ? createHeartPoints(p.center, p.radiusX, p.radiusY, p.rotationDeg, 96)
          : currentIrregularShape.value === 'pear'
            ? createPearPoints(p.center, p.radiusX, p.radiusY, p.rotationDeg, 96)
            : currentIrregularShape.value === 'square'
              ? createSquarePoints(p.center, p.radiusX, p.radiusY, p.rotationDeg)
            : currentIrregularShape.value === 'cushion'
              ? createCushionPoints(p.center, p.radiusX, p.radiusY, p.rotationDeg, 96)
            : currentIrregularShape.value === 'octagon'
              ? createOctagonPoints(p.center, p.radiusX, p.radiusY, p.rotationDeg)
            : createMarquisePoints(p.center, p.radiusX, p.radiusY, p.rotationDeg, 96)
      )
    }
  }
  return { mode: 'ellipse' as const, ...p }
})

const getOpenPolylinePathD = (points: Point[]) => pointsToPathD(points, false)

const getBezierCurvePathD = (points: Point[]) => {
  if (points.length < 2) return ''
  return getOpenPolylinePathD(createBezierPoints(points, 96))
}

const getControlPolylineSegments = (points: Point[]) =>
  points.slice(0, -1).map((point, index) => ({
    start: point,
    end: points[index + 1]
  }))

const bezierDraftPreviewPoints = computed(() => {
  if (bezierDraftPoints.value.length === 0) return null
  const basePoints = bezierDraftPoints.value.map((point) => ({ ...point }))
  if (basePoints.length >= MAX_BEZIER_POINTS || !bezierDraftMouse.value) return basePoints
  return [...basePoints, bezierDraftMouse.value]
})

const bezierDraftPathD = computed(() => {
  const preview = bezierDraftPreviewPoints.value
  if (!preview || preview.length < 2) return ''
  return getBezierCurvePathD(preview)
})

// 获取本地坐标
const getLocalPoint = (event: PointerEvent | WheelEvent) => {
  const rect = svgRef.value?.getBoundingClientRect()

  if (!rect) {
    return { x: 0, y: 0 }
  }

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}
// 获取世界坐标--------屏幕坐标变成世界坐标
const getWorldPointFromEvent = (event: PointerEvent | WheelEvent) =>
  screenToWorld(getLocalPoint(event), viewport.value)
// 吸附的功能添加Start====================================
/** 吸附：屏幕约 SNAP_SCREEN_PX 内优先贴到端点；否则按世界网格对齐 */
const SNAP_SCREEN_PX = 12
const SNAP_GRID_STEP_WORLD = 1
const SNAP_MAX_RADIUS_WORLD = 12

const worldSnapRadius = () => {
  const z = Math.max(viewport.value.zoom, 1e-6)
  return Math.min(SNAP_SCREEN_PX / z, SNAP_MAX_RADIUS_WORLD)
}

const dist2 = (a: Point, b: Point) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}
// 处理ARC=============================

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
// 处理ARC=============================

const collectLineSnapTargets = (): Point[] => {
  const out: Point[] = [{ x: 0, y: 0 }]
  for (const e of visibleEntities.value) {
    if (e.type === 'LINE') {
      out.push(e.start, e.end)
    } else if (e.type === 'ARC') {
      // 处理ARC=============================
      if (e.startPoint && e.endPoint) {
        out.push(e.startPoint, e.endPoint)
      } else {
        out.push(
          polarToCartesian(e.center.x, e.center.y, e.radius, e.startAngle),
          polarToCartesian(e.center.x, e.center.y, e.radius, e.endAngle)
        )
      }
      // 处理ARC=============================
    } else if (e.type === 'CIRCLE') {
      // 圆：至少提供圆心；同时提供“右侧半径点”，便于 radius 阶段吸附
      out.push(e.center)
      out.push({ x: e.center.x + e.radius, y: e.center.y })
    } else if (e.type === 'BEZIER') {
      out.push(...e.points)
    } else if (isEllipseLikeIrregularEntity(e)) {
      out.push(e.center)
      const rad = (e.rotationDeg * Math.PI) / 180
      out.push({
        x: e.center.x + e.radiusX * Math.cos(rad),
        y: e.center.y + e.radiusX * Math.sin(rad)
      })
    }
  }
  return out
}

const snapToWorldGrid = (p: Point): Point => {
  if (SNAP_GRID_STEP_WORLD <= 0) return p
  const s = SNAP_GRID_STEP_WORLD
  return {
    x: Math.round(p.x / s) * s,
    y: Math.round(p.y / s) * s
  }
}

type SnapKind = 'none' | 'vertex' | 'grid'

const snapWorldPointDetailed = (raw: Point): { point: Point; kind: SnapKind } => {
  const r = worldSnapRadius()
  const r2 = r * r
  let best: Point | null = null
  let bestD2 = r2

  for (const v of collectLineSnapTargets()) {
    const d2 = dist2(raw, v)
    if (d2 <= bestD2) {
      bestD2 = d2
      best = v
    }
  }

  if (best) {
    return { point: { x: best.x, y: best.y }, kind: 'vertex' as const }
  }

  if (SNAP_GRID_STEP_WORLD > 0) {
    const g = snapToWorldGrid(raw)
    return { point: g, kind: 'grid' as const }
  }

  return { point: raw, kind: 'none' as const }
}

const snapWorldPoint = (raw: Point) => snapWorldPointDetailed(raw).point

/** 拖动端点时：可吸附到其他线端点 / 原点；排除正在拖动的那个端点 */
const collectEndpointSnapTargetsExcluding = (
  excludeEntityId: string,
  excludeEnd: 'start' | 'end' | number
): Point[] => {
  const out: Point[] = [{ x: 0, y: 0 }]
  for (const e of visibleEntities.value) {
    if (e.type === 'LINE') {
      if (e.id === excludeEntityId) {
        if (excludeEnd !== 'start') out.push(e.start)
        if (excludeEnd !== 'end') out.push(e.end)
      } else {
        out.push(e.start, e.end)
      }
      continue
    }

    if (e.type === 'ARC') {
      const startPt =
        e.startPoint ?? polarToCartesian(e.center.x, e.center.y, e.radius, e.startAngle)
      const endPt = e.endPoint ?? polarToCartesian(e.center.x, e.center.y, e.radius, e.endAngle)

      if (e.id === excludeEntityId) {
        if (excludeEnd !== 'start') out.push(startPt)
        if (excludeEnd !== 'end') out.push(endPt)
      } else {
        out.push(startPt, endPt)
      }
    }

    if (e.type === 'BEZIER') {
      e.points.forEach((value, index) => {
        if (e.id !== excludeEntityId || index !== excludeEnd) out.push(value)
      })
    }
  }
  return out
}

const snapWorldPointForMovingEndpoint = (
  raw: Point,
  excludeEntityId: string,
  excludeEnd: 'start' | 'end' | number
): { point: Point; snappedToVertex: boolean } => {
  const targets = collectEndpointSnapTargetsExcluding(excludeEntityId, excludeEnd)
  const r = worldSnapRadius()
  const r2 = r * r
  let best: Point | null = null
  let bestD2 = r2
  for (const v of targets) {
    const d2 = dist2(raw, v)
    if (d2 <= bestD2) {
      bestD2 = d2
      best = v
    }
  }
  if (best) {
    return { point: { x: best.x, y: best.y }, snappedToVertex: true }
  }
  if (SNAP_GRID_STEP_WORLD > 0) {
    return { point: snapToWorldGrid(raw), snappedToVertex: false }
  }
  return { point: raw, snappedToVertex: false }
}
// 吸附的功能添加END====================================

// 移动主体====================================
// 移动entities——line====================================
const tryPickLineEndpointNear = (entityId: string, world: Point): 'start' | 'end' | null => {
  const entity = visibleEntities.value.find((e) => e.id === entityId)
  if (!entity || entity.type !== 'LINE') return null
  const r = worldSnapRadius()
  const r2 = r * r
  const ds = dist2(world, entity.start)
  const de = dist2(world, entity.end)
  if (ds <= r2 && ds <= de) return 'start'
  if (de <= r2) return 'end'
  return null
}

const setPointerCaptureSafe = (target: EventTarget | null, pointerId: number) => {
  if (!target || typeof (target as Element).setPointerCapture !== 'function') return
  try {
    ;(target as Element).setPointerCapture(pointerId)
  } catch {
    /* ignore */
  }
}
// 移动entities——line====================================
// 移动主体====================================

const projectPointToRadius = (center: Point, point: Point, radius: number) => {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const length = Math.hypot(dx, dy)

  if (length < 1e-6 || radius < 1e-6) return point

  const scale = radius / length
  return { x: center.x + dx * scale, y: center.y + dy * scale }
}

// 处理ARC=============================
const pointToAngleDeg = (center: Point, point: Point) =>
  (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI

const normalizeDeg = (a: number) => ((a % 360) + 360) % 360

const ccwDelta = (from: number, to: number) => (normalizeDeg(to) - normalizeDeg(from) + 360) % 360

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

const arcDraftPathD = computed(() => {
  if (
    !arcDraftCenter.value ||
    !arcDraftStart.value ||
    arcDraftRadius.value < 1e-6 ||
    !arcDraftEnd.value
  )
    return ''
  const c = arcDraftCenter.value
  const r = arcDraftRadius.value
  const a0 = pointToAngleDeg(c, arcDraftStart.value)
  const a1 = pointToAngleDeg(c, arcDraftEnd.value)
  const dir = arcDraftDirection.value >= 0 ? 1 : -1
  const endDeg = dir === 1 ? a0 + ccwDelta(a0, a1) : a0 - ccwDelta(a1, a0)
  return describeArc(c.x, c.y, r, a0, endDeg)
})
// 处理ARC=============================

const handleLineToolPoint = (raw: Point) => {
  const point = snapWorldPoint(raw)
  const tool = drawingShapeTool.value ?? 'only_line'

  // 多段线：每次点击画一段直线，并把上一段的终点作为下一段起点（连续折线）
  if (tool === 'more_line') {
    // 第 1 点：仅初始化“当前段起点”
    if (!lineDraftStart.value) {
      lineDraftStart.value = point
      lineDraftEnd.value = point
      lineSnapPreviewWorld.value = null
      return
    }

    // 后续点：从“当前段起点”到“当前点击点”生成一段 LINE，并更新起点为新点
    lineDraftEnd.value = point
    lineSnapPreviewWorld.value = null

    if (Math.hypot(point.x - lineDraftStart.value.x, point.y - lineDraftStart.value.y) < 1e-6) {
      return
    }

    store.addLineEntity(lineDraftStart.value, point)

    // 不 reset：保持折线连续绘制
    lineDraftStart.value = point
    lineDraftEnd.value = point
    return
  }

  // 单线：第 1 点起点，第 2 点终点，画完即 reset
  if (!lineDraftStart.value) {
    lineDraftStart.value = point
    lineDraftEnd.value = point
    lineSnapPreviewWorld.value = null
    return
  }

  lineDraftEnd.value = point
  lineSnapPreviewWorld.value = null
  if (Math.hypot(point.x - lineDraftStart.value.x, point.y - lineDraftStart.value.y) < 1e-6) {
    return
  }

  store.addLineEntity(lineDraftStart.value, point)
  resetLineDraft()
}

// 处理ARC=============================
const addArcEntityFrom3Points = (params: {
  center: Point
  radius: number
  startOnCircle: Point
  endOnCircle: Point
  dir: number
}) => {
  const { center, radius, startOnCircle, endOnCircle, dir } = params

  if (Math.hypot(endOnCircle.x - startOnCircle.x, endOnCircle.y - startOnCircle.y) < 1e-6)
    return false

  const a0 = pointToAngleDeg(center, startOnCircle)
  const a1 = pointToAngleDeg(center, endOnCircle)
  const endDeg = dir >= 0 ? a0 + ccwDelta(a0, a1) : a0 - ccwDelta(a1, a0)

  store.addArcEntity(center, radius, a0, endDeg, startOnCircle, endOnCircle)
  resetArcDraft()
  lineSnapPreviewWorld.value = null
  return true
}

const circumcircleFrom3Points = (p1: Point, p2: Point, p3: Point) => {
  // 计算三点的外接圆（若共线返回 null）
  const ax = p1.x
  const ay = p1.y
  const bx = p2.x
  const by = p2.y
  const cx = p3.x
  const cy = p3.y

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(d) < 1e-9) return null

  const ax2ay2 = ax * ax + ay * ay
  const bx2by2 = bx * bx + by * by
  const cx2cy2 = cx * cx + cy * cy

  const ux = (ax2ay2 * (by - cy) + bx2by2 * (cy - ay) + cx2cy2 * (ay - by)) / d
  const uy = (ax2ay2 * (cx - bx) + bx2by2 * (ax - cx) + cx2cy2 * (bx - ax)) / d

  const center = { x: ux, y: uy }
  const radius = Math.hypot(ux - ax, uy - ay)
  if (!Number.isFinite(radius) || radius < 1e-6) return null
  return { center, radius }
}

// 处理圆=============================
const addCircleToolEntity = (center: Point, radius: number) => {
  if (radius < 1e-6) return
  store.addCircleEntity(center, radius)
  // 交互完成后清空草稿，等待下一次开始绘制
  resetCircleDraft()
}

const handleEllipseToolPoint = (raw: Point) => {
  const point = snapWorldPoint(raw)
  if (!ellipseDraftCenter.value) {
    ellipseDraftCenter.value = point
    return
  }
  if (!ellipseDraftMajorEnd.value) {
    ellipseDraftMajorEnd.value = point
    return
  }
  const p = computeEllipseFromThreePoints(
    ellipseDraftCenter.value,
    ellipseDraftMajorEnd.value,
    point
  )
  if (p) {
    store.addIrregularEntity(
      currentIrregularShape.value,
      p.center,
      p.radiusX,
      p.radiusY,
      p.rotationDeg
    )
  }
  resetEllipseDraft()
}

const handleBezierToolPoint = (raw: Point) => {
  const point = snapWorldPoint(raw)
  const nextPoints = [...bezierDraftPoints.value, point]
  bezierDraftPoints.value = nextPoints
  bezierDraftEnd.value = point
  bezierSnapPreviewWorld.value = null
  bezierDraftMouse.value = point
  if (nextPoints.length >= MAX_BEZIER_POINTS) {
    store.addBezierEntity(nextPoints)
    resetBezierDraft()
  }
}

const handleCircleToolPoint = (raw: Point) => {
  const point = snapWorldPoint(raw)
  const tool = drawingShapeTool.value ?? 'center_radius'

  // 两点画圆：两点为直径端点（diameter endpoints）
  if (tool === 'two_points') {
    if (!circleDraftP1.value) {
      circleDraftP1.value = point
      circleDraftCenter.value = null
      circleDraftRadius.value = 0
      return
    }

    const p1 = circleDraftP1.value
    const center = { x: (p1.x + point.x) / 2, y: (p1.y + point.y) / 2 }
    const radius = Math.hypot(point.x - p1.x, point.y - p1.y) / 2
    addCircleToolEntity(center, radius)
    return
  }

  // 圆心-半径
  if (tool === 'center_radius') {
    if (!circleDraftCenter.value) {
      circleDraftP1.value = null
      circleDraftCenter.value = point
      circleDraftRadius.value = 0
      return
    }
    const radius = Math.hypot(
      point.x - circleDraftCenter.value.x,
      point.y - circleDraftCenter.value.y
    )
    addCircleToolEntity(circleDraftCenter.value, radius)
    return
  }

  // 圆心-直径（第二点为直径端点）
  if (tool === 'center_diameter') {
    if (!circleDraftCenter.value) {
      circleDraftP1.value = null
      circleDraftCenter.value = point
      circleDraftRadius.value = 0
      return
    }

    const radius =
      Math.hypot(point.x - circleDraftCenter.value.x, point.y - circleDraftCenter.value.y) / 2
    addCircleToolEntity(circleDraftCenter.value, radius)
    return
  }

  // 三点画圆：三点分别在圆周上
  if (tool === 'three_points_circle') {
    if (!circleDraftP1.value) {
      circleDraftP1.value = point
      circleDraftP2.value = null
      circleDraftCenter.value = null
      circleDraftRadius.value = 0
      return
    }

    if (!circleDraftP2.value) {
      circleDraftP2.value = point
      circleDraftCenter.value = null
      circleDraftRadius.value = 0
      return
    }

    const p1 = circleDraftP1.value
    const p2 = circleDraftP2.value
    const circle = circumcircleFrom3Points(p1, p2, point)
    if (!circle) return
    addCircleToolEntity(circle.center, circle.radius)
    return
  }
}

// center -> start -> end
const handleArcToolPoint_center_start_end = (point: Point, event: PointerEvent) => {
  // 第 1 步：确定圆心
  if (!arcDraftCenter.value) {
    arcDraftCenter.value = point
    arcDraftStart.value = null
    arcDraftEnd.value = { ...point }
    arcDraftRadius.value = 0
    arcDraftDirection.value = event.shiftKey ? -1 : 1
    lineSnapPreviewWorld.value = null
    return
  }

  // 第 2 步：确定起点（从圆心到当前点计算半径，并投影到圆上）
  if (!arcDraftStart.value) {
    const radius = Math.hypot(point.x - arcDraftCenter.value.x, point.y - arcDraftCenter.value.y)
    if (radius < 1e-6) return

    arcDraftRadius.value = radius
    arcDraftStart.value = projectPointToRadius(arcDraftCenter.value, point, radius)
    arcDraftEnd.value = { ...arcDraftStart.value }
    arcDraftDirection.value = event.shiftKey ? -1 : 1
    lineSnapPreviewWorld.value = null
    return
  }

  // 第 3 步：确定终点（投影到圆上）
  const center = arcDraftCenter.value
  const r = arcDraftRadius.value
  const endOnCircle = projectPointToRadius(center, point, r)

  arcDraftDirection.value = event.shiftKey ? -1 : 1
  addArcEntityFrom3Points({
    center,
    radius: r,
    startOnCircle: arcDraftStart.value,
    endOnCircle,
    dir: arcDraftDirection.value
  })
}

// start -> center -> end
const handleArcToolPoint_start_center_end = (point: Point, event: PointerEvent) => {
  // 第 1 步：确定起点
  if (!arcDraftStart.value) {
    arcDraftStart.value = point
    arcDraftCenter.value = null
    arcDraftEnd.value = null
    arcDraftRadius.value = 0
    arcDraftDirection.value = event.shiftKey ? -1 : 1
    lineSnapPreviewWorld.value = null
    return
  }

  // 第 2 步：确定圆心（从起点到当前点计算半径，并投影起点到圆上）
  if (!arcDraftCenter.value) {
    const radius = Math.hypot(point.x - arcDraftStart.value.x, point.y - arcDraftStart.value.y)
    if (radius < 1e-6) return

    arcDraftCenter.value = point
    arcDraftRadius.value = radius

    // 为了避免浮点误差，把 start 点投影回精确半径圆上
    arcDraftStart.value = projectPointToRadius(arcDraftCenter.value, arcDraftStart.value, radius)
    arcDraftEnd.value = { ...arcDraftStart.value }
    arcDraftDirection.value = event.shiftKey ? -1 : 1
    lineSnapPreviewWorld.value = null
    return
  }

  // 第 3 步：确定终点（投影到圆上）
  const center = arcDraftCenter.value
  const r = arcDraftRadius.value
  const endOnCircle = projectPointToRadius(center, point, r)

  arcDraftDirection.value = event.shiftKey ? -1 : 1
  addArcEntityFrom3Points({
    center,
    radius: r,
    startOnCircle: arcDraftStart.value,
    endOnCircle,
    dir: arcDraftDirection.value
  })
}

// three points -> arc
// 交互：第 1 点=start，第 2 点=mid，第 3 点=end；弧线自动选择“经过 mid”的那一侧
const handleArcToolPoint_three_points_arc = (point: Point) => {
  // 1) start
  if (!arcDraftStart.value) {
    arcDraftStart.value = point
    arcDraftMid.value = null
    arcDraftCenter.value = null // 暂存圆心：未知
    arcDraftEnd.value = null
    arcDraftRadius.value = 0
    arcDraftDirection.value = 1
    lineSnapPreviewWorld.value = null
    return
  }

  // 2) mid
  if (!arcDraftMid.value) {
    arcDraftMid.value = point
    arcDraftCenter.value = null // 暂存圆心：未知
    arcDraftEnd.value = null
    arcDraftRadius.value = 0
    lineSnapPreviewWorld.value = null
    return
  }

  // 3) end
  arcDraftEnd.value = point

  const startPt = arcDraftStart.value
  const midPt = arcDraftMid.value
  const endPt = arcDraftEnd.value

  const circle = circumcircleFrom3Points(startPt, midPt, endPt)
  if (!circle) {
    // 三点共线或数值不稳定：忽略本次第三点
    arcDraftEnd.value = null
    return
  }

  const { center, radius } = circle

  const startOnCircle = projectPointToRadius(center, startPt, radius)
  const midOnCircle = projectPointToRadius(center, midPt, radius)
  const endOnCircle = projectPointToRadius(center, endPt, radius)

  // 判断 mid 落在哪个方向的 start->end 弧上：mid 在 CCW 则 dir=+1，否则 dir=-1
  const aStart = pointToAngleDeg(center, startOnCircle)
  const aMid = pointToAngleDeg(center, midOnCircle)
  const aEnd = pointToAngleDeg(center, endOnCircle)

  const sweepStartToEnd = ccwDelta(aStart, aEnd)
  const sweepStartToMid = ccwDelta(aStart, aMid)
  const midOnCcw = sweepStartToMid <= sweepStartToEnd + 1e-9
  const dir = midOnCcw ? 1 : -1

  addArcEntityFrom3Points({ center, radius, startOnCircle, endOnCircle, dir })
}

// 统一入口：根据 drawingShapeTool 选择不同顺序
const handleArcToolPoint = (raw: Point, event: PointerEvent) => {
  const point = snapWorldPoint(raw)
  const tool = drawingShapeTool.value ?? 'center_start_end'

  if (tool === 'start_center_end') {
    handleArcToolPoint_start_center_end(point, event)
    return
  }

  if (tool === 'center_start_end') {
    handleArcToolPoint_center_start_end(point, event)
    return
  }

  if (tool === 'three_points_arc') {
    handleArcToolPoint_three_points_arc(point)
    return
  }

  // fallback：默认使用 center -> start -> end
  handleArcToolPoint_center_start_end(point, event)
}
// 处理ARC=============================

// const handleWheel = (event: WheelEvent) => {
//   const factor = event.deltaY < 0 ? 1.1 : 0.9
//   store.zoomAt(getLocalPoint(event), factor)
// }

// 鼠标按下
const handleBackgroundPointerDown = (event: PointerEvent) => {
  if (event.button === 2) {
    if (activeTool.value === 'bezier' && bezierDraftPoints.value.length >= 2) {
      store.addBezierEntity(bezierDraftPoints.value)
    }
    resetDrafts()
    return
  }
  // 拖拽
  if (event.button === 1) {
    const point = getLocalPoint(event)
    panState.value = {
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y
    }
    return
  }

  // 左键绘制图形
  if (event.button !== 0) return

  const worldPoint = getWorldPointFromEvent(event)

  if (activeTool.value === 'select') {
    const point = getLocalPoint(event)
    selectionState.value = {
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y,
      append: event.ctrlKey || event.metaKey,
      moved: false
    }
    store.setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 })
    return
  }

  if (activeTool.value === 'line') {
    handleLineToolPoint(worldPoint)
    return
  }

  if (activeTool.value === 'arc') {
    handleArcToolPoint(worldPoint, event)
    return
  }

  if (activeTool.value === 'circle') {
    handleCircleToolPoint(worldPoint)
    return
  }

  if (activeTool.value === 'ellipse') {
    handleEllipseToolPoint(worldPoint)
    return
  }

  if (activeTool.value === 'bezier') {
    handleBezierToolPoint(worldPoint)
    return
  }
}
// 移动entities——line====================================
const handleLineEndpointPointerDown = (
  entityId: string,
  end: 'start' | 'end',
  event: PointerEvent
) => {
  if (event.button !== 0 || activeTool.value !== 'move') return
  if (!selectedEntityIds.value.includes(entityId)) {
    store.selectSingleEntity(entityId)
  }
  const world = getWorldPointFromEvent(event)
  store.beginInteractiveTransform()
  moveDragState.value = { mode: 'endpoint', entityId, end, lastWorld: world }
  moveDragMoved.value = false
  setPointerCaptureSafe(event.currentTarget, event.pointerId)
}
// 移动entities——line====================================

const handleArcEndpointPointerDown = (
  entityId: string,
  end: 'start' | 'end',
  event: PointerEvent
) => {
  if (event.button !== 0 || activeTool.value !== 'move') return
  if (!selectedEntityIds.value.includes(entityId)) {
    store.selectSingleEntity(entityId)
  }
  const world = getWorldPointFromEvent(event)
  store.beginInteractiveTransform()
  moveDragState.value = { mode: 'endpoint', entityId, end, lastWorld: world }
  moveDragMoved.value = false
  setPointerCaptureSafe(event.currentTarget, event.pointerId)
}

// 移动 ARC 端点====================================

const handleArcCenterPointerDown = (entityId: string, event: PointerEvent) => {
  if (event.button !== 0 || activeTool.value !== 'move') return
  if (!selectedEntityIds.value.includes(entityId)) {
    store.selectSingleEntity(entityId)
  }
  const world = getWorldPointFromEvent(event)
  store.beginInteractiveTransform()
  // 使用专门模式：中心拖动也支持吸附（但仍保持圆弧不变性=仅平移）
  moveDragState.value = { mode: 'arc_center', entityId, lastWorld: world }
  moveDragMoved.value = false
  setPointerCaptureSafe(event.currentTarget, event.pointerId)
}

// 移动 CIRCLE：圆心整体平移（保持 radius 不变）
const handleCircleCenterPointerDown = (entityId: string, event: PointerEvent) => {
  if (event.button !== 0 || activeTool.value !== 'move') return
  if (!selectedEntityIds.value.includes(entityId)) {
    store.selectSingleEntity(entityId)
  }
  const world = getWorldPointFromEvent(event)
  store.beginInteractiveTransform()
  moveDragState.value = { mode: 'circle_center', entityId, lastWorld: world }
  moveDragMoved.value = false
  circleRadiusHandlePreviewWorld.value = null
  setPointerCaptureSafe(event.currentTarget, event.pointerId)
}

const handleEllipseCenterPointerDown = (entityId: string, event: PointerEvent) => {
  if (event.button !== 0 || activeTool.value !== 'move') return
  if (!selectedEntityIds.value.includes(entityId)) {
    store.selectSingleEntity(entityId)
  }
  const world = getWorldPointFromEvent(event)
  store.beginInteractiveTransform()
  moveDragState.value = { mode: 'ellipse_center', entityId, lastWorld: world }
  moveDragMoved.value = false
  setPointerCaptureSafe(event.currentTarget, event.pointerId)
}

// 移动 CIRCLE：圆周“半径点”缩放（保持 center 不变）
const handleCircleRadiusPointerDown = (entityId: string, event: PointerEvent) => {
  if (event.button !== 0 || activeTool.value !== 'move') return
  if (!selectedEntityIds.value.includes(entityId)) {
    store.selectSingleEntity(entityId)
  }
  const ent = visibleEntities.value.find((e) => e.id === entityId)
  if (!ent || ent.type !== 'CIRCLE') return
  const world = getWorldPointFromEvent(event)
  store.beginInteractiveTransform()
  moveDragState.value = {
    mode: 'circle_radius',
    entityId,
    center: { ...ent.center },
    lastWorld: world
  }
  moveDragMoved.value = false
  // 初始拖动时就把圆周点放到当前圆周位置，避免视觉跳动
  circleRadiusHandlePreviewWorld.value = { x: ent.center.x + ent.radius, y: ent.center.y }
  setPointerCaptureSafe(event.currentTarget, event.pointerId)
}

const handleBezierPointPointerDown = (
  entityId: string,
  pointIndex: number,
  event: PointerEvent
) => {
  if (event.button !== 0 || activeTool.value !== 'move') return
  if (!selectedEntityIds.value.includes(entityId)) {
    store.selectSingleEntity(entityId)
  }
  const world = getWorldPointFromEvent(event)
  store.beginInteractiveTransform()
  moveDragState.value = { mode: 'bezier_point', entityId, pointIndex, lastWorld: world }
  moveDragMoved.value = false
  setPointerCaptureSafe(event.currentTarget, event.pointerId)
}

const handleEntityPointerDown = (entityId: string, event: PointerEvent) => {
  if (event.button !== 0) {
    return
  }

  if (activeTool.value === 'select') {
    const append = event.ctrlKey || event.metaKey
    if (append) {
      store.setSelection([...selectedEntityIds.value, entityId])
    } else {
      store.selectSingleEntity(entityId)
    }
    store.setSelectionRect(null)
    selectionState.value = null
    return
  }

  // 移动entities——line====================================
  if (activeTool.value === 'move') {
    const world = getWorldPointFromEvent(event)
    const entity = visibleEntities.value.find((e) => e.id === entityId)
    if (entity?.type === 'LINE' && selectedEntityIds.value.includes(entityId)) {
      const nearEnd = tryPickLineEndpointNear(entityId, world)
      if (nearEnd) {
        store.beginInteractiveTransform()
        moveDragState.value = { mode: 'endpoint', entityId, end: nearEnd, lastWorld: world }
        moveDragMoved.value = false
        setPointerCaptureSafe(event.currentTarget, event.pointerId)
        return
      }
    }
    if (!selectedEntityIds.value.includes(entityId)) {
      store.selectSingleEntity(entityId)
    }
    store.beginInteractiveTransform()
    moveDragState.value = { mode: 'entity', lastWorld: world }
    moveDragMoved.value = false
    setPointerCaptureSafe(event.currentTarget, event.pointerId)
    return
  }
  // 移动entities——line====================================

  if (activeTool.value === 'line') {
    handleLineToolPoint(getWorldPointFromEvent(event))
    return
  }

  if (activeTool.value === 'arc') {
    handleArcToolPoint(getWorldPointFromEvent(event), event)
  }

  if (activeTool.value === 'circle') {
    handleCircleToolPoint(getWorldPointFromEvent(event))
  }

  if (activeTool.value === 'ellipse') {
    handleEllipseToolPoint(getWorldPointFromEvent(event))
  }

  if (activeTool.value === 'bezier') {
    handleBezierToolPoint(getWorldPointFromEvent(event))
  }
}

const handlePointerMove = (event: PointerEvent) => {
  //   if (panState.value) {
  //     const point = getLocalPoint(event)
  //     const deltaX = point.x - panState.value.lastX
  //     const deltaY = point.y - panState.value.lastY
  //     store.panBy(deltaX, deltaY)
  //     panState.value.lastX = point.x
  //     panState.value.lastY = point.y
  //     return
  //   }

  // 移动entities——line====================================
  if (moveDragState.value) {
    const rawWorld = getWorldPointFromEvent(event)
    if (moveDragState.value.mode === 'endpoint') {
      const s = moveDragState.value
      const { point: snapped, snappedToVertex } = snapWorldPointForMovingEndpoint(
        rawWorld,
        s.entityId,
        s.end
      )
      moveEndpointSnapPreview.value = snappedToVertex ? snapped : null
      const ent = entities.value.find((e) => e.id === s.entityId)
      if (ent) {
        const cur =
          ent.type === 'LINE'
            ? s.end === 'start'
              ? ent.start
              : ent.end
            : ent.type === 'ARC'
              ? s.end === 'start'
                ? (ent.startPoint ??
                  polarToCartesian(ent.center.x, ent.center.y, ent.radius, ent.startAngle))
                : (ent.endPoint ??
                  polarToCartesian(ent.center.x, ent.center.y, ent.radius, ent.endAngle))
              : null

        if (cur) {
          const ddx = snapped.x - cur.x
          const ddy = snapped.y - cur.y
          if (ddx !== 0 || ddy !== 0) {
            moveDragMoved.value = true
            if (ent.type === 'LINE') {
              store.moveLineEndpointInPlace(s.entityId, s.end, ddx, ddy)
            } else if (ent.type === 'ARC') {
              store.moveArcEndpointInPlace(s.entityId, s.end, ddx, ddy)
            }
          }
        }
      }
      moveDragState.value = {
        mode: 'endpoint',
        entityId: s.entityId,
        end: s.end,
        lastWorld: rawWorld
      }
      return
    }

    if (moveDragState.value.mode === 'arc_center') {
      const s = moveDragState.value
      // 按住 Alt：把当前圆弧圆心句柄的拖动切换为“整体拖动选中集”
      if (event.altKey) {
        const last = moveDragState.value.lastWorld
        const dx = rawWorld.x - last.x
        const dy = rawWorld.y - last.y
        moveEndpointSnapPreview.value = null
        if (dx !== 0 || dy !== 0) {
          moveDragMoved.value = true
          store.moveSelectedEntitiesInPlace(dx, dy)
        }
        moveDragState.value = { mode: 'arc_center', entityId: s.entityId, lastWorld: rawWorld }
        return
      }

      const { point: snapped, kind } = snapWorldPointDetailed(rawWorld)
      moveEndpointSnapPreview.value = kind === 'vertex' ? snapped : null

      const ent = entities.value.find((e) => e.id === s.entityId)
      if (ent && ent.type === 'ARC') {
        const ddx = snapped.x - ent.center.x
        const ddy = snapped.y - ent.center.y
        if (ddx !== 0 || ddy !== 0) {
          moveDragMoved.value = true
          // center 拖动只做整体平移，不改变 radius/startAngle/endAngle 的形状约束
          store.moveArcCenterInPlace(s.entityId, ddx, ddy)
        }
      }

      moveDragState.value = { mode: 'arc_center', entityId: s.entityId, lastWorld: rawWorld }
      return
    }

    if (moveDragState.value.mode === 'circle_center') {
      const s = moveDragState.value
      // 按住 Alt：把当前圆心句柄的拖动切换为“整体拖动选中集”
      if (event.altKey) {
        const last = moveDragState.value.lastWorld
        const dx = rawWorld.x - last.x
        const dy = rawWorld.y - last.y
        moveEndpointSnapPreview.value = null
        circleRadiusHandlePreviewWorld.value = null
        if (dx !== 0 || dy !== 0) {
          moveDragMoved.value = true
          store.moveSelectedEntitiesInPlace(dx, dy)
        }
        moveDragState.value = { mode: 'circle_center', entityId: s.entityId, lastWorld: rawWorld }
        return
      }

      const { point: snapped, kind } = snapWorldPointDetailed(rawWorld)
      moveEndpointSnapPreview.value = kind === 'vertex' ? snapped : null
      circleRadiusHandlePreviewWorld.value = null

      const ent = entities.value.find((e) => e.id === s.entityId)
      if (ent && ent.type === 'CIRCLE') {
        const ddx = snapped.x - ent.center.x
        const ddy = snapped.y - ent.center.y
        if (ddx !== 0 || ddy !== 0) {
          moveDragMoved.value = true
          store.moveCircleCenterInPlace(s.entityId, ddx, ddy)
        }
      }

      moveDragState.value = { mode: 'circle_center', entityId: s.entityId, lastWorld: rawWorld }
      return
    }

    if (moveDragState.value.mode === 'ellipse_center') {
      const s = moveDragState.value
      if (event.altKey) {
        const last = moveDragState.value.lastWorld
        const dx = rawWorld.x - last.x
        const dy = rawWorld.y - last.y
        moveEndpointSnapPreview.value = null
        if (dx !== 0 || dy !== 0) {
          moveDragMoved.value = true
          store.moveSelectedEntitiesInPlace(dx, dy)
        }
        moveDragState.value = { mode: 'ellipse_center', entityId: s.entityId, lastWorld: rawWorld }
        return
      }

      const { point: snapped, kind } = snapWorldPointDetailed(rawWorld)
      moveEndpointSnapPreview.value = kind === 'vertex' ? snapped : null

      const ent = entities.value.find((e) => e.id === s.entityId)
      if (ent && isEllipseLikeIrregularEntity(ent)) {
        const ddx = snapped.x - ent.center.x
        const ddy = snapped.y - ent.center.y
        if (ddx !== 0 || ddy !== 0) {
          moveDragMoved.value = true
          store.moveEllipseCenterInPlace(s.entityId, ddx, ddy)
        }
      }

      moveDragState.value = { mode: 'ellipse_center', entityId: s.entityId, lastWorld: rawWorld }
      return
    }

    if (moveDragState.value.mode === 'circle_radius') {
      const s = moveDragState.value
      const { point: snapped, kind } = snapWorldPointDetailed(rawWorld)
      moveEndpointSnapPreview.value = kind === 'vertex' ? snapped : null

      const ddx = snapped.x - s.center.x
      const ddy = snapped.y - s.center.y
      const nextR = Math.hypot(ddx, ddy)
      const nextRClamped = Math.max(nextR, 1e-6)

      const ent = entities.value.find((e) => e.id === s.entityId)
      if (ent && ent.type === 'CIRCLE') {
        if (Math.abs(ent.radius - nextRClamped) > 1e-9) {
          moveDragMoved.value = true
        }
      }

      store.moveCircleRadiusInPlace(s.entityId, nextRClamped)
      // 防止鼠标压到圆心导致半径被钳制到 1e-6 时，圆周点仍然落在圆上
      if (nextR < 1e-9) {
        circleRadiusHandlePreviewWorld.value = { x: s.center.x + nextRClamped, y: s.center.y }
      } else {
        circleRadiusHandlePreviewWorld.value = {
          x: s.center.x + (ddx / nextR) * nextRClamped,
          y: s.center.y + (ddy / nextR) * nextRClamped
        }
      }
      moveDragState.value = {
        mode: 'circle_radius',
        entityId: s.entityId,
        center: s.center,
        lastWorld: rawWorld
      }
      return
    }

    if (moveDragState.value.mode === 'bezier_point') {
      const s = moveDragState.value
      const { point: snapped, snappedToVertex } = snapWorldPointForMovingEndpoint(
        rawWorld,
        s.entityId,
        s.pointIndex
      )
      moveEndpointSnapPreview.value = snappedToVertex ? snapped : null
      const ent = entities.value.find((e) => e.id === s.entityId)
      if (ent && ent.type === 'BEZIER') {
        const cur = ent.points[s.pointIndex]
        if (!cur) return
        const ddx = snapped.x - cur.x
        const ddy = snapped.y - cur.y
        if (ddx !== 0 || ddy !== 0) {
          moveDragMoved.value = true
          store.moveBezierPointInPlace(s.entityId, s.pointIndex, ddx, ddy)
        }
      }
      moveDragState.value = {
        mode: 'bezier_point',
        entityId: s.entityId,
        pointIndex: s.pointIndex,
        lastWorld: rawWorld
      }
      return
    }

    const last = moveDragState.value.lastWorld
    const dx = rawWorld.x - last.x
    const dy = rawWorld.y - last.y
    moveEndpointSnapPreview.value = null
    if (dx !== 0 || dy !== 0) {
      moveDragMoved.value = true
      store.moveSelectedEntitiesInPlace(dx, dy)
    }
    moveDragState.value = { mode: 'entity', lastWorld: rawWorld }
    return
  }
  // 移动entities——line====================================

  if (selectionState.value) {
    const point = getLocalPoint(event)
    selectionState.value.moved =
      selectionState.value.moved ||
      Math.abs(point.x - selectionState.value.startX) > 3 ||
      Math.abs(point.y - selectionState.value.startY) > 3

    const x = Math.min(selectionState.value.startX, point.x)
    const y = Math.min(selectionState.value.startY, point.y)
    const width = Math.abs(point.x - selectionState.value.startX)
    const height = Math.abs(point.y - selectionState.value.startY)

    store.setSelectionRect({ x, y, width, height })
    selectionState.value.lastX = point.x
    selectionState.value.lastY = point.y
    return
  }

  if (activeTool.value === 'line') {
    const raw = getWorldPointFromEvent(event)
    const { point, kind } = snapWorldPointDetailed(raw)
    // 已有起点：橡皮筋终点跟随吸附后的点；仅起步：仍显示端点吸附指示（网格吸附在点击时生效）
    if (lineDraftStart.value) {
      lineDraftEnd.value = point
    }
    lineSnapPreviewWorld.value = kind === 'vertex' ? point : null
    return
  }

  if (activeTool.value === 'arc') {
    const raw = getWorldPointFromEvent(event)
    const { point, kind } = snapWorldPointDetailed(raw)
    lineSnapPreviewWorld.value = kind === 'vertex' ? point : null

    // 三点圆弧预览逻辑：
    // - 第二点阶段：展示“起点 -> 当前鼠标点”的实时预览线
    // - 第三点阶段：实时计算外接圆，并刷新圆弧路径预览
    if (drawingShapeTool.value === 'three_points_arc') {
      if (!arcDraftStart.value) return

      // 第二点（mid）未确认：arcDraftMid 为空，此时 arcDraftEnd 承载“鼠标当前点”
      if (!arcDraftMid.value) {
        arcDraftEnd.value = point
        return
      }

      // 第三点（end）阶段：用 start/mid/mouse 实时计算圆心、半径与方向
      const circle = circumcircleFrom3Points(arcDraftStart.value, arcDraftMid.value, point)
      if (!circle) {
        arcDraftCenter.value = null
        arcDraftRadius.value = 0
        arcDraftEnd.value = null
        return
      }

      const { center, radius } = circle
      arcDraftCenter.value = center
      arcDraftRadius.value = radius

      const startOnCircle = projectPointToRadius(center, arcDraftStart.value, radius)
      const midOnCircle = projectPointToRadius(center, arcDraftMid.value, radius)
      const endOnCircle = projectPointToRadius(center, point, radius)

      const aStart = pointToAngleDeg(center, startOnCircle)
      const aMid = pointToAngleDeg(center, midOnCircle)
      const aEnd = pointToAngleDeg(center, endOnCircle)

      const sweepStartToEnd = ccwDelta(aStart, aEnd)
      const sweepStartToMid = ccwDelta(aStart, aMid)
      const midOnCcw = sweepStartToMid <= sweepStartToEnd + 1e-9
      const dir = midOnCcw ? 1 : -1

      arcDraftDirection.value = dir
      arcDraftStart.value = startOnCircle
      arcDraftEnd.value = endOnCircle
      return
    }

    // start -> center -> end：选“圆心”阶段时，模板的橡皮筋线用 arcDraftStart -> arcDraftEnd
    // 这里让 arcDraftEnd 临时承载“当前鼠标点（候选圆心）”，从而让预览线跟随鼠标。
    if (
      drawingShapeTool.value === 'start_center_end' &&
      arcDraftStart.value &&
      !arcDraftCenter.value
    ) {
      arcDraftEnd.value = point
      return
    }

    if (!arcDraftCenter.value) return
    if (!arcDraftStart.value) {
      arcDraftEnd.value = point
      arcDraftRadius.value = Math.hypot(
        point.x - arcDraftCenter.value.x,
        point.y - arcDraftCenter.value.y
      )
      return
    }

    // 预览终点阶段：方向只由 Shift 决定，避免临界区导致 CCW/CW 互跳
    arcDraftDirection.value = event.shiftKey ? -1 : 1
    arcDraftEnd.value = projectPointToRadius(arcDraftCenter.value, point, arcDraftRadius.value)
    return
  }

  if (activeTool.value === 'circle') {
    const raw = getWorldPointFromEvent(event)
    const { point, kind } = snapWorldPointDetailed(raw)
    const tool = drawingShapeTool.value ?? 'center_radius'

    // 半径/第三点阶段的吸附指示
    const snappedForRing = kind === 'vertex' ? point : null
    // 切换到圆工具时清理其他工具的预览状态
    lineSnapPreviewWorld.value = null
    moveEndpointSnapPreview.value = null
    circleSnapPreviewWorld.value = null

    if (tool === 'center_radius') {
      // 第一阶段：选择“圆心”（仅显示吸附预览，不锁定草稿点）
      if (!circleDraftCenter.value) {
        circleSnapPreviewWorld.value = snappedForRing
      } else {
        // 第二阶段：选择“半径点”（更新草稿并显示吸附预览）
        circleDraftRadius.value = Math.hypot(
          point.x - circleDraftCenter.value.x,
          point.y - circleDraftCenter.value.y
        )
        circleDraftP1.value = point
        circleSnapPreviewWorld.value = snappedForRing
      }
      return
    }

    if (tool === 'center_diameter') {
      // 第一阶段：选择“圆心”
      if (!circleDraftCenter.value) {
        circleSnapPreviewWorld.value = snappedForRing
      } else {
        // 第二阶段：选择“直径端点”
        circleDraftP1.value = point
        circleDraftRadius.value =
          Math.hypot(point.x - circleDraftCenter.value.x, point.y - circleDraftCenter.value.y) / 2
        circleSnapPreviewWorld.value = snappedForRing
      }
      return
    }

    if (tool === 'two_points') {
      // 第一阶段：选择“第一点”
      if (!circleDraftP1.value) {
        circleSnapPreviewWorld.value = snappedForRing
      } else {
        // 第二阶段：选择“第二点”
        circleDraftP2.value = point
        circleDraftCenter.value = {
          x: (circleDraftP1.value.x + point.x) / 2,
          y: (circleDraftP1.value.y + point.y) / 2
        }
        circleDraftRadius.value =
          Math.hypot(point.x - circleDraftP1.value.x, point.y - circleDraftP1.value.y) / 2
        circleSnapPreviewWorld.value = snappedForRing
      }
      return
    }

    if (tool === 'three_points_circle') {
      // 第一阶段：选择“第一点”
      if (!circleDraftP1.value) {
        circleSnapPreviewWorld.value = snappedForRing
        return
      }

      // 第二阶段：选择“第二点”（此阶段用 circleDraftCenter 承载鼠标点以用于预览连线）
      if (circleDraftP1.value && !circleDraftP2.value) {
        circleDraftCenter.value = point
        circleSnapPreviewWorld.value = snappedForRing
        return
      }
      if (circleDraftP1.value && circleDraftP2.value) {
        const circle = circumcircleFrom3Points(circleDraftP1.value, circleDraftP2.value, point)
        if (!circle) {
          circleDraftCenter.value = null
          circleDraftRadius.value = 0
          circleSnapPreviewWorld.value = null
          return
        }
        circleDraftP3.value = point
        circleDraftCenter.value = circle.center
        circleDraftRadius.value = circle.radius
        circleSnapPreviewWorld.value = snappedForRing
      }
      return
    }

    // fallback：不认识的工具时不更新预览
    circleSnapPreviewWorld.value = null
    return
  }

  if (activeTool.value === 'ellipse') {
    const raw = getWorldPointFromEvent(event)
    const { point, kind } = snapWorldPointDetailed(raw)
    ellipseSnapPreviewWorld.value = kind === 'vertex' ? point : null
    ellipseDraftMouse.value = point
    return
  }

  if (activeTool.value === 'bezier') {
    const raw = getWorldPointFromEvent(event)
    const { point, kind } = snapWorldPointDetailed(raw)
    bezierSnapPreviewWorld.value = kind === 'vertex' ? point : null
    bezierDraftMouse.value = point
    return
  }

  lineSnapPreviewWorld.value = null
  moveEndpointSnapPreview.value = null
  ellipseSnapPreviewWorld.value = null
  bezierSnapPreviewWorld.value = null
}

const handleKeyToggleArcDirection = (event: KeyboardEvent) => {
  if (activeTool.value !== 'arc') return
  if (!arcDraftCenter.value || !arcDraftStart.value) return
  arcDraftDirection.value = event.shiftKey ? -1 : 1
}

const handlePointerUp = () => {
  // 移动entities——line====================================
  if (moveDragState.value) {
    if (moveDragMoved.value) {
      store.endInteractiveTransform()
    } else {
      store.cancelInteractiveTransform()
    }
    moveDragState.value = null
    moveDragMoved.value = false
    moveEndpointSnapPreview.value = null
    circleRadiusHandlePreviewWorld.value = null
  }
  // 移动entities——line====================================

  if (activeTool.value === 'select' && selectionState.value) {
    const rect = selectionRect.value
    if (rect && (rect.width > 4 || rect.height > 4)) {
      const p1 = screenToWorld({ x: rect.x, y: rect.y }, viewport.value)
      const p2 = screenToWorld({ x: rect.x + rect.width, y: rect.y + rect.height }, viewport.value)
      const worldRect = {
        minX: Math.min(p1.x, p2.x),
        minY: Math.min(p1.y, p2.y),
        maxX: Math.max(p1.x, p2.x),
        maxY: Math.max(p1.y, p2.y)
      }
      const m = selectionBoundsMarginWorld.value
      const ids = visibleEntities.value
        .filter((entity) => {
          if (entity.type === 'LINE') {
            const bounds = {
              minX: Math.min(entity.start.x, entity.end.x) - m,
              minY: Math.min(entity.start.y, entity.end.y) - m,
              maxX: Math.max(entity.start.x, entity.end.x) + m,
              maxY: Math.max(entity.start.y, entity.end.y) + m
            }
            return !(
              bounds.maxX < worldRect.minX ||
              bounds.minX > worldRect.maxX ||
              bounds.maxY < worldRect.minY ||
              bounds.minY > worldRect.maxY
            )
          }

          if (isEllipseLikeIrregularEntity(entity)) {
            const pad = Math.max(entity.radiusX, entity.radiusY) + m
            const bounds = {
              minX: entity.center.x - pad,
              minY: entity.center.y - pad,
              maxX: entity.center.x + pad,
              maxY: entity.center.y + pad
            }
            return !(
              bounds.maxX < worldRect.minX ||
              bounds.minX > worldRect.maxX ||
              bounds.maxY < worldRect.minY ||
              bounds.minY > worldRect.maxY
            )
          }

          if (entity.type === 'BEZIER') {
            const bezierPts = createBezierPoints(entity.points, 96)
            const xs = bezierPts.map((point) => point.x)
            const ys = bezierPts.map((point) => point.y)
            const bounds = {
              minX: Math.min(...xs) - m,
              minY: Math.min(...ys) - m,
              maxX: Math.max(...xs) + m,
              maxY: Math.max(...ys) + m
            }
            return !(
              bounds.maxX < worldRect.minX ||
              bounds.minX > worldRect.maxX ||
              bounds.maxY < worldRect.minY ||
              bounds.minY > worldRect.maxY
            )
          }

          const bounds = {
            minX: entity.center.x - entity.radius - m,
            minY: entity.center.y - entity.radius - m,
            maxX: entity.center.x + entity.radius + m,
            maxY: entity.center.y + entity.radius + m
          }
          return !(
            bounds.maxX < worldRect.minX ||
            bounds.minX > worldRect.maxX ||
            bounds.maxY < worldRect.minY ||
            bounds.minY > worldRect.maxY
          )
        })
        .map((entity) => entity.id)

      if (selectionState.value.append) {
        store.setSelection([...selectedEntityIds.value, ...ids])
      } else {
        store.setSelection(ids)
      }
    } else if (!selectionState.value.append) {
      store.clearSelection()
    }
    store.setSelectionRect(null)
  }

  panState.value = null
  selectionState.value = null
}

onMounted(() => {
  // 创建 ResizeObserver 实例，监听尺寸变化
  resizeObserver.value = new ResizeObserver((entries) => {
    // entries 是尺寸变化的元素数组（一个 Observer 可监听多个元素）
    // 取第一个元素的「内容区域尺寸」（contentRect 包含 width/height 等）
    const rect = entries[0]?.contentRect
    if (!rect) return
    // 调用 Pinia Store 的 setCanvasSize 方法，同步尺寸到视图
    store.setCanvasSize(rect.width, rect.height)
  })
  // 如果 canvasHost 存在，则监听其尺寸变化
  if (canvasHost.value) {
    resizeObserver.value.observe(canvasHost.value)
  }

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('keydown', handleKeyToggleArcDirection)
  window.addEventListener('keyup', handleKeyToggleArcDirection)

  unsubscribeAction = subscribeQomoToCanvasAction((action) => {
    if (action.type === 'DRAWING') {
      if (action.entityType === 'LINE') {
        activeTool.value = 'line'
        drawingShapeTool.value = action.drawingShapeTool ?? 'only_line'
        resetDrafts()
        return
      }

      if (action.entityType === 'ARC') {
        activeTool.value = 'arc'
        if (!action.drawingShapeTool) drawingShapeTool.value = 'center_start_end'
        if (action.drawingShapeTool) drawingShapeTool.value = action.drawingShapeTool
        resetDrafts()
        return
      }

      if (action.entityType === 'CIRCLE') {
        activeTool.value = 'circle'
        drawingShapeTool.value = action.drawingShapeTool ?? 'center_radius'
        resetDrafts()
        return
      }

      if (action.entityType === 'BEZIER') {
        activeTool.value = 'bezier'
        drawingShapeTool.value = action.drawingShapeTool ?? 'cubic_bezier'
        resetDrafts()
        return
      }

      if (
        action.entityType === 'IRREGULAR' &&
        (action.drawingShapeTool === 'oval' ||
          action.drawingShapeTool === 'square' ||
          action.drawingShapeTool === 'cushion' ||
          action.drawingShapeTool === 'octagon' ||
          action.drawingShapeTool === 'marquise' ||
          action.drawingShapeTool === 'pear' ||
          action.drawingShapeTool === 'heart')
      ) {
        activeTool.value = 'ellipse'
        drawingShapeTool.value = action.drawingShapeTool ?? 'oval'
        resetDrafts()
        return
      }
    }

    if (action.type === 'MOVE') {
      activeTool.value = 'move'
      resetDrafts()
      return
    }

    if (action.type === 'SELECT') {
      activeTool.value = 'select'
      resetDrafts()
      return
    }

    if (action.type === 'DELETE_SELECTED') {
      store.deleteSelectedEntities()
      return
    }

    if (action.type === 'UNDO') {
      store.undo()
      return
    }

    if (action.type === 'REDO') {
      store.redo()
      return
    }

    if (action.type === 'SAVE') {
      store.saveDraft(action.projectName)
      info('正在保存本地文件...', '文件名为：' + action.projectName, 8000)
      return
    }

    if (action.type === 'CREATE_PROJECT') {
      createProject(action.projectName)
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('keydown', handleKeyToggleArcDirection)
  window.removeEventListener('keyup', handleKeyToggleArcDirection)
  unsubscribeAction?.()
  unsubscribeAction = null
})
</script>
