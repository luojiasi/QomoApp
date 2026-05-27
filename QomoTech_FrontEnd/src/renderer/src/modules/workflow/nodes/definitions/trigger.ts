// ─────────────────────────────────────────────────────────────
// nodes/definitions/trigger.ts — 触发类节点蓝图
//
// trigger 类节点是流程的入口。
// 没有输入端口，执行由外部事件或用户手动触发。
// ─────────────────────────────────────────────────────────────

import type { NodeTypeDef } from '../../types/nodeDefinition'

/**
 * 手动触发节点
 * 用户点击"运行"按钮时启动流程会跳过该手动触发节点，，适合调试与临时执行。
 */
const manualTrigger: NodeTypeDef = {
  type: 'trigger.manual',
  category: 'trigger',
  displayName: '手动触发',
  icon: '▶',
  color: '#7c3aed',
  description: '由用户点击运行按钮手动启动流程',
  version: 1,
  inputs: [],
  outputs: [{ name: 'main', displayName: '执行' }],
  params: [],
  defaults: {}
}

/**
 * 单一入口触发（点击运行的时候只会从这一个入口进行触发，不会触发手动触发节点）
 * 用户点击"运行"按钮时启动流程。
 */
const singleTrigger: NodeTypeDef = {
  type: 'trigger.single',
  category: 'trigger',
  displayName: '单一入口触发节点',
  icon: '▶',
  color: '#7c3aed',
  description: '用户点击"运行"按钮时启动流程只会从这一个入口进行触发，不会触发手动触发节点',
  version: 1,
  inputs: [],
  outputs: [{ name: 'main', displayName: '执行' }],
  params: [],
  defaults: {}
}
/**
 * 多入口触发（点击运行之后会从多个入口处触发，仅有多入口处触发，单一入口触发和多入口触发不能同时存在）
 */
const multiTrigger: NodeTypeDef = {
  type: 'trigger.multi',
  category: 'trigger',
  displayName: '多入口触发节点',
  icon: '▶',
  color: '#7c3aed',
  description: '用户点击"运行"按钮时启动流程会从多个入口进行触发，仅有多入口处触发',
  version: 1,
  inputs: [],
  outputs: [{ name: 'main', displayName: '执行' }],
  params: [],
  defaults: {}
}
export const triggerDefs: NodeTypeDef[] = [manualTrigger,singleTrigger,multiTrigger]
