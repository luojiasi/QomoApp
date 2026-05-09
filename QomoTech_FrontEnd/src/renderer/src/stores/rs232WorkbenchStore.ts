import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { defaultRs232WorkbenchState } from '../configs/settings'
import type {
  Rs232SerialSessionRequest,
  Rs232WorkbenchState,
  SettingsSaveResult
} from '../types/settings'
import { cloneSettings } from '../utils/settings'
import { createSettingsSaveResult } from './settingsStoreUtils'
import { RS232_WORKBENCH_STORAGE_KEY } from '../configs/storageKeys'
import { LIGHT_SETTINGS_PERSIST_DEBOUNCE_MS as PERSIST_DEBOUNCE_MS } from '../configs/constants'

function isRs232WorkbenchShape(data: unknown): data is Rs232WorkbenchState {
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

function normalizeRs232Workbench(data: Rs232WorkbenchState): Rs232WorkbenchState {
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

function loadRs232WorkbenchFromStorage(): Rs232WorkbenchState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(RS232_WORKBENCH_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRs232WorkbenchShape(parsed)) return null
    return normalizeRs232Workbench(parsed as Rs232WorkbenchState)
  } catch {
    return null
  }
}

export function parseRs232SessionFromLocalStorage(): Rs232SerialSessionRequest | null {
  const workbench = loadRs232WorkbenchFromStorage()
  if (!workbench) return null
  if (typeof workbench.port.portName !== 'string' || !workbench.port.portName.trim()) return null
  return {
    port: cloneSettings(workbench.port),
    send: cloneSettings(workbench.send),
    receive: cloneSettings(workbench.receive)
  }
}

function persistRs232WorkbenchToStorage(value: Rs232WorkbenchState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RS232_WORKBENCH_STORAGE_KEY, JSON.stringify(value))
  } catch (e) {
    console.warn('[rs232-workbench] 写入 localStorage 失败', e)
  }
}

export const useRs232WorkbenchStore = defineStore('rs232-workbench', () => {
  const workbench = ref<Rs232WorkbenchState>(
    loadRs232WorkbenchFromStorage() ?? cloneSettings(defaultRs232WorkbenchState)
  )

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  const schedulePersist = (): void => {
    if (persistTimer !== null) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      persistRs232WorkbenchToStorage(workbench.value)
    }, PERSIST_DEBOUNCE_MS)
  }

  watch(workbench, schedulePersist, { deep: true, flush: 'post' })

  const loadRs232Workbench = async (): Promise<SettingsSaveResult<Rs232WorkbenchState>> => {
    const fromStorage = loadRs232WorkbenchFromStorage()
    if (fromStorage) {
      workbench.value = cloneSettings(fromStorage)
    }
    return createSettingsSaveResult('已从本地存储加载 RS232 工作台配置。', workbench.value)
  }

  /** 立即写入 localStorage（用于「本地存储」按钮显式确认） */
  const saveToLocalStorageNow = async (): Promise<SettingsSaveResult<Rs232WorkbenchState>> => {
    if (persistTimer !== null) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    workbench.value = cloneSettings(normalizeRs232Workbench(workbench.value))
    persistRs232WorkbenchToStorage(workbench.value)
    return createSettingsSaveResult('已保存到本地存储。', workbench.value)
  }

  return {
    workbench,
    loadRs232Workbench,
    saveToLocalStorageNow
  }
})
