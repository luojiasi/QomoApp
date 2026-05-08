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
  ControllerAxisSettings,
  ControllerCommunicationSettings,
  ControllerParameters,
  ControllerTransport,
} from './controllerSettings'

export type {
  BlackeningProcessRecipe,
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
  RecipeStatus,
} from './recipeSettings'

export type { SaveJsonPreset } from './saveJson'
