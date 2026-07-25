import type { RecipeStatePayload, MainRecipe } from './types'
import type { RecipeChainNode, RecipeChainKind } from './chainTypes'

function nameOf(item: { id: string; name?: string } | undefined, fallbackId: string): string {
  if (!item) return ''
  return (item.name && item.name.trim()) || item.id || fallbackId
}

function findById<T extends { id: string }>(list: T[] | undefined, id: string): T | undefined {
  return list?.find((x) => x.id === id)
}

export function buildRecipeChain(
  state: RecipeStatePayload,
  main: MainRecipe | undefined
): RecipeChainNode[] {
  if (!main) return []
  const nodes: RecipeChainNode[] = [
    { kind: 'main', id: main.id, label: main.name, depth: 0, missing: false }
  ]

  const bId = main.blackeningRecipeId || ''
  const b = bId ? findById(state.blackeningRecipes, bId) : undefined
  nodes.push({
    kind: 'blackening',
    id: bId,
    label: nameOf(b, bId),
    depth: 1,
    missing: !bId || !b
  })

  const mId = main.machiningRecipeId || ''
  const m = mId ? findById(state.machiningRecipes, mId) : undefined
  nodes.push({
    kind: 'machining',
    id: mId,
    label: nameOf(m, mId),
    depth: 1,
    missing: !mId || !m
  })

  const laserId = m?.laserPowerRecipeId || ''
  const laser = laserId ? findById(state.laserPowerRecipes, laserId) : undefined
  nodes.push({
    kind: 'laser',
    id: laserId,
    label: nameOf(laser, laserId),
    depth: 2,
    missing: !m || !laserId || !laser
  })

  const hId = m?.horizontalFormulaId || ''
  const h = hId ? findById(state.horizontalFormulaRecipes, hId) : undefined
  nodes.push({
    kind: 'horizontal',
    id: hId,
    label: nameOf(h, hId),
    depth: 2,
    missing: !m || !hId || !h
  })

  const vId = m?.verticalFormulaId || ''
  const v = vId ? findById(state.verticalFormulaRecipes, vId) : undefined
  nodes.push({
    kind: 'vertical',
    id: vId,
    label: nameOf(v, vId),
    depth: 2,
    missing: !m || !vId || !v
  })

  return nodes
}

export function chainIndexOf(nodes: RecipeChainNode[], kind: RecipeChainKind, id: string): number {
  return nodes.findIndex((n) => n.kind === kind && n.id === id)
}

/** delta: -1 上一步 / +1 下一步；越界返回原 index */
export function chainStep(nodes: RecipeChainNode[], index: number, delta: -1 | 1): number {
  if (nodes.length === 0) return -1
  const next = index + delta
  if (next < 0 || next >= nodes.length) return index
  return next
}

export interface RecipeReferrer {
  listKey: 'mainRecipes' | 'machiningRecipes' | 'blackeningRecipes'
  id: string
  name: string
  field: string
}

export function findRecipeReferrers(
  state: RecipeStatePayload,
  target: { listKey: string; id: string }
): RecipeReferrer[] {
  const out: RecipeReferrer[] = []
  const { listKey, id } = target
  if (!id) return out

  if (listKey === 'blackeningRecipes') {
    for (const m of state.mainRecipes ?? []) {
      if (m.blackeningRecipeId === id) {
        out.push({ listKey: 'mainRecipes', id: m.id, name: m.name, field: 'blackeningRecipeId' })
      }
    }
  }
  if (listKey === 'machiningRecipes') {
    for (const m of state.mainRecipes ?? []) {
      if (m.machiningRecipeId === id) {
        out.push({ listKey: 'mainRecipes', id: m.id, name: m.name, field: 'machiningRecipeId' })
      }
    }
  }
  if (listKey === 'laserPowerRecipes' || listKey === 'horizontalFormulaRecipes' || listKey === 'verticalFormulaRecipes') {
    const field =
      listKey === 'laserPowerRecipes'
        ? 'laserPowerRecipeId'
        : listKey === 'horizontalFormulaRecipes'
          ? 'horizontalFormulaId'
          : 'verticalFormulaId'
    for (const mach of state.machiningRecipes ?? []) {
      if ((mach as unknown as Record<string, string>)[field] === id) {
        out.push({
          listKey: 'machiningRecipes',
          id: mach.id,
          name: mach.name || mach.id,
          field
        })
      }
    }
    if (listKey === 'laserPowerRecipes') {
      for (const b of state.blackeningRecipes ?? []) {
        if (b.laserPowerRecipeId === id) {
          out.push({
            listKey: 'blackeningRecipes',
            id: b.id,
            name: b.name || b.id,
            field: 'laserPowerRecipeId'
          })
        }
      }
    }
  }
  return out
}
