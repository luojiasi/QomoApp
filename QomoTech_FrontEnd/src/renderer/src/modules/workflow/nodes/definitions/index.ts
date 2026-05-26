// ─────────────────────────────────────────────────────────────
// nodes/definitions/index.ts — 节点注册表
//
// 在这里把各分类的节点蓝图汇总，导出统一的 NODE_REGISTRY。
// 引擎、节点选择器等所有地方只需从此处取数据。
//
// 如何新增一种节点：
//   1. 在对应分类文件里添加 NodeTypeDef 对象（或新建文件）。
//   2. 在下方 allDefs 数组里引入。
//   3. 完成，引擎和 UI 自动识别。
// ─────────────────────────────────────────────────────────────

import type { NodeRegistry, NodeTypeDef } from '../../types/nodeDefinition'
import { triggerDefs } from './trigger'
import { motionDefs } from './motion'
import { ioDefs } from './io'
import { flowDefs } from './flow'

const allDefs: NodeTypeDef[] = [
  ...triggerDefs,
  ...motionDefs,
  ...ioDefs,
  ...flowDefs
]

/**
 * 全局节点注册表，key = NodeTypeDef.type。
 * @example NODE_REGISTRY['motion.move-abs'].params
 */
export const NODE_REGISTRY: NodeRegistry = Object.fromEntries(
  allDefs.map((def) => [def.type, def]),
)
