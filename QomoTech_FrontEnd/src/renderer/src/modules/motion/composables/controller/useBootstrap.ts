import type { ControllerParameters } from '../../types/controller'
import type { BackendBootstrapResult } from '../../types/bootstrap'
import { defaultControllerParameters } from '../../config/controller'
import { connectMotionWithControllerSettings, setMotionAllAxesParamsWithControllerSettings } from '../../api/apiConnect'
import { isControllerConnected } from '@/shared/api/hardware'

let controllerBootstrapDone = false
let controllerBootstrapPromise: Promise<BackendBootstrapResult> | null = null

const reconnectControllerSingleton = async (controllerSettings: ControllerParameters): Promise<BackendBootstrapResult> => {
  // 1. 连接控制器（仅发 IP）
  const connectRes = await connectMotionWithControllerSettings(controllerSettings)
  if (!connectRes?.success) {
    return { success: false, message: connectRes?.message || '控制器连接失败，请检查硬件连接。', data: { motion: connectRes } }
  }

  // 2. 连接成功后下发轴参数
  const paramsRes = await setMotionAllAxesParamsWithControllerSettings(controllerSettings)
  if (!paramsRes?.success) {
    console.warn('[bootstrap] 连接成功但轴参数下发失败', paramsRes?.message)
    return { success: true, message: '已连接控制器，但轴参数下发失败。', data: { motion: connectRes, params: paramsRes } }
  }

  controllerBootstrapDone = true
  return { success: true, message: '已重连控制器并下发轴参数。', data: { motion: connectRes, params: paramsRes } }
}

export const bootstrapControllerOnce = async (controllerSettings: ControllerParameters = defaultControllerParameters): Promise<BackendBootstrapResult> => {
  if (controllerBootstrapDone && isControllerConnected()) {
    return { success: true, message: '控制器单实例已初始化，无需重复连接。' }
  }
  if (controllerBootstrapPromise) return controllerBootstrapPromise

  controllerBootstrapPromise = (async () => {
    if (isControllerConnected()) {
      controllerBootstrapDone = true
      return { success: true, message: '控制器已连接，跳过重复连接。' }
    }
    return reconnectControllerSingleton(controllerSettings)
  })()

  try {
    return await controllerBootstrapPromise
  } finally {
    controllerBootstrapPromise = null
  }
}
