import type { ControllerAxisCount, ControllerParameters } from '../types/settings'
import { applyControllerAxisCount } from '../configs/settings'
import { cloneSettings } from './settings'

export function isControllerParametersShape(data: unknown): data is ControllerParameters {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return (
    o.communication !== null &&
    typeof o.communication === 'object' &&
    Array.isArray(o.axes) &&
    Array.isArray(o.ioMap)
  )
}

export function normalizeControllerParameters(payload: ControllerParameters): ControllerParameters {
  const ac = payload.communication.axisCount
  if (ac === 3 || ac === 5) {
    return applyControllerAxisCount(cloneSettings(payload), ac)
  }
  const len = payload.axes.length
  const count: ControllerAxisCount = len >= 5 ? 5 : 3
  return applyControllerAxisCount(cloneSettings(payload), count)
}

/** 提取仅与驱动器同步相关的字段签名，用于去重 */
export function buildControllerDriverSyncSignature(value: ControllerParameters): string {
  return JSON.stringify({
    axisCount: value.communication.axisCount,
    axes: value.axes.map((a) => ({
      axisNo: a.axisNo,
      units: a.units,
      lspeed: a.lspeed,
      speed: a.speed,
      accel: a.accel,
      decel: a.decel,
      sramp: a.sramp,
      fwd_in: a.fwd_in,
      rev_in: a.rev_in,
      backlash: a.backlash
    }))
  })
}
