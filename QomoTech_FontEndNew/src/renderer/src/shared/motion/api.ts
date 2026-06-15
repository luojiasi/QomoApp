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

// Axis params
export const getMotionPosition = (axis: string) =>
  apiCall<number>(`motion/dpos/${axis}`, 'GET')

export const zeroMotionAxis = (axis: string) =>
  apiCall('motion/axis/zero', 'POST', { axis })

export const setMotionAllAxesParams = (payload: { table: Record<string, Record<string, number>> }) =>
  apiCall('motion/axis/params/batch', 'POST', payload)

// U/R rotation
export const rotateUAxisByAngle = (angle: number, speed: number, direction?: string) =>
  apiCall('motion/u/rotate-by-params', 'POST', { params: { 旋转角度: angle, 旋转速度: speed, 旋转方向: direction } })

export const isUAxisAtTargetAngle = (angle: number, tolerance = 0.001) =>
  apiCall<boolean>('motion/u/at-angle', 'GET', null, { angle, tolerance })

export const rotateRAxisByTurns = (turns: number, speed: number, direction?: string) =>
  apiCall('motion/r/rotate-turns', 'POST', { params: { 旋转圈数: turns, 旋转速度: speed, 旋转方向: direction } })

// Online command
export const sendOnlineCommand = (command: string) =>
  apiCall<string>('motion/cmd', 'POST', { command })

// Controller settings persistence
export const getControllerSettings = () =>
  apiCall<unknown>('motion/controller-settings', 'GET')

export const saveControllerSettings = (payload: unknown) =>
  apiCall('motion/controller-settings', 'POST', payload)

// Bootstrap helpers
export const connectMotionWithControllerSettings = (settings: { communication: { controller_ip: string } }) =>
  connectMotion(settings.communication.controller_ip)

export const buildMotionAllAxesParamsPayload = (settings: { axes: Array<{ axis_name: string; units: number; speed: number; lspeed: number; accel: number; decel: number; sramp: number; merge: number; fwd_in: number; rev_in: number }> }) => {
  const table: Record<string, Record<string, number>> = {}
  for (const axis of settings.axes) {
    table[axis.axis_name] = {
      units: axis.units,
      speed: axis.speed,
      lspeed: axis.lspeed,
      accel: axis.accel,
      decel: axis.decel,
      sramp: axis.sramp,
      merge: axis.merge,
      fwd_in: axis.fwd_in,
      rev_in: axis.rev_in
    }
  }
  return { table }
}
