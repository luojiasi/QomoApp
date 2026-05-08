import type { NodeDefinition, NodeCategoryMeta, NodeCategory } from '../types/selfProcessTypes'

export const NODE_CATEGORY_META: Record<NodeCategory, NodeCategoryMeta> = {
  workflowSystem: {
    category: 'workflowSystem',
    label: '流程系统',
    icon: '⚙',
    color: '#6366f1',
    description: '流程入口控制'
  },
  motion: {
    category: 'motion',
    label: '运动控制',
    icon: '⚡',
    color: '#2563eb',
    description: '轴移动、回零、急停等运动指令'
  },
  flow: {
    category: 'flow',
    label: '流程控制',
    icon: '🔀',
    color: '#7c3aed',
    description: '延时、条件判断、循环等流程编排'
  }
}

const AXIS_OPTIONS = [
  { label: 'X 轴', value: 'X' },
  { label: 'Y 轴', value: 'Y' },
  { label: 'Z 轴', value: 'Z' },
  { label: 'U 轴', value: 'U' },
  { label: 'R 轴', value: 'R' }
]

export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
  // ──── 流程系统 ────────────────────────────────────────────
  'workflowSystem.singleStart': {
    type: 'workflowSystem.singleStart',
    category: 'workflowSystem',
    label: '单一入口',
    icon: '▶',
    color: '#22c55e',
    description: '流程唯一入口，每个流程仅允许添加一个',
    properties: [],
    inputs: [],
    outputs: [{ name: 'main', displayName: '开始' }],
    defaults: {}
  },

  'workflowSystem.multiStart': {
    type: 'workflowSystem.multiStart',
    category: 'workflowSystem',
    label: '并行入口',
    icon: '⏩',
    color: '#6366f1',
    description: '并行入口，允许多个，每个作为独立并行起点',
    properties: [],
    inputs: [],
    outputs: [{ name: 'main', displayName: '开始' }],
    defaults: {}
  },

  // ──── 运动控制 ────────────────────────────────────────────
  'motion.connect': {
    type: 'motion.connect',
    category: 'motion',
    label: '连接控制器',
    icon: '🔗',
    color: '#2563eb',
    description: '建立与 ZMC 运动控制器的通讯连接',
    properties: [
      { name: 'ip', displayName: 'IP 地址', type: 'string', default: '192.168.0.11', required: true, placeholder: '192.168.0.11' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { ip: '192.168.0.11' }
  },

  'motion.disconnect': {
    type: 'motion.disconnect',
    category: 'motion',
    label: '断开控制器',
    icon: '✂️',
    color: '#2563eb',
    description: '断开与运动控制器的连接',
    properties: [],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: {}
  },

  'motion.move-abs': {
    type: 'motion.move-abs',
    category: 'motion',
    label: '轴绝对移动',
    icon: '🎯',
    color: '#2563eb',
    description: '将指定轴移动到绝对坐标位置',
    properties: [
      { name: 'axis', displayName: '轴', type: 'select', default: 'X', required: true, options: AXIS_OPTIONS },
      { name: 'position', displayName: '目标位置', type: 'number', default: 0, required: true, placeholder: '目标绝对坐标' },
      { name: 'speed', displayName: '速度', type: 'number', default: 10, required: false, placeholder: '移动速度' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { axis: 'X', position: 0, speed: 10 }
  },

  'motion.move-rel': {
    type: 'motion.move-rel',
    category: 'motion',
    label: '轴相对移动',
    icon: '➡️',
    color: '#2563eb',
    description: '将指定轴移动相对距离',
    properties: [
      { name: 'axis', displayName: '轴', type: 'select', default: 'X', required: true, options: AXIS_OPTIONS },
      { name: 'delta', displayName: '位移量', type: 'number', default: 10, required: true, placeholder: '相对位移距离' },
      { name: 'speed', displayName: '速度', type: 'number', default: 10, required: false, placeholder: '移动速度' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { axis: 'X', delta: 10, speed: 10 }
  },

  'motion.move-linear': {
    type: 'motion.move-linear',
    category: 'motion',
    label: '多轴直线插补',
    icon: '📐',
    color: '#2563eb',
    description: '多轴同步直线插补运动（可相对/绝对）',
    properties: [
      { name: 'axes', displayName: '轴列表', type: 'string', default: '["X","Y"]', required: true, placeholder: '["X","Y"]' },
      { name: 'positions', displayName: '位置列表', type: 'string', default: '[0,0]', required: true, placeholder: '[10,20]' },
      { name: 'relative', displayName: '相对运动', type: 'select', default: false, required: false, options: [
        { label: '否（绝对）', value: 'false' },
        { label: '是（相对）', value: 'true' }
      ]},
      { name: 'speed', displayName: '速度', type: 'number', default: 10, required: false, placeholder: '移动速度' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { axes: '["X","Y"]', positions: '[0,0]', relative: false, speed: 10 }
  },

  'motion.home': {
    type: 'motion.home',
    category: 'motion',
    label: '轴回零',
    icon: '🏠',
    color: '#2563eb',
    description: '将指定轴回零（回原点），留空表示全轴回零',
    properties: [
      { name: 'axes', displayName: '回零轴', type: 'string', default: '', required: false, placeholder: '留空=全轴，如 X,Y,Z' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { axes: '' }
  },

  'motion.stop': {
    type: 'motion.stop',
    category: 'motion',
    label: '停止运动',
    icon: '⏹️',
    color: '#dc2626',
    description: '停止所有轴的运动',
    properties: [],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: {}
  },

  'motion.estop': {
    type: 'motion.estop',
    category: 'motion',
    label: '全局急停',
    icon: '🛑',
    color: '#dc2626',
    description: '紧急停止所有轴',
    properties: [],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }],
    defaults: {}
  },

  'motion.pause': {
    type: 'motion.pause',
    category: 'motion',
    label: '暂停运动',
    icon: '⏸️',
    color: '#f59e0b',
    description: '暂停所有轴的运动',
    properties: [],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: {}
  },

  'motion.resume': {
    type: 'motion.resume',
    category: 'motion',
    label: '继续运动',
    icon: '▶️',
    color: '#22c55e',
    description: '恢复暂停的运动',
    properties: [],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: {}
  },

  'motion.reset': {
    type: 'motion.reset',
    category: 'motion',
    label: '复位',
    icon: '🔄',
    color: '#3b82f6',
    description: '复位控制器报警',
    properties: [],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: {}
  },

  // ──── 流程控制 ────────────────────────────────────────────
  'flow.delay': {
    type: 'flow.delay',
    category: 'flow',
    label: '延时等待',
    icon: '⏱️',
    color: '#7c3aed',
    description: '暂停执行指定时间后继续',
    properties: [
      { name: 'seconds', displayName: '等待时间 (秒)', type: 'number', default: 1, required: true, placeholder: '延时秒数' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { seconds: 1 }
  },

  'flow.condition': {
    type: 'flow.condition',
    category: 'flow',
    label: '条件判断',
    icon: '🔀',
    color: '#7c3aed',
    description: '根据条件表达式结果走不同分支（true/false 两个出口）',
    properties: [
      { name: 'leftOperand', displayName: '左操作数', type: 'string', default: '', required: true, placeholder: '如: $prev.result.position' },
      { name: 'operator', displayName: '运算符', type: 'select', default: 'eq', required: true, options: [
        { label: '等于 (==)', value: 'eq' },
        { label: '不等于 (!=)', value: 'ne' },
        { label: '大于 (>)', value: 'gt' },
        { label: '大于等于 (>=)', value: 'gte' },
        { label: '小于 (<)', value: 'lt' },
        { label: '小于等于 (<=)', value: 'lte' },
        { label: '包含', value: 'contains' }
      ]},
      { name: 'rightOperand', displayName: '右操作数', type: 'string', default: '', required: true, placeholder: '比较目标值' }
    ],
    inputs: [
      { name: 'input', displayName: '左操作数输入' },
      { name: 'compare', displayName: '右操作数输入' }
    ],
    outputs: [
      { name: 'true', displayName: '条件成立' },
      { name: 'false', displayName: '条件不成立' }
    ],
    defaults: { leftOperand: '', operator: 'eq', rightOperand: '' }
  },

  'flow.loop': {
    type: 'flow.loop',
    category: 'flow',
    label: '循环操作',
    icon: '🔁',
    color: '#7c3aed',
    description: '重复执行后续节点指定次数',
    properties: [
      { name: 'count', displayName: '循环次数', type: 'number', default: 5, required: true, placeholder: '执行次数' }
    ],
    inputs: [],
    outputs: [
      { name: 'loop', displayName: '循环体' },
      { name: 'done', displayName: '循环结束' }
    ],
    defaults: { count: 5 }
  },

  'flow.setVariable': {
    type: 'flow.setVariable',
    category: 'flow',
    label: '设置变量',
    icon: '📝',
    color: '#7c3aed',
    description: '设置流程变量值，可在后续节点中通过 $var.变量名 引用',
    properties: [
      { name: 'varName', displayName: '变量名', type: 'string', default: '', required: true, placeholder: '变量名（不含$前缀）' },
      { name: 'value', displayName: '值', type: 'string', default: '', required: true, placeholder: '支持表达式如 $prev.data.position' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }],
    defaults: { varName: '', value: '' }
  },

  'flow.getVariable': {
    type: 'flow.getVariable',
    category: 'flow',
    label: '获取变量',
    icon: '🔍',
    color: '#7c3aed',
    description: '读取流程变量值并输出到 data.value',
    properties: [
      { name: 'varName', displayName: '变量名', type: 'string', default: '', required: true, placeholder: '要读取的变量名（不含$前缀）' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '变量值' }],
    defaults: { varName: '' }
  }
}

export function getAllNodeTypes(): string[] {
  return Object.keys(NODE_DEFINITIONS)
}

export function getNodeDefinitionsByCategory(category: NodeCategory): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter((d) => d.category === category)
}

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS[type]
}
