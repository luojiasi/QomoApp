// =============================================================================
// Canvas2D 设置 —— localStorage 持久化
// =============================================================================

import {
  STORAGE_KEY_CANVAS2D,
  CANVAS_GRID_STEP,
  CANVAS_GRID_COLOR,
  CANVAS_GRID_AXIS_COLOR,
  CANVAS_AXIS_LINE_WIDTH,
  CANVAS_ENTITY_STROKE,
  CANVAS_ENTITY_LINE_WIDTH,
  CANVAS_SELECTION_STROKE,
  CANVAS_SELECTION_LINE_WIDTH,
  CANVAS_HOVER_STROKE,
  CANVAS_PREVIEW_STROKE,
  CANVAS_PREVIEW_DASH,
  CANVAS_SELECTION_RECT_STROKE,
  CANVAS_SELECTION_RECT_DASH,
  CANVAS_SELECTION_RECT_FILL,
  CANVAS_HIT_PX,
} from '../configs/defaults'

export interface Canvas2DConfig {
  gridStep: number
  gridColor: string
  gridAxisColor: string
  axisLineWidth: number
  entityStroke: string
  entityLineWidth: number
  selectionStroke: string
  selectionLineWidth: number
  hoverStroke: string
  previewStroke: string
  previewDash: number[]
  selectionRectStroke: string
  selectionRectDash: number[]
  selectionRectFill: string
  hitPx: number
}

export function loadCanvas2DConfig(): Canvas2DConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CANVAS2D)
    if (raw) {
      const saved = JSON.parse(raw)
      return {
        gridStep: saved.gridStep ?? CANVAS_GRID_STEP,
        gridColor: saved.gridColor ?? CANVAS_GRID_COLOR,
        gridAxisColor: saved.gridAxisColor ?? CANVAS_GRID_AXIS_COLOR,
        axisLineWidth: saved.axisLineWidth ?? CANVAS_AXIS_LINE_WIDTH,
        entityStroke: saved.entityStroke ?? CANVAS_ENTITY_STROKE,
        entityLineWidth: saved.entityLineWidth ?? CANVAS_ENTITY_LINE_WIDTH,
        selectionStroke: saved.selectionStroke ?? CANVAS_SELECTION_STROKE,
        selectionLineWidth: saved.selectionLineWidth ?? CANVAS_SELECTION_LINE_WIDTH,
        hoverStroke: saved.hoverStroke ?? CANVAS_HOVER_STROKE,
        previewStroke: saved.previewStroke ?? CANVAS_PREVIEW_STROKE,
        previewDash: saved.previewDash ?? CANVAS_PREVIEW_DASH,
        selectionRectStroke: saved.selectionRectStroke ?? CANVAS_SELECTION_RECT_STROKE,
        selectionRectDash: saved.selectionRectDash ?? CANVAS_SELECTION_RECT_DASH,
        selectionRectFill: saved.selectionRectFill ?? CANVAS_SELECTION_RECT_FILL,
        hitPx: saved.hitPx ?? CANVAS_HIT_PX,
      }
    }
  } catch { /* corrupted data, fall through to defaults */ }
  return {
    gridStep: CANVAS_GRID_STEP,
    gridColor: CANVAS_GRID_COLOR,
    gridAxisColor: CANVAS_GRID_AXIS_COLOR,
    axisLineWidth: CANVAS_AXIS_LINE_WIDTH,
    entityStroke: CANVAS_ENTITY_STROKE,
    entityLineWidth: CANVAS_ENTITY_LINE_WIDTH,
    selectionStroke: CANVAS_SELECTION_STROKE,
    selectionLineWidth: CANVAS_SELECTION_LINE_WIDTH,
    hoverStroke: CANVAS_HOVER_STROKE,
    previewStroke: CANVAS_PREVIEW_STROKE,
    previewDash: [...CANVAS_PREVIEW_DASH],
    selectionRectStroke: CANVAS_SELECTION_RECT_STROKE,
    selectionRectDash: [...CANVAS_SELECTION_RECT_DASH],
    selectionRectFill: CANVAS_SELECTION_RECT_FILL,
    hitPx: CANVAS_HIT_PX,
  }
}

export function saveCanvas2DConfig(data: Canvas2DConfig) {
  localStorage.setItem(STORAGE_KEY_CANVAS2D, JSON.stringify(data))
}
