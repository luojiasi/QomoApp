// ─────────────────────────────────────────────────────────────
// nodes/definitions/create_params.ts — 数据构造类节点蓝图
//
// data 类节点用于构造/生成数据，供下游节点（如 IF 判断）使用。
// ─────────────────────────────────────────────────────────────

import type { NodeTypeDef } from '../../types/nodeDefinition'

/**
 * 数据构造节点
 * 用户写入 JSON 数据，执行时原样输出给下游节点。
 *
 * 本地执行（executeAs: 'passthrough'），不调用后端。
 */
const createData: NodeTypeDef = {
  type: 'data.create',
  category: 'data',
  displayName: '构造数据',
  icon: '{ }',
  color: '#7c3aed',
  description: '构造 JSON 数据，原样传递给下游节点',
  version: 1,
  inputs: [{ name: 'main', displayName: '执行' }],
  outputs: [{ name: 'main', displayName: '输出' }],
  params: [
    {
      name: 'data',
      displayName: '输出数据',
      type: 'json',
      default: '{}',
      required: false,
      description: 'JSON 格式的数据，如 {"x":100,"y":200}，执行时原样输出给下游'
    }
  ],
  defaults: {
    data: '{}'
  },
  executeAs: 'passthrough'
}

export const createDefs: NodeTypeDef[] = [createData]
