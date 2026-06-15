// =============================================================================
// Camera 模块 API — 后端 /api/camera/* 端点
// =============================================================================

import type {
  CameraDeviceInfo,
  CameraStatusPayload,
  CameraExposurePayload,
  CameraFrameSpeedPayload,
  CameraMirrorPayload,
  CameraWhiteBalancePayload,
  CameraBootstrapSettingsPayload
} from './types'

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
    return { success: false, message: `Network error: ${msg}` }
  }
}

// Settings persistence
export const getCameraSettings = () =>
  apiCall<Record<string, unknown> | null>('camera/settings', 'GET')

export const saveCameraSettings = (payload: Record<string, unknown>) =>
  apiCall('camera/settings', 'POST', payload)

// Device management
export const fetchCameraDevices = () =>
  apiCall<{ devices: CameraDeviceInfo[] }>('camera/devices', 'GET')

export const connectCamera = async (index: number) => {
  const res = await apiCall<CameraStatusPayload>('camera/connect', 'POST', { index })
  if (!res.success) return res
  return getCameraStatus()
}

export const disconnectCamera = async () => {
  const res = await apiCall('camera/disconnect', 'POST')
  if (!res.success) return res
  return getCameraStatus()
}

export const getCameraStatus = () =>
  apiCall<CameraStatusPayload>('camera/status', 'GET')

// Parameter control
export const setCameraExposure = async (payload: CameraExposurePayload) => {
  const res = await apiCall('camera/params/exposure', 'POST', payload)
  if (!res.success) return res
  return getCameraStatus()
}

export const setCameraFrameSpeed = async (payload: CameraFrameSpeedPayload) => {
  const res = await apiCall('camera/params/frame-speed', 'POST', payload)
  if (!res.success) return res
  return getCameraStatus()
}

export const setCameraMirror = async (payload: CameraMirrorPayload) => {
  const res = await apiCall('camera/params/mirror', 'POST', payload)
  if (!res.success) return res
  return getCameraStatus()
}

export const setCameraWhiteBalance = async (payload: CameraWhiteBalancePayload) => {
  const res = await apiCall('camera/params/white-balance', 'POST', payload)
  if (!res.success) return res
  return getCameraStatus()
}

export const bootstrapCameraSettings = async (payload: CameraBootstrapSettingsPayload) => {
  const res = await apiCall('camera/bootstrap-settings', 'POST', payload)
  if (!res.success) return res
  return getCameraStatus()
}
