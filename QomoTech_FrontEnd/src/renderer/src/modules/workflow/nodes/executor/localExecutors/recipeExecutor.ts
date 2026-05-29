// ─────────────────────────────────────────────────────────────
// nodes/executor/localExecutors/recipeExecutor.ts — 获取配方执行器
//
// 直接从前端 useRecipeSettingsStore（Pinia）读取配方数据，
// 根据 selectedMainRecipeId 解引用完整配方链，
// 输出与主页 RecipeParameterPanel 一致的 runRecipePayload 结构。
// 不需要网络请求，即时返回。
// ─────────────────────────────────────────────────────────────

import type { WorkflowNode } from '../../../types/workflow'
import type { NodeRunResult, ExecutionCallbacks } from '../../../types/workflowExecution'
import { useRecipeSettingsStore } from '@/modules/recipe/useRecipeStore'

function uniqueById<T extends { id: string }>(items: Array<T | null>): T[] {
  const map = new Map<string, T>()
  items.forEach((item) => { if (item) map.set(item.id, item) })
  return Array.from(map.values())
}

function findById<T extends { id: string }>(list: T[], id: string): T | null {
  return list.find((item) => item.id === id) ?? null
}

export async function executeGetRecipe(
  node: WorkflowNode,
  _upstreamData: Record<string, Record<string, unknown>>,
  callbacks?: ExecutionCallbacks
): Promise<NodeRunResult> {
  callbacks?.onProgress?.(node.id, '正在读取配方数据')

  const store = useRecipeSettingsStore()
  const state = store.recipeState

  const selectedId = (node.params.mainRecipeId as string) || state.selectedMainRecipeId
  if (!selectedId) {
    return {
      nodeId: node.id, nodeType: node.type, status: 'failure',
      output: {}, error: '未选择主配方，请先在配方管理中选择或指定 mainRecipeId 参数'
    }
  }

  const main = findById(state.mainRecipes, selectedId)
  if (!main) {
    return {
      nodeId: node.id, nodeType: node.type, status: 'failure',
      output: {}, error: `未找到主配方 (id: ${selectedId})`
    }
  }

  const blackening = findById(state.blackeningRecipes, main.blackeningRecipeId)
  const machining = findById(state.machiningRecipes, main.machiningRecipeId)

  if (!blackening || !machining) {
    return {
      nodeId: node.id, nodeType: node.type, status: 'failure',
      output: {}, error: `主配方 "${main.name}" 关联的黑化或加工工艺配方未找到`
    }
  }

  const blackeningLaser = findById(state.laserPowerRecipes, blackening.laserPowerRecipeId)
  const machiningLaser = findById(state.laserPowerRecipes, machining.laserPowerRecipeId)
  const vertical = findById(state.verticalFormulaRecipes, machining.verticalFormulaId)
  const horizontal = findById(state.horizontalFormulaRecipes, machining.horizontalFormulaId)

  if (!blackeningLaser || !machiningLaser || !vertical || !horizontal) {
    return {
      nodeId: node.id, nodeType: node.type, status: 'failure',
      output: {}, error: `主配方 "${main.name}" 关联的激光功率或工艺公式配方未找到`
    }
  }

  const selectedLaserRecipe = uniqueById([blackeningLaser, machiningLaser])
  const selectedHorizontal = uniqueById([horizontal])
  const selectedVertical = uniqueById([vertical])

  const payload = {
    selectedMainRecipe: main,
    selectedBlackeningRecipe: [blackening],
    selectedMachiningRecipe: [machining],
    selectedLaserRecipe,
    selectedHorizontal,
    selectedVertical,
    MainRecipeChild: [main.blackeningRecipeId, main.machiningRecipeId],
    BlackeningRecipeChild: [blackening.laserPowerRecipeId],
    MachiningRecipeChild: [machining.laserPowerRecipeId, machining.horizontalFormulaId, machining.verticalFormulaId]
  }

  callbacks?.onProgress?.(node.id, `已获取配方: ${main.name}`)

  return {
    nodeId: node.id,
    nodeType: node.type,
    status: 'success',
    output: payload as unknown as Record<string, unknown>
  }
}
