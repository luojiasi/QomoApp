import type { Ref, InjectionKey } from 'vue'

// ActionDef 定义
export type ActionGroup = 'file' | 'shape' | 'freeparam' | 'tool' | 'settings' | 'view'

/** provide/inject：设置弹窗共享状态 */
export interface SettingsState {
  isOpen: Ref<boolean>
  capturing: Ref<string | null>
}
export const SETTINGS_STATE_KEY: InjectionKey<SettingsState> = Symbol('settingsState')

/** SwitchableView 复用组件的 Tab 定义 */
export interface TabItem {
  id: string
  label: string
}
// 定义 ActionDef 类型
export interface ActionDef {
  id: string
  label: string
  group: ActionGroup
  key?: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  icon?: string
  /** SET_TOOL / 复合 action 携带的额外数据 */
  data?: Record<string, string>
}
/** 通用编辑器设置 */
export interface GeneralEditorConfig {
  defaultProjectName: string
  defaultExtrudeHeight: number
  defaultOpenSize: number
  defaultTiltAngle: number
}

/** 3D 场景配置 */
export interface Scene3DConfig {
  cameraPosition: { x: number; y: number; z: number }
  cameraFov: number
  cameraNear: number
  cameraFar: number
  sceneBackground: number
  ambientLightIntensity: number
  directionalLightIntensity: number
  directionalLightPosition: { x: number; y: number; z: number }
  axesSize: number
  gridSize: number
  gridDivisions: number
  gridColorCenter: number
  gridColorEdge: number
  showGrid: boolean
  showAxes: boolean
  controlsMinDistance: number
  controlsMaxDistance: number
  // 预览材质
  materialDefaultColor: number
  materialSelectedColor: number
  materialWallTopColor: number
  materialWallBottomColor: number
  materialReferenceOpacity: number
  materialWallOpacity: number
  materialSelectedWallOpacity: number
  materialCapColor: number
  materialSelectedCapColor: number
  materialCapOpacity: number
  materialSelectedCapOpacity: number
}
