/**
 * core/api/httpClient.ts
 *
 * HTTP 客户端基础设施 —— 所有 core/api/* 的唯一 HTTP 依赖。
 * 从 shared/api/httpClient.ts 迁移至 core 层，作为统一的 API 通信底座。
 *
 * 职责：
 *   - 封装 fetch，提供统一的 apiCall() 函数
 *   - 管理后端 base URL（支持 env 变量 / Electron / 浏览器）
 *   - 统一错误格式 { success: boolean, message?: string, data?: T }
 *
 * 注意：getCameraStreamUrl 保留在此处（相机取帧是 HTTP GET 图片流，不是 JSON API）。
 */
const normalizeEndpoint = (endpoint: string) => endpoint.replace(/^\/+/, '')

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type ApiPayload = Record<string, unknown> | unknown[] | null
type ApiQueryParams = Record<string, string | number | boolean | null | undefined> | null

export interface ApiCallResult<T = any> {
  success: boolean
  message?: string
  data?: T
  [key: string]: any
}

const isHttpBrowserRuntime = () => {
  if (typeof window === 'undefined') return false
  return window.location.protocol === 'http:' || window.location.protocol === 'https:'
}

export const getBackendBaseUrl = () => {
  const envBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, '')
  }

  if (isHttpBrowserRuntime()) {
    return ''
  }

  const envPort = import.meta.env.VITE_BACKEND_PORT
  const backendPort = envPort && String(envPort).trim() ? String(envPort).trim() : '5000'
  return `http://127.0.0.1:${backendPort}`
}

export const getBackendApiUrl = (endpoint: string) => {
  const normalizedEndpoint = normalizeEndpoint(endpoint)
  const baseUrl = getBackendBaseUrl()
  return baseUrl ? `${baseUrl}/api/${normalizedEndpoint}` : `/api/${normalizedEndpoint}`
}

const buildQueryString = (queryParams: ApiQueryParams) => {
  if (!queryParams) {
    return ''
  }

  const searchParams = new URLSearchParams()
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value))
    }
  })
  return searchParams.toString()
}

export const withApiQuery = (endpoint: string, queryParams: ApiQueryParams = null) => {
  const url = getBackendApiUrl(endpoint)
  const queryString = buildQueryString(queryParams)
  if (!queryString) {
    return url
  }
  return `${url}?${queryString}`
}

export const getCameraStreamUrl = (queryParams: ApiQueryParams = null) =>
  withApiQuery('camera/frame', queryParams)

export const apiCall = async <T = any>(
  endpoint: string,
  method: HttpMethod = 'GET',
  data: ApiPayload = null,
  queryParams: ApiQueryParams = null
): Promise<ApiCallResult<T>> => {
  const url = method === 'GET' ? withApiQuery(endpoint, queryParams) : getBackendApiUrl(endpoint)

  try {
    const headers: Record<string, string> = {}
    if (data) headers['Content-Type'] = 'application/json'
    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    })
    if (!response.ok) {
      const contentType = response.headers.get('content-type') || ''
      let errorBody: any = null
      try {
        errorBody = contentType.includes('application/json')
          ? await response.json()
          : await response.text()
      } catch {
        errorBody = null
      }
      console.error(`\u274c HTTP\u9519\u8bef: ${response.status} ${response.statusText}`, errorBody)
      const detailText =
        typeof errorBody === 'string'
          ? errorBody
          : errorBody && typeof errorBody === 'object'
            ? JSON.stringify(errorBody)
            : ''
      return {
        success: false,
        message: `HTTP\u9519\u8bef: ${response.status} ${response.statusText}${detailText ? ` | ${detailText}` : ''}`
      }
    }
    const contentType = response.headers.get('content-type') || ''
    const result = contentType.includes('application/json')
      ? await response.json()
      : ({ success: true, data: (await response.text()) as unknown as T } satisfies ApiCallResult<T>)
    return result
  } catch (error: any) {
    console.error(`\u274c API\u8c03\u7528\u5931\u8d25 (${endpoint}):`, error)
    return { success: false, message: `\u7f51\u7edc\u9519\u8bef: ${error.message}` }
  }
}
