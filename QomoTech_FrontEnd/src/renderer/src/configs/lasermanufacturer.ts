import {type LaserSettingsPayload} from '../api/device/laser'


/** 厂家默认参数 */
export const DEFAULTS_BY_MANUFACTURER: Record<string, LaserSettingsPayload> = {
    '星言通': {
      manufacturer: '星言通',
      port: 'COM4',
      power: '930',
      frequency: '6000',
      current: '80'
    },
    '梅曼': {
      manufacturer: '梅曼',
      port: 'COM4',
      power: '50',
      frequency: '8',
      current: '30'
    }
  }
