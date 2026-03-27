export type BackendRuntimeState = 'running' | 'starting' | 'restarting' | 'error' | 'missing' | 'stopped'

export type BackendRuntimeStatus = {
  state: BackendRuntimeState
  isReachable: boolean
  message: string
}

const unsupportedStatus: BackendRuntimeStatus = {
  state: 'stopped',
  isReachable: false,
  message: '当前环境不支持桌面端后台状态检测'
}

export const getDesktopBackendRuntimeStatus = async (): Promise<BackendRuntimeStatus> => {
  const getter = window.api?.getBackendRuntimeStatus
  if (!getter) {
    return unsupportedStatus
  }

  try {
    return await getter()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      state: 'error',
      isReachable: false,
      message: `获取后台状态失败: ${message}`
    }
  }
}
