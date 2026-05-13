export type QomoTo5PActionType =
  | 'FIT_VIEW'
  | 'TOGGLE_GRID'
  | 'TOGGLE_AXES'
  | 'TOGGLE_PROJECTION_Z0'

export type QomoTo5PAction = {
  type: QomoTo5PActionType
}

type QomoTo5PActionHandler = (action: QomoTo5PAction) => void

const handlers = new Set<QomoTo5PActionHandler>()

/**
 * Create5P.vue -> QomoTo5P.ts : 派发用户按钮操作
 * Qomo3DPreview.vue <- QomoTo5P.ts : 订阅动作并执行交互逻辑
 */
export const dispatchQomoTo5PAction = (action: QomoTo5PAction) => {
  handlers.forEach((handler) => handler(action))
}

/**
 * 在 Qomo3DPreview.vue 中订阅动作
 * @returns 取消订阅函数
 */
export const subscribeQomoTo5PAction = (handler: QomoTo5PActionHandler) => {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

