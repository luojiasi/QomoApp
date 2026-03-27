export type RecipeStatus = 'draft' | 'active' | 'archived'

export type OpeningShape = 'V型' | '||型' | '//型' 

export interface RecipeRecordBase {
  id: string
  code: string
  name: string
  notes: string
  updatedAt: string
}

/** 线性公式的两个可编辑系数：k * 深度 + b */
export interface LinearFormulaCoefficients {
  k: number
  b: number
}

export interface ProcessFormulaRecipe {
  name: string
  openingShape: OpeningShape
  // 角度公式
  angleFormula: LinearFormulaCoefficients
  // 下开口公式
  lowerOpeningFormula: LinearFormulaCoefficients
  // 深度补偿公式
  depthCompensationFormula: LinearFormulaCoefficients
  // 上开口公式
  upperOpeningFormula: string
  // 补偿角度公式
  compensationAngleFormula: LinearFormulaCoefficients
  focusCompensation: number
}

export interface SharedFormulaRecipe extends RecipeRecordBase {
  formula: ProcessFormulaRecipe
}

/** 垂直工艺：边缘 / 中间切割段（CHANGE 为 k*深度+b） */
export interface VerticalEdgeOrMiddleCutting {
  speed: number
  cutTimes: number
  change: LinearFormulaCoefficients
}

/** 垂直工艺：下降切割 */
export interface VerticalDescentCutting {
  speed: number
  zFeed: number
  change: LinearFormulaCoefficients
}
export type cuttingAxis = 'XY'|'R'
/** 垂直工艺配方参数（与水平工艺的开口/公式结构不同） */
export interface VerticalProcessFormulaRecipe {
  /** 切割轴 */
  cuttingAxis: cuttingAxis
  /** 变化百分比 */
  changePercent: number
  /** X-FEED */
  xFeed: number
  /** X-SEPPD */
  xSpeed: number
  edgeCutting: VerticalEdgeOrMiddleCutting
  middleCutting: VerticalEdgeOrMiddleCutting
  descentCutting: VerticalDescentCutting
}

export interface VerticalFormulaRecipe extends RecipeRecordBase {
  formula: VerticalProcessFormulaRecipe
}

/** 激光功率配方与控制器之间的传输方式（仅两种可选） */
export type LaserTransmissionMode = '网线' | 'RS232'

/** 激光功率配方，可被扫黑工艺配方与加工工艺配方引用 */
export interface LaserPowerRecipe extends RecipeRecordBase {
  /** 激光厂家 */
  laserManufacturer: string
  /** 激光功率 */
  laserPower: number
  /** 激光频率 */
  laserFrequency: number
  /** 激光电流 */
  laserCurrent: number
  /** 使用传输方式 */
  transmissionMode: LaserTransmissionMode
}

export interface BlackeningProcessRecipe extends RecipeRecordBase {
  enabled: boolean
  descentStep: number
  descentCount: number
  blackeningSpeed: number
  blackeningStep: number
  laserPowerRecipeId: string
  jiaojubuchang:number,
  saoheikaikou: LinearFormulaCoefficients
}

export interface MachiningProcessRecipe extends RecipeRecordBase {
  horizontalFormulaId: string
  verticalFormulaId: string
  laserPowerRecipeId: string
}

export interface CleaningProcessRecipe extends RecipeRecordBase {
  enabled: boolean
  horizontalFormulaId: string
  verticalFormulaId: string
}

export interface MainRecipeDefinition extends RecipeRecordBase {
  version: string
  productModel: string
  status: RecipeStatus
  blackeningRecipeId: string
  machiningRecipeId: string
  cleaningRecipeId: string
}

/** 与 `RecipeEditorCard` 的 `type` 一致，用于各子配方库列表的关键词筛选 */
export const RECIPE_LIBRARY_CARD_TYPE_KEYS = [
  'blackening',
  'machining',
  'cleaning',
  'laserPower',
  'horizontalFormula',
  'verticalFormula'
] as const

export type RecipeLibraryCardType = (typeof RECIPE_LIBRARY_CARD_TYPE_KEYS)[number]

export function createDefaultLibraryKeywords(): Record<RecipeLibraryCardType, string> {
  return {
    blackening: '',
    machining: '',
    cleaning: '',
    laserPower: '',
    horizontalFormula: '',
    verticalFormula: ''
  }
}

export interface RecipeFilter {
  /** 在主配方「备注」中不区分大小写包含匹配 */
  keyword: string
  /** 按卡片上的主配方状态筛选：草稿 / 生效 / 归档；`all` 表示不限定 */
  recipeStatus: RecipeStatus | 'all'
  /** 各子配方库卡片列表的关键词（匹配名称、编码、备注等，不区分大小写） */
  libraryKeywords: Record<RecipeLibraryCardType, string>
}

export interface RecipeManagerState {
  mainRecipes: MainRecipeDefinition[]
  laserPowerRecipes: LaserPowerRecipe[]
  blackeningRecipes: BlackeningProcessRecipe[]
  horizontalFormulaRecipes: SharedFormulaRecipe[]
  verticalFormulaRecipes: VerticalFormulaRecipe[]
  machiningRecipes: MachiningProcessRecipe[]
  cleaningRecipes: CleaningProcessRecipe[]
  selectedMainRecipeId: string
  filter: RecipeFilter
}

export type RecipeDefinition = MainRecipeDefinition
