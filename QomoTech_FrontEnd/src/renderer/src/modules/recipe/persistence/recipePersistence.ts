import { getRecipeStateFromFile, saveRecipeStateToFile } from '../api'
import type { RecipeManagerState } from '../recipeTypes'
import { normalizeRecipeState } from '../recipeValidation'

/** 从服务端加载配方状态。成功返回规范化数据，失败返回 null。 */
export async function loadRecipeStateFromBackend(): Promise<RecipeManagerState | null> {
  const res = await getRecipeStateFromFile()
  if (res?.success && res.data) {
    const normalized = normalizeRecipeState(res.data)
    if (normalized) return normalized
  }
  return null
}

/** 保存配方状态到服务端。返回是否成功。 */
export async function saveRecipeStateToBackend(payload: RecipeManagerState): Promise<boolean> {
  const res = await saveRecipeStateToFile(payload as unknown as Record<string, unknown>)
  if (!res?.success) {
    console.warn('[recipe-persistence] 保存到服务端失败', res?.message)
    return false
  }
  return true
}
