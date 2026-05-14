import type { 运动模式 } from './types'

export interface UAxisRotateRequestPayload {
  旋转角度: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 运动模式
}

export interface RAxisRotateRequestPayload {
  旋转圈数: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 运动模式
}

