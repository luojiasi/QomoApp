import { getRecipeStateFromFile, saveRecipeStateToFile } from '../api'
import type { RecipeManagerState } from '../recipeTypes'
import { normalizeRecipeState } from '../recipeValidation'

/** 从服务端加载配方状态。成功返回规范化数据，失败返回 null。 */
export async function loadRecipeStateFromBackend(): Promise<RecipeManagerState | null> {
  try {
    const res = await getRecipeStateFromFile()
    if (res?.success && res.data) {
      const normalized = normalizeRecipeState(res.data)
      if (normalized) return normalized
      console.warn('[recipe-persistence] normalizeRecipeState 校验失败，回退到本地存储', {
        dataKeys: res.data ? Object.keys(res.data) : 'null',
        laserPowerCount: Array.isArray(res.data?.laserPowerRecipes) ? res.data.laserPowerRecipes.length : 'N/A'
      })
    } else {
      console.warn('[recipe-persistence] 服务端无配方数据或响应异常', { success: res?.success, hasData: !!res?.data })
    }
  } catch (err) {
    console.error('[recipe-persistence] 加载服务端配方异常', err)
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
