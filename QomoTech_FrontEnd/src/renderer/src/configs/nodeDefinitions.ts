import type { NodeDefinition, NodeCategoryMeta, NodeCategory } from '../types/selfProcessTypes'

// ═══════════════════════════════════════════════════════════════
// 节点分类元数据
// ═══════════════════════════════════════════════════════════════

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
    description: '轴移动、旋转、归零、急停等运动指令'
  },
  io: {
    category: 'io',
    label: 'IO 控制',
    icon: '🔌',
    color: '#ca8a04',
    description: '数字输入输出读写'
  },
  flow: {
    category: 'flow',
    label: '流程控制',
    icon: '🔀',
    color: '#7c3aed',
    description: '延时、条件判断、循环等流程编排'
  },
  camera: {
    category: 'camera',
    label: '相机',
    icon: '📷',
    color: '#0891b2',
    description: '图像采集'
  },
  laser: {
    category: 'laser',
    label: '激光',
    icon: 'LA',
    color: '#dc2626',
    description: '激光控制'
  }
}

// ═══════════════════════════════════════════════════════════════
// 节点类型定义
// ═══════════════════════════════════════════════════════════════

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
      { name: 'ipAddress', displayName: 'IP 地址', type: 'string', default: '192.168.0.11', required: true, placeholder: '192.168.0.11' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { ipAddress: '192.168.0.11' }
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
      { name: 'axis_no', displayName: '轴号', type: 'select', default: 0, required: true, options: [
        { label: 'X 轴 (0)', value: '0' },
        { label: 'Y 轴 (1)', value: '1' },
        { label: 'Z 轴 (2)', value: '2' },
        { label: 'U 轴 (3)', value: '3' },
        { label: 'R 轴 (4)', value: '4' }
      ]},
      { name: 'target_mm', displayName: '目标位置 (mm)', type: 'number', default: 0, required: true, placeholder: '目标绝对坐标' },
      { name: 'speed', displayName: '速度 (mm/s)', type: 'number', default: 10, required: true, placeholder: '移动速度' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { axis_no: 0, target_mm: 0, speed: 10 }
  },

  'motion.move-rel': {
    type: 'motion.move-rel',
    category: 'motion',
    label: '轴相对移动',
    icon: '➡️',
    color: '#2563eb',
    description: '将指定轴移动相对距离',
    properties: [
      { name: 'axis_no', displayName: '轴号', type: 'select', default: 0, required: true, options: [
        { label: 'X 轴 (0)', value: '0' },
        { label: 'Y 轴 (1)', value: '1' },
        { label: 'Z 轴 (2)', value: '2' },
        { label: 'U 轴 (3)', value: '3' },
        { label: 'R 轴 (4)', value: '4' }
      ]},
      { name: 'delta_mm', displayName: '位移量 (mm)', type: 'number', default: 10, required: true, placeholder: '相对位移距离' },
      { name: 'speed', displayName: '速度 (mm/s)', type: 'number', default: 10, required: true, placeholder: '移动速度' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { axis_no: 0, delta_mm: 10, speed: 10 }
  },

  'motion.rotate-u': {
    type: 'motion.rotate-u',
    category: 'motion',
    label: 'U 轴旋转',
    icon: '↻',
    color: '#2563eb',
    description: '控制 U 轴旋转指定角度',
    properties: [
      { name: 'angle', displayName: '旋转角度 (°)', type: 'number', default: 90, required: true, placeholder: '旋转角度' },
      { name: 'speed', displayName: '旋转速度', type: 'number', default: 10, required: true, placeholder: '旋转速度' },
      { name: 'direction', displayName: '旋转方向', type: 'select', default: '顺时针', required: true, options: [
        { label: '顺时针', value: '顺时针' },
        { label: '逆时针', value: '逆时针' }
      ]},
      { name: 'mode', displayName: '运动模式', type: 'select', default: 'relative', required: true, options: [
        { label: '相对', value: 'relative' },
        { label: '绝对', value: 'absolute' }
      ]}
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { angle: 90, speed: 10, direction: '顺时针', mode: 'relative' }
  },

  'motion.rotate-r': {
    type: 'motion.rotate-r',
    category: 'motion',
    label: 'R 轴旋转',
    icon: '🔄',
    color: '#2563eb',
    description: '控制 R 轴旋转指定圈数',
    properties: [
      { name: 'turns', displayName: '旋转圈数', type: 'number', default: 1, required: true, placeholder: '旋转圈数' },
      { name: 'speed', displayName: '旋转速度', type: 'number', default: 10, required: true, placeholder: '旋转速度' },
      { name: 'direction', displayName: '旋转方向', type: 'select', default: '顺时针', required: true, options: [
        { label: '顺时针', value: '顺时针' },
        { label: '逆时针', value: '逆时针' }
      ]},
      { name: 'mode', displayName: '运动模式', type: 'select', default: 'relative', required: true, options: [
        { label: '相对', value: 'relative' },
        { label: '绝对', value: 'absolute' }
      ]}
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { turns: 1, speed: 10, direction: '顺时针', mode: 'relative' }
  },

  'motion.zero': {
    type: 'motion.zero',
    category: 'motion',
    label: '轴归零',
    icon: '🏠',
    color: '#2563eb',
    description: '将指定轴回零（回原点）',
    properties: [
      { name: 'axis_no', displayName: '轴号', type: 'select', default: 0, required: true, options: [
        { label: 'X 轴 (0)', value: '0' },
        { label: 'Y 轴 (1)', value: '1' },
        { label: 'Z 轴 (2)', value: '2' },
        { label: 'U 轴 (3)', value: '3' },
        { label: 'R 轴 (4)', value: '4' }
      ]}
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { axis_no: 0 }
  },

  'motion.stop': {
    type: 'motion.stop',
    category: 'motion',
    label: '轴急停',
    icon: '🛑',
    color: '#dc2626',
    description: '紧急停止指定轴的运动',
    properties: [
      { name: 'axis_no', displayName: '轴号', type: 'select', default: 0, required: true, options: [
        { label: 'X 轴 (0)', value: '0' },
        { label: 'Y 轴 (1)', value: '1' },
        { label: 'Z 轴 (2)', value: '2' },
        { label: 'U 轴 (3)', value: '3' },
        { label: 'R 轴 (4)', value: '4' }
      ]}
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { axis_no: 0 }
  },

  'motion.get-position': {
    type: 'motion.get-position',
    category: 'motion',
    label: '获取轴位置',
    icon: '📏',
    color: '#2563eb',
    description: '读取指定轴的当前位置',
    properties: [
      { name: 'axis_no', displayName: '轴号', type: 'select', default: 0, required: true, options: [
        { label: 'X 轴 (0)', value: '0' },
        { label: 'Y 轴 (1)', value: '1' },
        { label: 'Z 轴 (2)', value: '2' },
        { label: 'U 轴 (3)', value: '3' },
        { label: 'R 轴 (4)', value: '4' }
      ]}
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '位置数据' }],
    defaults: { axis_no: 0 }
  },

  'motion.set-params': {
    type: 'motion.set-params',
    category: 'motion',
    label: '设置轴参数',
    icon: '⚙️',
    color: '#2563eb',
    description: '批量设置各轴的运动参数（units/speed/accel 等）',
    properties: [
      { name: 'params', displayName: '轴参数 JSON', type: 'json', default: JSON.stringify({
        params_by_axis: {
          0: { units: 1000, speed: 10, accel: 100, decel: 100 },
          1: { units: 1000, speed: 10, accel: 100, decel: 100 },
          2: { units: 1000, speed: 10, accel: 100, decel: 100 },
          3: { units: 1000, speed: 10, accel: 100, decel: 100 }
        }
      }, null, 2), required: true, description: '按轴号索引的参数对象' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: {}
  },

  // ──── IO 控制 ─────────────────────────────────────────────
  'io.set-output': {
    type: 'io.set-output',
    category: 'io',
    label: '设置 IO 输出',
    icon: 'SO',
    color: '#ca8a04',
    description: '设置指定数字输出端口的高低电平',
    properties: [
      { name: 'io_no', displayName: 'IO 端口号', type: 'number', default: 0, required: true, placeholder: '0-15' },
      { name: 'value', displayName: '输出值', type: 'select', default: true, required: true, options: [
        { label: '高电平 (true)', value: 'true' },
        { label: '低电平 (false)', value: 'false' }
      ]}
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '完成' }, { name: 'error', displayName: '失败' }],
    defaults: { io_no: 0, value: true }
  },

  'io.read-input': {
    type: 'io.read-input',
    category: 'io',
    label: '读取 IO 输入',
    icon: 'RI',
    color: '#ca8a04',
    description: '读取指定数字输入端口的当前状态',
    properties: [
      { name: 'io_no', displayName: 'IO 端口号', type: 'number', default: 0, required: true, placeholder: '0-15' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '输入值' }, { name: 'error', displayName: '失败' }],
    defaults: { io_no: 0 }
  },

  'io.read-output': {
    type: 'io.read-output',
    category: 'io',
    label: '读取 IO 输出',
    icon: 'RO',
    color: '#ca8a04',
    description: '读取指定数字输出端口的当前状态',
    properties: [
      { name: 'io_no', displayName: 'IO 端口号', type: 'number', default: 0, required: true, placeholder: '0-15' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '输出值' }, { name: 'error', displayName: '失败' }],
    defaults: { io_no: 0 }
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
  },

  // ──── 相机 ────────────────────────────────────────────────
  'camera.capture': {
    type: 'camera.capture',
    category: 'camera',
    label: '拍照',
    icon: '📸',
    color: '#0891b2',
    description: '触发相机采集一张图像',
    properties: [
      { name: 'savePath', displayName: '保存路径', type: 'string', default: '', required: false, placeholder: '留空使用默认路径' }
    ],
    inputs: [],
    outputs: [{ name: 'main', displayName: '图像路径' }],
    defaults: {}
  }
}

/** 获取所有节点类型 ID 列表 */
export function getAllNodeTypes(): string[] {
  return Object.keys(NODE_DEFINITIONS)
}

/** 按分类获取节点定义 */
export function getNodeDefinitionsByCategory(category: NodeCategory): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter((d) => d.category === category)
}

/** 根据类型 ID 获取定义 */
export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS[type]
}
