// ─── 认证 ───────────────────────────────────────
export const AUTH_STORAGE_KEY = 'qomotech-auth'
export const HOME_STATE_KEY = 'HOME_STATE'

// ─── 相机 ───────────────────────────────────────
export const CAMERA_SETTINGS_STORAGE_KEY = 'qomotech-camera-settings'

// ─── RS232 ──────────────────────────────────────
export const RS232_WORKBENCH_STORAGE_KEY = 'qomotech-rs232-workbench'

// ─── 控制器 ─────────────────────────────────────
export const CONTROLLER_SETTINGS_STORAGE_KEY = 'qomotech-controller-settings'

// ─── 辅助功能面板 ───────────────────────────────
export const AUXILIARY_FUNCTION_PANEL_QUICK_MOVE_TO_POSITION_STORAGE_KEY = 'AuxiliaryFunctionPanel_quickMoveToPosition'
export const CENTER_ROTATION_STORAGE_KEY = 'qomotech-4p-center-rotation'

// ─── 配方 ───────────────────────────────────────
export const RECIPE_STORAGE_KEYS = {
  mainRecipes: 'qomotech.recipe.main-recipes',
  laserPowerRecipes: 'qomotech.recipe.laser-power-recipes',
  blackeningRecipes: 'qomotech.recipe.blackening-recipes',
  horizontalFormulaRecipes: 'qomotech.recipe.horizontal-formula-recipes',
  verticalFormulaRecipes: 'qomotech.recipe.vertical-formula-recipes',
  machiningRecipes: 'qomotech.recipe.machining-recipes',
  mainRecipeDetails: 'qomotech.recipe.main-recipe-details',
  selectedMainRecipeId: 'qomotech.recipe.selected-main-recipe-id',
  filter: 'qomotech.recipe.filter'
} as const

// ─── 程序 / 运行 ────────────────────────────────
export const PROGRAM_STARTED_AT_STORAGE_KEY = 'qomo.startProgram.startedAtMs'

// ─── UI 主题 ────────────────────────────────────
export const UI_THEME_STORAGE_KEY = 'qomo-ui-theme'

// ─── 5P 编辑器 ─────────────────────────────────
export const QOMO5P_DRAFT_KEY = 'qomo-5p-draft'

// ─── 图形缩放 ───────────────────────────────────
export const SHOW_AND_DRAW_LOCAL_SCALE_KEY = 'qomo.showAndDrawInHome.localScale'
