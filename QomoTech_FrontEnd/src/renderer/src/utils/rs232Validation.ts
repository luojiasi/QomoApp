import type { Rs232WorkbenchState } from '../types/settings'
import { defaultRs232WorkbenchState } from '../configs/settings'
import { cloneSettings } from './settings'

export function isRs232WorkbenchShape(data: unknown): data is Rs232WorkbenchState {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return (
    o.port !== null &&
    typeof o.port === 'object' &&
    o.send !== null &&
    typeof o.send === 'object' &&
    o.receive !== null &&
    typeof o.receive === 'object' &&
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
