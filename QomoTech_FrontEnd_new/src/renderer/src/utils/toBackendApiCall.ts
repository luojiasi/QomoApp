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

  // 手机浏览器通过 http(s) 访问时，统一走同源 /api。
  // Electron 生产环境改为 loadFile 后，这里会落到 file:// 分支并直连本机 127.0.0.1:5000。
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

export const getBackendWsBaseUrl = () => {
  const baseUrl = getBackendBaseUrl()

  if (!baseUrl) {
    if (typeof window === 'undefined') return ''
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}`
  }

  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace(/^https:\/\//, 'wss://')
  }

  if (baseUrl.startsWith('http://')) {
    return baseUrl.replace(/^http:\/\//, 'ws://')
  }

  return baseUrl
}
export const getMotionStatusWsUrl = () => {
  const baseUrl = getBackendWsBaseUrl()
  return baseUrl ? `${baseUrl}/ws/motion/status` : '/ws/motion/status'
}













// API调用函数
// 全局 API 调用工具
export const apiCall = async <T = any>(endpoint: string,method: HttpMethod = 'GET',data: ApiPayload = null,queryParams: ApiQueryParams = null): Promise<ApiCallResult<T>> => {
    const url = method === 'GET' ? withApiQuery(endpoint, queryParams) : getBackendApiUrl(endpoint)
    // if (data) console.log('请求数据:', data)
    // if (queryParams) console.log('查询参数:', queryParams)
    
    try {
      const headers: Record<string, string> = {}
      if (data) headers['Content-Type'] = 'application/json'
      const response = await fetch(url, {method,headers,body: data ? JSON.stringify(data) : undefined})
      // console.log(`响应状态: ${response.status} ${response.statusText}`)
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || ''
        let errorBody: any = null
        try {
          errorBody = contentType.includes('application/json') ? await response.json() : await response.text()
        } catch {
          errorBody = null
        }
        console.error(`❌ HTTP错误: ${response.status} ${response.statusText}`, errorBody)
        const detailText =
          typeof errorBody === 'string'
            ? errorBody
            : errorBody && typeof errorBody === 'object'
              ? JSON.stringify(errorBody)
              : ''
        return { success: false, message: `HTTP错误: ${response.status} ${response.statusText}${detailText ? ` | ${detailText}` : ''}` }
      }
      const contentType = response.headers.get('content-type') || ''
      const result = contentType.includes('application/json')
        ? await response.json()
        : ({success: true,data: (await response.text()) as unknown as T} satisfies ApiCallResult<T>)
      // console.log(`响应数据:`, result)
      return result
    } catch (error: any) {
      console.error(`❌ API调用失败 (${endpoint}):`, error)
      return { success: false, message: `网络错误: ${error.message}` }
    }
  }
  