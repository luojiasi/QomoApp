// ─────────────────────────────────────────────────────────────
// nodes/definitions/recipe.ts — 配方类节点蓝图
//
// recipe 类节点使用 executeAs 本地执行器，
// 由 recipeExecutor.ts 从 Pinia store 读取并解引用配方链。
// 主配方选择由 SelfProcessPage_NodeSettings.vue 中的
// 专用下拉组件处理，不从 params 渲染。
// ─────────────────────────────────────────────────────────────

import type { NodeTypeDef } from '../../types/nodeDefinition'

/**
 * 获取配方节点
 * 从前端 Pinia store 读取配方数据，根据选中的主配方解引用完整的配方链
 *（主配方 → 黑化/加工工艺 → 激光功率/水平/垂直公式），
 * 输出与主页 RecipeParameterPanel 一致的配方数据。
 */
const recipeGetState: NodeTypeDef = {
  type: 'recipe.getState',
  category: 'recipe',
  displayName: '获取配方',
  icon: '📋',
  color: '#7c3aed',
  description: '获取选中主配方的完整配方链数据（含黑化、加工、激光、公式）',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [],
  defaults: {},
  executeAs: 'getRecipe'
}

export const recipeDefs: NodeTypeDef[] = [recipeGetState]
