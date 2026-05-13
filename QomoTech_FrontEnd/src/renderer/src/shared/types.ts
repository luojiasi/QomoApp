// ─── 通知 ───────────────────────────────────────

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

/** 单条通知（内部状态，含计时器等） */
export interface NotificationItem {
  id: string
  type: NotificationType
  message: string
  description: string
  duration: number
  progress: number
  timer?: ReturnType<typeof setInterval>
}

/** 全局调用时传入的载荷（无需 id / progress / timer） */
export type AddNotificationInput = {
  type: NotificationType
  message: string
  description?: string
  /** 毫秒，0 表示不自动关闭 */
  duration?: number
}

// ─── 通用设置 ───────────────────────────────────

export type SettingValue = string | number | boolean | null

export interface ParameterField {
  key: string
  label: string
  value: SettingValue
  unit?: string
}

export interface ParameterFieldGroup {
  id: string
  title: string
  fields: ParameterField[]
}

export interface ParameterSection {
  id: string
  title: string
  description: string
  fields: ParameterField[]
  fieldGroups?: ParameterFieldGroup[]
}

export interface RouteShortcut {
  path: string
  name: string
  title: string
  description: string
}

export interface SettingsSaveResult<T> {
  success: boolean
  message: string
  data: T
  updatedAt: string
}

export interface ReservePageDefinition {
  id: string
  path: string
  title: string
  description: string
  readyFor: string[]
}
