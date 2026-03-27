export type SettingValue = string | number | boolean | null 

export interface ParameterField {
  key: string
  label: string
  value: SettingValue
  unit?: string
}

export interface ParameterFieldGroup {
  id: string
  title: string
  fields: ParameterField[]
}

export interface ParameterSection {
  id: string
  title: string
  description: string
  fields: ParameterField[]
  /** 若存在，主配方详情等界面优先按组渲染（如水平/垂直工艺分框） */
  fieldGroups?: ParameterFieldGroup[]
}

export interface RouteShortcut {
  path: string
  name: string
  title: string
  description: string
}

export interface SettingsSaveResult<T> {
  success: boolean
  message: string
  data: T
  updatedAt: string
}

export interface ReservePageDefinition {
  id: string
  path: string
  title: string
  description: string
  readyFor: string[]
}

export type {
  ControllerAxisCount,
  ControllerAxisDriverRead,
  ControllerAxisSettings,
  ControllerAxisUserInput,
  ControllerCommunicationSettings,
  ControllerParameters,
  ControllerTransport,
  IOMapDriverRead,
  IOMapEntry,
  IOMapNineGroups,
  IOMapSettings
} from './controllerSettings'

export { IO_MAP_GROUP_COUNT } from './controllerSettings'

export type {
  BlackeningProcessRecipe,
  CleaningProcessRecipe,
  LaserPowerRecipe,
  LaserTransmissionMode,
  LinearFormulaCoefficients,
  MainRecipeDefinition,
  MachiningProcessRecipe,
  OpeningShape,
  ProcessFormulaRecipe,
  SharedFormulaRecipe,
  VerticalDescentCutting,
  VerticalEdgeOrMiddleCutting,
  VerticalFormulaRecipe,
  VerticalProcessFormulaRecipe,
  RecipeDefinition,
  RecipeFilter,
  RecipeManagerState,
  RecipeStatus
} from './recipeSettings'

export type { SaveJsonPreset } from './saveJson'
export type { CameraSettingsState } from './cameraSettings'

export type {
  Rs232ApiContract,
  Rs232ComPortName,
  Rs232DataBits,
  Rs232FlowControl,
  Rs232Parity,
  Rs232PortConfig,
  Rs232QuickCommand,
  Rs232ReceiveConfig,
  Rs232SendConfig,
  Rs232SendMode,
  Rs232SendRequest,
  Rs232SendResult,
  Rs232SerialSessionRequest,
  Rs232StopBits,
  Rs232WorkbenchState
} from './rs232Settings'


