import type { ControllerParameters ,ControllerAxisCount ,} from '../index'
import { applyControllerAxisCount } from '../config/controller'
import { cloneSettings } from '@/shared/utils/settings'

export function isControllerParametersShape(data: unknown): data is ControllerParameters {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  if (!o.communication || typeof o.communication !== 'object') return false
  if (!Array.isArray(o.axes)) return false

  const c = o.communication as Record<string, unknown>
  // 后端字段名校验：旧版 camelCase 数据视为 invalid，工厂会自动用默认值替代
  if (typeof c.controller_model !== 'string') return false
  if (typeof c.controller_ip !== 'string') return false
  if (typeof c.axis_count !== 'number') return false

  for (const axis of o.axes) {
    if (!axis || typeof axis !== 'object') return false
    const a = axis as Record<string, unknown>
    if (typeof a.axis_no !== 'number') return false
    if (typeof a.axis_name !== 'string') return false
    if (!a.merge_params || typeof a.merge_params !== 'object') return false
  }

  return true
}

export function normalizeControllerParameters(payload: ControllerParameters): ControllerParameters {
  const ac = payload.communication.axis_count
  if (ac === 3 || ac === 5) {
    return applyControllerAxisCount(cloneSettings(payload), ac)
  }
  const len = payload.axes.length
  const count: ControllerAxisCount = len >= 5 ? 5 : 3
  return applyControllerAxisCount(cloneSettings(payload), count)
}

/**
 * 提取仅与驱动器同步相关的字段签名，用于 watch 去重。
 * 包含 merge_params 子模型，避免拐角参数变化漏同步。
 */
export function buildControllerDriverSyncSignature(value: ControllerParameters): string {
  return JSON.stringify({
    axis_count: value.communication.axis_count,
    axes: value.axes.map((a) => ({
      axis_no: a.axis_no,
      units: a.units,
      lspeed: a.lspeed,
      speed: a.speed,
      accel: a.accel,
      decel: a.decel,
      sramp: a.sramp,
      merge: a.merge,
      fwd_in: a.fwd_in,
      rev_in: a.rev_in,
      merge_params: { ...a.merge_params }
    }))
  })
}
