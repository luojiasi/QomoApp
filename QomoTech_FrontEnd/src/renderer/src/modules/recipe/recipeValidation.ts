import type {MachiningProcessRecipe,ProcessFormulaRecipe,RecipeManagerState,RecipeRecordBase,VerticalProcessFormulaRecipe} from './recipeTypes'
import {RECIPE_LIBRARY_CARD_TYPE_KEYS,createDefaultLibraryKeywords} from './recipeTypes'
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
    typeof value.name === 'string' &&
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
  if (typeof value.speed !== 'number' || typeof value.cutTimes !== 'number') return false
  if (!isLinearFormulaCoefficients(value.change)) return false
  // cutSpeedNums 在类型中为可选字段
  if (value.cutSpeedNums !== undefined && typeof value.cutSpeedNums !== 'number') return false
  return true
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
    typeof value.name === 'string' &&
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

  // 旧版嵌套结构：{ id, name, updatedAt, formula: {...} }
  const id = raw.id
  const name = raw.name
  const updatedAt = raw.updatedAt
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    return null
  }

  const formula = raw.formula

  if (isVerticalFormulaData(formula)) {
    return { id, name, updatedAt, ...(formula as Record<string, unknown>) } as VerticalProcessFormulaRecipe
  }
  if (isProcessFormulaData(formula)) {
    return { id, name, updatedAt, ...createDefaultVerticalProcessFormula() }
  }
  return null
}

function _normalizeFail(reason: string, detail?: unknown): null {
  console.warn('[recipe-validation] normalizeRecipeState 失败:', reason, detail)
  return null
}

/** 校验快照结构；垂直工艺配方若为旧版水平结构会迁移为新版 VerticalProcessFormulaRecipe。 */
export function normalizeRecipeState(raw: unknown): RecipeManagerState | null {
  if (!isObject(raw)) return _normalizeFail('raw 不是对象', typeof raw)

  const p = raw as Partial<RecipeManagerState>

  const missingArray = (
    !Array.isArray(p.mainRecipes) ? 'mainRecipes' :
    !Array.isArray(p.laserPowerRecipes) ? 'laserPowerRecipes' :
    !Array.isArray(p.blackeningRecipes) ? 'blackeningRecipes' :
    !Array.isArray(p.horizontalFormulaRecipes) ? 'horizontalFormulaRecipes' :
    !Array.isArray(p.verticalFormulaRecipes) ? 'verticalFormulaRecipes' :
    !Array.isArray(p.machiningRecipes) ? 'machiningRecipes' :
    null
  )
  if (missingArray) return _normalizeFail(`缺少数组字段: ${missingArray}`)

  if (typeof p.selectedMainRecipeId !== 'string') return _normalizeFail('selectedMainRecipeId 不是 string', typeof p.selectedMainRecipeId)
  if (!isObject(p.filter)) return _normalizeFail('filter 不是对象', typeof p.filter)

  const filter = p.filter as Record<string, unknown>
  if (typeof filter.keyword !== 'string') return _normalizeFail('filter.keyword 不是 string', typeof filter.keyword)
  const rs = filter.recipeStatus
  if (rs !== 'all' && rs !== 'draft' && rs !== 'active' && rs !== 'archived') return _normalizeFail('recipeStatus 无效', rs)

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

  for (let i = 0; i < p.laserPowerRecipes!.length; i++) {
    if (!isObject(p.laserPowerRecipes![i])) return _normalizeFail(`laserPowerRecipes[${i}] 不是对象`)
  }

  for (let i = 0; i < p.horizontalFormulaRecipes!.length; i++) {
    if (!isProcessFormulaRecipe(p.horizontalFormulaRecipes![i])) return _normalizeFail(`horizontalFormulaRecipes[${i}] 校验失败`, JSON.stringify(p.horizontalFormulaRecipes![i]).slice(0, 200))
  }

  const migratedVertical: VerticalProcessFormulaRecipe[] = []
  for (let i = 0; i < p.verticalFormulaRecipes!.length; i++) {
    const migrated = migrateVerticalFormulaRecipeRecord(p.verticalFormulaRecipes![i])
    if (!migrated) return _normalizeFail(`verticalFormulaRecipes[${i}] 校验失败`, JSON.stringify(p.verticalFormulaRecipes![i]).slice(0, 600))
    migratedVertical.push(migrated)
  }
  ;(p as { verticalFormulaRecipes: VerticalProcessFormulaRecipe[] }).verticalFormulaRecipes = migratedVertical

  for (let i = 0; i < p.blackeningRecipes!.length; i++) {
    if (!isObject(p.blackeningRecipes![i])) return _normalizeFail(`blackeningRecipes[${i}] 不是对象`)
    if (typeof (p.blackeningRecipes![i] as { laserPowerRecipeId?: unknown }).laserPowerRecipeId !== 'string') return _normalizeFail(`blackeningRecipes[${i}] 缺少 laserPowerRecipeId`)
    if (typeof (p.blackeningRecipes![i] as { enabled?: unknown }).enabled !== 'boolean') return _normalizeFail(`blackeningRecipes[${i}] enabled 不是 boolean`)
  }

  for (let i = 0; i < p.machiningRecipes!.length; i++) {
    if (!isObject(p.machiningRecipes![i])) return _normalizeFail(`machiningRecipes[${i}] 不是对象`)
    const m = p.machiningRecipes![i] as Partial<MachiningProcessRecipe>
    if (typeof m.horizontalFormulaId !== 'string') return _normalizeFail(`machiningRecipes[${i}] 缺少 horizontalFormulaId`)
    if (typeof m.verticalFormulaId !== 'string') return _normalizeFail(`machiningRecipes[${i}] 缺少 verticalFormulaId`)
    if (typeof m.laserPowerRecipeId !== 'string') return _normalizeFail(`machiningRecipes[${i}] 缺少 laserPowerRecipeId`)
  }

  return cloneSettings(p as RecipeManagerState)
}
