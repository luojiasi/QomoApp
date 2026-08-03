import type { FreeParamTaskRow } from './types'
import type { RecipeStatePayload } from '../recipe'

interface ApiCallResult<T = unknown> {
  success: boolean
  message?: string
  data?: T
  [key: string]: unknown
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
    rInterval: number
    rCompensation: number
    pointXy?: string
    slotIndex?: number | null
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

/** 将当前目标任务行下发到十工位自由编辑切割接口。 */
export const sendTenPlusFreeParams = (payload: TenPlusFreeParamPayload) =>
  apiCall<{ task_count?: number }>('startProgram/tenPlusEntitiesEditParams', 'POST', payload)

/** 从目标级字段组装后端行 payload（对齐 FrontEnd FreeParamDialog）。 */
export function buildTenPlusRowsFromTarget(
  rows: FreeParamTaskRow[],
  opts: { rInterval: number; rCompensation: number; pointXy?: string; slotIndex?: number | null }
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
    rInterval: opts.rInterval,
    rCompensation: opts.rCompensation,
    pointXy: opts.pointXy,
    slotIndex: opts.slotIndex
  }))
}
