import {
  type AxisMergeParams,
  type ControllerAxisCount,
  type ControllerAxisUserInput,
  type ControllerParameters
} from '../index'
import type { ParameterSection } from '@/shared/types'
import { cloneSettings } from '@/shared/utils/settings'

export const U_AXIS_NO = 3
export const R_AXIS_NO = 4
/** 轴号 → 轴名映射（与后端 motion_config.MotionConfig.axis_no_to_name 对齐） */
export const AXIS_NO_TO_NAME: Record<number, string> = { 0: 'X', 1: 'Y', 2: 'Z', 3: 'U', 4: 'R' }


/** 从轴配置读 speed，无效时退回默认 20 */
export function getAxisSpeed(axes: { axis_no: number; speed: number }[], axisNo: number): number {
  const v = Number(axes[axisNo]?.speed)
  return Number.isFinite(v) && v > 0 ? v : 20
}

/** 后端 motion_config.MergeParams 的默认值 */
export const defaultAxisMergeParams = (): AxisMergeParams => ({
  corner_mode: 0,
  decel_angle: 15.0,
  stop_angle: 45.0,
  zxmooth: 0.0
})

function createAxis(input: ControllerAxisUserInput): ControllerAxisUserInput {
  return { ...input }
}

/** 轴切换按钮文案：三轴 XYZ，五轴 XYZUR */
export const AXIS_TAB_LABELS: Record<ControllerAxisCount, readonly string[]> = {
  3: ['X', 'Y', 'Z'],
  5: ['X', 'Y', 'Z', 'U', 'R']
} as const

/** 与后端 motion_config.MotionConfig.enable_axes 对齐 */
const enableAxesByCount = (count: ControllerAxisCount): string[] =>
  count === 3 ? ['X', 'Y', 'Z'] : ['X', 'Y', 'Z', 'U', 'R']

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

/** 按轴号生成默认值（与后端 MotionAxisConfig() 默认一致） */
function makeDefaultAxis(axis_no: number, axis_name: string): ControllerAxisUserInput {
  return createAxis({
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
    merge_params: defaultAxisMergeParams(),
    backlash: 5,
    backlash_enable: false
  })
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

const userInputFields = (axis: ControllerAxisUserInput): ParameterSection['fields'] => [
  { key: 'axis_no', label: '轴号', value: axis.axis_no },
  { key: 'axis_name', label: '轴名称', value: axis.axis_name },
  { key: 'axis_type', label: 'ATYPE 轴类型', value: axis.axis_type },
  { key: 'units', label: '脉冲当量 units', value: axis.units },
  { key: 'speed', label: '运行速度', value: axis.speed },
  { key: 'lspeed', label: '起跳速度 lspeed', value: axis.lspeed },
  { key: 'creep', label: '爬行速度 creep（回零用）', value: axis.creep },
  { key: 'accel', label: '加速度', value: axis.accel },
  { key: 'decel', label: '减速度', value: axis.decel },
  { key: 'sramp', label: 'S 曲线时间 sramp', value: axis.sramp },
  { key: 'merge', label: '连续插补 merge（0/1）', value: axis.merge },
  { key: 'fwd_in', label: '正限位输入 fwd_in（-1=禁用）', value: axis.fwd_in },
  { key: 'rev_in', label: '负限位输入 rev_in（-1=禁用）', value: axis.rev_in },
  { key: 'corner_mode', label: '拐角模式 corner_mode', value: axis.merge_params.corner_mode },
  { key: 'decel_angle', label: '拐角减速开始 decel_angle', value: axis.merge_params.decel_angle },
  { key: 'stop_angle', label: '拐角强制停止 stop_angle', value: axis.merge_params.stop_angle },
  { key: 'zxmooth', label: '拐角圆滑半径 zxmooth', value: axis.merge_params.zxmooth },
  { key: 'backlash', label: '反向间隙补偿（前端独有）', value: axis.backlash },
  { key: 'backlash_enable', label: '启用反向间隙（前端独有）', value: axis.backlash_enable }
]


export const createControllerSections = (settings: ControllerParameters): ParameterSection[] => {
  const communication: ParameterSection = {
    id: 'controller-communication',
    title: '通讯参数',
    description: '与后端 motion_config.MotionConfig 字段对齐。',
    fields: [
      { key: 'controller_model', label: '控制器型号', value: settings.communication.controller_model },
      { key: 'controller_ip', label: 'IP 地址', value: settings.communication.controller_ip },
      { key: 'connect_timeout_s', label: '连接超时（秒）', value: settings.communication.connect_timeout_s },
      {
        key: 'enable_axes',
        label: '启用轴',
        value: settings.communication.enable_axes.join(', ')
      },
      {
        key: 'axis_count',
        label: '轴数量',
        value: settings.communication.axis_count
      }
    ]
  }

  const axisSections: ParameterSection[] = settings.axes.map((axis) => ({
    id: `controller-axis-${axis.axis_no}-input`,
    title: `${axis.axis_name} · 可配置（写入）`,
    description:
      '以下为需保存的参数；对接驱动器后由业务层写入控制器，与驱动器回读分离。',
    fields: userInputFields(axis)
  }))

  return [communication, ...axisSections]
}
