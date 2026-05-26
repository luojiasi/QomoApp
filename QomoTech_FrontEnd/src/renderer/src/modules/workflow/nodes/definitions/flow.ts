// ─────────────────────────────────────────────────────────────
// nodes/definitions/flow.ts — 流程控制类节点蓝图
//
// flow 类节点在前端本地执行（不调后端 HTTP）。
// 填写 executeAs 字段，执行引擎 switch-case 到对应函数。
// ─────────────────────────────────────────────────────────────

import type { NodeTypeDef } from '../../types/nodeDefinition'

/**
 * 延时节点
 * 等待指定毫秒数后再继续执行下游节点。
 *
 * 本地执行（executeAs: 'delay'），不调用后端。
 */
const delay: NodeTypeDef = {
  type: 'flow.delay',
  category: 'flow',
  displayName: '延时',
  icon: '⏱',
  color: '#c2410c',
  description: '等待指定时间后继续执行后续节点',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [{ name: 'main', displayName: '继续' }],
  params: [
    {
      name: 'duration',
      displayName: '等待时间 (ms)',
      type: 'number',
      default: 1000,
      required: true,
      description: '等待的毫秒数，最小 10ms',
      placeholder: '1000'
    }
  ],
  defaults: {
    duration: 1000
  },
  executeAs: 'delay'
}

export const flowDefs: NodeTypeDef[] = [delay]
