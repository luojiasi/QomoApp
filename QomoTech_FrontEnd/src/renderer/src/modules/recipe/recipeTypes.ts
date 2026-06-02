export interface RecipeRecordBase {
  id: string
  name: string
  updatedAt: string
}

// 主配方的类型
export type RecipeStatus = 'draft' | 'active' | 'archived'
export interface MainRecipeDefinition extends RecipeRecordBase {
  status: RecipeStatus
  blackeningRecipeId: string
  machiningRecipeId: string
}

// 扫黑工艺配方的类型
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

// 加工工艺配方的类型
export interface MachiningProcessRecipe extends RecipeRecordBase {
  horizontalFormulaId: string
  verticalFormulaId: string
  laserPowerRecipeId: string
}






export interface LinearFormulaCoefficients {k: number; b: number}

// 水平工艺配方的类型
export type OpeningShape = 'V型' | '//型' 
export interface ProcessFormulaRecipe extends RecipeRecordBase {
  openingShape: OpeningShape
  angleFormula: LinearFormulaCoefficients
  lowerOpeningFormula: LinearFormulaCoefficients
  depthCompensationFormula: LinearFormulaCoefficients
  upperOpeningFormula: string
  compensationAngleFormula: LinearFormulaCoefficients
  focusCompensation: number
}

// 垂直工艺配方的类型
export type cuttingAxis = 'XY'|'R'
export interface VerticalEdgeOrMiddleCutting {
  speed: number
  cutTimes: number
  cutSpeedNums?: number
  change: LinearFormulaCoefficients
}
export interface VerticalDescentCutting {
  speed: number
  zFeed: number
  change: LinearFormulaCoefficients
}
export interface VerticalProcessFormulaRecipe extends RecipeRecordBase {
  cuttingAxis: cuttingAxis
  changePercent: number
  xFeed: number
  xSpeed: number
  edgeCutting: VerticalEdgeOrMiddleCutting
  middleCutting: VerticalEdgeOrMiddleCutting
  descentCutting: VerticalDescentCutting
}

// 激光功率配方的类型
export interface LaserPowerRecipe extends RecipeRecordBase {
  laserManufacturer: string
  laserPower: number
  laserFrequency: number
  laserCurrent: number
}




/** 与 `RecipeEditorCard` 的 `type` 一致，用于各子配方库列表的关键词筛选 */
export const RECIPE_LIBRARY_CARD_TYPE_KEYS = ['blackening','machining','laserPower','horizontalFormula','verticalFormula'] as const

export type RecipeLibraryCardType = (typeof RECIPE_LIBRARY_CARD_TYPE_KEYS)[number]

export function createDefaultLibraryKeywords(): Record<RecipeLibraryCardType, string> {
  return {
    blackening: '',
    machining: '',
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
  horizontalFormulaRecipes: ProcessFormulaRecipe[]
  verticalFormulaRecipes: VerticalProcessFormulaRecipe[]
  machiningRecipes: MachiningProcessRecipe[]
  selectedMainRecipeId: string
  filter: RecipeFilter
}

export type RecipeDefinition = MainRecipeDefinition

// ------------------------------------------------------------------
// 编辑器/管理页面共享类型（避免各 .vue 文件中重复定义）
// ------------------------------------------------------------------

export type EditableFormulaKey =
  | 'angleFormula'
  | 'lowerOpeningFormula'
  | 'depthCompensationFormula'
  | 'compensationAngleFormula'

export type ProcessDetailFieldKind = 'laserPower' | 'horizontal' | 'vertical'

/** 与 `RECIPE_LIBRARY_CARD_TYPE_KEYS` 一致，用于编辑卡片类型区分 */
export type RecipeCardType = RecipeLibraryCardType

export interface EditableFormulaItem {
  key: EditableFormulaKey
  label: string
  symbol: 'A' | 'L' | 'D' | 'CA'
  kLabel: string
  bLabel: string
}

export type OpeningShapeFormulaPreset = Partial<Record<EditableFormulaKey, LinearFormulaCoefficients>>

export type CardRecipeItem =
  | BlackeningProcessRecipe
  | MachiningProcessRecipe
  | LaserPowerRecipe
  | ProcessFormulaRecipe
  | VerticalProcessFormulaRecipe
