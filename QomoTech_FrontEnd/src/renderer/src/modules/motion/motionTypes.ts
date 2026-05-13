// 控制器和上位机之间的通讯方式（与后端 motion_config.MotionConfig.transport 对齐）
export type ControllerTransport = 'ethernet' | 'rs232' | 'rs485' | 'can' | 'ethercat'

/** 仅支持三轴（XYZ）或五轴（XYZUR），与后端 axis_count Literal[3,5] 对齐 */
export type ControllerAxisCount = 3 | 5

/**
 * 通讯参数。字段名与后端 motion_config.MotionConfig 1:1 对齐：
 * controller_model / transport / controller_ip / connect_timeout_s / enable_axes / axis_count
 */
export interface ControllerCommunicationSettings {
  controller_model: string
  transport: ControllerTransport
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
  /** ATYPE: 1=方向脉冲, 4=正交编码器, 65=EtherCAT */
  axis_type: number
  units: number
  speed: number
  lspeed: number
  accel: number
  decel: number
  sramp: number
  creep: number
  /** 0 / 1 连续轨迹合并开关 */
  merge: number
  /** -1 = 禁用 */
  fwd_in: number
  /** -1 = 禁用 */
  rev_in: number
  /** 嵌套结构对齐后端 merge_params 子模型 */
  merge_params: AxisMergeParams

  // —— 以下为前端独有 UI 字段（不会进入后端 axis 批量配置）——
  /** 反向间隙补偿距离（脉冲），通过 /api/motion/axis/backlash 单独下发 */
  backlash: number
  /** 是否启用反向间隙，通过 /api/motion/axis/backlash 单独下发 */
  backlash_enable: boolean
}

/** 从驱动器读取的运行状态（界面只读展示，默认占位为 0） */
export interface ControllerAxisDriverRead {
  dpos: number
  mpos: number
  endmove: number
  fs_limit: number
  rs_limit: number
  idle: number
  mspeed: number
  mtype: number
  ntype: number
  vp_speed: number
  axisstatus: number
  move_mark: number
  move_curmark: number
  axis_stopforeason: number
  move_buffered: number
  force_speed: number
  startmove_speed: number
  endmove_speed: number
}

export type ControllerAxisSettings = ControllerAxisUserInput & ControllerAxisDriverRead

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
