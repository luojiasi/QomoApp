import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getLaserSettings,
  saveLaserSettings,
  type LaserSettingsPayload
} from '../api/device/laser'

import { DEFAULTS_BY_MANUFACTURER } from '../configs/lasermanufacturer'

export const useLaserSettingsStore = defineStore('laser-settings', () => {
  const settings = ref<LaserSettingsPayload>({ ...DEFAULTS_BY_MANUFACTURER['KMJGQ_XYT'] })
  const loaded = ref(false)

  async function load(): Promise<void> {
    const res = await getLaserSettings()
    if (res?.success && res.data) {
      settings.value = { ...res.data }
    } else {
      settings.value = { ...DEFAULTS_BY_MANUFACTURER['KMJGQ_XYT'] }
    }
    loaded.value = true
  }

  async function save(): Promise<boolean> {
    const res = await saveLaserSettings(settings.value)
    return res?.success ?? false
  }

  /** 切换厂家时自动填充对应默认值 */
  function switchManufacturer(manufacturer: string): void {
    const defaults = DEFAULTS_BY_MANUFACTURER[manufacturer]
    if (defaults) {
      settings.value = { ...defaults }
    } else {
      settings.value.manufacturer = manufacturer
    }
  }

  return {
    settings,
    loaded,
    load,
    save,
    switchManufacturer
  }
})
