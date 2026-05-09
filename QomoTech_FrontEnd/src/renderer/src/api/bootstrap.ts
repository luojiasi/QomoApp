import type { ControllerParameters } from '../types/settings'
import { apiCall } from './base'
import { defaultControllerParameters } from '../configs/settings'
import { connectMotionWithControllerSettings } from './motion'

export interface BackendBootstrapResult {
  success: boolean
  message: string
  data?: { hardware?: any; motion?: any }
}

let controllerBootstrapDone = false
let controllerBootstrapPromise: Promise<BackendBootstrapResult> | null = null

const checkControllerSingletonConnected = async (): Promise<boolean> => {
  const statusRes = await apiCall('hardware/status', 'GET')
  return Boolean(statusRes?.success && statusRes?.data?.state?.motion_connected)
}

const reconnectControllerSingleton = async (controllerSettings: ControllerParameters): Promise<BackendBootstrapResult> => {
  const connectRes = await connectMotionWithControllerSettings(controllerSettings)
  if (connectRes?.success) {
    controllerBootstrapDone = true
    return { success: true, message: '已重连控制器（Motion）单例。', data: { motion: connectRes } }
  }
  return { success: false, message: connectRes?.message || '控制器单例重连失败，请检查硬件连接。', data: { motion: connectRes } }
}

export const bootstrapControllerOnce = async (controllerSettings: ControllerParameters = defaultControllerParameters): Promise<BackendBootstrapResult> => {
  if (controllerBootstrapDone) {
    const stillConnected = await checkControllerSingletonConnected()
    if (!stillConnected) return reconnectControllerSingleton(controllerSettings)
    return { success: true, message: '控制器单实例已初始化，无需重复连接。' }
  }
  if (controllerBootstrapPromise) return controllerBootstrapPromise

  controllerBootstrapPromise = (async () => {
    const connected = await checkControllerSingletonConnected()
    if (connected) {
      return reconnectControllerSingleton(controllerSettings)
    }
    return reconnectControllerSingleton(controllerSettings)
  })()

  try {
    return await controllerBootstrapPromise
  } finally {
    controllerBootstrapPromise = null
  }
}
