import { watch } from 'vue'
import { defineStore } from 'pinia'
import { applyControllerAxisCount, defaultControllerParameters } from '../configs/settings'
import type {
  ControllerAxisCount,
  ControllerParameters,
  SettingsSaveResult
} from '../types/settings'
import { type HomeState } from '../types/auth'
import { CONTROLLER_SETTINGS_STORAGE_KEY, HOME_STATE_KEY } from '../configs/storageKeys'
import { cloneSettings } from '../utils/settings'
import { setMotionAllAxesParamsWithControllerSettings } from '../api/motion'
import { createPersistedSettings, createSettingsSaveResult } from './settingsStoreUtils'
import {
  HEAVY_SETTINGS_PERSIST_DEBOUNCE_MS,
  DRIVER_SYNC_DEBOUNCE_MS
} from '../configs/constants'
import {
  buildControllerDriverSyncSignature,
  isControllerParametersShape,
  normalizeControllerParameters
} from '../utils/controllerValidation'

function loadHomeStateFromStorage(): HomeState {
  if (typeof window === 'undefined') {
    return { ISARRIVEDHOME: false, AUTO_HOME_ON_START: false }
  }
  try {
    const raw = window.localStorage.getItem(HOME_STATE_KEY)
    if (!raw) {
      const legacyIsArrived = window.localStorage.getItem('ISARRIVEDHOME') === 'true'
      return { ISARRIVEDHOME: legacyIsArrived, AUTO_HOME_ON_START: false }
    }
    const parsed = JSON.parse(raw) as Partial<HomeState>
    return {
      ISARRIVEDHOME: Boolean(parsed.ISARRIVEDHOME),
      AUTO_HOME_ON_START: Boolean(parsed.AUTO_HOME_ON_START)
    }
  } catch {
    return { ISARRIVEDHOME: false, AUTO_HOME_ON_START: false }
  }
}

function persistHomeStateToStorage(value: HomeState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HOME_STATE_KEY, JSON.stringify(value))
  } catch (e) {
    console.warn('[home-state] 写入 localStorage 失败', e)
  }
}

export const useControllerSettingsStore = defineStore('controller-settings', () => {
  const persisted = createPersistedSettings({
    storageKey: CONTROLLER_SETTINGS_STORAGE_KEY,
    defaultValue: normalizeControllerParameters(cloneSettings(defaultControllerParameters)),
    validate: isControllerParametersShape,
    normalize: normalizeControllerParameters,
    debounceMs: HEAVY_SETTINGS_PERSIST_DEBOUNCE_MS,
    loadMessage: '已从本地存储加载控制器参数。',
    saveMessage: '控制器参数已保存（含本地存储）。',
    logTag: 'controller-settings'
  })
  const controllerSettings = persisted.state

  let syncTimer: ReturnType<typeof setTimeout> | null = null
  let syncInFlight = false
  let syncQueued = false
  let lastSyncedSignature = ''

  const syncControllerSettingsToDriver = async (): Promise<void> => {
    const snapshot = cloneSettings(controllerSettings.value)
    const signature = buildControllerDriverSyncSignature(snapshot)
    if (signature === lastSyncedSignature) return

    if (syncInFlight) {
      syncQueued = true
      return
    }

    syncInFlight = true
    try {
      const result = await setMotionAllAxesParamsWithControllerSettings(snapshot)
      if (result?.success) {
        lastSyncedSignature = signature
        return
      }
      console.warn('[controller-settings] 同步驱动器参数失败', result?.message ?? result)
    } catch (error) {
      console.warn('[controller-settings] 同步驱动器参数异常', error)
    } finally {
      syncInFlight = false
      if (syncQueued) {
        syncQueued = false
        void syncControllerSettingsToDriver()
      }
    }
  }

  const scheduleDriverSync = (): void => {
    if (syncTimer !== null) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      syncTimer = null
      void syncControllerSettingsToDriver()
    }, DRIVER_SYNC_DEBOUNCE_MS)
  }

  watch(controllerSettings, scheduleDriverSync, { deep: true, flush: 'post' })

  const saveControllerSettings = async (
    payload: ControllerParameters
  ): Promise<SettingsSaveResult<ControllerParameters>> => {
    controllerSettings.value = cloneSettings(normalizeControllerParameters(payload))
    return createSettingsSaveResult('控制器参数已保存（含本地存储）。', controllerSettings.value)
  }

  const setAxisCount = async (
    count: ControllerAxisCount
  ): Promise<SettingsSaveResult<ControllerParameters>> => {
    controllerSettings.value = cloneSettings(
      applyControllerAxisCount(controllerSettings.value, count)
    )
    return createSettingsSaveResult('轴数量已更新。', controllerSettings.value)
  }

  const loadHomeState = (): HomeState => loadHomeStateFromStorage()
  const saveHomeState = (payload: HomeState): HomeState => {
    const next: HomeState = {
      ISARRIVEDHOME: Boolean(payload.ISARRIVEDHOME),
      AUTO_HOME_ON_START: Boolean(payload.AUTO_HOME_ON_START)
    }
    persistHomeStateToStorage(next)
    return next
  }

  return {
    controllerSettings,
    loadControllerSettings: persisted.load,
    saveControllerSettings,
    setAxisCount,
    loadHomeState,
    saveHomeState
  }
})
