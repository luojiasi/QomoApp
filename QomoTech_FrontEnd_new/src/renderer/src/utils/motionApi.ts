import { apiCall, type ApiCallResult } from './toBackendApiCall'
import {
  subscribeMotionStatus as _subscribeMotionStatus,
  getLatestMotionStatus,
  sendMotionWsCmd,
  type MotionStatusSnapshot,
  type MotionStatusListener,
  type MotionStatusSubscribeOptions,
} from './motionStatusWs'

export { getLatestMotionStatus, sendMotionWsCmd }
export type { MotionStatusSnapshot, MotionStatusListener, MotionStatusSubscribeOptions }

export type MotionAxis = 'X' | 'Y' | 'Z' | 'U' | 'R'
export const AXIS_NAMES: readonly MotionAxis[] = ['X', 'Y', 'Z', 'U', 'R'] as const

// ────────────────── 连接 / 断开 ──────────────────
export const connectMotion = (ip: string): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/connect', 'POST', { ip })

export const disconnectMotion = (): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/disconnect', 'POST')

// ────────────────── 状态快照（一次性 HTTP） ──────────────────
export const getMotionState = (): Promise<ApiCallResult<MotionStatusSnapshot>> =>
  apiCall<MotionStatusSnapshot>('motion/state', 'GET')

// ────────────────── 单轴运动 ──────────────────
export const moveAxisAbs = (
  axis: MotionAxis,
  position: number,
  speed?: number
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/move/abs', 'POST', {
    axis,
    position,
    ...(speed ? { speed } : {}),
  })

export const moveAxisRel = (
  axis: MotionAxis,
  delta: number,
  speed?: number
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/move/linear', 'POST', {
    axes: [axis],
    positions: [delta],
    relative: true,
    ...(speed ? { speed } : {}),
  })

// ────────────────── 多轴直线插补 ──────────────────
export const moveLinear = (
  axes: MotionAxis[],
  positions: number[],
  opts?: { speed?: number; relative?: boolean }
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/move/linear', 'POST', {
    axes,
    positions,
    relative: !!opts?.relative,
    ...(opts?.speed ? { speed: opts.speed } : {}),
  })

// ────────────────── 圆弧插补 ──────────────────
export const moveCircle = (
  axes: [MotionAxis, MotionAxis],
  end1: number,
  end2: number,
  center1: number,
  center2: number,
  opts?: { direction?: 'ccw' | 'cw'; speed?: number; relative?: boolean }
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/move/circle', 'POST', {
    axes,
    end1,
    end2,
    center1,
    center2,
    direction: opts?.direction ?? 'ccw',
    relative: !!opts?.relative,
    ...(opts?.speed ? { speed: opts.speed } : {}),
  })

export const moveCircle3P = (
  axes: [MotionAxis, MotionAxis],
  mid1: number,
  mid2: number,
  end1: number,
  end2: number,
  opts?: { speed?: number; relative?: boolean }
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/move/circle3p', 'POST', {
    axes,
    mid1,
    mid2,
    end1,
    end2,
    relative: !!opts?.relative,
    ...(opts?.speed ? { speed: opts.speed } : {}),
  })

// ────────────────── 螺旋插补 ──────────────────
export const moveSpiral = (
  axes: MotionAxis[],
  center1: number,
  center2: number,
  circles: number,
  pitch: number,
  thirdDistance: number,
  opts?: { fourthDistance?: number; speed?: number }
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/move/spiral', 'POST', {
    axes,
    center1,
    center2,
    circles,
    pitch,
    third_distance: thirdDistance,
    fourth_distance: opts?.fourthDistance ?? 0,
    ...(opts?.speed ? { speed: opts.speed } : {}),
  })

// ────────────────── 点动 ──────────────────
export const jogStart = (
  axis: MotionAxis,
  direction: 1 | -1,
  speed?: number
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/jog', 'POST', { axis, direction, ...(speed ? { speed } : {}) })

export const jogStop = (axis: MotionAxis): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/jog/stop', 'POST', { axis })

// ────────────────── 回零 ──────────────────
export const home = (
  axes?: MotionAxis[]
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/home', 'POST', axes && axes.length > 0 ? { axes } : null)

// ────────────────── 连续轨迹 MERGE ──────────────────
export const mergeEnable = (axis: MotionAxis): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/merge/enable', 'POST', { axis })

export const mergeDisable = (
  axis: MotionAxis
): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/merge/disable', 'POST', { axis })

// ────────────────── 全局控制 ──────────────────
export const motionPause = (): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/pause', 'POST')

export const motionResume = (): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/resume', 'POST')

export const motionStop = (): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/stop', 'POST')

export const motionEstop = (): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/estop', 'POST')

export const motionReset = (): Promise<ApiCallResult<Record<string, unknown>>> =>
  apiCall('motion/reset', 'POST')

// ────────────────── WS 状态订阅 ──────────────────
export const subscribeMotionStatus = (
  listener: MotionStatusListener,
  options?: MotionStatusSubscribeOptions
): (() => void) => _subscribeMotionStatus(listener, options)
