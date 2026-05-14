import { ControllerAxisCount } from "./types"

/**
 * 通讯参数。字段名与后端 motion_config.MotionConfig 1:1 对齐
 */
export interface ControllerCommunicationSettings {
  controller_model: string
  controller_ip: string
  /** 后端 ZAux_OpenEth 连接超时秒数 */
  connect_timeout_s: number
  enable_axes: string[]
  axis_count: ControllerAxisCount
}

/**
 * 连续轨迹合并参数（对应后端 motion_config.MergeParams）。
 * 仅在 axis.merge=1 时由 ZAux SDK 实际生效。
 */
export interface AxisMergeParams {
  /** ZAux_Direct_SetCornerMode 拐角处理位标志 */
  corner_mode: number
  /** ZAux_Direct_SetDecelAngle 开始减速的拐角阈值（rad） */
  decel_angle: number
  /** ZAux_Direct_SetStopAngle 强制停止的拐角阈值（rad） */
  stop_angle: number
  /** ZAux_Direct_SetZsmooth 拐角圆滑半径 */
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

export type ControllerAxisSettings = ControllerAxisUserInput

/** 单列数字量 I/O：`digitalIn` 可上位机控制并下发，`digitalOut` 仅驱动器回读展示 */
export interface IOMapEntry {
  /** 数字量输入：可控制（写入/下发） */
  digitalIn: boolean
  /** 数字量输出：驱动器回读（只读） */
  digitalOut: boolean
}

/** @deprecated 使用 IOMapEntry */
export type IOMapDriverRead = IOMapEntry

/** @deprecated 使用 IOMapEntry */
export type IOMapSettings = IOMapEntry

export type IOMapNineGroups = [
  IOMapEntry,
  IOMapEntry,
  IOMapEntry,
  IOMapEntry,
  IOMapEntry,
  IOMapEntry,
  IOMapEntry,
  IOMapEntry,
  IOMapEntry
]

export interface ControllerParameters {
  communication: ControllerCommunicationSettings
  axes: ControllerAxisSettings[]
  /** 固定 9 组 I/O，前端 UI 状态。后端按需通过 /api/motion/io/* 接口读写 */
  ioMap: IOMapNineGroups
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
