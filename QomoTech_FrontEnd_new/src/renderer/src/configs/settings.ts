import type { ReservePageDefinition } from '../types/settings'

export const reservePageDefinitions: ReservePageDefinition[] = [
  {
    id: 'help',
    path: '/help',
    title: '帮助界面',
    description: '原 Home 页面内容已迁移到该页面，用于集中展示授权、账号和管理员维护操作。',
    readyFor: ['授权信息总览', '账号维护', '管理员密钥操作'],
  },
  {
    id: 'reserve-c',
    path: '/reserve-workbench-c',
    title: '备用界面 C',
    description: '建议承接系统工具、维护助手、日志审计类组件。',
    readyFor: ['系统维护工具', '调试日志查询', '权限与审计'],
  },
]

export { deviceFeatureRoutes } from './router'

export {
  AXIS_TAB_LABELS,
  applyControllerAxisCount,
  createControllerSections,
  defaultControllerParameters,
} from './controllerSettings'

export {
  createBlackeningRecipe,
  createDefaultVerticalProcessFormula,
  createHorizontalFormulaRecipe,
  createLaserPowerRecipe,
  createMainRecipe,
  createMachiningRecipe,
  createVerticalFormulaRecipe,
  createRecipeSections,
  defaultRecipeManagerState,
} from './recipeSettings'
