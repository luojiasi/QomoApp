// ─────────────────────────────────────────────────────────────
// types/canvasSettings.ts — 画布配置类型（仅类型，无常量）
// ─────────────────────────────────────────────────────────────

export type MiniMapPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

/** VueFlow 连线类型 */
export type EdgeConnectionType = 'step' | 'smoothstep' | 'straight' | 'default'

/** 连线终点箭头样式 */
export type EdgeArrowStyle = 'none' | 'arrow' | 'arrowclosed'

/** 配置面板下拉选项 */
export interface CanvasSettingsSelectOption<T extends string = string> {
  label: string
  value: T
}

/** 滑块类字段的 UI 约束 */
export interface CanvasSettingsRange {
  min: number
  max: number
  step: number
}

export interface CanvasSettings {
  // 网格对齐
  snapToGrid: boolean
  snapGridSize: number
  // 背景网格
  bgGap: number
  bgSize: number
  bgColor: string
  // 小地图
  showMiniMap: boolean
  miniMapWidth: number
  miniMapHeight: number
  miniMapPosition: MiniMapPosition
  // 视口与缩放
  defaultViewportX: number
  defaultViewportY: number
  defaultViewportZoom: number
  minZoom: number
  maxZoom: number
  // 连线
  edgeColor: string
  edgeStrokeWidth: number
  edgeArrowStyle: EdgeArrowStyle
  /** step / smoothstep 折线转角圆角半径（px） */
  edgeBorderRadius: number
  edgeType: EdgeConnectionType
}

/** workflow.json 中只保存与默认值不同的覆盖项 */
export type CanvasSettingsOverride = Partial<CanvasSettings>

/** 带滑块约束的字段名 */
export type CanvasSettingsRangeField =
  | 'snapGridSize'
  | 'bgGap'
  | 'bgSize'
  | 'miniMapWidth'
  | 'miniMapHeight'
  | 'defaultViewportZoom'
  | 'minZoom'
  | 'maxZoom'
  | 'edgeStrokeWidth'
  | 'edgeBorderRadius'
