import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  createBlackeningRecipe,
  createCleaningRecipe,
  createDefaultVerticalProcessFormula,
  createHorizontalFormulaRecipe,
  createLaserPowerRecipe,
  createMainRecipe,
  createMachiningRecipe,
  createVerticalFormulaRecipe,
  defaultRecipeManagerState
} from '../configs/settings'
import type {
  CleaningProcessRecipe,
  LaserPowerRecipe,
  MachiningProcessRecipe,
  ProcessFormulaRecipe,
  RecipeManagerState,
  SettingsSaveResult,
  SharedFormulaRecipe,
  VerticalFormulaRecipe,
  VerticalProcessFormulaRecipe
} from '../types/settings'
import {
  RECIPE_LIBRARY_CARD_TYPE_KEYS,
  createDefaultLibraryKeywords
} from '../types/recipeSettings'
import { cloneSettings } from '../utils/settings'
import { createSettingsSaveResult } from './settingsStoreUtils'

function getNextSequence(items: { id: string }[], prefix: string): number {
  return (
    items.reduce((max, item) => {
      const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`))
      return match ? Math.max(max, Number(match[1])) : max
    }, 0) + 1
  )
}

const RECIPE_STORAGE_KEYS = {
  mainRecipes: 'qomotech.recipe.main-recipes',
  laserPowerRecipes: 'qomotech.recipe.laser-power-recipes',
  blackeningRecipes: 'qomotech.recipe.blackening-recipes',
  horizontalFormulaRecipes: 'qomotech.recipe.horizontal-formula-recipes',
  verticalFormulaRecipes: 'qomotech.recipe.vertical-formula-recipes',
  machiningRecipes: 'qomotech.recipe.machining-recipes',
  cleaningRecipes: 'qomotech.recipe.cleaning-recipes',
  mainRecipeDetails: 'qomotech.recipe.main-recipe-details',
  selectedMainRecipeId: 'qomotech.recipe.selected-main-recipe-id',
  filter: 'qomotech.recipe.filter'
} as const

type ProcessRecipeWithFormulaDetails<T extends MachiningProcessRecipe | CleaningProcessRecipe> = T & {
  horizontalFormulaRecipe: SharedFormulaRecipe | null
  verticalFormulaRecipe: VerticalFormulaRecipe | null
}

interface MainRecipeDetailsStorage {
  selectedMainRecipeId: string
  savedAt: string
  mainRecipe: RecipeManagerState['mainRecipes'][number] | null
  blackeningRecipe: RecipeManagerState['blackeningRecipes'][number] | null
  machiningRecipe: ProcessRecipeWithFormulaDetails<MachiningProcessRecipe> | null
  cleaningRecipe: ProcessRecipeWithFormulaDetails<CleaningProcessRecipe> | null
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
    window.localStorage.getItem(RECIPE_STORAGE_KEYS.machiningRecipes) !== null ||
    window.localStorage.getItem(RECIPE_STORAGE_KEYS.cleaningRecipes) !== null
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
    cleaningRecipes:
      readLocalStorageJson<RecipeManagerState['cleaningRecipes']>(RECIPE_STORAGE_KEYS.cleaningRecipes) ??
      defaultRecipeManagerState.cleaningRecipes,
    selectedMainRecipeId:
      readLocalStorageJson<RecipeManagerState['selectedMainRecipeId']>(
        RECIPE_STORAGE_KEYS.selectedMainRecipeId
      ) ?? defaultRecipeManagerState.selectedMainRecipeId,
    filter:
      readLocalStorageJson<RecipeManagerState['filter']>(RECIPE_STORAGE_KEYS.filter) ??
      defaultRecipeManagerState.filter
  })
}

function persistStateToLocalStorage(state: RecipeManagerState): void {
  if (!canUseLocalStorage()) return

  writeLocalStorageJson(RECIPE_STORAGE_KEYS.mainRecipes, state.mainRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.laserPowerRecipes, state.laserPowerRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.blackeningRecipes, state.blackeningRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.horizontalFormulaRecipes, state.horizontalFormulaRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.verticalFormulaRecipes, state.verticalFormulaRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.machiningRecipes, state.machiningRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.cleaningRecipes, state.cleaningRecipes)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.mainRecipeDetails, buildMainRecipeDetailsStorage(state))
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.selectedMainRecipeId, state.selectedMainRecipeId)
  writeLocalStorageJson(RECIPE_STORAGE_KEYS.filter, state.filter)
}

function buildMainRecipeDetailsStorage(state: RecipeManagerState): MainRecipeDetailsStorage {
  const mainRecipe =
    state.mainRecipes.find((recipe) => recipe.id === state.selectedMainRecipeId) ??
    state.mainRecipes[0] ??
    null

  const blackeningRecipe =
    state.blackeningRecipes.find((recipe) => recipe.id === mainRecipe?.blackeningRecipeId) ?? null
  const machiningRecipe = state.machiningRecipes.find((recipe) => recipe.id === mainRecipe?.machiningRecipeId)
  const cleaningRecipe = state.cleaningRecipes.find((recipe) => recipe.id === mainRecipe?.cleaningRecipeId)

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

  const cleaningDetails = cleaningRecipe
    ? {
        ...cleaningRecipe,
        horizontalFormulaRecipe:
          state.horizontalFormulaRecipes.find((recipe) => recipe.id === cleaningRecipe.horizontalFormulaId) ??
          null,
        verticalFormulaRecipe:
          state.verticalFormulaRecipes.find((recipe) => recipe.id === cleaningRecipe.verticalFormulaId) ??
          null
      }
    : null

  return {
    selectedMainRecipeId: state.selectedMainRecipeId,
    savedAt: new Date().toISOString(),
    mainRecipe,
    blackeningRecipe,
    machiningRecipe: machiningDetails,
    cleaningRecipe: cleaningDetails
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLaserTransmissionMode(value: unknown): value is LaserPowerRecipe['transmissionMode'] {
  return value === '网线' || value === 'RS232'
}

function isLinearFormulaCoefficients(value: unknown): value is ProcessFormulaRecipe['angleFormula'] {
  if (!isObject(value)) return false
  return typeof value.k === 'number' && typeof value.b === 'number'
}

function isProcessFormulaRecipe(value: unknown): value is ProcessFormulaRecipe {
  if (!isObject(value)) return false

  return (
    typeof value.name === 'string' &&
    (value.openingShape === 'V型' || value.openingShape === '||型' || value.openingShape === '//型') &&
    isLinearFormulaCoefficients(value.angleFormula) &&
    isLinearFormulaCoefficients(value.lowerOpeningFormula) &&
    isLinearFormulaCoefficients(value.depthCompensationFormula) &&
    typeof value.upperOpeningFormula === 'string' &&
    isLinearFormulaCoefficients(value.compensationAngleFormula) &&
    typeof value.focusCompensation === 'number'
  )
}

function isVerticalEdgeOrMiddleCutting(value: unknown): value is VerticalProcessFormulaRecipe['edgeCutting'] {
  if (!isObject(value)) return false
  return (
    typeof value.speed === 'number' &&
    typeof value.cutTimes === 'number' &&
    isLinearFormulaCoefficients(value.change)
  )
}

function isVerticalDescentCutting(value: unknown): value is VerticalProcessFormulaRecipe['descentCutting'] {
  if (!isObject(value)) return false
  return typeof value.speed === 'number' && typeof value.zFeed === 'number' && isLinearFormulaCoefficients(value.change)
}

function isVerticalProcessFormulaRecipe(value: unknown): value is VerticalProcessFormulaRecipe {
  if (!isObject(value)) return false
  return (
    (value.cuttingAxis === 'XY' || value.cuttingAxis === 'R') &&
    typeof value.changePercent === 'number' &&
    typeof value.xFeed === 'number' &&
    typeof value.xSpeed === 'number' &&
    isVerticalEdgeOrMiddleCutting(value.edgeCutting) &&
    isVerticalEdgeOrMiddleCutting(value.middleCutting) &&
    isVerticalDescentCutting(value.descentCutting)
  )
}

function migrateVerticalFormulaRecipeRecord(raw: unknown): VerticalFormulaRecipe | null {
  if (!isObject(raw)) return null
  const id = raw.id
  const code = raw.code
  const name = raw.name
  const notes = raw.notes
  const updatedAt = raw.updatedAt
  const formula = raw.formula
  if (
    typeof id !== 'string' ||
    typeof code !== 'string' ||
    typeof name !== 'string' ||
    typeof notes !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    return null
  }
  if (isVerticalProcessFormulaRecipe(formula)) {
    return { id, code, name, notes, updatedAt, formula }
  }
  if (isProcessFormulaRecipe(formula)) {
    return { id, code, name, notes, updatedAt, formula: createDefaultVerticalProcessFormula() }
  }
  return null
}

/** 校验快照结构；垂直工艺配方若为旧版水平结构（ProcessFormulaRecipe）会迁移为新版 VerticalProcessFormulaRecipe。 */
function normalizeRecipeState(raw: unknown): RecipeManagerState | null {
  if (!isObject(raw)) return null

  const p = raw as Partial<RecipeManagerState>

  if (
    !Array.isArray(p.mainRecipes) ||
    !Array.isArray(p.laserPowerRecipes) ||
    !Array.isArray(p.blackeningRecipes) ||
    !Array.isArray(p.horizontalFormulaRecipes) ||
    !Array.isArray(p.verticalFormulaRecipes) ||
    !Array.isArray(p.machiningRecipes) ||
    !Array.isArray(p.cleaningRecipes)
  ) {
    return null
  }

  if (typeof p.selectedMainRecipeId !== 'string' || !isObject(p.filter)) {
    return null
  }

  const filter = p.filter as Record<string, unknown>
  if (typeof filter.keyword !== 'string') {
    return null
  }
  const rs = filter.recipeStatus
  if (rs !== 'all' && rs !== 'draft' && rs !== 'active' && rs !== 'archived') {
    return null
  }

  const libraryKeywords = createDefaultLibraryKeywords()
  if (isObject(filter.libraryKeywords)) {
    const lk = filter.libraryKeywords as Record<string, unknown>
    for (const key of RECIPE_LIBRARY_CARD_TYPE_KEYS) {
      if (typeof lk[key] === 'string') {
        libraryKeywords[key] = lk[key]
      }
    }
  }
  ;(p as { filter: RecipeManagerState['filter'] }).filter = {
    keyword: filter.keyword as string,
    recipeStatus: rs,
    libraryKeywords
  }

  for (const r of p.laserPowerRecipes) {
    if (!isObject(r)) return null
    if (!isLaserTransmissionMode((r as LaserPowerRecipe).transmissionMode)) return null
  }

  for (const r of p.horizontalFormulaRecipes) {
    if (!isObject(r)) return null
    if (!isProcessFormulaRecipe((r as SharedFormulaRecipe).formula)) return null
  }

  const migratedVertical: VerticalFormulaRecipe[] = []
  for (const r of p.verticalFormulaRecipes) {
    const migrated = migrateVerticalFormulaRecipeRecord(r)
    if (!migrated) return null
    migratedVertical.push(migrated)
  }
  ;(p as { verticalFormulaRecipes: VerticalFormulaRecipe[] }).verticalFormulaRecipes = migratedVertical

  for (const r of p.blackeningRecipes) {
    if (!isObject(r)) return null
    if (typeof (r as { laserPowerRecipeId?: unknown }).laserPowerRecipeId !== 'string') return null
    if (typeof (r as { enabled?: unknown }).enabled !== 'boolean') return null
  }

  for (const r of p.machiningRecipes) {
    if (!isObject(r)) return null
    const m = r as Partial<MachiningProcessRecipe>
    if (typeof m.horizontalFormulaId !== 'string') return null
    if (typeof m.verticalFormulaId !== 'string') return null
    if (typeof m.laserPowerRecipeId !== 'string') return null
  }

  for (const r of p.cleaningRecipes) {
    if (!isObject(r)) return null
    const c = r as Partial<CleaningProcessRecipe>
    if (typeof c.horizontalFormulaId !== 'string') return null
    if (typeof c.verticalFormulaId !== 'string') return null
    if (typeof c.enabled !== 'boolean') return null
  }

  return cloneSettings(p as RecipeManagerState)
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
    const { blackeningRecipes, machiningRecipes, cleaningRecipes, mainRecipes } = recipeState.value
    const blackeningRecipeId = blackeningRecipes[0]?.id
    const machiningRecipeId = machiningRecipes[0]?.id
    const cleaningRecipeId = cleaningRecipes[0]?.id

    if (!blackeningRecipeId || !machiningRecipeId || !cleaningRecipeId) {
      return
    }

    const sequence = getNextSequence(mainRecipes, 'main')
    const recipe = createMainRecipe(sequence, {
      blackeningRecipeId,
      machiningRecipeId,
      cleaningRecipeId
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

  const addCleaningRecipe = (): void => {
    if (
      !recipeState.value.horizontalFormulaRecipes.length ||
      !recipeState.value.verticalFormulaRecipes.length
    ) {
      return
    }
    const sequence = getNextSequence(recipeState.value.cleaningRecipes, 'cleaning')
    recipeState.value.cleaningRecipes.push(
      createCleaningRecipe(sequence, {
        horizontalFormulaId: recipeState.value.horizontalFormulaRecipes[0].id,
        verticalFormulaId: recipeState.value.verticalFormulaRecipes[0].id
      })
    )
  }

  const removeCleaningRecipe = (id: string): void => {
    recipeState.value.cleaningRecipes = recipeState.value.cleaningRecipes.filter(
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
    addCleaningRecipe,
    removeCleaningRecipe,
    addHorizontalFormulaRecipe,
    removeHorizontalFormulaRecipe,
    addVerticalFormulaRecipe,
    removeVerticalFormulaRecipe
  }
})
