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
} from '@/configs/settings'
import type {
  MachiningProcessRecipe,
  RecipeManagerState,
  SettingsSaveResult,
  SharedFormulaRecipe,
  VerticalFormulaRecipe
} from '@/types/settings'
import { cloneSettings } from '@/utils/settings'
import { getNextSequence, normalizeRecipeState } from './recipeValidation'
import { createSettingsSaveResult } from '@/modules/settings/useSettingsStore'
import { RECIPE_STORAGE_KEYS } from '@/configs/storageKeys'

type ProcessRecipeWithFormulaDetails<T extends MachiningProcessRecipe> = T & {
  horizontalFormulaRecipe: SharedFormulaRecipe | null
  verticalFormulaRecipe: VerticalFormulaRecipe | null
}

interface MainRecipeDetailsStorage {
  selectedMainRecipeId: string
  savedAt: string
  mainRecipe: RecipeManagerState['mainRecipes'][number] | null
  blackeningRecipe: RecipeManagerState['blackeningRecipes'][number] | null
  machiningRecipe: ProcessRecipeWithFormulaDetails<MachiningProcessRecipe> | null
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

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

function writeLocalStorageJson(key: string, value: unknown): void {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

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

  const loadRecipeState = async (): Promise<SettingsSaveResult<RecipeManagerState>> => {
    const cached = readStateFromLocalStorage()
    if (cached) {
      recipeState.value = cached
      persistStateToLocalStorage(recipeState.value)
      return createSettingsSaveResult('已从本地存储加载配方管理数据。', recipeState.value)
    }

    persistStateToLocalStorage(recipeState.value)
    return createSettingsSaveResult('未找到有效本地配方数据，已加载默认配方配置。', recipeState.value)
  }

  const saveRecipeState = async (
    payload: RecipeManagerState
  ): Promise<SettingsSaveResult<RecipeManagerState>> => {
    recipeState.value = cloneSettings(payload)
    persistStateToLocalStorage(recipeState.value)
    return createSettingsSaveResult('配方管理数据已保存到本地存储。', recipeState.value)
  }

  const selectMainRecipe = (id: string): void => {
    recipeState.value.selectedMainRecipeId = id
  }

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

  const removeMainRecipe = (id: string): void => {
    recipeState.value.mainRecipes = recipeState.value.mainRecipes.filter((recipe) => recipe.id !== id)
    if (recipeState.value.selectedMainRecipeId === id) {
      recipeState.value.selectedMainRecipeId = recipeState.value.mainRecipes[0]?.id ?? ''
    }
  }

  const addLaserPowerRecipe = (): void => {
    const sequence = getNextSequence(recipeState.value.laserPowerRecipes, 'laser-power')
    recipeState.value.laserPowerRecipes.push(createLaserPowerRecipe(sequence))
  }

  const removeLaserPowerRecipe = (id: string): void => {
    recipeState.value.laserPowerRecipes = recipeState.value.laserPowerRecipes.filter(
      (recipe) => recipe.id !== id
    )
  }

  const addBlackeningRecipe = (): void => {
    const fallback = recipeState.value.laserPowerRecipes[0]?.id
    if (!fallback) {
      return
    }
    const sequence = getNextSequence(recipeState.value.blackeningRecipes, 'blackening')
    recipeState.value.blackeningRecipes.push(createBlackeningRecipe(sequence, fallback))
  }

  const removeBlackeningRecipe = (id: string): void => {
    recipeState.value.blackeningRecipes = recipeState.value.blackeningRecipes.filter(
      (recipe) => recipe.id !== id
    )
  }

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

  const removeMachiningRecipe = (id: string): void => {
    recipeState.value.machiningRecipes = recipeState.value.machiningRecipes.filter(
      (recipe) => recipe.id !== id
    )
  }

  const addHorizontalFormulaRecipe = (): void => {
    const sequence = getNextSequence(recipeState.value.horizontalFormulaRecipes, 'horizontal-formula')
    recipeState.value.horizontalFormulaRecipes.push(createHorizontalFormulaRecipe(sequence))
  }

  const removeHorizontalFormulaRecipe = (id: string): void => {
    recipeState.value.horizontalFormulaRecipes = recipeState.value.horizontalFormulaRecipes.filter(
      (recipe) => recipe.id !== id
    )
  }

  const addVerticalFormulaRecipe = (): void => {
    const sequence = getNextSequence(recipeState.value.verticalFormulaRecipes, 'vertical-formula')
    recipeState.value.verticalFormulaRecipes.push(createVerticalFormulaRecipe(sequence))
  }

  const removeVerticalFormulaRecipe = (id: string): void => {
    recipeState.value.verticalFormulaRecipes = recipeState.value.verticalFormulaRecipes.filter(
      (recipe) => recipe.id !== id
    )
  }

  watch(
    recipeState,
    (state) => {
      persistStateToLocalStorage(state)
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
