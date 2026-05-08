import type { SettingsSaveResult } from '../types/settings'
import { cloneSettings } from '../utils/settings'

export const createSettingsSaveResult = <T>(message: string, data: T): SettingsSaveResult<T> => ({
  success: true,
  message,
  data: cloneSettings(data),
  updatedAt: new Date().toISOString()
})
