// =============================================================================
// Motion 模块类型定义
// =============================================================================

export type ControllerAxisCount = 3 | 5

export type MotionAxis = 'X' | 'Y' | 'Z' | 'U' | 'R'

export interface AxisMergeParams {
  corner_mode: number
  decel_angle: number
  stop_angle: number
  zxmooth: number
}

export interface ControllerAxisUserInput {
  axis_no: number
  axis_name: string
  axis_type: number
  units: number
  speed: number
  lspeed: number
  accel: number
  decel: number
  sramp: number
  creep: number
  merge: number
  fwd_in: number
  rev_in: number
  /** 正负软限位 FS_LIMIT / RS_LIMIT（默认 1e9 / -1e9 表示禁用） */
  正软限位: number
  负软限位: number
  motor_type: 'servo' | 'stepper'
  pulses_per_rev: number
  electronic_gear_ratio: number
  gear_ratio: number
  step_angle: number
  microsteps: number
  merge_params: AxisMergeParams
  backlash: number
  backlash_enable: boolean
}

export interface ControllerCommunicationSettings {
  controller_model: string
  controller_ip: string
  connect_timeout_s: number
  enable_axes: string[]
  axis_count: ControllerAxisCount
}

export interface ControllerParameters {
  communication: ControllerCommunicationSettings
  axes: ControllerAxisUserInput[]
}

export interface MotionAxisParamsPayload {
  units?: number
  lspeed?: number
  speed?: number
  accel?: number
  decel?: number
  sramp?: number
  atype?: number
  merge?: number
  fwd_in?: number
  rev_in?: number
  正软限位?: number
  负软限位?: number
}

export interface MotionAllAxesParamsRequestPayload {
  table: Record<string, MotionAxisParamsPayload>
}
