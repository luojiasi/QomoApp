import { getControllerSettingsFromFile, saveControllerSettingsToFile } from '../api'
import type { ControllerParameters } from '../types'
import { isControllerParametersShape, normalizeControllerParameters } from '../validation/controller'

/**
 * 从服务端加载控制器参数。
 * 成功时返回规范化后的参数；失败时返回 null。
 */
export async function loadControllerParameters(): Promise<ControllerParameters | null> {
  const res = await getControllerSettingsFromFile()
  if (res?.success && res.data) {
    const data = res.data as Record<string, unknown>
    if (isControllerParametersShape(data)) {
      return normalizeControllerParameters(data)
    }
  }
  return null
}

/**
 * 保存控制器参数到服务端。
 */
export async function saveControllerParameters(
  payload: ControllerParameters
): Promise<boolean> {
  const res = await saveControllerSettingsToFile(payload as unknown as Record<string, unknown>)
  if (!res?.success) {
    console.warn('[controller-persistence] 保存到服务端失败', res?.message)
    return false
  }
  return true
}
