// =============================================================================
// Recipe composable — 配方状态响应式管理
// =============================================================================
import { ref, readonly, computed } from 'vue'
import { getRecipeState, saveRecipeState } from './api'
import type { RecipeStatePayload, MainRecipe } from './types'

const state = ref<RecipeStatePayload>({})
const loading = ref(false)
const dirty = ref(false)
const lastError = ref('')

export function useRecipes() {
  const mainRecipes = computed<MainRecipe[]>(() => state.value.mainRecipes ?? [])
  const selectedMainRecipeId = computed(() => state.value.selectedMainRecipeId ?? '')
  const selectedRecipe = computed<MainRecipe | undefined>(() =>
    mainRecipes.value.find(r => r.id === selectedMainRecipeId.value)
  )

  async function load() {
    loading.value = true
    lastError.value = ''
    try {
      const res = await getRecipeState()
      if (res.success && res.data) {
        state.value = res.data as RecipeStatePayload
        dirty.value = false
      } else {
        lastError.value = res.message ?? '加载配方失败'
      }
    } catch (e: unknown) {
      lastError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function save() {
    lastError.value = ''
    try {
      const res = await saveRecipeState(state.value)
      if (res.success) {
        dirty.value = false
      } else {
        lastError.value = res.message ?? '保存配方失败'
      }
    } catch (e: unknown) {
      lastError.value = e instanceof Error ? e.message : String(e)
    }
  }

  function selectRecipe(id: string) {
    state.value.selectedMainRecipeId = id
    dirty.value = true
  }

  function updateField(path: string, value: unknown) {
    const keys = path.split('.')
    let obj: Record<string, unknown> = state.value
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj)) obj[keys[i]] = {}
      obj = obj[keys[i]] as Record<string, unknown>
    }
    obj[keys[keys.length - 1]] = value
    dirty.value = true
  }

  return {
    state: readonly(state),
    mainRecipes,
    selectedMainRecipeId,
    selectedRecipe,
    loading: readonly(loading),
    dirty: readonly(dirty),
    lastError: readonly(lastError),
    load,
    save,
    selectRecipe,
    updateField
  }
}
