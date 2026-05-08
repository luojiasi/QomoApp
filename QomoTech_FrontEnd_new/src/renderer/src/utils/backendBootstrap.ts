import type { ControllerParameters } from '../types/settings'
import { connectMotion, getMotionState } from './motionApi'

export interface BackendBootstrapResult {
  success: boolean
  message: string
  data?: Record<string, unknown>
}

let controllerBootstrapDone = false
let controllerBootstrapPromise: Promise<BackendBootstrapResult> | null = null

const checkControllerConnected = async (): Promise<boolean> => {
  const res = await getMotionState()
  return Boolean(res?.success && res?.data?.state !== 'DISCONNECTED')
}

const reconnectController = async (
  ip: string
): Promise<BackendBootstrapResult> => {
  const res = await connectMotion(ip)
  if (res?.success) {
    controllerBootstrapDone = true
    return { success: true, message: `已连接控制器 ${ip}` }
  }
  return {
    success: false,
    message: res?.message || '控制器连接失败，请检查硬件连接。',
  }
}

export const bootstrapControllerOnce = async (
  controllerSettings: ControllerParameters
): Promise<BackendBootstrapResult> => {
  const ip = controllerSettings.communication.ipAddress

  if (controllerBootstrapDone) {
    const stillConnected = await checkControllerConnected()
    if (!stillConnected) {
      controllerBootstrapDone = false
      return reconnectController(ip)
    }
    return { success: true, message: '控制器已连接，无需重复连接。' }
  }

  if (controllerBootstrapPromise) return controllerBootstrapPromise

  controllerBootstrapPromise = (async () => {
    const connected = await checkControllerConnected()
    if (connected) {
      controllerBootstrapDone = true
      return { success: true, message: '控制器已连接。' }
    }
    return reconnectController(ip)
  })()

  try {
    return await controllerBootstrapPromise
  } finally {
    controllerBootstrapPromise = null
  }
}
