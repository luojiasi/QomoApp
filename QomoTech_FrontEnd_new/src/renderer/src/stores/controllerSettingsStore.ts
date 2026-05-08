import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { applyControllerAxisCount, defaultControllerParameters } from '../configs/settings'
import type {
  ControllerAxisCount,
  ControllerParameters,
  SettingsSaveResult,
} from '../types/settings'
import { HOME_STATE_KEY, type HomeState } from '../types/auth'
import { cloneSettings } from '../utils/settings'
import { createSettingsSaveResult } from './settingsStoreUtils'

export const CONTROLLER_SETTINGS_STORAGE_KEY = 'qomotech-controller-settings'

const PERSIST_DEBOUNCE_MS = 800

function normalizeControllerParameters(payload: ControllerParameters): ControllerParameters {
  const ac = payload.communication.axisCount
  if (ac === 3 || ac === 5) {
    return applyControllerAxisCount(payload, ac)
  }
  const len = payload.axes.length
  const count: ControllerAxisCount = len >= 5 ? 5 : 3
  return applyControllerAxisCount(payload, count)
}

function isControllerParametersShape(data: unknown): data is ControllerParameters {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return (
    o.communication !== null &&
    typeof o.communication === 'object' &&
    Array.isArray(o.axes)
  )
}

function loadControllerSettingsFromStorage(): ControllerParameters | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(CONTROLLER_SETTINGS_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isControllerParametersShape(parsed)) {
      return null
    }
    return normalizeControllerParameters(cloneSettings(parsed))
  } catch {
    return null
  }
}

function persistControllerSettingsToStorage(value: ControllerParameters): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      CONTROLLER_SETTINGS_STORAGE_KEY,
      JSON.stringify(value)
    )
  } catch (e) {
    console.warn('[controller-settings] 写入 localStorage 失败', e)
  }
}

function loadHomeStateFromStorage(): HomeState {
  if (typeof window === 'undefined') {
    return { ISARRIVEDHOME: false, AUTO_HOME_ON_START: false }
  }
  try {
    const raw = window.localStorage.getItem(HOME_STATE_KEY)
    if (!raw) {
      const legacyIsArrived =
        window.localStorage.getItem('ISARRIVEDHOME') === 'true'
      return { ISARRIVEDHOME: legacyIsArrived, AUTO_HOME_ON_START: false }
    }
    const parsed = JSON.parse(raw) as Partial<HomeState>
    return {
      ISARRIVEDHOME: Boolean(parsed.ISARRIVEDHOME),
      AUTO_HOME_ON_START: Boolean(parsed.AUTO_HOME_ON_START),
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
  const controllerSettings = ref<ControllerParameters>(
    loadControllerSettingsFromStorage() ??
      normalizeControllerParameters(cloneSettings(defaultControllerParameters))
  )

  let persistTimer: ReturnType<typeof setTimeout> | null = null

  const schedulePersist = (): void => {
    if (persistTimer !== null) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      persistControllerSettingsToStorage(controllerSettings.value)
    }, PERSIST_DEBOUNCE_MS)
  }

  watch(
    controllerSettings,
    () => {
      schedulePersist()
    },
    { deep: true, flush: 'post' }
  )

  const loadControllerSettings = async (): Promise<
    SettingsSaveResult<ControllerParameters>
  > => {
    const fromStorage = loadControllerSettingsFromStorage()
    if (fromStorage) controllerSettings.value = cloneSettings(fromStorage)
    return createSettingsSaveResult(
      '已从本地存储加载控制器参数。',
      controllerSettings.value
    )
  }

  const saveControllerSettings = async (
    payload: ControllerParameters
  ): Promise<SettingsSaveResult<ControllerParameters>> => {
    controllerSettings.value = cloneSettings(
      normalizeControllerParameters(payload)
    )
    return createSettingsSaveResult(
      '控制器参数已保存（含本地存储）。',
      controllerSettings.value
    )
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
      AUTO_HOME_ON_START: Boolean(payload.AUTO_HOME_ON_START),
    }
    persistHomeStateToStorage(next)
    return next
  }

  return {
    controllerSettings,
    loadControllerSettings,
    saveControllerSettings,
    setAxisCount,
    loadHomeState,
    saveHomeState,
  }
})
