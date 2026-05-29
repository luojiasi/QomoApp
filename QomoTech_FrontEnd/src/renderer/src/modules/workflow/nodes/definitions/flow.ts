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

/**
 * WHILE 循环节点
 *
 * 4 端口架构：
 *   main 输入 → 接收上游初始数据
 *   compute 输出 → 把循环数据发给计算链（变换+1 等），结果通过 compute_result 回传
 *   body 输出 → 触发副作用链（HTTP/日志/延迟），末尾由 loop_end 节点发信号回传
 *   done 输出 → 条件不满足/超限时退出
 *
 * 本地执行（executeAs: 'loop'），不调用后端。
 */
const loop: NodeTypeDef = {
  type: 'flow.loop',
  category: 'flow',
  displayName: 'WHILE 循环',
  icon: '⟳',
  color: '#c2410c',
  description: '条件满足时执行计算体→循环体，不满足时退出',
  version: 1,
  inputs: [
    { name: 'main', displayName: '输入' },
    { name: 'compute_result', displayName: '计算结果' },
    { name: 'loop_end', displayName: '循环结果' }
  ],
  outputs: [
    { name: 'compute', displayName: '计算体' },
    { name: 'body', displayName: '循环体' },
    { name: 'done', displayName: '完成' }
  ],
  params: [
    {
      name: 'maxIterations',
      displayName: '最大循环次数',
      type: 'number',
      default: 100,
      required: false,
      description: '防止无限循环的安全上限',
      placeholder: '100'
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
      description: '条件满足时继续循环，否则退出'
    }
  ],
  defaults: {
    maxIterations: 100,
    conditionMode: 'AND',
    conditions: []
  },
  executeAs: 'loop'
}

/**
 * WHILE 循环结束节点
 *
 * 放在循环体（body）链路末尾，发信号通知 WHILE 本轮结束。
 * 仅做控制信号，不携带数据。
 */
const loopEnd: NodeTypeDef = {
  type: 'flow.loop_end',
  category: 'flow',
  displayName: '循环结束',
  icon: '↩',
  color: '#c2410c',
  description: '标记循环体结束，通知 WHILE 进入下一轮判断',
  version: 1,
  inputs: [{ name: 'main', displayName: '输入' }],
  outputs: [{ name: 'main', displayName: '完成' }],
  params: [],
  defaults: {}
}

/**
 * 等待节点完成（并行汇聚）
 * 等待所有输入端口都收到数据后，合并输出继续下游。
 *
 * 本地执行（executeAs: 'wait_all'），不调用后端。
 */
const waitAll: NodeTypeDef = {
  type: 'flow.wait_all',
  category: 'flow',
  displayName: '等待节点完成',
  icon: '⏳',
  color: '#c2410c',
  description: '等待所有输入端口全部收到数据后，合并数据继续执行下游',
  version: 1,
  inputs: [
    { name: 'in_1', displayName: '输入1' },
    { name: 'in_2', displayName: '输入2' }
  ],
  outputs: [{ name: 'main', displayName: '完成' }],
  params: [
    {
      name: 'extraInputCount',
      displayName: '额外输入端口数',
      type: 'number',
      default: 0,
      required: false,
      description: '需等待的分支总数-2（如3个分支填1），未连接的端口悬空即可',
      placeholder: '0'
    }
  ],
  defaults: {
    extraInputCount: 0
  },
  executeAs: 'wait_all'
}

/**
 * 弹窗通知节点
 * 执行时在页面右上角弹出通知弹窗。
 *
 * 本地执行（executeAs: 'notify'），不调用后端。
 */
const notify: NodeTypeDef = {
  type: 'flow.notify',
  category: 'flow',
  displayName: '弹窗通知',
  icon: '🔔',
  color: '#c2410c',
  description: '在页面右上角弹出通知，支持成功/错误/警告/信息四种类型',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [{ name: 'main', displayName: '完成' }],
  params: [
    {
      name: 'type',
      displayName: '通知类型',
      type: 'select',
      default: 'info',
      required: true,
      options: [
        { label: '成功', value: 'success' },
        { label: '错误', value: 'error' },
        { label: '警告', value: 'warning' },
        { label: '信息', value: 'info' }
      ],
      description: '弹窗的样式和图标风格'
    },
    {
      name: 'message',
      displayName: '通知标题',
      type: 'string',
      default: '',
      required: true,
      description: '弹窗显示的标题文本',
      placeholder: '操作完成'
    },
    {
      name: 'description',
      displayName: '通知描述',
      type: 'json',
      default: '',
      required: false,
      description: '弹窗显示的描述文本，支持从上游数据引用',
      placeholder: '留空则无描述'
    },
    {
      name: 'duration',
      displayName: '显示时长 (ms)',
      type: 'number',
      default: 4500,
      required: false,
      description: '通知弹窗显示的毫秒数，默认 4.5 秒',
      placeholder: '4500'
    }
  ],
  defaults: {
    type: 'info',
    message: '',
    description: '',
    duration: 4500
  },
  executeAs: 'notify'
}

export const flowDefs: NodeTypeDef[] = [delay, countdown, schedule, condition, loop, loopEnd, waitAll, notify]
