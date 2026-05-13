import { ref } from 'vue'
import { defineStore } from 'pinia'
import { applyControllerAxisCount, defaultControllerParameters } from '@/configs/settings'
import type {
  ControllerAxisCount,
  ControllerParameters,
  SettingsSaveResult
} from '@/types/settings'
import { type HomeState } from '@/modules/auth/authTypes'
import { HOME_STATE_KEY } from '@/configs/storageKeys'
import { cloneSettings } from '@/utils/settings'
import {
  getControllerSettingsFromFile,
  saveControllerSettingsToFile
} from '@/modules/motion/connectApi'
import {
  isControllerParametersShape,
  normalizeControllerParameters
} from '@/utils/controllerValidation'
import { createSettingsSaveResult } from '@/modules/settings/useSettingsStore'

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
  const controllerSettings = ref<ControllerParameters>(
    normalizeControllerParameters(cloneSettings(defaultControllerParameters))
  )

  const loadControllerSettings = async (): Promise<SettingsSaveResult<ControllerParameters>> => {
    const res = await getControllerSettingsFromFile()
    if (res?.success && res.data) {
      const data = res.data as Record<string, unknown>
      if (isControllerParametersShape(data)) {
        controllerSettings.value = cloneSettings(normalizeControllerParameters(data))
        return createSettingsSaveResult('已从服务端加载控制器参数。', controllerSettings.value)
      }
    }
    controllerSettings.value = normalizeControllerParameters(cloneSettings(defaultControllerParameters))
    return createSettingsSaveResult('使用默认控制器参数。', controllerSettings.value)
  }

  const saveControllerSettings = async (
    payload: ControllerParameters
  ): Promise<SettingsSaveResult<ControllerParameters>> => {
    const normalized = normalizeControllerParameters(payload)
    controllerSettings.value = cloneSettings(normalized)
    const res = await saveControllerSettingsToFile(normalized as unknown as Record<string, unknown>)
    if (!res?.success) {
      console.warn('[controller-settings] 保存到服务端失败', res?.message)
    }
    return createSettingsSaveResult('控制器参数已保存。', controllerSettings.value)
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
    loadControllerSettings,
    saveControllerSettings,
    setAxisCount,
    loadHomeState,
    saveHomeState
  }
})
