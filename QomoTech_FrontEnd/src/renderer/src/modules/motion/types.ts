// =============================================================================
// Motion 模块类型定义
// 先 type（简单别名/字面量），后 interface（复杂对象结构）
// =============================================================================

// ============ type 定义 ============

/** 仅支持三轴（XYZ）或五轴（XYZUR），与后端 axis_count Literal[3,5] 对齐 */
export type ControllerAxisCount = 3 | 5

/** 运动轴名称 */
export type MotionAxis = 'X' | 'Y' | 'Z' | 'U' | 'R'

/** 运动模式 */
export type 运动模式 = 'relative' | 'absolute'

/** 在线命令 */
export type CommonOnlineCommand = {
  description: string
  command: string
  usage: string
}

/** 通用 XYZ 坐标 */
export type XYZ = {
  X: number
  Y: number
  Z: number
}

/** 回零状态 */
export type HomeState = {
  ISARRIVEDHOME: boolean
  AUTO_HOME_ON_START: boolean
}

// ============ interface 定义 ============

/** 连续轨迹合并参数（对应后端 motion_config.MergeParams） */
export interface AxisMergeParams {
  corner_mode: number
  decel_angle: number
  stop_angle: number
  zxmooth: number
}

/**
 * 单轴用户可配置参数（与后端 motion_config.MotionAxisConfig 字段一一对应）。
 * backlash / backlash_enable 是前端独有 UI 字段，后端通过 /api/motion/axis/backlash 单独设置。
 */
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
  /** 电机类型：servo=伺服，stepper=步进 */
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

/** 通讯参数，字段名与后端 motion_config.MotionConfig 1:1 对齐 */
export interface ControllerCommunicationSettings {
  controller_model: string
  controller_ip: string
  connect_timeout_s: number
  enable_axes: string[]
  axis_count: ControllerAxisCount
}

/** 控制器参数（通讯 + 各轴配置） */
export interface ControllerParameters {
  communication: ControllerCommunicationSettings
  axes: ControllerAxisUserInput[]
}

/** API 请求：单轴参数（可选，对应批量下发接口的字段子集） */
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

/** API 请求：批量轴参数，按轴名分组 */
export interface MotionAllAxesParamsRequestPayload {
  table: Record<string, MotionAxisParamsPayload>
}

/** API 请求：U 轴旋转 */
export interface UAxisRotateRequestPayload {
  旋转角度: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 运动模式
}

/** API 请求：R 轴旋转 */
export interface RAxisRotateRequestPayload {
  旋转圈数: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 运动模式
}

/** IO 输出状态 */
export interface MotionIoOutputState {
  io_no: number
  value: boolean
}

/** IO 输入状态 */
export interface MotionIoInputState {
  io_no: number
  value: boolean
}

/** 后端引导结果 */
export interface BackendBootstrapResult {
  success: boolean
  message: string
  data?: { hardware?: unknown; motion?: unknown; params?: unknown }
}
