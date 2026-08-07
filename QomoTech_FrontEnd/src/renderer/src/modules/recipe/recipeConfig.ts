import type {
  BlackeningProcessRecipe,
  LaserPowerRecipe,
  LinearFormulaCoefficients,
  MachiningProcessRecipe,
  MainRecipeDefinition,
  OpeningShape,
  OpeningShapeFormulaPreset,
  ProcessFormulaRecipe,
  RecipeManagerState,
  RecipeRecordBase,
  VerticalProcessFormulaRecipe
} from './recipeTypes'
import { createDefaultLibraryKeywords } from './recipeTypes'

export function createTimestamp(): string {return new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')}

function createLinearFormulaCoefficients(k: number, b: number): LinearFormulaCoefficients {return { k, b }}


/** 水平与垂直工艺配方共用的默认工艺参数（仅外层档案 id/编码/名称不同） */
function createDefaultSharedProcessFormula(processLineName: string): Omit<ProcessFormulaRecipe, 'id' | 'updatedAt'> {
  return {
    name: processLineName,
    openingShape: 'V型',
    angleFormula: createLinearFormulaCoefficients(0, 0.54),
    lowerOpeningFormula: createLinearFormulaCoefficients(5, 35),
    depthCompensationFormula: createLinearFormulaCoefficients(2, 0.5),
    upperOpeningFormula: '由系统自动计算',
    compensationAngleFormula: createLinearFormulaCoefficients(0, 0),
    focusCompensation: 0.08
  }
}

export function createLaserPowerRecipe(sequence: number): LaserPowerRecipe {
  return {
    id: `laser-power-${sequence}`,
    name: `激光功率配方 ${sequence}`,
    updatedAt: createTimestamp(),
    laserManufacturer: '默认厂家',
    laserPower: 950,
    laserFrequency: 7000,
    laserCurrent: 85
  }
}

export function createBlackeningRecipe(sequence: number,laserPowerRecipeId: string): BlackeningProcessRecipe {
  return {
    id: `blackening-${sequence}`,
    name: `扫黑工艺配方 ${sequence}`,
    updatedAt: createTimestamp(),
    enabled: true,
    descentStep: 0.1,
    descentCount: 2,
    blackeningSpeed: 20,
    blackeningStep: 0.012,
    jiaojubuchang:300,
    saoheikaikou:createLinearFormulaCoefficients(0,0),
    laserPowerRecipeId
  }
}

export function createHorizontalFormulaRecipe(sequence: number): ProcessFormulaRecipe {
  return {
    ...createDefaultSharedProcessFormula(`水平工艺 ${sequence}`),
    id: `horizontal-formula-${sequence}`,
    name: `水平工艺配方 ${sequence}`,
    updatedAt: createTimestamp()
  }
}

export function createDefaultVerticalProcessFormula(): Omit<VerticalProcessFormulaRecipe, keyof RecipeRecordBase> {
  return {
    cuttingAxis: 'XY',
    changePercent: 10,
    xFeed: 0.01,
    xSpeed: 20,
    edgeCutting: {
      speed: 50,
      cutTimes: 2,
      cutSpeedNums:5,
      change: createLinearFormulaCoefficients(1, 5)
    },
    middleCutting: {
      speed: 100,
      cutTimes: 1,
      change: createLinearFormulaCoefficients(0, 50)
    },
    descentCutting: {
      speed: 0.075,
      zFeed: 0.002,
      change: createLinearFormulaCoefficients(10, 0.075)
    }
  }
}

export function createVerticalFormulaRecipe(sequence: number): VerticalProcessFormulaRecipe {
  return {
    ...createDefaultVerticalProcessFormula(),
    id: `vertical-formula-${sequence}`,
    name: `垂直工艺配方 ${sequence}`,
    updatedAt: createTimestamp()
  }
}

export function createMachiningRecipe(
  sequence: number,
  requiredFormulas: {
    horizontalFormulaId: string
    verticalFormulaId: string
    laserPowerRecipeId: string
  }
): MachiningProcessRecipe {
  return {
    id: `machining-${sequence}`,
    name: `加工工艺配方 ${sequence}`,
    updatedAt: createTimestamp(),
    teachingMode: false,
    timeoutWaitTime: 2,
    ...requiredFormulas
  }
}

export function createMainRecipe(
  sequence: number,
  requiredChildren: {
    blackeningRecipeId: string
    machiningRecipeId: string
  }
): MainRecipeDefinition {
  return {
    id: `main-${sequence}`,
    name: `主配方 ${sequence}`,
    status: sequence === 1 ? 'active' : 'draft',
    updatedAt: createTimestamp(),
    ...requiredChildren
  } satisfies RecipeManagerState['mainRecipes'][number]
}

const defaultLaserPowerRecipes = [createLaserPowerRecipe(1), createLaserPowerRecipe(2)]
const defaultBlackeningRecipes = [
  createBlackeningRecipe(1, defaultLaserPowerRecipes[0].id),
  createBlackeningRecipe(2, defaultLaserPowerRecipes[1].id)
]
const defaultHorizontalFormulaRecipes = [createHorizontalFormulaRecipe(1), createHorizontalFormulaRecipe(2)]
const defaultVerticalFormulaRecipes = [createVerticalFormulaRecipe(1), createVerticalFormulaRecipe(2)]
const defaultMachiningRecipes = [
  createMachiningRecipe(1, {
    horizontalFormulaId: defaultHorizontalFormulaRecipes[0].id,
    verticalFormulaId: defaultVerticalFormulaRecipes[0].id,
    laserPowerRecipeId: defaultLaserPowerRecipes[0].id
  }),
  createMachiningRecipe(2, {
    horizontalFormulaId: defaultHorizontalFormulaRecipes[1].id,
    verticalFormulaId: defaultVerticalFormulaRecipes[1].id,
    laserPowerRecipeId: defaultLaserPowerRecipes[1].id
  })
]
export const defaultRecipeManagerState: RecipeManagerState = {
  selectedMainRecipeId: 'main-1',
  filter: {
    keyword: '',
    recipeStatus: 'all',
    libraryKeywords: createDefaultLibraryKeywords()
  },
  mainRecipes: [
    createMainRecipe(1, {
      blackeningRecipeId: defaultBlackeningRecipes[0].id,
      machiningRecipeId: defaultMachiningRecipes[0].id
    }),
    createMainRecipe(2, {
      blackeningRecipeId: defaultBlackeningRecipes[1].id,
      machiningRecipeId: defaultMachiningRecipes[1].id
    })
  ],
  laserPowerRecipes: defaultLaserPowerRecipes,
  blackeningRecipes: defaultBlackeningRecipes,
  horizontalFormulaRecipes: defaultHorizontalFormulaRecipes,
  verticalFormulaRecipes: defaultVerticalFormulaRecipes,
  machiningRecipes: defaultMachiningRecipes
}







// ------------------------------------------------------------------
// 编辑器/管理页面共享数据
// ------------------------------------------------------------------

export const openingShapeOptions: OpeningShape[] = ['V型', '//型']


export const openingShapeFormulaPresets: Record<OpeningShape, OpeningShapeFormulaPreset> = {
  'V型': {
    angleFormula: { k: 0, b: 0.54 },
    lowerOpeningFormula: { k: 5, b: 35 },
    depthCompensationFormula: { k: 2, b: 0.5 },
    compensationAngleFormula: { k: 0, b: 0 }
  },
  '//型': {
    angleFormula: { k: 0, b: 0.54 },
    lowerOpeningFormula: { k: 0, b: 50 },
    depthCompensationFormula: { k: 0, b: 0 },
    compensationAngleFormula: { k: 0, b: 0 }
  }
}

