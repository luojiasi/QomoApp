// ─────────────────────────────────────────────────────────────
// nodes/definitions/test.ts — 测试类节点蓝图
//
// test 类节点用于调试和诊断。
// ─────────────────────────────────────────────────────────────

import type { NodeTypeDef } from '../../types/nodeDefinition'

/**
 * 后端通讯测试节点
 * 向后端发送 GET /api/health 请求，验证通讯链路是否正常。
 */
const httpPing: NodeTypeDef = {
  type: 'test.http-ping',
  category: 'test',
  displayName: '后端通讯测试节点',
  icon: '⚙',
  color: '#a21caf',
  description: '向后端发送 HTTP 请求，测试通讯是否正常',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [
    { name: 'main', displayName: '完成' },
    { name: 'error', displayName: '错误' }
  ],
  params: [
    {
      name: 'method',
      displayName: '请求方法',
      type: 'select',
      default: 'GET',
      required: true,
      description: '像后端通讯方式',
      options: [
        { label: '获取数据', value: 'GET' },
        { label: '发送数据', value: 'POST' },
        { label: '更新数据', value: 'PUT' },
        { label: '删除数据', value: 'DELETE' }
      ]
    },
    {
      name: 'endpoint',
      displayName: '请求路径',
      type: 'string',
      default: '/api/health',
      required: true,
      description: '后端 API 路径，如 /api/health、/api/ping',
      placeholder: '/api/health'
    },
    {
      name: 'timeout',
      displayName: '超时时间 (ms)',
      type: 'number',
      default: 15000,
      required: false,
      description: '请求超时毫秒数，默认 15 秒',
      placeholder: '15000'
    }
  ],
  defaults: {
    method: 'GET',
    endpoint: '/api/health',
    timeout: 15000
  },
  routing: {
    method: 'GET',
    endpoint: '/api/health',
    paramLocation: 'query'
  }
}

export const testDefs: NodeTypeDef[] = [httpPing]
