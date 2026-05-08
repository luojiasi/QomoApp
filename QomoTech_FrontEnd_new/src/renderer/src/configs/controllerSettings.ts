import {
  type ControllerAxisCount,
  type ControllerAxisSettings,
  type ControllerParameters,
  type ParameterSection,
} from '../types/settings'
import { cloneSettings } from '../utils/settings'

export const AXIS_TAB_LABELS: Record<ControllerAxisCount, readonly string[]> = {
  3: ['X', 'Y', 'Z'],
  5: ['X', 'Y', 'Z', 'U', 'R'],
} as const

export function applyControllerAxisCount(
  settings: ControllerParameters,
  count: ControllerAxisCount
): ControllerParameters {
  const template = defaultControllerParameters.axes
  const out = cloneSettings(settings)
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
    enableAxes: count === 3 ? ['X', 'Y', 'Z'] : ['X', 'Y', 'Z', 'U', 'R'],
  }
  return out
}

export const defaultControllerParameters: ControllerParameters = {
  communication: {
    controllerModel: 'QomoTech406V2',
    transport: 'ethernet',
    ipAddress: '192.168.0.11',
    enableAxes: ['X', 'Y', 'Z', 'U', 'R'],
    axisCount: 5,
  },
  axes: [
    { axisNo: 0, axisName: 'X 轴' },
    { axisNo: 1, axisName: 'Y 轴' },
    { axisNo: 2, axisName: 'Z 轴' },
    { axisNo: 3, axisName: 'U 轴' },
    { axisNo: 4, axisName: 'R 轴' },
  ],
}

export const createControllerSections = (
  settings: ControllerParameters
): ParameterSection[] => {
  const communication: ParameterSection = {
    id: 'controller-communication',
    title: '通讯参数',
    description: 'QomoTech406V2 连接方式与 IP。轴参数已交由后端配置文件 motion_config.json 管理。',
    fields: [
      {
        key: 'controllerModel',
        label: '控制器型号',
        value: settings.communication.controllerModel,
      },
      {
        key: 'transport',
        label: '通讯方式',
        value: settings.communication.transport,
      },
      {
        key: 'ipAddress',
        label: 'IP 地址',
        value: settings.communication.ipAddress,
      },
      {
        key: 'enableAxes',
        label: '启用轴',
        value: settings.communication.enableAxes.join(', '),
      },
      {
        key: 'axisCount',
        label: '轴数量',
        value: settings.communication.axisCount,
      },
    ],
  }

  return [communication]
}
