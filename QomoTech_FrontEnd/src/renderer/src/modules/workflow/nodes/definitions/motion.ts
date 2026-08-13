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
 * 连接控制器节点
 * 连接到 ZMC 运动控制器。
 *
 * 对应后端：POST /api/motion/connect
 * 请求体：{ ip? }
 */
const motionConnect: NodeTypeDef = {
  type: 'motion.connect',
  category: 'motion',
  displayName: '连接控制器',
  icon: '🔌',
  color: '#1d4ed8',
  description: '连接到 ZMC 运动控制器，可指定 IP 地址，留空则使用配置默认值',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'ip',
      displayName: '控制器 IP',
      type: 'string',
      default: '',
      required: false,
      description: 'ZMC 控制器 IP 地址，留空则使用系统配置的默认 IP',
      placeholder: '192.168.0.11'
    }
  ],
  defaults: {
    ip: ''
  },
  routing: {
    method: 'POST',
    endpoint: '/api/motion/connect',
    paramLocation: 'body'
  }
}

/**
 * 断开控制器节点
 * 断开与 ZMC 运动控制器的连接。
 *
 * 对应后端：POST /api/motion/disconnect
 */
const motionDisconnect: NodeTypeDef = {
  type: 'motion.disconnect',
  category: 'motion',
  displayName: '断开控制器',
  icon: '🔌',
  color: '#1d4ed8',
  description: '断开与 ZMC 运动控制器的连接',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [],
  defaults: {},
  routing: {
    method: 'POST',
    endpoint: '/api/motion/disconnect',
    paramLocation: 'body'
  }
}

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
        { label: 'U 轴', value: 'U' },
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
    endpoint: '/api/motion/move/abs',
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
    endpoint: '/api/motion/io/output',
    paramLocation: 'body'
  }
}

/**
 * 轴点动节点
 * 指定轴向连续运动（正向/反向），直到发出停止指令。
 *
 * 对应后端：POST /api/motion/jog
 * 请求体：{ axis, direction, speed? }
 */
const axisJog: NodeTypeDef = {
  type: 'motion.jog',
  category: 'motion',
  displayName: '轴点动',
  icon: '▶',
  color: '#1d4ed8',
  description: '使指定轴以点动模式连续运动，正向或反向，直到停止',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
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
      description: '要点动的轴',
      options: [
        { label: 'X 轴', value: 'X' },
        { label: 'Y 轴', value: 'Y' },
        { label: 'Z 轴', value: 'Z' },
        { label: 'U 轴', value: 'U' },
        { label: 'R 轴', value: 'R' }
      ]
    },
    {
      name: 'direction',
      displayName: '方向',
      type: 'select',
      default: 1,
      required: true,
      description: '点动方向：1 = 正向（+），-1 = 负向（-）',
      options: [
        { label: '正向 (+)', value: 1 },
        { label: '负向 (-)', value: -1 }
      ]
    },
    {
      name: 'speed',
      displayName: '速度 (mm/s)',
      type: 'number',
      default: 10,
      description: '点动速度，留空则使用系统配置默认值',
      placeholder: '10'
    }
  ],
  defaults: {
    axis: 'X',
    direction: 1,
    speed: 10
  },
  routing: {
    method: 'POST',
    endpoint: '/api/motion/jog',
    paramLocation: 'body'
  }
}

/**
 * 停止点动节点
 * 停止指定轴的点动运动。
 *
 * 对应后端：POST /api/motion/jog/stop
 * 请求体：{ axis }
 */
const axisJogStop: NodeTypeDef = {
  type: 'motion.jog-stop',
  category: 'motion',
  displayName: '停止点动',
  icon: '⏹',
  color: '#1d4ed8',
  description: '停止指定轴的点动运动',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
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
      description: '要停止点动的轴',
      options: [
        { label: 'X 轴', value: 'X' },
        { label: 'Y 轴', value: 'Y' },
        { label: 'Z 轴', value: 'Z' },
        { label: 'U 轴', value: 'U' },
        { label: 'R 轴', value: 'R' }
      ]
    }
  ],
  defaults: {
    axis: 'X'
  },
  routing: {
    method: 'POST',
    endpoint: '/api/motion/jog/stop',
    paramLocation: 'body'
  }
}

/**
 * 复位节点
 * 清除 ESTOP/ALARM 状态，恢复至 IDLE。
 *
 * 对应后端：POST /api/motion/reset
 * 无需请求参数。
 */
const motionReset: NodeTypeDef = {
  type: 'motion.reset',
  category: 'motion',
  displayName: '复位',
  icon: '↺',
  color: '#1d4ed8',
  description: '清除控制器的急停/报警状态，恢复到 IDLE 空闲状态',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [],
  defaults: {},
  routing: {
    method: 'POST',
    endpoint: '/api/motion/reset',
    paramLocation: 'body'
  }
}

/**
 * 减速停止节点
 * 取消当前运动并清空运动缓冲，所有轴减速到停止。
 *
 * 对应后端：POST /api/motion/stop
 * 无需请求参数。
 */
const motionStop: NodeTypeDef = {
  type: 'motion.stop',
  category: 'motion',
  displayName: '减速停止',
  icon: '⏹',
  color: '#1d4ed8',
  description: '取消当前运动并清空缓冲，所有轴平滑减速停止',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [],
  defaults: {},
  routing: {
    method: 'POST',
    endpoint: '/api/motion/stop',
    paramLocation: 'body'
  }
}

/**
 * 急停节点
 * 立即切断脉冲输出，所有轴瞬间停止。
 *
 * 对应后端：POST /api/motion/estop
 * 无需请求参数。
 */
const motionEstop: NodeTypeDef = {
  type: 'motion.estop',
  category: 'motion',
  displayName: '急停',
  icon: '⚠',
  color: '#1d4ed8',
  description: '立即切断脉冲输出，所有轴瞬间停止（紧急情况使用）',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [],
  defaults: {},
  routing: {
    method: 'POST',
    endpoint: '/api/motion/estop',
    paramLocation: 'body'
  }
}

/**
 * 相对移动节点
 * 将指定轴移动相对位移量（基于当前位置的增量）。
 *
 * 对应后端：POST /api/motion/move/rel
 * 请求体：{ axis, position, speed? }
 */
const moveRel: NodeTypeDef = {
  type: 'motion.move-rel',
  category: 'motion',
  displayName: '相对移动',
  icon: '↘',
  color: '#1d4ed8',
  description: '将指定轴从当前位置移动指定增量距离',
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
        { label: 'U 轴', value: 'U' },
        { label: 'R 轴', value: 'R' }
      ]
    },
    {
      name: 'position',
      displayName: '位移量 (mm)',
      type: 'number',
      default: 0,
      required: true,
      description: '相对位移量（可为负值），单位毫米',
      placeholder: '10.0'
    },
    {
      name: 'speed',
      displayName: '速度 (mm/s)',
      type: 'number',
      default: 20,
      description: '运动速度，留空使用默认值',
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
    endpoint: '/api/motion/move/rel',
    paramLocation: 'body'
  }
}

export const motionDefs: NodeTypeDef[] = [motionConnect, motionDisconnect, motionStop, motionEstop, motionReset, moveAbs, moveRel, axisJog, axisJogStop, setDigitalOutput]
