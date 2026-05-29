// ─────────────────────────────────────────────────────────────
// nodes/definitions/camera.ts — 相机控制类节点蓝图
//
// camera 类节点通过 routing 字段声明后端 HTTP 接口，
// 执行引擎读取 routing 后自动把 params 组合成请求发送。
// ─────────────────────────────────────────────────────────────

import type { NodeTypeDef } from '../../types/nodeDefinition'

/**
 * 相机连接节点
 * 连接到指定编号的 USB 相机。
 *
 * 对应后端：POST /camera/connect
 */
const cameraConnect: NodeTypeDef = {
  type: 'camera.connect',
  category: 'camera',
  displayName: '相机连接',
  icon: '📷',
  color: '#0f766e',
  description: '枚举并连接到指定编号的 USB 相机',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'index',
      displayName: '相机编号',
      type: 'number',
      default: 0,
      required: true,
      description: 'USB 相机设备编号，0 为第一台',
      placeholder: '0'
    }
  ],
  defaults: {
    index: 0
  },
  routing: {
    method: 'POST',
    endpoint: '/api/camera/connect',
    paramLocation: 'body'
  }
}

/**
 * 相机断开节点
 * 断开当前连接的 USB 相机。
 *
 * 对应后端：POST /camera/disconnect
 */
const cameraDisconnect: NodeTypeDef = {
  type: 'camera.disconnect',
  category: 'camera',
  displayName: '相机断开',
  icon: '📷',
  color: '#0f766e',
  description: '断开当前连接的 USB 相机',
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
    endpoint: '/api/camera/disconnect',
    paramLocation: 'body'
  }
}

/**
 * 获取相机参数节点
 * 获取当前相机的完整状态信息（连接状态、流传输、速度等级等）。
 *
 * 对应后端：GET /api/camera/status
 */
const cameraGetParams: NodeTypeDef = {
  type: 'camera.getParams',
  category: 'camera',
  displayName: '获取相机参数',
  icon: '📷',
  color: '#0f766e',
  description: '获取当前相机的状态参数（连接状态、流传输、速度等级等）',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [],
  defaults: {},
  routing: {
    method: 'GET',
    endpoint: '/api/camera/status',
    paramLocation: 'query'
  }
}

/**
 * 设置曝光节点
 * 配置相机的曝光模式（自动/手动）及曝光时间。
 *
 * 对应后端：POST /api/camera/params/exposure
 */
const cameraSetExposure: NodeTypeDef = {
  type: 'camera.setExposure',
  category: 'camera',
  displayName: '设置曝光',
  icon: '📷',
  color: '#0f766e',
  description: '设置相机曝光模式与曝光时间',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'auto_exposure',
      displayName: '自动曝光',
      type: 'boolean',
      default: true,
      required: false,
      description: '开启后相机自动调节曝光'
    },
    {
      name: 'exposure_time',
      displayName: '曝光时间(ms)',
      type: 'number',
      default: 100,
      required: false,
      description: '手动模式下的曝光时间，单位为毫秒',
      placeholder: '100',
      showWhen: { field: 'auto_exposure', value: false }
    }
  ],
  defaults: {
    auto_exposure: true,
    exposure_time: 100
  },
  routing: {
    method: 'POST',
    endpoint: '/api/camera/params/exposure',
    paramLocation: 'body'
  }
}

/**
 * 设置帧率节点
 * 配置相机的帧率档位及自动调节参数。
 *
 * 对应后端：POST /api/camera/params/frame-speed
 */
const cameraSetFrameSpeed: NodeTypeDef = {
  type: 'camera.setFrameSpeed',
  category: 'camera',
  displayName: '设置帧率',
  icon: '📷',
  color: '#0f766e',
  description: '设置相机帧率速度等级与自动调节',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'speed_level',
      displayName: '速度等级',
      type: 'select',
      default: 1,
      required: false,
      description: '帧率速度档位，0 最低 / 3 最高',
      options: [
        { label: '0（最低）', value: 0 },
        { label: '1（低）', value: 1 },
        { label: '2（高）', value: 2 },
        { label: '3（最高）', value: 3 }
      ]
    },
    {
      name: 'auto_tune',
      displayName: '自动调节',
      type: 'boolean',
      default: true,
      required: false,
      description: '开启后相机自动调节帧率'
    },
    {
      name: 'tune',
      displayName: '调节值',
      type: 'number',
      default: 0,
      required: false,
      description: '手动调节数值',
      placeholder: '0',
      showWhen: { field: 'auto_tune', value: false }
    }
  ],
  defaults: {
    speed_level: 1,
    auto_tune: true,
    tune: 0
  },
  routing: {
    method: 'POST',
    endpoint: '/api/camera/params/frame-speed',
    paramLocation: 'body'
  }
}

/**
 * 设置镜像节点
 * 配置相机的水平和垂直镜像翻转。
 *
 * 对应后端：POST /api/camera/params/mirror
 */
const cameraSetMirror: NodeTypeDef = {
  type: 'camera.setMirror',
  category: 'camera',
  displayName: '设置镜像',
  icon: '📷',
  color: '#0f766e',
  description: '设置相机的水平与垂直镜像翻转',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'horizontal',
      displayName: '水平镜像',
      type: 'boolean',
      default: false,
      required: false,
      description: '开启后水平翻转画面'
    },
    {
      name: 'vertical',
      displayName: '垂直镜像',
      type: 'boolean',
      default: false,
      required: false,
      description: '开启后垂直翻转画面'
    }
  ],
  defaults: {
    horizontal: false,
    vertical: false
  },
  routing: {
    method: 'POST',
    endpoint: '/api/camera/params/mirror',
    paramLocation: 'body'
  }
}

/**
 * 设置白平衡节点
 * 配置相机的白平衡模式（自动/手动）及 RGB 增益值。
 *
 * 对应后端：POST /api/camera/params/white-balance
 */
const cameraSetWhiteBalance: NodeTypeDef = {
  type: 'camera.setWhiteBalance',
  category: 'camera',
  displayName: '设置白平衡',
  icon: '📷',
  color: '#0f766e',
  description: '设置相机白平衡模式与 RGB 增益参数',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'auto_white_balance',
      displayName: '自动白平衡',
      type: 'boolean',
      default: true,
      required: false,
      description: '开启后相机自动调节白平衡'
    },
    {
      name: 'once',
      displayName: '单次白平衡',
      type: 'boolean',
      default: false,
      required: false,
      description: '触发一次白平衡校准'
    },
    {
      name: 'r_gain',
      displayName: '红色增益',
      type: 'number',
      default: 1.0,
      required: false,
      description: '手动模式下的红色通道增益',
      placeholder: '1.0',
      showWhen: { field: 'auto_white_balance', value: false }
    },
    {
      name: 'g_gain',
      displayName: '绿色增益',
      type: 'number',
      default: 1.0,
      required: false,
      description: '手动模式下的绿色通道增益',
      placeholder: '1.0',
      showWhen: { field: 'auto_white_balance', value: false }
    },
    {
      name: 'b_gain',
      displayName: '蓝色增益',
      type: 'number',
      default: 1.0,
      required: false,
      description: '手动模式下的蓝色通道增益',
      placeholder: '1.0',
      showWhen: { field: 'auto_white_balance', value: false }
    }
  ],
  defaults: {
    auto_white_balance: true,
    once: false,
    r_gain: 1.0,
    g_gain: 1.0,
    b_gain: 1.0
  },
  routing: {
    method: 'POST',
    endpoint: '/api/camera/params/white-balance',
    paramLocation: 'body'
  }
}

export const cameraDefs: NodeTypeDef[] = [
  cameraConnect,
  cameraDisconnect,
  cameraGetParams,
  cameraSetExposure,
  cameraSetFrameSpeed,
  cameraSetMirror,
  cameraSetWhiteBalance
]
