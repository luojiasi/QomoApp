import { IO_MAP_GROUP_COUNT } from '@/shared/constants'
import {
  type AxisMergeParams,
  type ControllerAxisCount,
  type ControllerAxisDriverRead,
  type ControllerAxisSettings,
  type ControllerAxisUserInput,
  type ControllerParameters,
  type IOMapEntry,
  type IOMapNineGroups,
  type ParameterSection
} from '@/types/settings'
import { cloneSettings } from '@/utils/settings'

const defaultDriverRead: ControllerAxisDriverRead = {
  dpos: 0,
  mpos: 0,
  endmove: 0,
  fs_limit: 0,
  rs_limit: 0,
  idle: 0,
  mspeed: 0,
  mtype: 0,
  ntype: 0,
  vp_speed: 0,
  axisstatus: 0,
  move_mark: 0,
  move_curmark: 0,
  axis_stopforeason: 0,
  move_buffered: 0,
  force_speed: 0,
  startmove_speed: 0,
  endmove_speed: 0
}

/** 后端 motion_config.MergeParams 的默认值 */
export const defaultAxisMergeParams = (): AxisMergeParams => ({
  corner_mode: 0,
  decel_angle: 15.0,
  stop_angle: 45.0,
  zxmooth: 0.0
})

function createAxis(
  input: ControllerAxisUserInput,
  driver: Partial<ControllerAxisDriverRead> = {}
): ControllerAxisSettings {
  return { ...input, ...defaultDriverRead, ...driver }
}

const defaultIoEntry = (): IOMapEntry => ({ digitalIn: false, digitalOut: false })

const defaultIoMapNineGroups: IOMapNineGroups = Array.from({ length: IO_MAP_GROUP_COUNT }, () =>
  defaultIoEntry()
) as IOMapNineGroups

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
  const nextAxes: ControllerAxisSettings[] = []
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
function makeDefaultAxis(axis_no: number, axis_name: string): ControllerAxisSettings {
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
    transport: 'ethernet',
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
  ],
  ioMap: defaultIoMapNineGroups
}

const userInputFields = (axis: ControllerAxisSettings): ParameterSection['fields'] => [
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
  // —— merge_params 子模型（key 保持扁平名，渲染层自行寻址 axis.merge_params.xxx） ——
  { key: 'corner_mode', label: '拐角模式 corner_mode', value: axis.merge_params.corner_mode },
  { key: 'decel_angle', label: '拐角减速开始 decel_angle', value: axis.merge_params.decel_angle },
  { key: 'stop_angle', label: '拐角强制停止 stop_angle', value: axis.merge_params.stop_angle },
  { key: 'zxmooth', label: '拐角圆滑半径 zxmooth', value: axis.merge_params.zxmooth },
  // —— 前端独有（通过 /axis/backlash 单独下发）——
  { key: 'backlash', label: '反向间隙补偿（前端独有）', value: axis.backlash },
  { key: 'backlash_enable', label: '启用反向间隙（前端独有）', value: axis.backlash_enable }
]

const driverReadFields = (axis: ControllerAxisSettings): ParameterSection['fields'] => [
  { key: 'dpos', label: '轴指令位置 DPOS', value: axis.dpos },
  { key: 'mpos', label: '编码器反馈 MPOS', value: axis.mpos },
  { key: 'endmove', label: '当前运动目标', value: axis.endmove },
  { key: 'fs_limit', label: '正软限位', value: axis.fs_limit },
  { key: 'rs_limit', label: '负软限位', value: axis.rs_limit },
  { key: 'idle', label: '运动状态', value: axis.idle },
  { key: 'mspeed', label: '实际反馈速度', value: axis.mspeed },
  { key: 'mtype', label: '当前运动类型', value: axis.mtype },
  { key: 'ntype', label: '下条运动类型', value: axis.ntype },
  { key: 'vp_speed', label: '当前运动速度', value: axis.vp_speed },
  { key: 'axisstatus', label: '轴状态', value: axis.axisstatus },
  { key: 'move_mark', label: '运动标记', value: axis.move_mark },
  { key: 'move_curmark', label: '当前运动标记', value: axis.move_curmark },
  { key: 'axis_stopforeason', label: '轴停止原因', value: axis.axis_stopforeason },
  { key: 'move_buffered', label: '当前缓冲数', value: axis.move_buffered },
  { key: 'force_speed', label: 'SP 速度', value: axis.force_speed },
  { key: 'startmove_speed', label: 'SP 运动开始速度', value: axis.startmove_speed },
  { key: 'endmove_speed', label: 'SP 运动结束速度', value: axis.endmove_speed }
]

export const createControllerSections = (settings: ControllerParameters): ParameterSection[] => {
  const communication: ParameterSection = {
    id: 'controller-communication',
    title: '通讯参数',
    description: '与后端 motion_config.MotionConfig 字段对齐。',
    fields: [
      { key: 'controller_model', label: '控制器型号', value: settings.communication.controller_model },
      { key: 'transport', label: '通讯方式', value: settings.communication.transport },
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

  const axisSections: ParameterSection[] = settings.axes.flatMap((axis) => [
    {
      id: `controller-axis-${axis.axis_no}-input`,
      title: `${axis.axis_name} · 可配置（写入）`,
      description:
        '以下为需保存的参数；对接驱动器后由业务层写入控制器，与驱动器回读分离。',
      fields: userInputFields(axis)
    },
    {
      id: `controller-axis-${axis.axis_no}-driver`,
      title: `${axis.axis_name} · 驱动器回读（只读）`,
      description: '由驱动器/控制器实时读取的状态，界面仅展示。',
      fields: driverReadFields(axis)
    }
  ])

  const ioInSection: ParameterSection = {
    id: 'controller-io-map-in',
    title: 'I/O 数字量输入（驱动器回读）',
    description: `固定 ${IO_MAP_GROUP_COUNT} 组；可由上位机下发或界面编辑。`,
    fields: settings.ioMap.map((row, i) => ({
      key: `io-${i}-in`,
      label: `输入${i} `,
      value: row.digitalIn
    }))
  }

  const ioOutSection: ParameterSection = {
    id: 'controller-io-map-out',
    title: 'I/O 数字量输出（可控制） ',
    description: `固定 ${IO_MAP_GROUP_COUNT} 组；仅由驱动器回读，界面只读展示。`,
    fields: settings.ioMap.map((row, i) => ({
      key: `io-${i}-out`,
      label: `输出${i}`,
      value: row.digitalOut
    }))
  }

  return [communication, ...axisSections, ioInSection, ioOutSection]
}
