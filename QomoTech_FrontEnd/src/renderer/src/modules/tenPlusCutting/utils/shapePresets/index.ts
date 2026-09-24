import {
  垫型默认角,
  垫型默认指数,
  垫型默认高,
  垫型默认长,
  垫型默认宽,
  默认快捷形状
} from '../../constants/shapePreset'
import type { TenPlusQuickShapeInput, TenPlusQuickShapeRowDraft } from '../../types/shapePreset'
import { 构建垫型预览, 垫型错误, 生成垫型行 } from './垫型'
import { 构建水滴预览, 水滴错误, 生成水滴行 } from './水滴'
import { 构建马眼预览, 马眼错误, 生成马眼行 } from './马眼'
import type { 预览模型 } from './共用'

export { 点列转折线 } from './共用'
export { 水滴由尺寸, 水滴几何公式 } from './水滴'
export { 马眼几何公式 } from './马眼'

export function 创建默认快捷形状(): TenPlusQuickShapeInput {
  return {
    shape: 默认快捷形状,
    length: 垫型默认长,
    width: 垫型默认宽,
    height: 垫型默认高,
    exponent: 垫型默认指数,
    angle: 垫型默认角
  }
}

export function 快捷形状错误(输入: TenPlusQuickShapeInput): string | null {
  if (输入.shape === '水滴') return 水滴错误(输入)
  if (输入.shape === '马眼') return 马眼错误(输入)
  return 垫型错误(输入)
}

export function 构建快捷形状预览(输入: TenPlusQuickShapeInput): 预览模型 | null {
  if (输入.shape === '水滴') return 构建水滴预览(输入)
  if (输入.shape === '马眼') return 构建马眼预览(输入)
  return 构建垫型预览(输入)
}

/**
 * 由快捷形状尺寸生成任务行草稿。
 * 垫型：超椭圆四分之一弧 × 4，后 3 行 sameLayer。
 * 水滴：长/宽 → a=宽/2、L=长−a；X 镜像后沿轮廓顶→左→右，后 2 行 sameLayer。
 * 马眼：长/宽 → 半长 l、半宽 w；两段等半径中心圆，X 镜像后左弧→右弧，第 2 行 sameLayer。
 */
export function 生成快捷形状行(输入: TenPlusQuickShapeInput): TenPlusQuickShapeRowDraft[] {
  switch (输入.shape) {
    case '垫型':
      return 生成垫型行(输入)
    case '水滴':
      return 生成水滴行(输入)
    case '马眼':
      return 生成马眼行(输入)
    default: {
      const _never: never = 输入.shape
      throw new Error(`未实现的快捷形状：${String(_never)}`)
    }
  }
}
