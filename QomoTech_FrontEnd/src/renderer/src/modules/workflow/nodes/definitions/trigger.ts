// ─────────────────────────────────────────────────────────────
// nodes/definitions/trigger.ts — 触发类节点蓝图
//
// trigger 类节点是流程的入口。
// 没有输入端口，执行由外部事件或用户手动触发。
// ─────────────────────────────────────────────────────────────

import type { NodeTypeDef } from '../../types/nodeDefinition'

/**
 * 手动触发节点
 * 用户点击"运行"按钮时启动流程，适合调试与临时执行。
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

export const triggerDefs: NodeTypeDef[] = [manualTrigger]
