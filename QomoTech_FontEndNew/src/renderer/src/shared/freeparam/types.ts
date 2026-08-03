/** 单条任务参数行（对齐 FrontEnd freeParamTypes） */
export interface FreeParamTaskRow {
  id: string
  /** 序号 */
  taskNo: number
  /** 直径 (mm) */
  diameter: number
  /** 角度 (°), -90~90 */
  angle: number
  /** 高度 (mm) */
  height: number
  /** 分割数 (0 或 3-360) */
  divisions: number
  /** 主配方 ID */
  recipe: string
  /** X 方向补偿 (mm) */
  compX: number
  /** Y 方向补偿 (mm) */
  compY: number
  /** Z 方向补偿 (mm) */
  compZ: number
  /** 角度补偿 (°) */
  compAngle: number
  /** 弦长倍率 */
  chordRatio: number
}

/** 自由参数编程目标（大类）：每个目标独立一套任务表 + 点位/圈补偿 */
export interface FreeParamTarget {
  id: string
  name: string
  /** 该目标的点位 XY，格式 "(x,y)" */
  pointXy: string
  /** 绑定的工位号 1–10；未绑定为 null */
  slotIndex: number | null
  /** 每旋转多少圈做一次补偿（对齐 FrontEnd rInterval） */
  rInterval: number
  /** 每次圈补偿量 mm（对齐 FrontEnd rCompensation） */
  rCompensation: number
  rows: FreeParamTaskRow[]
}

/** 十工位单槽（对应 TENPLUSCUTTING.json） */
export interface TenPlusSlot {
  index: number
  x: number
  y: number
  z: number
  u: number
  taught: boolean
}

export interface TenPlusCuttingConfig {
  version: string
  slots: TenPlusSlot[]
}

/** 新格式：多目标整包保存 */
export interface SerializedFreeParamTargets {
  format: 'QOMO5P-FreeParamTargets'
  version: string
  savedAt: string
  activeTargetId: string | null
  targets: FreeParamTarget[]
}

/** 旧格式兼容：单表（FrontEnd FreeParamDialog） */
export interface SerializedTaskTable {
  format: 'QOMO5P-TaskTable'
  version: string
  savedAt: string
  rows: FreeParamTaskRow[]
}

export const FREE_PARAM_FILE_VERSION = '2.3.0'
export const TEN_PLUS_SLOT_COUNT = 10
export const FREE_PARAM_FILE_EXT = '.jjs'
export const FREE_PARAM_FORMAT = 'QOMO5P-FreeParamTargets' as const
export const LEGACY_TASK_TABLE_FORMAT = 'QOMO5P-TaskTable' as const
