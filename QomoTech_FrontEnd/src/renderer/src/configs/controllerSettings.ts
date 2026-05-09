import { IO_MAP_GROUP_COUNT } from './constants'
import {
  type ControllerAxisCount,
  type ControllerAxisDriverRead,
  type ControllerAxisSettings,
  type ControllerAxisUserInput,
  type ControllerParameters,
  type IOMapEntry,
  type IOMapNineGroups,
  type ParameterSection
} from '../types/settings'
import { cloneSettings } from '../utils/settings'

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

/** 轴切换按钮文案：三轴 XYZ，五轴 XYZRU */
export const AXIS_TAB_LABELS: Record<ControllerAxisCount, readonly string[]> = {
  3: ['X', 'Y', 'Z'],
  5: ['X', 'Y', 'Z', 'U', 'R']
} as const

/**
 * 按轴数量裁剪或补齐轴参数，并同步 enableAxes / axisCount。
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
    nextAxes.push({ ...cloneSettings(base), axisNo: i })
  }
  out.axes = nextAxes
  out.communication = {
    ...out.communication,
    axisCount: count,
    enableAxes: count === 3 ? ['X', 'Y', 'Z'] : ['X', 'Y', 'Z', 'U', 'R']
  }
  return out
}

/** 五轴：0 X、1 Y、2 Z、3 R、4 U；可配置项见类型 ControllerAxisUserInput，其余为驱动器回读占位 */
export const defaultControllerParameters: ControllerParameters = {
  communication: {
    controllerModel: 'QomoTech406V2',
    transport: 'ethernet',
    ipAddress: '192.168.0.11',
    enableAxes: ['X', 'Y', 'Z', 'U', 'R'],
    axisCount: 5
  },
  axes: [
    createAxis({
      axisNo: 0,
      axisName: 'X 轴',
      axisType: 1,
      units: 2000,
      speed: 20,
      lspeed: 20,
      creep: 10,
      accel: 500000,
      decel: 500000,
      merge: 0,
      sramp: 200,
      fwd_in: -1,
      rev_in: -1,
      corner_mode: 0,
      decel_angle: 15,
      stop_angle: 45,
      zxmooth: 0,
      backlash: 5,
      backlash_enable: false
    }),
    createAxis({
      axisNo: 1,
      axisName: 'Y 轴',
      axisType: 1,
      units: 2000,
      speed: 20,
      lspeed: 20,
      creep: 10,
      accel: 500000,
      decel: 500000,
      merge: 0,
      sramp: 200,
      fwd_in: -1,
      rev_in: -1,
      corner_mode: 0,
      decel_angle: 15,
      stop_angle: 45,
      zxmooth: 0,
      backlash: 5,
      backlash_enable: false
    }),
    createAxis({
      axisNo: 2,
      axisName: 'Z 轴',
      axisType: 1,
      units: 2000,
      speed: 20,
      lspeed: 20,
      creep: 10,
      accel: 500000,
      decel: 500000,
      merge: 0,
      sramp: 200,
      fwd_in: -1,
      rev_in: -1,
      corner_mode: 0,
      decel_angle: 15,
      stop_angle: 45,
      zxmooth: 0,
      backlash: 5,
      backlash_enable: false
    }),
    createAxis({
      axisNo: 3,
      axisName: 'U 轴',
      axisType: 1,
      units: 2000,
      speed: 20,
      lspeed: 20,
      creep: 10,
      accel: 500000,
      decel: 500000,
      merge: 0,
      sramp: 200,
      fwd_in: -1,
      rev_in: -1,
      corner_mode: 0,
      decel_angle: 15,
      stop_angle: 45,
      zxmooth: 0,
      backlash: 10,
      backlash_enable: false
    }),
    createAxis({
      axisNo: 4,
      axisName: 'R 轴',
      axisType: 1,
      units: 2000,
      speed: 20,
      lspeed: 20,
      creep: 10,
      accel: 500000,
      decel: 500000,
      merge: 0,
      sramp: 200,
      fwd_in: -1,
      rev_in: -1,
      corner_mode: 0,
      decel_angle: 15,
      stop_angle: 45,
      zxmooth: 0,
      backlash: 5,
      backlash_enable: false
    })
  ],
  ioMap: defaultIoMapNineGroups
}

const userInputFields = (axis: ControllerAxisSettings): ParameterSection['fields'] => [
  { key: 'axisNo', label: '轴号', value: axis.axisNo },
  { key: 'axisName', label: '轴名称', value: axis.axisName },
  { key: 'axisType', label: '轴类型', value: axis.axisType },
  { key: 'units', label: '脉冲当量', value: axis.units },
  { key: 'speed', label: '运行速度', value: axis.speed },
  { key: 'lspeed', label: '启动速度', value: axis.lspeed },
  { key: 'creep', label: '爬行速度', value: axis.creep },
  { key: 'accel', label: '加速度', value: axis.accel },
  { key: 'decel', label: '减速度', value: axis.decel },
  { key: 'merge', label: '连续插补', value: axis.merge },
  { key: 'sramp', label: '加减速曲线', value: axis.sramp },
  { key: 'fwd_in', label: '正限位输入', value: axis.fwd_in },
  { key: 'rev_in', label: '负限位输入', value: axis.rev_in },
  { key: 'corner_mode', label: '拐角模式', value: axis.corner_mode },
  { key: 'decel_angle', label: '拐角减速开始', value: axis.decel_angle },
  { key: 'stop_angle', label: '拐角减速结束', value: axis.stop_angle },
  { key: 'zxmooth', label: '倒角半径', value: axis.zxmooth },
  { key: 'backlash', label: '反向间隙补偿', value: axis.backlash },
  { key: 'backlash_enable', label: '是否反向间隙', value: axis.backlash_enable }
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
    description: 'QomoTech406V2 连接方式与 IP。',
    fields: [
      { key: 'controllerModel', label: '控制器型号', value: settings.communication.controllerModel },
      { key: 'transport', label: '通讯方式', value: settings.communication.transport },
      { key: 'ipAddress', label: 'IP 地址', value: settings.communication.ipAddress },
      {
        key: 'enableAxes',
        label: '启用轴',
        value: settings.communication.enableAxes.join(', ')
      },
      {
        key: 'axisCount',
        label: '轴数量',
        value: settings.communication.axisCount
      }
    ]
  }

  const axisSections: ParameterSection[] = settings.axes.flatMap((axis) => [
    {
      id: `controller-axis-${axis.axisNo}-input`,
      title: `${axis.axisName} · 可配置（写入）`,
      description:
        '以下为需保存的参数；对接驱动器后由业务层写入控制器，与驱动器回读分离。',
      fields: userInputFields(axis)
    },
    {
      id: `controller-axis-${axis.axisNo}-driver`,
      title: `${axis.axisName} · 驱动器回读（只读）`,
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
