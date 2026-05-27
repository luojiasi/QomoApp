// ─────────────────────────────────────────────────────────────
// utils/minimapNodeColor.ts — 小地图节点着色（纯函数）
// ─────────────────────────────────────────────────────────────

import type { Node } from '@vue-flow/core'
import { NODE_REGISTRY } from '../nodes/definitions/index'
import { NODE_CATEGORY_STYLES } from '../constants/nodeStyles'
import type { NodeCategory } from '../types/nodeDefinition'

/** 按节点蓝图分类返回小地图矩形填充色（与画布节点头部色一致） */
export function resolveMiniMapNodeColor(node: Node): string {
  const nodeType = (node.data?.nodeType as string) ?? ''
  const category: NodeCategory = NODE_REGISTRY[nodeType]?.category ?? 'motion'
  return NODE_CATEGORY_STYLES[category].headerBg
}
