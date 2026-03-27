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
