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

export const cameraDefs: NodeTypeDef[] = [cameraConnect, cameraDisconnect]
