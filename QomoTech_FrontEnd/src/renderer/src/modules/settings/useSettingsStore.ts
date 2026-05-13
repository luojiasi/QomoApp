import { ref } from 'vue'
import { defineStore } from 'pinia'
import { reservePageDefinitions } from '@/configs/settings'
import type { ReservePageDefinition, SettingsSaveResult } from '@/types/settings'
import { cloneSettings } from '@/utils/settings'
import { createSettingsSaveResult } from '@/stores/settingsStoreUtils'

export const useReservePagesStore = defineStore('reserve-pages', () => {
  const reservePages = ref<ReservePageDefinition[]>(cloneSettings(reservePageDefinitions))

  const loadReservePages = async (): Promise<SettingsSaveResult<ReservePageDefinition[]>> =>
    createSettingsSaveResult('备用界面占位接口已加载。', reservePages.value)

  return {
    reservePages,
    loadReservePages
  }
})
