// ─────────────────────────────────────────────────────────────
// utils/edgeMarkerUtils.ts — 连线箭头标记构建（纯函数）
// ─────────────────────────────────────────────────────────────

import { MarkerType } from '@vue-flow/core'
import type { EdgeMarkerType } from '@vue-flow/core'
import type { EdgeArrowStyle } from '../types/canvasSettings'
import {
  EDGE_MARKER_MAX_SIZE,
  EDGE_MARKER_MIN_SIZE,
  EDGE_MARKER_STROKE_FACTOR
} from '../constants/workflowEdge'

/** 根据线宽计算箭头尺寸，与线条粗细成比例且限制在合理范围 */
export function calcEdgeMarkerSize(strokeWidth: number): number {
  const scaled = Math.round(strokeWidth * EDGE_MARKER_STROKE_FACTOR + 5)
  return Math.min(EDGE_MARKER_MAX_SIZE, Math.max(EDGE_MARKER_MIN_SIZE, scaled))
}

/** 根据箭头样式与描边属性生成 VueFlow markerEnd */
export function buildEdgeMarkerEnd(
  arrowStyle: EdgeArrowStyle,
  color: string,
  strokeWidth: number
): EdgeMarkerType | undefined {
  if (arrowStyle === 'none') return undefined

  const type = arrowStyle === 'arrowclosed' ? MarkerType.ArrowClosed : MarkerType.Arrow
  const size = calcEdgeMarkerSize(strokeWidth)

  return { type, color, width: size, height: size }
}
