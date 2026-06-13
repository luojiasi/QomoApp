// =============================================================================
// Serial 模块 API — 后端 HTTP 通讯端点
// =============================================================================

import type {
  Rs232PortInfo,
  Rs232SendRequest,
  Rs232SerialSessionRequest
} from './types'

function getApiBase(): string {
  if (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    return ''
  }
  const port = '5000'
  return `http://127.0.0.1:${port}`
}

function buildUrl(endpoint: string): string {
  const base = getApiBase()
  return base ? `${base}/api/${endpoint.replace(/^\/+/, '')}` : `/api/${endpoint.replace(/^\/+/, '')}`
}

interface ApiCallResult<T = unknown> {
  success: boolean
  message?: string
  data?: T
  [key: string]: unknown
}

async function apiCall<T = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  queryParams?: Record<string, string | number | boolean | null | undefined>
): Promise<ApiCallResult<T>> {
  let url = buildUrl(endpoint)
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
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
    if (!res.ok) {
      const ct = res.headers.get('content-type') ?? ''
      let detail = ''
      try {
        detail = ct.includes('application/json') ? JSON.stringify(await res.json()) : await res.text()
      } catch { /* ignore */ }
      return { success: false, message: `HTTP ${res.status} ${res.statusText}${detail ? ` | ${detail}` : ''}` }
    }
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      return await res.json()
    }
    return { success: true, data: await res.text() as unknown as T }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `网络错误: ${msg}` }
  }
}

// ─── RS232 ───

export const fetchRs232Ports = () =>
  apiCall<{ ports: Rs232PortInfo[] }>('rs232/ports', 'GET')

export const openRs232 = (payload: Rs232SerialSessionRequest) =>
  apiCall<{ connected?: boolean; portName?: string | null }>('rs232/open', 'POST', payload)

export const closeRs232 = () =>
  apiCall<{ connected?: boolean }>('rs232/close', 'POST')

export const sendRs232 = (payload: Rs232SendRequest) =>
  apiCall<{ timestamp?: string }>('rs232/send', 'POST', payload)

export const fetchRs232Buffer = (clear = false) =>
  apiCall<{ text: string }>('rs232/buffer', 'GET', null, { clear })
