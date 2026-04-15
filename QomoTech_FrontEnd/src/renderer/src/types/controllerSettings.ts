// 控制器和上位机之间的通讯方式（网口、串口、CAN、EtherCAT 等）
export type ControllerTransport = 'ethernet' | 'rs232' | 'rs485' | 'can' | 'ethercat'
// 步进/伺服常用的脉冲输出模式（脉冲+方向、双脉冲、正交编码器等）
export type ControllerPulseMode = 'pulse_direction' | 'double_pulse' | 'quadrature'
// 回零时轴先往正方向还是负方向去找原点
export type ControllerHomeDirection = 'positive' | 'negative'
// 原点等数字量信号是高电平有效还是低电平有效
export type ControllerSignalLevel = 'high' | 'low'

/** 仅支持三轴（XYZ）或五轴（XYZRU） */
export type ControllerAxisCount = 3 | 5

export interface ControllerCommunicationSettings {
  controllerModel: 'ZMC406-V2' | 'QomoTech406V2'
  transport: ControllerTransport
  ipAddress: string
  enableAxes: string[] // 启用轴列表，与 axisCount 一致：3 时为 X/Y/Z，5 时为 X/Y/Z/R/U
  /** 轴数量，仅允许 3 或 5 */
  axisCount: ControllerAxisCount
}

/** 用户可写入 / 持久化的轴参数（其余字段由驱动器回读） */
export interface ControllerAxisUserInput {
  axisNo: number
  axisName: string
  axisType: number
  units: number
  speed: number
  lspeed: number
  creep: number
  accel: number
  decel: number
  merge: number
  sramp: number
  fwd_in: number
  rev_in: number
  corner_mode: number
  decel_angle: number
  stop_angle: number
  zxmooth: number
  backlash: number
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

/** 固定 9 组数字量 I/O */
export const IO_MAP_GROUP_COUNT = 9 as const

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
  /** 固定 9 组：输入可控制，输出为驱动器回读 */
  ioMap: IOMapNineGroups
}
