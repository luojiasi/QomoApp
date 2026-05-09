import { defineStore } from 'pinia'
import { defaultRs232WorkbenchState } from '../configs/settings'
import type { Rs232SerialSessionRequest } from '../types/settings'
import { cloneSettings } from '../utils/settings'
import { RS232_WORKBENCH_STORAGE_KEY } from '../configs/storageKeys'
import { LIGHT_SETTINGS_PERSIST_DEBOUNCE_MS } from '../configs/constants'
import { isRs232WorkbenchShape, normalizeRs232Workbench } from '../utils/rs232Validation'
import { createPersistedSettings, readSettingsFromStorage } from './settingsStoreUtils'

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

export const useRs232WorkbenchStore = defineStore('rs232-workbench', () => {
  const persisted = createPersistedSettings({
    storageKey: RS232_WORKBENCH_STORAGE_KEY,
    defaultValue: defaultRs232WorkbenchState,
    validate: isRs232WorkbenchShape,
    normalize: normalizeRs232Workbench,
    debounceMs: LIGHT_SETTINGS_PERSIST_DEBOUNCE_MS,
    loadMessage: '已从本地存储加载 RS232 工作台配置。',
    saveMessage: '已保存到本地存储。',
    logTag: 'rs232-workbench'
  })

  return {
    workbench: persisted.state,
    loadRs232Workbench: persisted.load,
    saveToLocalStorageNow: persisted.saveNow,
    resetRs232Workbench: persisted.reset
  }
})
