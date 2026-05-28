// ─────────────────────────────────────────────────────────────
// utils/nodeRegistryUtils.ts — 节点注册表查询（纯函数）
// ─────────────────────────────────────────────────────────────

import { NODE_REGISTRY } from '../nodes/definitions/index'
import type { NodeCategory, NodeTypeDef } from '../types/nodeDefinition'

/** 画布右键菜单中的分类顺序 */
const CATEGORY_ORDER: NodeCategory[] = ['trigger', 'motion', 'camera', 'rs232', 'flow', 'data', 'test']

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: '触发',
  motion: '运动',
  camera: '相机',
  rs232: '串口',
  flow: '流程',
  data: '数据',
  test: '测试'
}

export interface NodePickerGroup {
  category: NodeCategory
  label: string
  nodes: NodeTypeDef[]
}

/** 按分类分组，供节点添加菜单使用 */
export function getNodePickerGroups(): NodePickerGroup[] {
  const all = Object.values(NODE_REGISTRY)
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    nodes: all.filter((def) => def.category === category)
  })).filter((group) => group.nodes.length > 0)
}
