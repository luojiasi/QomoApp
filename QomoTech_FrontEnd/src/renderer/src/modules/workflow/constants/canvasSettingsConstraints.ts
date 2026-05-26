// ─────────────────────────────────────────────────────────────
// constants/canvasSettingsConstraints.ts — 画布配置面板滑块约束
// ─────────────────────────────────────────────────────────────

import type { CanvasSettingsRange, CanvasSettingsRangeField } from '../types/canvasSettings'

export const CANVAS_SETTINGS_RANGES: Record<CanvasSettingsRangeField, CanvasSettingsRange> = {
  snapGridSize: { min: 5, max: 50, step: 5 },
  bgGap: { min: 10, max: 60, step: 5 },
  bgSize: { min: 1, max: 10, step: 0.5 },
  miniMapWidth: { min: 100, max: 300, step: 10 },
  miniMapHeight: { min: 60, max: 200, step: 10 },
  defaultViewportZoom: { min: 0.1, max: 2, step: 0.1 },
  minZoom: { min: 0.05, max: 1, step: 0.05 },
  maxZoom: { min: 1, max: 8, step: 0.5 },
  edgeStrokeWidth: { min: 1, max: 4, step: 0.5 },
  edgeBorderRadius: { min: 0, max: 32, step: 1 }
}
