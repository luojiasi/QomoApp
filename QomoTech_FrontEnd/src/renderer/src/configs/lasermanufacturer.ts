import {type LaserSettingsPayload} from '../api/device/laser'


/** 厂家默认参数 */
export const DEFAULTS_BY_MANUFACTURER: Record<string, LaserSettingsPayload> = {
    'KMJGQ_XYT': {
      manufacturer: 'KMJGQ_XYT',
      port: 'COM4',
      power: '930',
      frequency: '6000',
      current: '80'
    },
    'KMJGQ_MM': {
      manufacturer: 'KMJGQ_MM',
      port: 'COM4',
      power: '50',
      frequency: '8',
      current: '30'
    }
  }
