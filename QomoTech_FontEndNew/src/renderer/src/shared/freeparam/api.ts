import type { FreeParamTarget, FreeParamTaskRow } from './types'
import type { RecipeStatePayload } from '../recipe'

interface ApiCallResult<T = unknown> {
  success: boolean
  message?: string
  data?: T
  [key: string]: unknown
}

export interface TenPlusTargetSummary {
  id: string
  name: string
  slotIndex: number
  pointXy: string
  十轴切割R旋转圈数: number
  十轴切割R旋转补偿值: number
}

export interface TenPlusFreeParamPayload {
  recipes: {
    mainRecipes: RecipeStatePayload['mainRecipes']
    machiningRecipes: RecipeStatePayload['machiningRecipes']
    blackeningRecipes: RecipeStatePayload['blackeningRecipes']
    laserPowerRecipes: RecipeStatePayload['laserPowerRecipes']
    horizontalFormulaRecipes: RecipeStatePayload['horizontalFormulaRecipes']
    verticalFormulaRecipes: RecipeStatePayload['verticalFormulaRecipes']
  }
  /** 勾选并下发的多个目标摘要 */
  targets: TenPlusTargetSummary[]
  rows: Array<{
    taskNo: number
    diameter: number
    angle: number
    height: number
    divisions: number
    recipeId: string
    compX: number
    compY: number
    compZ: number
    compAngle: number
    chordRatio: number
    十轴切割R旋转圈数: number
    十轴切割R旋转补偿值: number
    pointXy?: string
    slotIndex?: number | null
    targetId?: string
    targetName?: string
  }>
}

function getApiBase(): string {
  if (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    return ''
  }
  return 'http://127.0.0.1:5000'
}

async function apiCall<T = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown
): Promise<ApiCallResult<T>> {
  const base = getApiBase()
  const url = base ? `${base}/api/${endpoint.replace(/^\/+/, '')}` : `/api/${endpoint.replace(/^\/+/, '')}`

  try {
    const headers: Record<string, string> = {}
    if (body) headers['Content-Type'] = 'application/json'
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
    if (!res.ok) {
      const ct = res.headers.get('content-type') ?? ''
      let detail = ''
      try {
        detail = ct.includes('application/json') ? JSON.stringify(await res.json()) : await res.text()
      } catch {
        /* ignore */
      }
      return { success: false, message: `HTTP ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ''}` }
    }
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) return await res.json()
    return { success: true, data: (await res.text()) as unknown as T }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Network error: ${msg}` }
  }
}

/** 将勾选目标任务行下发到十工位自由编辑切割接口。 */
export const sendTenPlusFreeParams = (payload: TenPlusFreeParamPayload) =>
  apiCall<{ task_count?: number }>('startProgram/tenPlusEntitiesEditParams', 'POST', payload)

export function toTenPlusTargetSummary(target: FreeParamTarget): TenPlusTargetSummary | null {
  if (target.slotIndex === null || target.slotIndex === undefined) return null
  if (!target.pointXy || !String(target.pointXy).trim()) return null
  return {
    id: target.id,
    name: target.name,
    slotIndex: target.slotIndex,
    pointXy: target.pointXy,
    十轴切割R旋转圈数: target.十轴切割R旋转圈数,
    十轴切割R旋转补偿值: target.十轴切割R旋转补偿值
  }
}

/** 从目标级字段组装后端行 payload。 */
export function buildTenPlusRowsFromTarget(
  rows: FreeParamTaskRow[],
  opts: {
    十轴切割R旋转圈数: number
    十轴切割R旋转补偿值: number
    pointXy?: string
    slotIndex?: number | null
    targetId?: string
    targetName?: string
  }
): TenPlusFreeParamPayload['rows'] {
  return rows.map((row) => ({
    taskNo: row.taskNo,
    diameter: row.diameter,
    angle: row.angle,
    height: row.height,
    divisions: row.divisions,
    recipeId: row.recipe,
    compX: row.compX,
    compY: row.compY,
    compZ: row.compZ,
    compAngle: row.compAngle,
    chordRatio: row.chordRatio,
    十轴切割R旋转圈数: opts.十轴切割R旋转圈数,
    十轴切割R旋转补偿值: opts.十轴切割R旋转补偿值,
    pointXy: opts.pointXy,
    slotIndex: opts.slotIndex,
    targetId: opts.targetId,
    targetName: opts.targetName
  }))
}

/** 多个勾选目标按工位号排序后展平为 rows。 */
export function buildTenPlusRowsFromTargets(selected: FreeParamTarget[]): TenPlusFreeParamPayload['rows'] {
  const ordered = [...selected].sort((a, b) => {
    const sa = a.slotIndex ?? 999
    const sb = b.slotIndex ?? 999
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name)
  })
  const out: TenPlusFreeParamPayload['rows'] = []
  for (const target of ordered) {
    out.push(
      ...buildTenPlusRowsFromTarget(target.rows, {
        十轴切割R旋转圈数: target.十轴切割R旋转圈数,
        十轴切割R旋转补偿值: target.十轴切割R旋转补偿值,
        pointXy: target.pointXy,
        slotIndex: target.slotIndex,
        targetId: target.id,
        targetName: target.name
      })
    )
  }
  return out
}
