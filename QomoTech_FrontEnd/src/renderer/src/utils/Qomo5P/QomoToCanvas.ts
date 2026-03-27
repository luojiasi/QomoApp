import { EntityType } from '@renderer/types/Qomo5P'

export type DrawingArcType =
  | 'three_points_arc'
  | 'start_center_end'
  | 'start_center_angle'
  | 'start_center_length'
  | 'center_start_end'
  | 'center_start_angle'
  | 'center_start_length'

export type DrawingLineType = 'only_line' | 'more_line'

export type DrawingCircleType =
  | 'two_points'
  | 'three_points_circle'
  | 'center_radius'
  | 'center_diameter'

export type DrawingBezierType = 'cubic_bezier'

export type DrawingIrregularType = 'oval' | 'heart' | 'pear' | 'square' | 'marquise'

export type DrawingShapeTools =
  | DrawingArcType
  | DrawingLineType
  | DrawingCircleType
  | DrawingBezierType
  | DrawingIrregularType

export type QomoToCanvasActionType =
  | 'DRAWING'
  | 'MOVE'
  | 'SELECT'
  | 'DELETE_SELECTED'
  | 'UNDO'
  | 'REDO'
  | 'SAVE'

// 让类型更精确：只有 DRAWING 才允许携带 entityType，其他 action 不带该字段更合理
export type QomoToCanvasAction =
  | { type: 'DRAWING'; entityType?: EntityType; drawingShapeTool?: DrawingShapeTools }
  | { type: 'MOVE' }
  | { type: 'SELECT' }
  | { type: 'DELETE_SELECTED' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SAVE'; projectName: string }
  | { type: 'CREATE_PROJECT'; projectName: string }

type QomoToCanvasActionHandler = (action: QomoToCanvasAction) => void
const handlers = new Set<QomoToCanvasActionHandler>()

/**
 * Create5P.vue -> QomoToCanvas.ts : 派发用户按钮操作
 * QomoCanvas.vue <- QomoToCanvas.ts : 订阅动作并执行交互逻辑
 */
export const dispatchQomoToCanvasAction = (action: QomoToCanvasAction) => {
  handlers.forEach((handler) => handler(action))
}

/**
 * 在 QomoCanvas.vue 中订阅动作
 * @returns 取消订阅函数
 */
export const subscribeQomoToCanvasAction = (handler: QomoToCanvasActionHandler) => {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

// /**
//  * 取消订阅动作,避免内存泄漏
//  */
// export const unsubscribeQomoToCanvasAction = () => {
//     handlers.clear()
// }
