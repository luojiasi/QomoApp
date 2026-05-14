import { ControllerAxisCount, 运动模式 } from "./types"


export interface ControllerParameters {
  communication: ControllerCommunicationSettings
  axes: ControllerAxisUserInput[]
}
/**
 * 通讯参数。字段名与后端 motion_config.MotionConfig 1:1 对齐
 */
export interface ControllerCommunicationSettings {
  controller_model: string
  controller_ip: string
  connect_timeout_s: number
  enable_axes: string[]
  axis_count: ControllerAxisCount
}


/**
 * 连续轨迹合并参数（对应后端 motion_config.MergeParams）。
 * 仅在 axis.merge=1 时由 ZAux SDK 实际生效。
 */
export interface AxisMergeParams {
  corner_mode: number
  decel_angle: number
  stop_angle: number
  zxmooth: number
}

/**
 * 单轴用户可配置参数（与后端 motion_config.MotionAxisConfig 字段一一对应）。
 * 注意：backlash / backlash_enable 是前端独有 UI 字段，后端通过 /api/motion/axis/backlash 单独设置，
 *       不放在 axis batch 配置里（不会随 buildMotionAllAxesParamsRequestPayload 下发）。
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
  merge_params: AxisMergeParams

  backlash: number
  backlash_enable: boolean
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

export interface RAxisRotateRequestPayload {
  旋转圈数: number
  旋转速度: number
  旋转方向?: string
  运动模式?: 运动模式
}
