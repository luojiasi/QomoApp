/** 单条任务参数行 */
export interface TenPlusTaskRow {
  id: string
  taskNo: number
  diameter: number
  angle: number
  height: number
  divisions: number
  recipe: string
  compX: number
  compY: number
  compZ: number
  compAngle: number
  chordRatio: number
  k: number
  b: number
  x: number
}

/** 编程目标：独立任务表 + 点位/圈补偿 + 工位绑定 */
export interface TenPlusTarget {
  id: string
  name: string
  /** 该目标的点位 XYZ，格式 "(x,y,z)"；读档兼容旧字段 pointXy */
  pointXyz: string
  /** 是否对切，默认 true；读档缺省视为 true */
  oppositeCut: boolean
  slotIndex: number | null
  rInterval: number
  rCompensation: number
  rows: TenPlusTaskRow[]
}

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

export interface SerializedTenPlusTargets {
  format: 'QOMO5P-FreeParamTargets'
  version: string
  savedAt: string
  activeTargetId: string | null
  targets: TenPlusTarget[]
}

export interface SerializedLegacyTaskTable {
  format: 'QOMO5P-TaskTable'
  version: string
  savedAt: string
  rows: TenPlusTaskRow[]
}

export interface TenPlusTargetSummary {
  id: string
  name: string
  slotIndex: number
  pointXyz: string
  oppositeCut: boolean
  rInterval: number
  rCompensation: number
}

export interface TenPlusFreeParamPayload {
  recipes: {
    mainRecipes: unknown[]
    machiningRecipes: unknown[]
    blackeningRecipes: unknown[]
    laserPowerRecipes: unknown[]
    horizontalFormulaRecipes: unknown[]
    verticalFormulaRecipes: unknown[]
  }
  targets: TenPlusTargetSummary[]
  rows: Array<{
    taskNo: number
    diameter: number
    angle: number
    height: number
    divisions: number
    recipeId: string
    compX: number
    compY: number
    compZ: number
    compAngle: number
    chordRatio: number
    k: number
    b: number
    x: number
    rInterval: number
    rCompensation: number
    oppositeCut?: boolean
    pointXyz?: string
    slotIndex?: number | null
    targetId?: string
    targetName?: string
  }>
}
