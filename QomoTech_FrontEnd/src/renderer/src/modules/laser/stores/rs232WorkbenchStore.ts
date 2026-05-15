import { defineStore } from 'pinia'
import { defaultRs232WorkbenchState } from '../config/rs232'
import { RS232_WORKBENCH_STORAGE_KEY } from '@/shared/constants/storageKeys'
import { LIGHT_SETTINGS_PERSIST_DEBOUNCE_MS } from '@/shared/constants/constants'
import { isRs232WorkbenchShape, normalizeRs232Workbench } from '../validation/rs232Validation'
import { createPersistedSettings } from '@/shared/utils/useSettingsStore'

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
