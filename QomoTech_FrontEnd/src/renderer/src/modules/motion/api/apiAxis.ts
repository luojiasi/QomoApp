import { apiCall, type ApiCallResult } from '@/shared/api/httpClient'
import type { ControllerParameters } from '../types/controller'
import type { MotionAxis, UAxisRotateRequestPayload, RAxisRotateRequestPayload } from '../index'

type MoveMotionAxisAbsOptions = { speed?: number; controllerSettings?: ControllerParameters }
type MoveMotionAxisRelOptions = { speed?: number; controllerSettings?: ControllerParameters }

import { AXIS_NO_TO_NAME } from '../config/controller'

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const pickAxisSpeed = (axisNo: number, options?: { speed?: number; controllerSettings?: ControllerParameters }): number | undefined => {
  const explicitSpeed = options?.speed
  if (isPositiveFiniteNumber(explicitSpeed)) return explicitSpeed
  const savedSpeed = options?.controllerSettings?.axes.find((a) => a.axis_no === axisNo)?.speed
  return isPositiveFiniteNumber(savedSpeed) ? savedSpeed : undefined
}

// ------------------------------------------------------------------
// API
// ------------------------------------------------------------------

export const getMotionPosition = async (axis: MotionAxis): Promise<ApiCallResult<number>> =>
  apiCall<number>(`motion/dpos/${axis}`, 'GET')

export const emergencyStopMotion = async (): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/estop', 'POST')

export const zeroMotionAxis = async (axisNo: number): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisName = AXIS_NO_TO_NAME[axisNo]
  if (!axisName) return { success: false, message: `未知轴号: ${axisNo}` }
  return apiCall('motion/axis/zero', 'POST', { axis: axisName } as unknown as Record<string, unknown>)
}

export const moveMotionAxisAbs = async (axisNo: number, targetMm: number, options?: MoveMotionAxisAbsOptions): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisNoInt = Number(axisNo)
  const axisName = AXIS_NO_TO_NAME[axisNoInt]
  if (!axisName) return { success: false, message: `未知轴号: ${axisNoInt}` }

  const body: Record<string, unknown> = { axis: axisName, position: targetMm }
  const selectedSpeed = pickAxisSpeed(axisNoInt, options)
  if (typeof selectedSpeed === 'number') body.speed = selectedSpeed

  return apiCall('motion/move/abs', 'POST', body as unknown as Record<string, unknown>)
}

export const moveMotionAxisRel = async (axisNo: number, deltaMm: number, options?: MoveMotionAxisRelOptions): Promise<ApiCallResult<Record<string, unknown>>> => {
  const axisNoInt = Number(axisNo)
  const axisName = AXIS_NO_TO_NAME[axisNoInt]
  if (!axisName) return { success: false, message: `未知轴号: ${axisNoInt}` }

  const body: Record<string, unknown> = { axis: axisName, position: deltaMm }
  const selectedSpeed = pickAxisSpeed(axisNoInt, options)
  if (typeof selectedSpeed === 'number') body.speed = selectedSpeed

  return apiCall('motion/move/rel', 'POST', body as unknown as Record<string, unknown>)
}

export const rotateUAxisByAngle = async (payload: UAxisRotateRequestPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/u/rotate-by-params', 'POST', { params: payload } as unknown as Record<string, unknown>)

export const rotateRAxisByTurns = async (payload: RAxisRotateRequestPayload): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/r/rotate-turns', 'POST', { params: payload } as unknown as Record<string, unknown>)
