import { reactive } from 'vue'
import { loadCanvas2DConfig, type Canvas2DConfig } from '../../stores/canvas2DSettingsStore'
import {
  DEFAULT_SNAP_TO_GRID,
  CANVAS_GRID_STEP, CANVAS_GRID_COLOR, CANVAS_GRID_AXIS_COLOR,
  CANVAS_AXIS_LINE_WIDTH, CANVAS_ENTITY_STROKE, CANVAS_ENTITY_LINE_WIDTH,
  CANVAS_SELECTION_STROKE, CANVAS_SELECTION_LINE_WIDTH, CANVAS_HOVER_STROKE,
  CANVAS_PREVIEW_STROKE, CANVAS_PREVIEW_DASH,
  CANVAS_SELECTION_RECT_STROKE, CANVAS_SELECTION_RECT_DASH,
  CANVAS_SELECTION_RECT_FILL, CANVAS_HIT_PX,
} from '../../configs/defaults'

export interface Canvas2DForm {
  snaptoGrid: boolean
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
  previewDash: string
  selectionRectStroke: string
  selectionRectDash: string
  selectionRectFill: string
  hitPx: number
}

function arrToStr(a: number[]): string { return a.join(', ') }
function strToArr(s: string): number[] { return s.split(',').map(v => Number(v.trim())).filter(n => !isNaN(n)) }

export function useCanvas2DSettings() {
  const initial = loadCanvas2DConfig()

  const form = reactive<Canvas2DForm>({
    snaptoGrid: initial.snaptoGrid,
    gridStep: initial.gridStep,
    gridColor: initial.gridColor,
    gridAxisColor: initial.gridAxisColor,
    axisLineWidth: initial.axisLineWidth,
    entityStroke: initial.entityStroke,
    entityLineWidth: initial.entityLineWidth,
    selectionStroke: initial.selectionStroke,
    selectionLineWidth: initial.selectionLineWidth,
    hoverStroke: initial.hoverStroke,
    previewStroke: initial.previewStroke,
    previewDash: arrToStr(initial.previewDash),
    selectionRectStroke: initial.selectionRectStroke,
    selectionRectDash: arrToStr(initial.selectionRectDash),
    selectionRectFill: initial.selectionRectFill,
    hitPx: initial.hitPx,
  })

  function reset() {
    form.snaptoGrid = DEFAULT_SNAP_TO_GRID
    form.gridStep = CANVAS_GRID_STEP
    form.gridColor = CANVAS_GRID_COLOR
    form.gridAxisColor = CANVAS_GRID_AXIS_COLOR
    form.axisLineWidth = CANVAS_AXIS_LINE_WIDTH
    form.entityStroke = CANVAS_ENTITY_STROKE
    form.entityLineWidth = CANVAS_ENTITY_LINE_WIDTH
    form.selectionStroke = CANVAS_SELECTION_STROKE
    form.selectionLineWidth = CANVAS_SELECTION_LINE_WIDTH
    form.hoverStroke = CANVAS_HOVER_STROKE
    form.previewStroke = CANVAS_PREVIEW_STROKE
    form.previewDash = arrToStr(CANVAS_PREVIEW_DASH)
    form.selectionRectStroke = CANVAS_SELECTION_RECT_STROKE
    form.selectionRectDash = arrToStr(CANVAS_SELECTION_RECT_DASH)
    form.selectionRectFill = CANVAS_SELECTION_RECT_FILL
    form.hitPx = CANVAS_HIT_PX
  }

  function toData(): Canvas2DConfig {
    return {
      snaptoGrid: form.snaptoGrid,
      gridStep: form.gridStep,
      gridColor: form.gridColor,
      gridAxisColor: form.gridAxisColor,
      axisLineWidth: form.axisLineWidth,
      entityStroke: form.entityStroke,
      entityLineWidth: form.entityLineWidth,
      selectionStroke: form.selectionStroke,
      selectionLineWidth: form.selectionLineWidth,
      hoverStroke: form.hoverStroke,
      previewStroke: form.previewStroke,
      previewDash: strToArr(form.previewDash),
      selectionRectStroke: form.selectionRectStroke,
      selectionRectDash: strToArr(form.selectionRectDash),
      selectionRectFill: form.selectionRectFill,
      hitPx: form.hitPx,
    }
  }

  function reload() {
    const c = loadCanvas2DConfig()
    form.snaptoGrid = c.snaptoGrid
    form.gridStep = c.gridStep
    form.gridColor = c.gridColor
    form.gridAxisColor = c.gridAxisColor
    form.axisLineWidth = c.axisLineWidth
    form.entityStroke = c.entityStroke
    form.entityLineWidth = c.entityLineWidth
    form.selectionStroke = c.selectionStroke
    form.selectionLineWidth = c.selectionLineWidth
    form.hoverStroke = c.hoverStroke
    form.previewStroke = c.previewStroke
    form.previewDash = arrToStr(c.previewDash)
    form.selectionRectStroke = c.selectionRectStroke
    form.selectionRectDash = arrToStr(c.selectionRectDash)
    form.selectionRectFill = c.selectionRectFill
    form.hitPx = c.hitPx
  }

  return { form, reset, toData, reload }
}
