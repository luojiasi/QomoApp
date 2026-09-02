/** 单条任务参数行 */
export interface TenPlusTaskRow {
  id: string
  taskNo: number
  /** 路径类型，取值见 TEN_PLUS_PATH_TYPE_OPTIONS */
  pathType: string
  diameter: number
  /** 非等分直线：长 (mm) */
  length: number
  /** 非等分直线：宽 (mm) */
  width: number
  /** 非等分直线：切角比例 (%)，切角在宽度方向的投影占宽的百分比 */
  cornerRatio: number
  /**
   * 曲线：圆弧起始角 / 结束角（度），相对该段自己的圆心，+X 为 0° 逆时针。
   * 一段弧一行；同一圈腰棱用 sameLayer 编组。
   */
  arcStart: number
  arcEnd: number
  /** 曲线：圆心相对工位中心的偏移 (mm) */
  arcOffsetX: number
  arcOffsetY: number
  /**
   * 曲线子类型，取值见 TEN_PLUS_CURVE_KIND_OPTIONS。
   * `circle` = 中心圆（半径+偏心）；`superellipse` = 超椭圆（长/宽/n）。
   */
  curveKind: string
  /**
   * 超椭圆指数 n。仅 curveKind=superellipse 时生效；长/宽为外接尺寸。
   * 旧档无 curveKind 时，n>0 仍按超椭圆兼容。
   */
  superellipseN: number
  /** 曲线：与上一行同一切割高度平面，不叠层 */
  sameLayer: boolean
  angle: number
  height: number
  divisions: number
  recipe: string
  compX: number
  compY: number
  compZ: number
  compAngle: number
  /** 直径百分比，默认 100 */
  diameterPercent: number
  /** 高度百分比，默认 100 */
  heightPercent: number
  /** 是否用钻石比例换算直径百分比与高度百分比；仅前端换算入口，不下发 */
  useDiamondRatio: boolean
  /** 钻石比例百分比；仅前端换算入口，不下发 */
  diamondPercent: number
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
    pathType: string
    diameter: number
    length: number
    width: number
    cornerRatio: number
    arcStart: number
    arcEnd: number
    arcOffsetX: number
    arcOffsetY: number
    curveKind: string
    superellipseN: number
    sameLayer: boolean
    angle: number
    height: number
    divisions: number
    recipeId: string
    compX: number
    compY: number
    compZ: number
    compAngle: number
    diameterPercent: number
    heightPercent: number
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

/** UR 校准相机十字线：横/竖各自线宽与颜色 */
export interface TenPlusUrCrosshairSettings {
  hColor: string
  vColor: string
  hWidth: number
  vWidth: number
}
