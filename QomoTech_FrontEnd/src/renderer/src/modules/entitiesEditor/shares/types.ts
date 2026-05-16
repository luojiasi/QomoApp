
// ActionDef 定义
export type ActionGroup = 'file' | 'shape' | 'tool' | 'settings'
export type InspectorSection = 'params' | 'transform'


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
