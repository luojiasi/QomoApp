import type { ControllerAxisUserInput, ControllerParameters } from '../types'
import type { ParameterSection } from '@/shared/types'

const userInputFields = (
  axis: ControllerAxisUserInput
): ParameterSection['fields'] => [
  { key: 'axis_no', label: '轴号', value: axis.axis_no },
  { key: 'axis_name', label: '轴名称', value: axis.axis_name },
  { key: 'axis_type', label: '轴类型', value: axis.axis_type },
  { key: 'units', label: '脉冲当量', value: axis.units },
  { key: 'speed', label: '运行速度', value: axis.speed },
  { key: 'lspeed', label: '起跳速度 lspeed', value: axis.lspeed },
  { key: 'creep', label: '爬行速度(回零用)', value: axis.creep },
  { key: 'accel', label: '加速度', value: axis.accel },
  { key: 'decel', label: '减速度', value: axis.decel },
  { key: 'sramp', label: 'S曲线时间', value: axis.sramp },
  { key: 'merge', label: '连续插补(0/1)', value: axis.merge },
  { key: 'fwd_in', label: '正限位输入(-1=禁用)', value: axis.fwd_in },
  { key: 'rev_in', label: '负限位输入(-1=禁用)', value: axis.rev_in },
  {
    key: 'corner_mode',
    label: '拐角模式 corner_mode',
    value: axis.merge_params.corner_mode
  },
  {
    key: 'decel_angle',
    label: '拐角减速开始 decel_angle',
    value: axis.merge_params.decel_angle
  },
  {
    key: 'stop_angle',
    label: '拐角强制停止 stop_angle',
    value: axis.merge_params.stop_angle
  },
  {
    key: 'zxmooth',
    label: '拐角圆滑半径 zxmooth',
    value: axis.merge_params.zxmooth
  },
  { key: 'backlash', label: '反向间隙补偿（前端独有）', value: axis.backlash },
  {
    key: 'backlash_enable',
    label: '启用反向间隙（前端独有）',
    value: axis.backlash_enable
  }
]

/** 根据控制器设置生成参数分节（用于 UI 渲染） */
export function createControllerSections(
  settings: ControllerParameters
): ParameterSection[] {
  const communication: ParameterSection = {
    id: 'controller-communication',
    title: '通讯参数',
    description: '与后端 motion_config.MotionConfig 字段对齐。',
    fields: [
      {
        key: 'controller_model',
        label: '控制器型号',
        value: settings.communication.controller_model
      },
      {
        key: 'controller_ip',
        label: 'IP 地址',
        value: settings.communication.controller_ip
      },
      {
        key: 'connect_timeout_s',
        label: '连接超时（秒）',
        value: settings.communication.connect_timeout_s
      },
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
