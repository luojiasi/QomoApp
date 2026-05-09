import { apiCall, type ApiCallResult } from '../core/base'
import type { ControllerParameters } from '../../types/settings'

export type MotionAxis = 'X' | 'Y' | 'Z' | 'U' | 'R'

export interface UAxisRotateRequestPayload {
  旋转角度: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 'relative' | 'absolute'
}

export interface RAxisRotateRequestPayload {
  旋转圈数: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 'relative' | 'absolute'
}

type MoveMotionAxisAbsOptions = { speed?: number; controllerSettings?: ControllerParameters }
type MoveMotionAxisRelOptions = { speed?: number; controllerSettings?: ControllerParameters }

// ------------------------------------------------------------------
// 内部辅助
// ------------------------------------------------------------------

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const pickAxisSpeed = (axisNo: number, options?: { speed?: number; controllerSettings?: ControllerParameters }): number | undefined => {
  const explicitSpeed = options?.speed
  if (isPositiveFiniteNumber(explicitSpeed)) return explicitSpeed
  const savedSpeed = options?.controllerSettings?.axes.find((a) => a.axisNo === axisNo)?.speed
  return isPositiveFiniteNumber(savedSpeed) ? savedSpeed : undefined
}

// ------------------------------------------------------------------
// API
// ------------------------------------------------------------------

export const getMotionPosition = async (axis: MotionAxis): Promise<ApiCallResult<{ axis: MotionAxis; position_mm: number }>> =>
  apiCall(`motion/position/${axis}`, 'GET')

export const emergencyStopMotion = async (axisNo: number): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/emergency-stop', 'POST', { axis_no: axisNo } as unknown as Record<string, unknown>)

export const zeroMotionAxis = async (axisNo: number): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/axis/zero', 'POST', { axis_no: Number(axisNo) } as unknown as Record<string, unknown>)

import { setMotionAllAxesParams } from './connect'

const pushAxisSpeed = async (axisNo: number, speed: number): Promise<ApiCallResult<Record<string, unknown>>> =>
  setMotionAllAxesParams({ params_by_axis: { [axisNo]: { speed } } })

export const moveMotionAxisAbs = async (axisNo: number, targetMm: number, options?: MoveMotionAxisAbsOptions): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisNoInt = Number(axisNo)
  const selectedSpeed = pickAxisSpeed(axisNoInt, options)

  if (typeof selectedSpeed === 'number') {
    const speedRes = await pushAxisSpeed(axisNoInt, selectedSpeed)
    if (!speedRes?.success) return speedRes as ApiCallResult<Record<string, unknown>>
  }

  return apiCall('motion/axis/move-abs', 'POST', {
    axis_no: axisNoInt,
    target_mm: targetMm,
  } as unknown as Record<string, unknown>)
}

export const moveMotionAxisRel = async (axisNo: number, deltaMm: number, options?: MoveMotionAxisRelOptions): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisNoInt = Number(axisNo)
  const selectedSpeed = pickAxisSpeed(axisNoInt, options)

  return apiCall('motion/axis/move-rel', 'POST', {
    axis_no: axisNoInt,
    delta_mm: deltaMm,
    ...(typeof selectedSpeed === 'number' ? { speed: selectedSpeed } : {}),
  } as unknown as Record<string, unknown>)
}

export const rotateUAxisByAngle = async (payload: UAxisRotateRequestPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/axis/U轴旋转的角度', 'POST', payload as unknown as Record<string, unknown>)

export const rotateRAxisByTurns = async (payload: RAxisRotateRequestPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/axis/R轴旋转的圈数', 'POST', payload as unknown as Record<string, unknown>)
