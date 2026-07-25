// =============================================================================
// Recipe 类型定义 — 对应 recipe-state.json 的七类配方结构
// =============================================================================

export interface LaserPowerRecipe {
  id: string
  name?: string
  laserManufacturer?: string
  laserPower: number
  laserFrequency: number
  laserCurrent: number
}

export interface BlackeningRecipe {
  id: string
  name?: string
  enabled: boolean
  descentStep: number
  descentCount: number
  blackeningSpeed: number
  blackeningStep: number
  jiaojubuchang: number
  saoheikaikou: { k: number; b: number }
  laserPowerRecipeId: string
}

export interface HorizontalFormulaRecipe {
  id: string
  name?: string
  openingShape: string
  angleFormula: { k: number; b: number }
  lowerOpeningFormula: { k: number; b: number }
  depthCompensationFormula: { k: number; b: number }
  compensationAngleFormula: { k: number; b: number }
  focusCompensation: number
  upperOpeningFormula?: string
}

export interface VerticalFormulaRecipe {
  id: string
  name?: string
  cuttingAxis: string
  changePercent: number
  xFeed: number
  xSpeed: number
  edgeCutting: { speed: number; cutTimes: number; cutSpeedNums?: number; change: { k: number; b: number } }
  middleCutting: { speed: number; cutTimes: number; change: { k: number; b: number } }
  descentCutting: { speed: number; zFeed: number; change: { k: number; b: number } }
}

export interface MachiningRecipe {
  id: string
  name?: string
  horizontalFormulaId: string
  verticalFormulaId: string
  laserPowerRecipeId: string
}

export interface MainRecipe {
  id: string
  name: string
  status?: string
  blackeningRecipeId: string
  machiningRecipeId: string
}

export interface RecipeStatePayload {
  selectedMainRecipeId?: string
  mainRecipes?: MainRecipe[]
  laserPowerRecipes?: LaserPowerRecipe[]
  blackeningRecipes?: BlackeningRecipe[]
  horizontalFormulaRecipes?: HorizontalFormulaRecipe[]
  verticalFormulaRecipes?: VerticalFormulaRecipe[]
  machiningRecipes?: MachiningRecipe[]
  [key: string]: unknown
}
