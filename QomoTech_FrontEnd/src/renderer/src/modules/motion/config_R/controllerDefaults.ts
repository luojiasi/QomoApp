import {
  type AxisMergeParams,
  type ControllerAxisCount,
  type ControllerAxisUserInput,
  type ControllerParameters
} from '../types'
import { cloneSettings } from '@/shared/utils/settings'

// =============================================================================
// 常量
// =============================================================================

export const U_AXIS_NO = 3
export const R_AXIS_NO = 4

/** 轴号 → 轴名映射（与后端 motion_config.MotionConfig.axis_no_to_name 对齐） */
export const AXIS_NO_TO_NAME: Record<number, string> = {
  0: 'X',
  1: 'Y',
  2: 'Z',
  3: 'U',
  4: 'R'
}

/** 轴切换按钮文案：三轴 XYZ，五轴 XYZUR */
export const AXIS_TAB_LABELS: Record<ControllerAxisCount, readonly string[]> = {
  3: ['X', 'Y', 'Z'],
  5: ['X', 'Y', 'Z', 'U', 'R']
} as const

// =============================================================================
// 辅助函数
// =============================================================================

/** 从轴配置读 speed，无效时退回默认 20 */
export function getAxisSpeed(
  axes: { axis_no: number; speed: number }[],
  axisNo: number
): number {
  const v = Number(axes[axisNo]?.speed)
  return Number.isFinite(v) && v > 0 ? v : 20
}

// =============================================================================
// 默认值
// =============================================================================

/** 后端 motion_config.MergeParams 的默认值 */
export const defaultAxisMergeParams = (): AxisMergeParams => ({
  corner_mode: 0,
  decel_angle: 15.0,
  stop_angle: 45.0,
  zxmooth: 0.0
})

/** 与后端 motion_config.MotionConfig.enable_axes 对齐 */
const enableAxesByCount = (count: ControllerAxisCount): string[] =>
  count === 3 ? ['X', 'Y', 'Z'] : ['X', 'Y', 'Z', 'U', 'R']

/** 按轴号生成默认值（与后端 MotionAxisConfig() 默认一致） */
function makeDefaultAxis(
  axis_no: number,
  axis_name: string
): ControllerAxisUserInput {
  return {
    axis_no,
    axis_name,
    axis_type: 1,
    units: 2000,
    speed: 20,
    lspeed: 20,
    accel: 500000,
    decel: 500000,
    sramp: 200,
    creep: 10,
    merge: 0,
    fwd_in: -1,
    rev_in: -1,
    pulses_per_rev: 10000.0,
    electronic_gear_ratio: 1.0,
    gear_ratio: 1.0,
    step_angle: 1.8,
    microsteps: 32.0,
    merge_params: defaultAxisMergeParams(),
    backlash: 5,
    backlash_enable: false
  }
}

/** 五轴：0 X、1 Y、2 Z、3 U、4 R；与后端 motion_config 默认实例一致 */
export const defaultControllerParameters: ControllerParameters = {
  communication: {
    controller_model: 'QomoTech406V2',
    controller_ip: '192.168.0.11',
    connect_timeout_s: 5.0,
    enable_axes: ['X', 'Y', 'Z', 'U', 'R'],
    axis_count: 5
  },
  axes: [
    makeDefaultAxis(0, 'X'),
    makeDefaultAxis(1, 'Y'),
    makeDefaultAxis(2, 'Z'),
    makeDefaultAxis(3, 'U'),
    makeDefaultAxis(4, 'R')
  ]
}

/**
 * 按轴数量裁剪或补齐轴参数，并同步 enable_axes / axis_count。
 * 保留已有轴数据；不足时从默认模板按轴号补齐。
 */
export function applyControllerAxisCount(
  settings: ControllerParameters,
  count: ControllerAxisCount
): ControllerParameters {
  const template = defaultControllerParameters.axes
  const out = cloneSettings(settings)
  const prev = out.axes
  const n = count === 3 ? 3 : 5
  const nextAxes: ControllerAxisUserInput[] = []
  for (let i = 0; i < n; i++) {
    const base = prev[i] ?? cloneSettings(template[i])
    nextAxes.push({ ...cloneSettings(base), axis_no: i })
  }
  out.axes = nextAxes
  out.communication = {
    ...out.communication,
    axis_count: count,
    enable_axes: enableAxesByCount(count)
  }
  return out
}
