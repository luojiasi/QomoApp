import type { NodeTypeMeta, NodeType } from '../types/selfProcessTypes'

type MotionApiEndpoint = {
  label: string
  endpoint: string
  method: 'GET' | 'POST'
  defaultBody?: Record<string, unknown>
}

/** 各节点类型元数据 */
export const NODE_TYPE_META: Record<NodeType, NodeTypeMeta> = {
  task: {
    type: 'task',
    label: '执行任务',
    icon: '⚙️',
    color: '#2563eb',
    description: '调用后端功能，如运动控制、相机拍照等',
    io: {
      inputs: [],
      outputs: []
    }
  },
  condition: {
    type: 'condition',
    label: '条件判断',
    icon: '🔀',
    color: '#7c3aed',
    description: '根据条件结果跳转到不同节点',
    io: {
      inputs: [],
      outputs: []
    }
  },
  delay: {
    type: 'delay',
    label: '延时等待',
    icon: '⏱️',
    color: '#ca8a04',
    description: '等待指定时间后继续执行',
    io: {
      inputs: [],
      outputs: []
    }
  },
  loop: {
    type: 'loop',
    label: '循环操作',
    icon: '🔄',
    color: '#059669',
    description: '重复执行子节点序列',
    io: {
      inputs: [],
      outputs: []
    }
  }
}

/** 节点运行状态颜色映射 */
export const NODE_STATUS_COLOR: Record<string, string> = {
  idle: '#7c3aed',
  running: '#facc15',
  success: '#16a34a',
  failed: '#dc2626',
  skipped: '#94a3b8'
}

/** 节点尺寸 */
export const NODE_WIDTH = 150
export const NODE_HEIGHT = 80

/** 日志级别颜色 */
export const LOG_LEVEL_COLOR: Record<string, string> = {
  info: '#2563eb',
  warn: '#ca8a04',
  error: '#dc2626',
  debug: '#64748b'
}

/** 日志级别标签 */
export const LOG_LEVEL_LABEL: Record<string, string> = {
  info: '信息',
  warn: '警告',
  error: '错误',
  debug: '调试'
}

/** 可调用的后端运动控制 API 列表（用于 task 节点选择） */
export const MOTION_API_ENDPOINTS: readonly MotionApiEndpoint[] = [
  {
    label: '连接控制器',
    endpoint: '/api/motion/connect',
    method: 'POST',
    defaultBody: { ipAddress: '192.168.0.11' }
  },
  {
    label: '轴绝对移动',
    endpoint: '/api/motion/axis/move-abs',
    method: 'POST',
    defaultBody: { axis_no: 0, target_mm: 0, speed: 10 }
  },
  {
    label: '轴相对移动',
    endpoint: '/api/motion/axis/move-rel',
    method: 'POST',
    defaultBody: { axis_no: 0, delta_mm: 0, speed: 10 }
  },
  {
    label: 'U轴旋转角度',
    endpoint: '/api/motion/axis/U轴旋转的角度',
    method: 'POST',
    defaultBody: { 旋转角度: 0, 旋转速度: 10, 旋转方向: '顺时针', 运动模式: 'relative' }
  },
  {
    label: 'R轴旋转圈数',
    endpoint: '/api/motion/axis/R轴旋转的圈数',
    method: 'POST',
    defaultBody: { 旋转圈数: 1, 旋转速度: 10, 旋转方向: '顺时针', 运动模式: 'relative' }
  },
  { label:'获取轴位置', endpoint: '/api/motion/position/{axis_no}', method: 'GET' },
  {
    label: '轴归零',
    endpoint: '/api/motion/axis/zero',
    method: 'POST',
    defaultBody: { axis_no: 0 }
  },
  {
    label: '轴急停',
    endpoint: '/api/motion/emergency-stop',
    method: 'POST',
    defaultBody: { axis_no: 0 }
  },
  {
    label: '设置IO输出',
    endpoint: '/api/motion/io/output',
    method: 'POST',
    defaultBody: { io_no: 0, value: true }
  },
  { label: '读取IO输入', endpoint: '/api/motion/io/input/{io_no}', method: 'GET' },
  { label: '读取IO输出', endpoint: '/api/motion/io/output/{io_no}', method: 'GET' },

  {
    label: '设置轴参数',
    endpoint: '/api/motion/axes/params',
    method: 'POST',
    defaultBody: {
      params_by_axis: {
        0: {
          units: 1000,
          lspeed: 0,
          speed: 10,
          accel: 100,
          decel: 100,
          sramp: 0
        },
        1: {
          units: 1000,
          lspeed: 0,
          speed: 10,
          accel: 100,
          decel: 100,
          sramp: 0
        },
        2: {
          units: 1000,
          lspeed: 0,
          speed: 10,
          accel: 100,
          decel: 100,
          sramp: 0
        },
        3: {
          units: 1000,
          lspeed: 0,
          speed: 10,
          accel: 100,
          decel: 100,
          sramp: 0
        }
      }
    }
  },
  { label:'断开控制器', endpoint: '/api/motion/disconnect', method: 'POST' },

] as const

/** 画布配置 */
export const CANVAS_CONFIG = {
  gridSize: 20,
  snapToGrid: true,
  padding: 40
} as const
