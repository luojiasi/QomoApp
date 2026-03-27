/// <reference types="vite/client" />

import type { AddNotificationInput } from './types/notification'

declare module 'vue' {
  interface ComponentCustomProperties {
    /** 全局通知，与 NotificationToast 联动 */
    $notify: (input: AddNotificationInput) => void
  }
}

export {}
