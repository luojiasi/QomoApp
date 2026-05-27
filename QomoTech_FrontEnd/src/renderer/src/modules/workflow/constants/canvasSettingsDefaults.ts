// ─────────────────────────────────────────────────────────────
// constants/canvasSettingsDefaults.ts — 画布配置默认值
// ─────────────────────────────────────────────────────────────

import type { CanvasSettings } from '../types/canvasSettings'

export const CANVAS_SETTINGS_DEFAULTS: CanvasSettings = {
  snapToGrid: true,
  snapGridSize: 20,
  bgGap: 20,
  bgSize: 6,
  bgColor: '#575757',
  showMiniMap: true,
  miniMapWidth: 160,
  miniMapHeight: 100,
  miniMapPosition: 'top-left',
  defaultViewportX: 0,
  defaultViewportY: 0,
  defaultViewportZoom: 1,
  minZoom: 0.6,
  maxZoom: 2,
  edgeColor: '#d93a7a',
  edgeStrokeWidth: 1.5,
  edgeArrowStyle: 'arrowclosed',
  edgeBorderRadius: 8,
  edgeType: 'step',
  nodeBorderWidth: 2
}
