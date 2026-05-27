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

/**
 * 数据变换节点
 * 对上游数据的某个字段进行数学或字符串运算，输出变换后的数据。
 *
 * 本地执行（executeAs: 'transform'），不调用后端。
 */
const transformData: NodeTypeDef = {
  type: 'data.transform',
  category: 'data',
  displayName: '数据变换',
  icon: '⇄',
  color: '#7c3aed',
  description: '对上游数据的字段进行加减乘除或字符串变换',
  version: 1,
  inputs: [{ name: 'main', displayName: '输入' }],
  outputs: [{ name: 'main', displayName: '输出' }],
  params: [
    {
      name: 'field',
      displayName: '变换字段',
      type: 'string',
      default: '',
      required: true,
      description: '要变换的上游数据字段名，如 pos、name。留空则用整个数据',
      placeholder: '如 pos'
    },
    {
      name: 'operation',
      displayName: '操作',
      type: 'select',
      default: 'add',
      required: true,
      options: [
        { label: '加 (+)', value: 'add' },
        { label: '减 (-)', value: 'subtract' },
        { label: '乘 (×)', value: 'multiply' },
        { label: '除 (÷)', value: 'divide' },
        { label: '取余 (%)', value: 'modulo' },
        { label: '前面拼接', value: 'concat_before' },
        { label: '后面拼接', value: 'concat_after' },
        { label: '转大写', value: 'to_upper' },
        { label: '转小写', value: 'to_lower' },
        { label: '替换 (→)', value: 'replace' }
      ],
      description: '数学运算或字符串操作'
    },
    {
      name: 'operand',
      displayName: '操作数',
      type: 'string',
      default: '',
      required: false,
      description: '运算的另一个值。加减乘除填数字；替换用 旧文本→新文本 格式',
      placeholder: '如 10 或 前缀'
    },
    {
      name: 'targetField',
      displayName: '输出字段名',
      type: 'string',
      default: '',
      required: false,
      description: '结果存入的字段名，留空则覆盖原字段',
      placeholder: '留空即覆盖原字段'
    }
  ],
  defaults: {
    field: '',
    operation: 'add',
    operand: '',
    targetField: ''
  },
  executeAs: 'transform'
}

export const createDefs: NodeTypeDef[] = [createData, transformData]
