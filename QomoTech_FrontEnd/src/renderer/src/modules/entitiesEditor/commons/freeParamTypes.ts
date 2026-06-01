// =============================================================================
// 自由编辑参数 —— 任务参数行类型
// =============================================================================

/** 配方选项：存储主配方 ID，来源于 recipeStore 中 status='active' 的主配方 */
export type RecipeOption = string

/** 单条任务参数行 */
export interface TaskRow {
  id: string
  /** 序号 */
  taskNo: number
  /** 直径 (mm) */
  diameter: number
  /** 高度 (mm) */
  height: number
  /** 分割数 (3-360) */
  divisions: number
  /** 配方 */
  recipe: RecipeOption
}

/** 任务参数表序列化格式 */
export interface SerializedTaskTable {
  format: 'QOMO5P-TaskTable'
  version: string
  savedAt: string
  rows: TaskRow[]
}

export const TASK_TABLE_VERSION = '1.0.0'
export const TASK_TABLE_FILE_EXT = '.jjs'
