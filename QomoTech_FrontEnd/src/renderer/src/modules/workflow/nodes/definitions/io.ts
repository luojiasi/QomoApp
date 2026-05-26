// ─────────────────────────────────────────────────────────────
// nodes/definitions/io.ts — IO 控制类节点蓝图
//
// io 类节点用于控制数字输入/输出端口，
// 通过 routing 声明后端接口，引擎自动发 HTTP。
// ─────────────────────────────────────────────────────────────

import type { NodeTypeDef } from '../../types/nodeDefinition'

/**
 * 数字输出控制节点
 * 将指定 DO 端口设置为高电平或低电平。
 *
 * 对应后端：POST /api/io/do/set
 * 请求体：{ port, value }
 */
const setDigitalOutput: NodeTypeDef = {
  type: 'io.set-do',
  category: 'io',
  displayName: '设置数字输出',
  icon: '⇄',
  color: '#15803d',
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

export const ioDefs: NodeTypeDef[] = [setDigitalOutput]
