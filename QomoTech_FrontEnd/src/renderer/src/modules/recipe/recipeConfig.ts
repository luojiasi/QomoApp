import type {
  BlackeningProcessRecipe,
  LaserPowerRecipe,
  MachiningProcessRecipe,
  ProcessFormulaRecipe,
  RecipeManagerState,
  SharedFormulaRecipe,
  VerticalFormulaRecipe,
  VerticalProcessFormulaRecipe
} from './recipeTypes'
import type { ParameterField, ParameterSection } from '@/shared/types'
import { createDefaultLibraryKeywords } from './recipeTypes'

function createTimestamp(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

function createLinearFormulaCoefficients(k: number, b: number) {
  return { k, b }
}

function formatLinearFormula(
  symbol: 'A' | 'L' | 'D' | 'CA',
  formula?: ProcessFormulaRecipe['angleFormula']
): string {
  if (!formula) return '-'
  return `${symbol} = ${formula.k} * 深度 + ${formula.b}`
}

/** 水平与垂直工艺配方共用的默认工艺参数（仅外层档案 id/编码/名称不同） */
function createDefaultSharedProcessFormula(processLineName: string): ProcessFormulaRecipe {
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
    code: `LP-${String(sequence).padStart(3, '0')}`,
    name: `激光功率配方 ${sequence}`,
    notes: '可被扫黑工艺配方与加工工艺配方引用。',
    updatedAt: createTimestamp(),
    laserManufacturer: '默认厂家',
    laserPower: 930,
    laserFrequency: 8000,
    laserCurrent: 10,
    transmissionMode: 'RS232'
  }
}

export function createBlackeningRecipe(
  sequence: number,
  laserPowerRecipeId: string
): BlackeningProcessRecipe {
  return {
    id: `blackening-${sequence}`,
    code: `BH-${String(sequence).padStart(3, '0')}`,
    name: `扫黑工艺配方 ${sequence}`,
    notes: '用于主配方中的扫黑工艺步骤。',
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

export function createHorizontalFormulaRecipe(sequence: number): SharedFormulaRecipe {
  return {
    id: `horizontal-formula-${sequence}`,
    code: `HP-${String(sequence).padStart(3, '0')}`,
    name: `水平工艺配方 ${sequence}`,
    notes: '水平工艺共享配方，可被加工和清洗工艺同时引用。',
    updatedAt: createTimestamp(),
    formula: createDefaultSharedProcessFormula(`水平工艺 ${sequence}`)
  }
}

export function createDefaultVerticalProcessFormula(): VerticalProcessFormulaRecipe {
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

export function createVerticalFormulaRecipe(sequence: number): VerticalFormulaRecipe {
  return {
    id: `vertical-formula-${sequence}`,
    code: `VP-${String(sequence).padStart(3, '0')}`,
    name: `垂直工艺配方 ${sequence}`,
    notes: '垂直工艺共享配方，可被加工和清洗工艺同时引用。',
    updatedAt: createTimestamp(),
    formula: createDefaultVerticalProcessFormula()
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
    code: `JG-${String(sequence).padStart(3, '0')}`,
    name: `加工工艺配方 ${sequence}`,
    notes: '可选择共享的水平工艺配方与垂直工艺配方。',
    updatedAt: createTimestamp(),
    ...requiredFormulas
  }
}

export function createMainRecipe(
  sequence: number,
  requiredChildren: {
    blackeningRecipeId: string
    machiningRecipeId: string
  }
) {
  return {
    id: `main-${sequence}`,
    code: `MP-${String(sequence).padStart(3, '0')}`,
    name: `主配方 ${sequence}`,
    version: 'v1.0.0',
    productModel: `QMT-${String(sequence).padStart(2, '0')}`,
    status: sequence === 1 ? 'active' : 'draft',
    notes: '主配方必须同时选择扫黑、加工两个工艺配方。',
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

function getSelectedMainRecipe(state: RecipeManagerState) {
  return (
    state.mainRecipes.find((recipe) => recipe.id === state.selectedMainRecipeId) ?? state.mainRecipes[0]
  )
}

function createLaserPowerParameterFields(recipe?: LaserPowerRecipe | null): ParameterField[] {
  return [
    { key: 'laser-manufacturer', label: '激光厂家', value: recipe?.laserManufacturer ?? '-' },
    { key: 'laser-power', label: '激光功率', value: recipe?.laserPower ?? '-' },
    { key: 'laser-frequency', label: '激光频率', value: recipe?.laserFrequency ?? '-' },
    { key: 'laser-current', label: '激光电流', value: recipe?.laserCurrent ?? '-' },
    // { key: 'laser-transmission', label: '使用传输方式', value: recipe?.transmissionMode ?? '-' }
  ]
}

function createFormulaFields(prefix: string, recipe?: ProcessFormulaRecipe): ParameterField[] {
  return [
    { key: `${prefix}-name`, label: '工艺名称', value: recipe?.name ?? '-' },
    { key: `${prefix}-shape`, label: '开口形状', value: recipe?.openingShape ?? '-' },
    { key: `${prefix}-upper`, label: '上开口公式', value: recipe?.upperOpeningFormula ?? '-' },
    {
      key: `${prefix}-focus`,
      label: '焦距补偿',
      value: recipe?.focusCompensation ?? '-'
    },
    { key: `${prefix}-angle`, label: '角度公式', value: formatLinearFormula('A', recipe?.angleFormula) },
    {
      key: `${prefix}-lower`,
      label: '下开口公式',
      value: formatLinearFormula('L', recipe?.lowerOpeningFormula)
    },
    {
      key: `${prefix}-depth`,
      label: '深度补偿公式',
      value: formatLinearFormula('D', recipe?.depthCompensationFormula)
    },

    {
      key: `${prefix}-compensation-angle`,
      label: '补偿角度公式',
      value: formatLinearFormula('CA', recipe?.compensationAngleFormula)
    }
  ]
}


function formatDepthLinearFormula(label: string,formula?: VerticalProcessFormulaRecipe['edgeCutting']['change']): string {
  if (!formula) return '-'
  return `${label} = ${formula.k}*距离+${formula.b} [增至100%]`
}

function createVerticalFormulaFieldGroups(prefix: string,recipe?: VerticalProcessFormulaRecipe): NonNullable<ParameterSection['fieldGroups']> {
  return [
    {
      id: `${prefix}-base`,
      title: '基础参数',
      fields: [
        { key: `${prefix}-cutting-axis`, label: '切割轴(XY/R)', value: recipe?.cuttingAxis ?? '-' },
        { key: `${prefix}-x-feed`, label: 'X_偏移量(mm)', value: recipe?.xFeed ?? '-' },
        { key: `${prefix}-x-speed`, label: '插补运行速度(mm/s)', value: recipe?.xSpeed ?? '-' }
      ]
    },
    {
      id: `${prefix}-edge-cutting`,
      title: '边缘切割',
      fields: [
        { key: `${prefix}-edge-speed`, label: '切割速度百分比(%)', value: recipe?.edgeCutting.speed ?? '-' },
        { key: `${prefix}-edge-cut-times`, label: '切割次数(次)', value: recipe?.edgeCutting.cutTimes ?? '-' },
        { key: `${prefix}-edge-cut-speed-nums`, label: '切割速量(次)', value: recipe?.edgeCutting.cutSpeedNums ?? '-' },
        {key: `${prefix}-edge-change`,label: '边缘切割变化率',value: formatDepthLinearFormula('速度', recipe?.edgeCutting.change)}
      ]
    },
    {
      id: `${prefix}-middle-cutting`,
      title: '中间切割',
      fields: [
        { key: `${prefix}-middle-speed`, label: '切割速度百分比(%)', value: recipe?.middleCutting.speed ?? '-' },
        {
          key: `${prefix}-middle-cut-times`,
          label: '切割次数(次)',
          value: recipe?.middleCutting.cutTimes ?? '-'
        },
        {
          key: `${prefix}-middle-change`,
          label: '中间切割变化率',
          value: formatDepthLinearFormula('速度', recipe?.middleCutting.change)
        }
      ]
    },
    {
      id: `${prefix}-descent-cutting`,
      title: '下降切割',
      fields: [
        { key: `${prefix}-descent-speed`, label: '下降量(mm/层)', value: recipe?.descentCutting.speed ?? '-' },
        { key: `${prefix}-descent-z-feed`, label: '下降减少量(mm/%)', value: recipe?.descentCutting.zFeed ?? '-' },
        { key: `${prefix}-change-percent`, label: '变化百分比(%)', value: recipe?.changePercent ?? '-' },
        {
          key: `${prefix}-descent-change`,
          label: '下降切割变化率',
          value:`下降量=${recipe?.descentCutting.speed}-${recipe?.descentCutting.zFeed}*进度//${recipe?.changePercent}%`
        }
      ]
    }
  ]
}

export const createRecipeSections = (state: RecipeManagerState): ParameterSection[] => {
  const selectedRecipe = getSelectedMainRecipe(state)
  const selectedBlackening = state.blackeningRecipes.find(
    (recipe) => recipe.id === selectedRecipe?.blackeningRecipeId
  )
  const selectedMachining = state.machiningRecipes.find(
    (recipe) => recipe.id === selectedRecipe?.machiningRecipeId
  )
  const selectedMachiningHorizontal = state.horizontalFormulaRecipes.find(
    (recipe) => recipe.id === selectedMachining?.horizontalFormulaId
  )
  const selectedMachiningVertical = state.verticalFormulaRecipes.find(
    (recipe) => recipe.id === selectedMachining?.verticalFormulaId
  )
  const selectedBlackeningLaser = state.laserPowerRecipes.find(
    (recipe) => recipe.id === selectedBlackening?.laserPowerRecipeId
  )
  const selectedMachiningLaser = state.laserPowerRecipes.find(
    (recipe) => recipe.id === selectedMachining?.laserPowerRecipeId
  )

  return [
    {
      id: 'recipe-blackening-detail',
      title: '扫黑工艺配方详情',
      description: '扫黑工艺配方包含下降步长、下降次数、扫黑速度、扫黑步进及激光功率配方。',
      fields: [
        { key: 'blackening-enabled', label: '是否启用该配方', value: selectedBlackening?.enabled ?? false },
        { key: 'descentStep', label: '下降步长', value: selectedBlackening?.descentStep ?? '-' },
        { key: 'descentCount', label: '下降次数', value: selectedBlackening?.descentCount ?? '-' },
        { key: 'blackeningSpeed', label: '扫黑速度', value: selectedBlackening?.blackeningSpeed ?? '-' },
        { key: 'blackeningStep', label: '扫黑步进', value: selectedBlackening?.blackeningStep ?? '-' }
      ],
      fieldGroups: [
        {
          id: 'blackening-laser',
          title: '激光功率配方',
          fields: createLaserPowerParameterFields(selectedBlackeningLaser)
        }
      ]
    },
    {
      id: 'recipe-machining-detail',
      title: '加工工艺配方详情',
      description: '加工工艺配方包含激光功率配方，并可选择共享的水平工艺配方与垂直工艺配方。',
      fields: [],
      fieldGroups: [
        {
          id: 'machining-laser',
          title: '激光功率配方',
          fields: createLaserPowerParameterFields(selectedMachiningLaser)
        },
        {
          id: 'machining-horizontal',
          title: '水平工艺参数',
          fields: createFormulaFields('machining-horizontal', selectedMachiningHorizontal?.formula)
        },
        ...createVerticalFormulaFieldGroups(
          'machining-vertical',
          selectedMachiningVertical?.formula
        )
      ]
    }
  ]
}
