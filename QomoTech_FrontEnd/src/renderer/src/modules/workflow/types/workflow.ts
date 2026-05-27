// ─────────────────────────────────────────────────────────────
// types/workflow.ts
//
// 流程数据的核心类型定义。
// 这里的类型描述"存储在 workflow.json 里的数据结构"，
// 与节点蓝图（nodeDefinition.ts）不同：
//   - workflow.ts   = 运行时数据（用户创建的流程、节点实例）
//   - nodeDefinition.ts = 静态配置（节点有哪些类型、每种类型长什么样）
// ─────────────────────────────────────────────────────────────

import type { CanvasSettingsOverride } from './canvasSettings'

// ─── 节点执行状态 ─────────────────────────────────────────────

/**
 * 节点在画布上的执行状态。
 *
 * editing → 编辑中（默认状态，无指示器）
 * idle    → 未运行（等待执行）
 * running → 执行中
 * success → 执行成功
 * failure → 执行失败
 * warning → 执行完成但有警告
 */
export type NodeExecutionStatus =
  | 'editing'
  | 'idle'
  | 'running'
  | 'success'
  | 'failure'
  | 'warning'

// ─── 流程边 ───────────────────────────────────────────────────

/**
 * 画布上两个节点之间的连线。
 * 字段名与 VueFlow 的 Edge 对齐，方便互相转换。
 */
export interface WorkflowEdge {
  id: string
  source: string          // 起点节点 id
  target: string          // 终点节点 id
  sourceHandle?: string   // 起点端口名，如 'main' / 'error'
  targetHandle?: string   // 终点端口名
}

/** 画布连线描边样式（VueFlow edge.style） */
export interface EdgeStyle {
  stroke: string
  strokeWidth: number
}

// ─── 流程节点实例 ─────────────────────────────────────────────

/**
 * 画布上的一个节点实例。
 *
 * 注意：这不是节点"蓝图"，而是用户放到画布上的具体节点。
 * 蓝图（NodeTypeDef）在 nodeDefinition.ts 里，通过 type 字段关联。
 *
 * @example
 * // 用户在画布上放了一个"绝对运动"节点
 * {
 *   id: 'abc123',
 *   type: 'motion.move-abs',   // 关联蓝图
 *   label: '移动到原点',
 *   position: { x: 200, y: 150 },
 *   params: { axis: 'X', position: 0 },  // 用户填写的参数
 *   description: ''
 * }
 */
export interface WorkflowNode {
  id: string

  /**
   * 节点类型，格式为 'category.action'。
   * 必须能在节点注册表（NODE_REGISTRY）中找到对应的 NodeTypeDef。
   */
  type: string

  /** 用户给这个节点起的名字，显示在卡片上 */
  label: string

  /** 节点在画布上的坐标 */
  position: { x: number; y: number }

  /**
   * 用户填写的参数值，key 对应 NodeTypeDef.params[].name。
   * 执行时这些值会被序列化后发送给后端。
   */
  params: Record<string, unknown>

  /** 可选备注，显示在节点卡片底部 */
  description: string

  /** 禁用后画布视觉变灰，执行时跳过 */
  disabled?: boolean

  /** 节点执行状态，由引擎在执行过程中更新 */
  status?: NodeExecutionStatus

  /** 状态文字覆盖（如倒计时剩余秒数 "5s"），存在时替代 statusIcon */
  statusText?: string
}

// ─── 流程定义 ─────────────────────────────────────────────────

/**
 * 一整个工作流，保存在 workflow_{id}/workflow.json 文件里。
 */
export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: string   // ISO 8601 字符串
  updatedAt: string

  /**
   * 画布面板设置（可选）。
   * 只保存与默认值不同的字段，用于跨会话还原用户偏好。
   */
  canvasSettings?: CanvasSettingsOverride
}

// ─── 索引条目 ─────────────────────────────────────────────────

/**
 * 保存在 index.json 里的轻量条目，用于左侧流程列表展示。
 * 不包含节点数据，加载快。
 */
export interface WorkflowIndexEntry {
  id: string
  name: string
  updatedAt: string
}

// ─── IF 判断条件 ─────────────────────────────────────────────

/** IF 判断节点中的单条条件 */
export interface IfCondition {
  /** 数据来源的输入端口名，如 'main' / 'input_1' */
  inputName: string
  /** 要比较的字段路径，为空时比较整个上游数据 */
  field: string
  /** 比较运算符 */
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte'
  /** 比较的目标值 */
  value: string | number
}
