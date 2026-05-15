import type { Rs232WorkbenchState, Rs232SerialSessionRequest } from '../types'
import { defaultRs232WorkbenchState } from '../config/rs232'
import { cloneSettings } from '@/shared/utils/settings'
import { RS232_WORKBENCH_STORAGE_KEY } from '@/shared/constants/storageKeys'
import { readSettingsFromStorage } from '@/shared/utils/useSettingsStore'

export function isRs232WorkbenchShape(data: unknown): data is Rs232WorkbenchState {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return (
    o.port !== null && typeof o.port === 'object' &&
    o.send !== null && typeof o.send === 'object' &&
    o.receive !== null && typeof o.receive === 'object' &&
    typeof o.receiveBuffer === 'string' &&
    Array.isArray(o.quickCommands)
  )
}

export function normalizeRs232Workbench(data: Rs232WorkbenchState): Rs232WorkbenchState {
  const d = defaultRs232WorkbenchState
  return cloneSettings({
    ...d,
    ...data,
    port: { ...d.port, ...data.port },
    send: { ...d.send, ...data.send },
    receive: { ...d.receive, ...data.receive },
    quickCommands:
      Array.isArray(data.quickCommands) && data.quickCommands.length > 0
        ? data.quickCommands.map((c) => ({ ...c }))
        : cloneSettings(d.quickCommands)
  })
}

/**
 * 直接从 localStorage 解析串口会话请求，供路由切换前的非响应式读取使用。
 * 不依赖 store 实例。
 */
export function parseRs232SessionFromLocalStorage(): Rs232SerialSessionRequest | null {
  const workbench = readSettingsFromStorage(
    RS232_WORKBENCH_STORAGE_KEY,
    isRs232WorkbenchShape,
    normalizeRs232Workbench
  )
  if (!workbench) return null
  if (typeof workbench.port.portName !== 'string' || !workbench.port.portName.trim()) return null
  return {
    port: cloneSettings(workbench.port),
    send: cloneSettings(workbench.send),
    receive: cloneSettings(workbench.receive)
  }
}
