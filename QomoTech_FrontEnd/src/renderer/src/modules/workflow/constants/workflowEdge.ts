// ─────────────────────────────────────────────────────────────
// constants/workflowEdge.ts — 画布连线视觉常量
// ─────────────────────────────────────────────────────────────

import type { EdgeStyle } from '../types/workflow'

/** 默认连线样式 */
export const DEFAULT_EDGE_STYLE: EdgeStyle = {
  stroke: '#6b7280',
  strokeWidth: 1.5
}

/** 选中时连线样式（粗细由画布设置动态覆盖） */
export const SELECTED_EDGE_STYLE: EdgeStyle = {
  stroke: '#facc15',
  strokeWidth: 2.5
}

/** 选中边相对默认粗细的增量 */
export const SELECTED_EDGE_STROKE_WIDTH_OFFSET = 1

/** step / smoothstep 从端口先向下延伸的最小竖直距离（px） */
export const EDGE_PATH_OFFSET = 24

/** 箭头标记尺寸（px），随线宽微调并限制上下界 */
export const EDGE_MARKER_MIN_SIZE = 8
export const EDGE_MARKER_MAX_SIZE = 14
export const EDGE_MARKER_STROKE_FACTOR = 3
