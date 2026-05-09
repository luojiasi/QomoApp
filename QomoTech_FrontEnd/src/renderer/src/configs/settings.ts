import type { ReservePageDefinition } from '../types/settings'
import type { LicenseStatus } from '../types/license'

export { DEFAULT_ADMIN_ACCOUNT, DEFAULT_USER_ACCOUNT } from './auth'

export const reservePageDefinitions: ReservePageDefinition[] = [
  {
    id: 'help',
    path: '/help',
    title: '帮助界面',
    description: '原 Home 页面内容已迁移到该页面，用于集中展示授权、账号和管理员维护操作。',
    readyFor: ['授权信息总览', '账号维护', '管理员密钥操作']
  },
  {
    id: 'detailed-rs232-send',
    path: '/detailed-rs232-send',
    title: '详细RS232数据发送区',
    description: '用于配置串口参数、编辑发送帧内容与预留 RS232 接口联调。',
    readyFor: ['串口参数配置（COM1～COM10）', '发送/接收数据区', '快捷命令与接口联调说明']
  },
  {
    id: 'reserve-c',
    path: '/reserve-workbench-c',
    title: '备用界面 C',
    description: '建议承接系统工具、维护助手、日志审计类组件。',
    readyFor: ['系统维护工具', '调试日志查询', '权限与审计']
  }
]

export {
  AXIS_TAB_LABELS,
  applyControllerAxisCount,
  createControllerSections,
  defaultControllerParameters
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
  defaultRecipeManagerState
} from './recipeSettings'

export {
  createRs232Sections,
  defaultRs232WorkbenchState,
  RS232_BAUD_RATE_OPTIONS,
  RS232_COM_PORT_OPTIONS,
  RS232_DATA_BITS_OPTIONS,
  RS232_FLOW_CONTROL_OPTIONS,
  RS232_PARITY_OPTIONS,
  RS232_SEND_MODE_OPTIONS,
  RS232_STOP_BITS_OPTIONS,
  rs232ApiContracts
} from './rs232Settings'

export { defaultCameraSettings } from './cameraSettings'

export {
  QOMO5P_PROJECT_VERSION,
  DEFAULT_ENTITY_BASE_HEIGHT,
  createDefaultViewport,
  createDefaultLayer,
  createDefaultWelding
} from './qomo5pSettings'

export const createDefaultLicenseStatus = (): LicenseStatus => ({
  valid: false,
  code: 'missing',
  message: '当前设备尚未激活，请输入密钥。',
  requiresActivation: true,
  deviceFingerprint: '',
  activatedAt: null,
  expireAt: null,
  licenseId: null,
  remainingDays: null
})
