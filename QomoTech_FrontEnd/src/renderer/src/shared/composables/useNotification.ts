import { type ShallowRef, shallowRef } from 'vue'
import type { AddNotificationInput, NotificationType } from '@/shared/types'

export type NotificationToastExpose = {
  addNotification: (input: AddNotificationInput) => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const toastRef: ShallowRef<NotificationToastExpose | null> = shallowRef(null)

/**
 * 在 App.vue 中挂载 `<NotificationToast ref="toastRef" />` 后调用一次，将实例交给全局使用。
 */
export function registerNotificationToast(instance: NotificationToastExpose | null): void {
  toastRef.value = instance
}

function getToast(): NotificationToastExpose | null {
  return toastRef.value
}

const DEFAULT_DURATION = 4500

function push(input: AddNotificationInput): void {
  const toast = getToast()
  if (!toast) {
    console.warn('[useNotification] NotificationToast 尚未注册，请在 App.vue 中挂载并调用 registerNotificationToast')
    return
  }

  toast.addNotification({
    type: input.type,
    message: input.message,
    description: input.description ?? '',
    duration: input.duration ?? DEFAULT_DURATION
  })
}

export function useNotification() {
  return {
    /** 通用：可指定类型 */
    notify: push,
    success: (message: string, description?: string, duration?: number) =>
      push({ type: 'success', message, description, duration }),
    error: (message: string, description?: string, duration?: number) =>
      push({ type: 'error', message, description, duration }),
    warning: (message: string, description?: string, duration?: number) =>
      push({ type: 'warning', message, description, duration }),
    info: (message: string, description?: string, duration?: number) =>
      push({ type: 'info', message, description, duration }),
    remove: (id: string) => getToast()?.removeNotification(id),
    clearAll: () => getToast()?.clearAll()
  }
}

/** 不依赖 setup，可在任意 TS 模块中直接调用 */
export function notify(input: AddNotificationInput): void {
  push(input)
}

export function notifyByType(
  type: NotificationType,
  message: string,
  description?: string,
  duration?: number
): void {
  push({ type, message, description, duration })
}
