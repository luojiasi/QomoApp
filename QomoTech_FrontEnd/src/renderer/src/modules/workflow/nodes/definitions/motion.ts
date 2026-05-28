// ─────────────────────────────────────────────────────────────
// nodes/definitions/motion.ts — 运动 / IO 控制类节点蓝图
//
// motion 类节点通过 routing 字段声明后端 HTTP 接口，
// 执行引擎读取 routing 后自动把 params 组合成请求发送。
// 无需在前端写任何业务逻辑。
//
// 2026-05-28：原 io.ts 合并至此，setDigitalOutput 归入 motion 分类。
// ─────────────────────────────────────────────────────────────

import type { NodeTypeDef } from '../../types/nodeDefinition'

/**
 * 绝对位置移动节点
 * 将指定轴移动到目标绝对坐标。
 *
 * 对应后端：POST /api/motion/move-abs
 * 请求体：{ axis, position, speed }
 */
const moveAbs: NodeTypeDef = {
  type: 'motion.move-abs',
  category: 'motion',
  displayName: '绝对移动',
  icon: '↗',
  color: '#1d4ed8',
  description: '将指定轴移动到绝对坐标位置',
  version: 1,
  inputs: [{ name: 'main', displayName: '输入' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'axis',
      displayName: '轴号',
      type: 'select',
      default: 'X',
      required: true,
      description: '要移动的轴',
      options: [
        { label: 'X 轴', value: 'X' },
        { label: 'Y 轴', value: 'Y' },
        { label: 'Z 轴', value: 'Z' },
        { label: 'R 轴', value: 'R' }
      ]
    },
    {
      name: 'position',
      displayName: '目标位置 (mm)',
      type: 'number',
      default: 0,
      required: true,
      description: '绝对坐标，单位毫米',
      placeholder: '0.0'
    },
    {
      name: 'speed',
      displayName: '速度 (mm/s)',
      type: 'number',
      default: 20,
      description: '运动速度，1–100',
      placeholder: '50'
    }
  ],
  defaults: {
    axis: 'X',
    position: 0,
    speed: 20
  },
  routing: {
    method: 'POST',
    endpoint: '/api/motion/move-abs',
    paramLocation: 'body'
  }
}

/**
 * 数字输出控制节点
 * 将指定 DO 端口设置为高电平或低电平。
 *
 * 对应后端：POST /api/io/do/set
 * 请求体：{ port, value }
 */
const setDigitalOutput: NodeTypeDef = {
  type: 'io.set-do',
  category: 'motion',
  displayName: '设置数字输出',
  icon: '⇄',
  color: '#1d4ed8',
  description: '将数字输出端口设置为高/低电平',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'port',
      displayName: '端口号',
      type: 'number',
      default: 0,
      required: true,
      description: 'DO 端口编号，从 0 开始',
      placeholder: '0'
    },
    {
      name: 'value',
      displayName: '电平',
      type: 'select',
      default: 1,
      required: true,
      description: '1 = 高电平（ON），0 = 低电平（OFF）',
      options: [
        { label: '高电平 (ON)', value: 1 },
        { label: '低电平 (OFF)', value: 0 }
      ]
    }
  ],
  defaults: {
    port: 0,
    value: 1
  },
  routing: {
    method: 'POST',
    endpoint: '/api/io/do/set',
    paramLocation: 'body'
  }
}

export const motionDefs: NodeTypeDef[] = [moveAbs, setDigitalOutput]
