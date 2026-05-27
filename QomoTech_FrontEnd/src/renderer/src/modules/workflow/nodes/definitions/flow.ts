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

/**
 * 倒计时节点
 * 按秒/分/时倒计时，每秒回调进度（剩余时间文本），
 * 完成后继续执行下游节点。
 *
 * 本地执行（executeAs: 'countdown'），不调用后端。
 */
const countdown: NodeTypeDef = {
  type: 'flow.countdown',
  category: 'flow',
  displayName: '倒计时',
  icon: '⏲',
  color: '#c2410c',
  description: '倒计时指定时长，每秒更新剩余时间，完成后继续',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [{ name: 'main', displayName: '完成' }],
  params: [
    {
      name: 'minutes',
      displayName: '分钟',
      type: 'number',
      default: 0,
      required: false,
      description: '倒计时分钟数',
      placeholder: '0'
    },
    {
      name: 'seconds',
      displayName: '秒',
      type: 'number',
      default: 5,
      required: false,
      description: '倒计时秒数',
      placeholder: '5'
    }
  ],
  defaults: {
    minutes: 0,
    seconds: 5
  },
  executeAs: 'countdown'
}

/**
 * 定时节点
 * 等待到指定的绝对时间后再继续执行下游节点。
 *
 * 本地执行（executeAs: 'schedule'），不调用后端。
 */
const schedule: NodeTypeDef = {
  type: 'flow.schedule',
  category: 'flow',
  displayName: '定时',
  icon: '🕐',
  color: '#c2410c',
  description: '等到指定时间点后继续执行后续节点',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [{ name: 'main', displayName: '到时' }],
  params: [
    {
      name: 'date',
      displayName: '日期',
      type: 'date',
      default: '',
      required: true,
      description: '选择目标日期'
    },
    {
      name: 'time',
      displayName: '时间',
      type: 'time',
      default: '00:00',
      required: true,
      description: '输入目标时间'
    }
  ],
  defaults: {
    date: '',
    time: '00:00'
  },
  executeAs: 'schedule'
}

/**
 * IF 判断节点
 * 根据条件列表评估上游数据，所有条件为 AND 关系。
 * 全部满足走 True 分支，任一不满足走 False 分支。
 *
 * 本地执行（executeAs: 'condition'），不调用后端。
 */
const condition: NodeTypeDef = {
  type: 'flow.condition',
  category: 'flow',
  displayName: 'IF 判断',
  icon: '◇',
  color: '#c2410c',
  description: '根据上游数据判断条件，分流 True/False 分支',
  version: 1,
  inputs: [{ name: 'main', displayName: '输入' }],
  outputs: [
    { name: 'true', displayName: 'True' },
    { name: 'false', displayName: 'False' }
  ],
  params: [
    {
      name: 'extraInputCount',
      displayName: '额外输入端口数',
      type: 'number',
      default: 0,
      required: false,
      description: '额外输入端口的数量（自动命名为 输入1、输入2...）',
      placeholder: '0'
    },
    {
      name: 'conditionMode',
      displayName: '条件关系',
      type: 'select',
      default: 'AND',
      required: false,
      options: [
        { label: 'AND（全部满足）', value: 'AND' },
        { label: 'OR（任一满足）', value: 'OR' }
      ],
      description: '多个条件之间的逻辑关系'
    },
    {
      name: 'conditions',
      displayName: '条件列表',
      type: 'conditionList',
      default: [],
      required: true,
      description: '所有条件为 AND 关系，全部满足走 True，否则走 False'
    }
  ],
  defaults: {
    extraInputCount: 0,
    conditionMode: 'AND',
    conditions: []
  },
  executeAs: 'condition'
}

export const flowDefs: NodeTypeDef[] = [delay, countdown, schedule, condition]
