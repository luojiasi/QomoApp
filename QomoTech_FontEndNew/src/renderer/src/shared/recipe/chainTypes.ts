export type RecipeChainKind =
  | 'main'
  | 'blackening'
  | 'machining'
  | 'laser'
  | 'horizontal'
  | 'vertical'

export interface RecipeChainNode {
  kind: RecipeChainKind
  /** 列表项 id；main 用主配方 id；未关联时为 '' */
  id: string
  /** 展示名；未关联时用空串，UI 显示「待选择」 */
  label: string
  depth: number
  missing: boolean
}
