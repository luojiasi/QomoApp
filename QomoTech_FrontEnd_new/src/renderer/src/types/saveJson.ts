/** 与主进程 `app:save-json-file` 约定一致，用于区分保存对话框与默认文件名 */
export type SaveJsonPreset =
  | 'controller-settings'
  | 'rs232-workbench'
  | 'main-recipe-details'
