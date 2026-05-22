import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  createBlackeningRecipe,
  createHorizontalFormulaRecipe,
  createLaserPowerRecipe,
  createMainRecipe,
  createMachiningRecipe,
  createVerticalFormulaRecipe,
  defaultRecipeManagerState
} from './recipeConfig'
import type {MachiningProcessRecipe,ProcessFormulaRecipe,RecipeManagerState,VerticalProcessFormulaRecipe} from './recipeTypes'
import type { SettingsSaveResult } from '@/shared/types'
import { cloneSettings } from '@/shared/utils/settings'
import { getNextSequence, normalizeRecipeState } from './recipeValidation'
import { createSettingsSaveResult } from '@/shared/utils/useSettingsStore'
import { RECIPE_STORAGE_KEYS } from '@/shared/constants/storageKeys'
import { loadRecipeStateFromBackend, saveRecipeStateToBackend } from './persistence/recipePersistence'
import { HEAVY_SETTINGS_PERSIST_DEBOUNCE_MS } from '@/shared/constants/constants'

/** 加工配方 + 展开的水平/垂直工艺子配方，供其他模块快速读取 */
type ProcessRecipeWithFormulaDetails<T extends MachiningProcessRecipe> = T & {
  horizontalFormulaRecipe: ProcessFormulaRecipe | null
  verticalFormulaRecipe: VerticalProcessFormulaRecipe | null
}

/** 主配方详情快照：聚合主配方、扫黑、加工及其子配方的完整信息 */
interface MainRecipeDetailsStorage {
  selectedMainRecipeId: string
  savedAt: string
  mainRecipe: RecipeManagerState['mainRecipes'][number] | null
  blackeningRecipe: RecipeManagerState['blackeningRecipes'][number] | null
  machiningRecipe: ProcessRecipeWithFormulaDetails<MachiningProcessRecipe> | null
}

/** 检测浏览器 localStorage 是否可用 */
function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/** 从 localStorage 读取并反序列化 JSON，失败返回 null */
function readLocalStorageJson<T>(key: string): T | null {
  if (!canUseLocalStorage()) return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** 将值序列化为 JSON 写入 localStorage */
function writeLocalStorageJson(key: string, value: unknown): void {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

/** 检测 localStorage 中是否存在分键存储的配方数据（区分新旧存储格式） */
function hasSplitStorageData(): boolean {
  if (!canUseLocalStorage()) return false

  return (
    window.localStorage.getItem(RECIPE_STORAGE_KEYS.mainRecipes) !== null ||
    window.localStorage.getItem(RECIPE_STORAGE_KEYS.laserPowerRecipes) !== null ||
    window.localStorage.getItem(RECIPE_STORAGE_KEYS.blackeningRecipes) !== null ||
    window.localStorage.getItem(RECIPE_STORAGE_KEYS.horizontalFormulaRecipes) !== null ||
    window.localStorage.getItem(RECIPE_STORAGE_KEYS.verticalFormulaRecipes) !== null ||
    window.localStorage.getItem(RECIPE_STORAGE_KEYS.machiningRecipes) !== null
  )
}

/** 从 localStorage 的 8 个分键中读取并校验/迁移完整配方状态，若无数据返回 null */
function readStateFromLocalStorage(): RecipeManagerState | null {
  if (!canUseLocalStorage()) return null

  if (!hasSplitStorageData()) return null

  return normalizeRecipeState({
    mainRecipes:
      readLocalStorageJson<RecipeManagerState['mainRecipes']>(RECIPE_STORAGE_KEYS.mainRecipes) ??
      defaultRecipeManagerState.mainRecipes,
    laserPowerRecipes:
      readLocalStorageJson<RecipeManagerState['laserPowerRecipes']>(
        RECIPE_STORAGE_KEYS.laserPowerRecipes
      ) ?? defaultRecipeManagerState.laserPowerRecipes,
    blackeningRecipes:
      readLocalStorageJson<RecipeManagerState['blackeningRecipes']>(
        RECIPE_STORAGE_KEYS.blackeningRecipes
      ) ?? defaultRecipeManagerState.blackeningRecipes,
    horizontalFormulaRecipes:
      readLocalStorageJson<RecipeManagerState['horizontalFormulaRecipes']>(
        RECIPE_STORAGE_KEYS.horizontalFormulaRecipes
      ) ?? defaultRecipeManagerState.horizontalFormulaRecipes,
    verticalFormulaRecipes:
      readLocalStorageJson<RecipeManagerState['verticalFormulaRecipes']>(
        RECIPE_STORAGE_KEYS.verticalFormulaRecipes
      ) ?? defaultRecipeManagerState.verticalFormulaRecipes,
    machiningRecipes:
      readLocalStorageJson<RecipeManagerState['machiningRecipes']>(
        RECIPE_STORAGE_KEYS.machiningRecipes
      ) ?? defaultRecipeManagerState.machiningRecipes,
    selectedMainRecipeId:
      readLocalStorageJson<RecipeManagerState['selectedMainRecipeId']>(
        RECIPE_STORAGE_KEYS.selectedMainRecipeId
      ) ?? defaultRecipeManagerState.selectedMainRecipeId,
    filter:
      readLocalStorageJson<RecipeManagerState['filter']>(RECIPE_STORAGE_KEYS.filter) ??
      defaultRecipeManagerState.filter
  })
}

/** 构建主配方详情快照：展开选中主配方的扫黑、加工及关联的水平/垂直工艺子配方 */
function buildMainRecipeDetailsStorage(state: RecipeManagerState): MainRecipeDetailsStorage {
  const mainRecipe =
    state.mainRecipes.find((recipe) => recipe.id === state.selectedMainRecipeId) ??
    state.mainRecipes[0] ??
    null

  const blackeningRecipe =
    state.blackeningRecipes.find((recipe) => recipe.id === mainRecipe?.blackeningRecipeId) ?? null
  const machiningRecipe = state.machiningRecipes.find((recipe) => recipe.id === mainRecipe?.machiningRecipeId)

  const machiningDetails = machiningRecipe
    ? {
        ...machiningRecipe,
        horizontalFormulaRecipe:
          state.horizontalFormulaRecipes.find(
            (recipe) => recipe.id === machiningRecipe.horizontalFormulaId
          ) ?? null,
        verticalFormulaRecipe:
          state.verticalFormulaRecipes.find((recipe) => recipe.id === machiningRecipe.verticalFormulaId) ??
          null
      }
    : null

  return {
    selectedMainRecipeId: state.selectedMainRecipeId,
    savedAt: new Date().toISOString(),
    mainRecipe,
    blackeningRecipe,
    machiningRecipe: machiningDetails
  }
}

/** 将完整配方状态写入 localStorage 的 8 个分键及聚合详情快照 */
function persistStateToLocalStorage(state: RecipeManagerState): void {
  if (!canUseLocalStorage()) return
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.mainRecipes, state.mainRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.laserPowerRecipes, state.laserPowerRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.blackeningRecipes, state.blackeningRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.horizontalFormulaRecipes, state.horizontalFormulaRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.verticalFormulaRecipes, state.verticalFormulaRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.machiningRecipes, state.machiningRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.mainRecipeDetails, buildMainRecipeDetailsStorage(state))
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.selectedMainRecipeId, state.selectedMainRecipeId)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.filter, state.filter)
}

export const useRecipeSettingsStore = defineStore('recipe-settings', () => {
  const recipeState = ref<RecipeManagerState>(cloneSettings(defaultRecipeManagerState))

  /** 后端持久化防抖定时器 */
  let backendPersistTimer: ReturnType<typeof setTimeout> | null = null

  const clearBackendPersistTimer = (): void => {
    if (backendPersistTimer !== null) {
      clearTimeout(backendPersistTimer)
      backendPersistTimer = null
    }
  }

  const scheduleBackendPersist = (): void => {
    clearBackendPersistTimer()
    backendPersistTimer = setTimeout(() => {
      backendPersistTimer = null
      void saveRecipeStateToBackend(recipeState.value)
    }, HEAVY_SETTINGS_PERSIST_DEBOUNCE_MS)
  }

  /** 页面初始化时优先从后端加载，其次 localStorage，均失败则写入默认值 */
  const loadRecipeState = async (): Promise<SettingsSaveResult<RecipeManagerState>> => {
    const fromBackend = await loadRecipeStateFromBackend()
    if (fromBackend) {
      recipeState.value = fromBackend
      persistStateToLocalStorage(recipeState.value)
      return createSettingsSaveResult('已从服务端加载配方管理数据。', recipeState.value)
    }

    const cached = readStateFromLocalStorage()
    if (cached) {
      recipeState.value = cached
      persistStateToLocalStorage(recipeState.value)
      // 将 localStorage 数据同步到后端文件（首次迁移 + 兜底）
      clearBackendPersistTimer()
      void saveRecipeStateToBackend(recipeState.value)
      return createSettingsSaveResult('已从本地存储加载配方管理数据。', recipeState.value)
    }

    persistStateToLocalStorage(recipeState.value)
    return createSettingsSaveResult('未找到有效配方数据，已加载默认配方配置。', recipeState.value)
  }

  /** 手动持久化：同时写入 localStorage 和后端 */
  const saveRecipeState = async (
    payload: RecipeManagerState
  ): Promise<SettingsSaveResult<RecipeManagerState>> => {
    recipeState.value = cloneSettings(payload)
    persistStateToLocalStorage(recipeState.value)
    clearBackendPersistTimer()
    await saveRecipeStateToBackend(recipeState.value)
    return createSettingsSaveResult('配方管理数据已保存到服务端。', recipeState.value)
  }

  /** 切换当前选中的主配方 ID */
  const selectMainRecipe = (id: string): void => {
    recipeState.value.selectedMainRecipeId = id
  }

  /** 新增主配方：自动引用第一个扫黑配方和第一个加工配方，并选中新配方 */
  const addMainRecipe = (): void => {
    const { blackeningRecipes, machiningRecipes, mainRecipes } = recipeState.value
    const blackeningRecipeId = blackeningRecipes[0]?.id
    const machiningRecipeId = machiningRecipes[0]?.id

    if (!blackeningRecipeId || !machiningRecipeId) {
      return
    }

    const sequence = getNextSequence(mainRecipes, 'main')
    const recipe = createMainRecipe(sequence, {
      blackeningRecipeId,
      machiningRecipeId
    })
    recipeState.value.mainRecipes.push(recipe)
    recipeState.value.selectedMainRecipeId = recipe.id
  }

  /** 删除主配方：若删除的是当前选中项，自动切换到第一个主配方 */
  const removeMainRecipe = (id: string): void => {
    recipeState.value.mainRecipes = recipeState.value.mainRecipes.filter((recipe) => recipe.id !== id)
    if (recipeState.value.selectedMainRecipeId === id) {
      recipeState.value.selectedMainRecipeId = recipeState.value.mainRecipes[0]?.id ?? ''
    }
  }

  /** 新增激光功率配方 */
  const addLaserPowerRecipe = (): void => {
    const sequence = getNextSequence(recipeState.value.laserPowerRecipes, 'laser-power')
    recipeState.value.laserPowerRecipes.push(createLaserPowerRecipe(sequence))
  }

  /** 删除激光功率配方 */
  const removeLaserPowerRecipe = (id: string): void => {
    recipeState.value.laserPowerRecipes = recipeState.value.laserPowerRecipes.filter(
      (recipe) => recipe.id !== id
    )
  }

  /** 新增扫黑工艺配方：默认引用第一个激光功率配方 */
  const addBlackeningRecipe = (): void => {
    const fallback = recipeState.value.laserPowerRecipes[0]?.id
    if (!fallback) {
      return
    }
    const sequence = getNextSequence(recipeState.value.blackeningRecipes, 'blackening')
    recipeState.value.blackeningRecipes.push(createBlackeningRecipe(sequence, fallback))
  }

  /** 删除扫黑工艺配方 */
  const removeBlackeningRecipe = (id: string): void => {
    recipeState.value.blackeningRecipes = recipeState.value.blackeningRecipes.filter(
      (recipe) => recipe.id !== id
    )
  }

  /** 新增加工工艺配方：默认引用第一个水平/垂直/激光配方，三类均需至少有一条才可新增 */
  const addMachiningRecipe = (): void => {
    if (
      !recipeState.value.horizontalFormulaRecipes.length ||
      !recipeState.value.verticalFormulaRecipes.length ||
      !recipeState.value.laserPowerRecipes.length
    ) {
      return
    }
    const sequence = getNextSequence(recipeState.value.machiningRecipes, 'machining')
    recipeState.value.machiningRecipes.push(
      createMachiningRecipe(sequence, {
        horizontalFormulaId: recipeState.value.horizontalFormulaRecipes[0].id,
        verticalFormulaId: recipeState.value.verticalFormulaRecipes[0].id,
        laserPowerRecipeId: recipeState.value.laserPowerRecipes[0].id
      })
    )
  }

  /** 删除加工工艺配方 */
  const removeMachiningRecipe = (id: string): void => {
    recipeState.value.machiningRecipes = recipeState.value.machiningRecipes.filter(
      (recipe) => recipe.id !== id
    )
  }

  /** 新增水平工艺配方 */
  const addHorizontalFormulaRecipe = (): void => {
    const sequence = getNextSequence(recipeState.value.horizontalFormulaRecipes, 'horizontal-formula')
    recipeState.value.horizontalFormulaRecipes.push(createHorizontalFormulaRecipe(sequence))
  }

  /** 删除水平工艺配方 */
  const removeHorizontalFormulaRecipe = (id: string): void => {
    recipeState.value.horizontalFormulaRecipes = recipeState.value.horizontalFormulaRecipes.filter(
      (recipe) => recipe.id !== id
    )
  }

  /** 新增垂直工艺配方 */
  const addVerticalFormulaRecipe = (): void => {
    const sequence = getNextSequence(recipeState.value.verticalFormulaRecipes, 'vertical-formula')
    recipeState.value.verticalFormulaRecipes.push(createVerticalFormulaRecipe(sequence))
  }

  /** 删除垂直工艺配方 */
  const removeVerticalFormulaRecipe = (id: string): void => {
    recipeState.value.verticalFormulaRecipes = recipeState.value.verticalFormulaRecipes.filter(
      (recipe) => recipe.id !== id
    )
  }

  /** 深度监听配方状态变化：立即写入 localStorage，防抖写入后端 JSON 文件 */
  watch(
    recipeState,
    (state) => {
      persistStateToLocalStorage(state)
      scheduleBackendPersist()
    },
    { deep: true }
  )

  return {
    recipeState,
    loadRecipeState,
    saveRecipeState,
    selectMainRecipe,
    addMainRecipe,
    removeMainRecipe,
    addLaserPowerRecipe,
    removeLaserPowerRecipe,
    addBlackeningRecipe,
    removeBlackeningRecipe,
    addMachiningRecipe,
    removeMachiningRecipe,
    addHorizontalFormulaRecipe,
    removeHorizontalFormulaRecipe,
    addVerticalFormulaRecipe,
    removeVerticalFormulaRecipe
  }
})
