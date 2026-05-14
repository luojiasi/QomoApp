import type {
  LaserPowerRecipe,
  MachiningProcessRecipe,
  ProcessFormulaRecipe,
  RecipeManagerState,
  RecipeRecordBase,
  VerticalProcessFormulaRecipe
} from './recipeTypes'
import {
  RECIPE_LIBRARY_CARD_TYPE_KEYS,
  createDefaultLibraryKeywords
} from './recipeTypes'
import { createDefaultVerticalProcessFormula } from './recipeConfig'
import { cloneSettings } from '@/shared/utils/settings'

/** 取自递增前缀（如 'main-1','main-2'…）的下一序号 */
export function getNextSequence(items: { id: string }[], prefix: string): number {
  return (
    items.reduce((max, item) => {
      const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`))
      return match ? Math.max(max, Number(match[1])) : max
    }, 0) + 1
  )
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLinearFormulaCoefficients(value: unknown): value is ProcessFormulaRecipe['angleFormula'] {
  if (!isObject(value)) return false
  return typeof value.k === 'number' && typeof value.b === 'number'
}

function isProcessFormulaRecipe(value: unknown): value is ProcessFormulaRecipe {
  if (!isObject(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    typeof value.notes === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.openingShape === 'V型' || value.openingShape === '//型') &&
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
    typeof value.cutSpeedNums === 'number' &&
    isLinearFormulaCoefficients(value.change)
  )
}

function isVerticalDescentCutting(value: unknown): value is VerticalProcessFormulaRecipe['descentCutting'] {
  if (!isObject(value)) return false
  return (
    typeof value.speed === 'number' &&
    typeof value.zFeed === 'number' &&
    isLinearFormulaCoefficients(value.change)
  )
}

function isVerticalProcessFormulaRecipe(value: unknown): value is VerticalProcessFormulaRecipe {
  if (!isObject(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    typeof value.notes === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.cuttingAxis === 'XY' || value.cuttingAxis === 'R') &&
    typeof value.changePercent === 'number' &&
    typeof value.xFeed === 'number' &&
    typeof value.xSpeed === 'number' &&
    isVerticalEdgeOrMiddleCutting(value.edgeCutting) &&
    isVerticalEdgeOrMiddleCutting(value.middleCutting) &&
    isVerticalDescentCutting(value.descentCutting)
  )
}

type VerticalFormulaPayload = Omit<VerticalProcessFormulaRecipe, keyof RecipeRecordBase>

function isVerticalFormulaData(value: unknown): value is VerticalFormulaPayload {
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

function isProcessFormulaData(value: unknown): boolean {
  if (!isObject(value)) return false
  return (
    typeof value.name === 'string' &&
    (value.openingShape === 'V型' || value.openingShape === '//型') &&
    isLinearFormulaCoefficients(value.angleFormula) &&
    isLinearFormulaCoefficients(value.lowerOpeningFormula) &&
    isLinearFormulaCoefficients(value.depthCompensationFormula) &&
    typeof value.upperOpeningFormula === 'string' &&
    isLinearFormulaCoefficients(value.compensationAngleFormula) &&
    typeof value.focusCompensation === 'number'
  )
}

/** 兼容旧版嵌套结构的垂直工艺配方记录的迁移（展平为 flat 结构） */
function migrateVerticalFormulaRecipeRecord(raw: unknown): VerticalProcessFormulaRecipe | null {
  if (!isObject(raw)) return null

  // 已是 flat 结构（无 formula 嵌套）
  if (!('formula' in raw)) {
    return isVerticalProcessFormulaRecipe(raw) ? raw : null
  }

  // 旧版嵌套结构：{ id, code, name, notes, updatedAt, formula: {...} }
  const id = raw.id
  const code = raw.code
  const name = raw.name
  const notes = raw.notes
  const updatedAt = raw.updatedAt
  if (
    typeof id !== 'string' ||
    typeof code !== 'string' ||
    typeof name !== 'string' ||
    typeof notes !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    return null
  }

  const formula = raw.formula

  if (isVerticalFormulaData(formula)) {
    return { id, code, name, notes, updatedAt, ...(formula as Record<string, unknown>) } as VerticalProcessFormulaRecipe
  }
  if (isProcessFormulaData(formula)) {
    return { id, code, name, notes, updatedAt, ...createDefaultVerticalProcessFormula() }
  }
  return null
}

/** 校验快照结构；垂直工艺配方若为旧版水平结构会迁移为新版 VerticalProcessFormulaRecipe。 */
export function normalizeRecipeState(raw: unknown): RecipeManagerState | null {
  if (!isObject(raw)) return null

  const p = raw as Partial<RecipeManagerState>

  if (
    !Array.isArray(p.mainRecipes) ||
    !Array.isArray(p.laserPowerRecipes) ||
    !Array.isArray(p.blackeningRecipes) ||
    !Array.isArray(p.horizontalFormulaRecipes) ||
    !Array.isArray(p.verticalFormulaRecipes) ||
    !Array.isArray(p.machiningRecipes)
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
    if (typeof (r as LaserPowerRecipe).transmissionMode !== 'string') return null
  }

  for (const r of p.horizontalFormulaRecipes) {
    if (!isProcessFormulaRecipe(r)) return null
  }

  const migratedVertical: VerticalProcessFormulaRecipe[] = []
  for (const r of p.verticalFormulaRecipes) {
    const migrated = migrateVerticalFormulaRecipeRecord(r)
    if (!migrated) return null
    migratedVertical.push(migrated)
  }
  ;(p as { verticalFormulaRecipes: VerticalProcessFormulaRecipe[] }).verticalFormulaRecipes = migratedVertical

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

  return cloneSettings(p as RecipeManagerState)
}
