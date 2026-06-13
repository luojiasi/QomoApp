// =============================================================================
// Motion 模块 API — 后端 /api/motion/* 端点
// =============================================================================

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
  body?: unknown,
  queryParams?: Record<string, string | number | boolean | null | undefined>
): Promise<ApiCallResult<T>> {
  const base = getApiBase()
  let url = base ? `${base}/api/${endpoint.replace(/^\/+/, '')}` : `/api/${endpoint.replace(/^\/+/, '')}`

  if (method === 'GET' && queryParams) {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== null && v !== undefined) sp.append(k, String(v))
    }
    const qs = sp.toString()
    if (qs) url += `?${qs}`
  }

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
    return { success: false, message: `网络错误: ${msg}` }
  }
}

// Connect
export const connectMotion = (ip: string) =>
  apiCall('motion/connect', 'POST', { ip })

export const disconnectMotion = () =>
  apiCall('motion/disconnect', 'POST')

// Home
export const homeAxes = (axes?: string[]) =>
  apiCall('motion/home', 'POST', { axes })

// Jog
export const jogAxis = (axis: string, direction: number, speed?: number) =>
  apiCall('motion/jog', 'POST', { axis, direction, speed })

export const jogStop = (axis: string) =>
  apiCall('motion/jog/stop', 'POST', { axis })

// Move
export const moveAbs = (axis: string, position: number, speed?: number) =>
  apiCall('motion/move/abs', 'POST', { axis, position, speed })

export const moveRel = (axis: string, position: number, speed?: number) =>
  apiCall('motion/move/rel', 'POST', { axis, position, speed })

// Emergency
export const estop = () =>
  apiCall('motion/estop', 'POST')

export const pause = () =>
  apiCall('motion/pause', 'POST')

export const resume = () =>
  apiCall('motion/resume', 'POST')

export const stop = () =>
  apiCall('motion/stop', 'POST')

// IO
export const setIoOutput = (io: number, value: boolean) =>
  apiCall('motion/io/output', 'POST', { io, value })

export const getIoOutput = (io: number) =>
  apiCall<boolean>(`motion/io/output/${io}`, 'GET')

export const getIoOutputs = (start = 0, end = 8) =>
  apiCall<Record<string, boolean>>('motion/io/output', 'GET', null, { start, end })

export const getIoInput = (io: number) =>
  apiCall<boolean>(`motion/io/input/${io}`, 'GET')

export const getIoInputs = (start = 0, end = 8) =>
  apiCall<Record<string, boolean>>('motion/io/input', 'GET', null, { start, end })
