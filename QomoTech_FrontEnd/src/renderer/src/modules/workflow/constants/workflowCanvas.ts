// ─────────────────────────────────────────────────────────────
// constants/workflowCanvas.ts — 画布渲染相关常量
// ─────────────────────────────────────────────────────────────

/** 节点卡片默认宽度（像素） */
export const NODE_WIDTH = 180

/** 节点卡片默认高度（像素），用于右键添加时居中定位及小地图缩略 */
export const NODE_HEIGHT = 100

/** 新建节点默认坐标 */
export const DEFAULT_NODE_POSITION = { x: 100, y: 100 } as const

/** VueFlow 实例 id，与 useVueFlow({ id }) 对齐，避免多 store 实例 */
export const WORKFLOW_VUE_FLOW_ID = 'qomo-workflow-canvas'

// 连线样式常量已迁移到 constants/workflowEdge.ts
