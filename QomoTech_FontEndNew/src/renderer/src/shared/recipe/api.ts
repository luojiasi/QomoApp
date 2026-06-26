import type { RecipeStatePayload } from './types'

interface ApiCallResult<T = unknown> {
  success: boolean
  message?: string
  data?: T
  [key: string]: unknown
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
  let url = base ? `${base}/api/${endpoint.replace(/^\/+/, '')}` : `/api/${endpoint.replace(/^\/+/, '')}`

  try {
    const headers: Record<string, string> = {}
    if (body) headers['Content-Type'] = 'application/json'
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
    if (!res.ok) {
      const ct = res.headers.get('content-type') ?? ''
      let detail = ''
      try {
        detail = ct.includes('application/json') ? JSON.stringify(await res.json()) : await res.text()
      } catch { /* ignore */ }
      return { success: false, message: `HTTP ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ''}` }
    }
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) return await res.json()
    return { success: true, data: await res.text() as unknown as T }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Network error: ${msg}` }
  }
}

// Recipe state (full tree, like recipe-state.json)
export const getRecipeState = () =>
  apiCall<RecipeStatePayload>('recipe/state', 'GET')

export const saveRecipeState = (payload: RecipeStatePayload) =>
  apiCall('recipe/state', 'POST', payload)
