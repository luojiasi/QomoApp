// ─────────────────────────────────────────────────────────────
// constants/canvasSettingsOptions.ts — 画布配置面板选项数据
// ─────────────────────────────────────────────────────────────

import type {
  CanvasSettingsSelectOption,
  EdgeArrowStyle,
  EdgeConnectionType,
  MiniMapPosition
} from '../types/canvasSettings'

export const EDGE_ARROW_STYLE_OPTIONS: readonly CanvasSettingsSelectOption<EdgeArrowStyle>[] = [
  { label: '无箭头', value: 'none' },
  { label: '开放箭头', value: 'arrow' },
  { label: '实心箭头', value: 'arrowclosed' }
] as const

export const EDGE_TYPE_OPTIONS: readonly CanvasSettingsSelectOption<EdgeConnectionType>[] = [
  { label: '直角折线', value: 'step' },
  { label: '平滑折线', value: 'smoothstep' },
  { label: '直线', value: 'straight' },
  { label: '曲线', value: 'default' }
] as const

export const MINI_MAP_POSITION_OPTIONS: readonly CanvasSettingsSelectOption<MiniMapPosition>[] = [
  { label: '左上', value: 'top-left' },
  { label: '右上', value: 'top-right' },
  { label: '左下', value: 'bottom-left' },
  { label: '右下', value: 'bottom-right' }
] as const
