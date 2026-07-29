// =============================================================================
// Recipe composable — 配方状态响应式管理
// =============================================================================
import { ref, readonly, computed, toRaw } from 'vue'
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

  function replaceList(listKey: string, arr: unknown[]) {
    ;(state.value as Record<string, unknown>)[listKey] = arr
    dirty.value = true
  }

  /** 按 id 更新数组元素；支持 fieldPath 如 'angleFormula.k' 或 'edgeCutting.change.k' */
  function updateListItem(listKey: string, id: string, fieldPath: string, value: unknown) {
    const list = [...(((state.value as Record<string, unknown>)[listKey] as Record<string, unknown>[] | undefined) ?? [])] as Record<string, unknown>[]
    const idx = list.findIndex((r) => r.id === id)
    if (idx < 0) return
    // Pinia/Vue ref 里的对象是 Proxy；structuredClone(Proxy) 会抛 DataCloneError
    const clone = structuredClone(toRaw(list[idx])) as Record<string, unknown>
    const parts = fieldPath.split('.')
    let cur: Record<string, unknown> = clone
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]
      const child = cur[key]
      cur[key] = { ...toRaw((child as Record<string, unknown> | undefined) ?? {}) }
      cur = cur[key] as Record<string, unknown>
    }
    // 统一启用字段为真正的 boolean，避免 "false" 字符串被当成已启用
    const nextValue =
      parts[parts.length - 1] === 'enabled' ? value === true || value === 'true' || value === 1 || value === '1' : value
    cur[parts[parts.length - 1]] = nextValue
    list[idx] = clone
    state.value = { ...toRaw(state.value), [listKey]: list }
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
    updateField,
    replaceList,
    updateListItem
  }
}
