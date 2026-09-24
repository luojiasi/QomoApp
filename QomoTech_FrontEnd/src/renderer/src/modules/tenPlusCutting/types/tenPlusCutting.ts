/** 单条任务参数行（前端表格 / 存档）。下发字段见 TenPlusFreeParamRow。 */
export interface TenPlusTaskRow {
  id: string
  taskNo: number
  /** 路径类型：equalSegments | unEqualSegments | curve */
  pathType: string
  /**
   * 尺寸主字段，按 pathType 语义不同（下发同名字段 diameter）：
   * - equalSegments：外接圆直径 (mm)
   * - curve + circle：该段圆弧半径 (mm)，不是直径
   * - unEqualSegments / superellipse：钻石比例用的腰宽；几何用 length/width
   */
  diameter: number
  /** 非等分直线 / 超椭圆：外接长 (mm) */
  length: number
  /** 非等分直线 / 超椭圆：外接宽 (mm)。切角矩形钻石比例用此当腰宽 */
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
   * 曲线子类型，取值见 曲线子类型选项。
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
  /** 工艺倾角 (°)。0=台面；>0 正切；<0 反向切。范围 -90~90 */
  angle: number
  /** 本层高度 (mm)。台面行锁定 0 */
  height: number
  /** 等分线段分割数。0 或 ≥48 时后端改为 R 轴连续转。台面行锁定 0 */
  divisions: number
  /** 主配方 id，下发为 recipeId */
  recipe: string
  compAngle: number
  /** 尺寸百分比，默认 100。后端乘在直径/长宽上 */
  diameterPercent: number
  /** 高度百分比，默认 100。后端：实际高度 = height × 此值 / 100 */
  heightPercent: number
  /** 起始切割百分比，默认 0：从产品高度的该比例处开始切 */
  cutStartPercent: number
  /** 结束切割百分比，默认 100：进度到达该比例后结束本任务 */
  cutEndPercent: number
  /** 是否用钻石比例换算直径百分比与高度百分比；仅前端换算入口，不下发 */
  useDiamondRatio: boolean
  /** 钻石比例百分比；仅前端换算入口，不下发 */
  diamondPercent: number
  /** 弦长倍率。放大切割长度 / 扫面范围，缺省 1.2 */
  chordRatio: number
  /**
   * 等分线段分割数为 0 时，R 轴持续旋转每趟等待的圈数。
   * 其它路径后端也会带上，缺省 2。
   */
  rTurns: number
  k: number
  b: number
  x: number
}

/** 编程目标：独立任务表 + 点位/圈补偿 + 工位绑定 */
export interface TenPlusTarget {
  id: string
  name: string
  /** 该目标的点位 XYZ，格式 "(x,y,z)" */
  pointXyz: string
  /** 是否对切，默认 true；读档缺省视为 true */
  oppositeCut: boolean
  slotIndex: number | null
  十轴切割R旋转圈数: number
  十轴切割R旋转补偿值: number
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

export interface TenPlusTargetSummary {
  id: string
  name: string
  slotIndex: number
  pointXyz: string
  oppositeCut: boolean
  十轴切割R旋转圈数: number
  十轴切割R旋转补偿值: number
}

/**
 * POST /api/startProgram/tenPlusEntitiesEditParams 的一行。
 * 字段名必须与后端 构建任务的数据 读取的英文键一致。
 * 前端不下发：id、recipe（改名为 recipeId）、useDiamondRatio、diamondPercent。
 */
export interface TenPlusFreeParamRow {
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
  compAngle: number
  diameterPercent: number
  heightPercent: number
  cutStartPercent: number
  cutEndPercent: number
  chordRatio: number
  rTurns: number
  k: number
  b: number
  x: number
  十轴切割R旋转圈数: number
  十轴切割R旋转补偿值: number
  oppositeCut: boolean
  pointXyz: string
  slotIndex: number
  targetId: string
  targetName: string
  /** 该工位相机清晰误差 (mm)，开始时按工位 GET 后写入 */
  cameraFocusError: number
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
  rows: TenPlusFreeParamRow[]
}

/** UR 校准相机十字线：横/竖各自线宽与颜色 */
export interface TenPlusUrCrosshairSettings {
  hColor: string
  vColor: string
  hWidth: number
  vWidth: number
}

/** 十轴页顶栏与相机窗口的本地记忆 */
export interface TenPlusPageUiSettings {
  keyboardEnabled: boolean
  cameraVisible: boolean
  cameraX: number | null
  cameraY: number | null
  /** 相机窗口十字线调节条；默认隐藏 */
  crosshairBarVisible: boolean
  /** 运行时相机放大到中间任务参数表；默认关闭 */
  runCameraEnlarge: boolean
}
