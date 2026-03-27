import type { SettingValue } from '../types/settings'

export const cloneSettings = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const formatSettingValue = (value: SettingValue, unit?: string): string => {
  if (value === null) {
    return '-'
  }

  if (typeof value === 'boolean') {
    return value ? '启用' : '禁用'
  }

  return unit ? `${value} ${unit}` : String(value)
}
