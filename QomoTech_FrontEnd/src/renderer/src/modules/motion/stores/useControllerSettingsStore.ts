import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ControllerAxisCount, ControllerParameters, HomeState } from '../types'
import type { SettingsSaveResult } from '@/shared/types'
import { cloneSettings } from '@/shared/utils/settings'
import { createSettingsSaveResult } from '@/shared/utils/useSettingsStore'
import { applyControllerAxisCount, defaultControllerParameters } from '../config'
import { normalizeControllerParameters } from '../validation/controller'
import { loadControllerParameters, saveControllerParameters } from '../persistence/controllerPersistence'
import { loadHomeState, saveHomeState } from '../persistence/homeStatePersistence'

export const useControllerSettingsStore = defineStore('controller-settings', () => {
  const controllerSettings = ref<ControllerParameters>(
    normalizeControllerParameters(cloneSettings(defaultControllerParameters))
  )

    /** 从服务端加载控制器参数。成功更新 store，失败退回默认值。 */
  const loadControllerSettings = async (): Promise<SettingsSaveResult<ControllerParameters>> => {
    const loaded = await loadControllerParameters()
    if (loaded) {
      controllerSettings.value = cloneSettings(loaded)
      return createSettingsSaveResult('已从服务端加载控制器参数。', controllerSettings.value)
    }
    controllerSettings.value = normalizeControllerParameters(cloneSettings(defaultControllerParameters))
    return createSettingsSaveResult('使用默认控制器参数。', controllerSettings.value)
  }

    /** 保存控制器参数到服务端，同步更新 store 状态。 */
  const saveControllerSettings = async (
    payload: ControllerParameters
  ): Promise<SettingsSaveResult<ControllerParameters>> => {
    const normalized = normalizeControllerParameters(payload)
    controllerSettings.value = cloneSettings(normalized)
    await saveControllerParameters(normalized)
    return createSettingsSaveResult('控制器参数已保存。', controllerSettings.value)
  }

    /** 切换轴数量（3/5），自动裁剪或补齐轴配置。 */
  const setAxisCount = async (
    count: ControllerAxisCount
  ): Promise<SettingsSaveResult<ControllerParameters>> => {
    controllerSettings.value = cloneSettings(
      applyControllerAxisCount(controllerSettings.value, count)
    )
    return createSettingsSaveResult('轴数量已更新。', controllerSettings.value)
  }

    /** 加载回零状态（委托 persistence 层）。 */
  const loadHomeStateFromStore = (): HomeState => loadHomeState()
    /** 保存回零状态（委托 persistence 层），确保字段为布尔值。 */
  const saveHomeStateToStore = (payload: HomeState): HomeState => {
    const next: HomeState = {
      ISARRIVEDHOME: Boolean(payload.ISARRIVEDHOME),
      AUTO_HOME_ON_START: Boolean(payload.AUTO_HOME_ON_START)
    }
    saveHomeState(next)
    return next
  }

  return {
    controllerSettings,
    loadControllerSettings,
    saveControllerSettings,
    setAxisCount,
    loadHomeState: loadHomeStateFromStore,
    saveHomeState: saveHomeStateToStore
  }
})
