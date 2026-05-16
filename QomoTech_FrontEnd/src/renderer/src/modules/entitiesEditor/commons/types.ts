// =============================================================================
// entitiesEditor 模块类型定义
// 规则：type 别名在前，interface 在后
// =============================================================================

import type { XYZ , XY } from "@/shared/types"
/** 2D 点（复用 shared XY） */
export interface Point2D extends XY {}
/** 3D 点（复用 shared XYZ） */
export interface Point3D extends XYZ {}
// ============ type 别名 ============
/** 开口方向 */
export type OpenSide = 'LEFT' | 'RIGHT'
/** 核心三类型 */
export type EntityKind = 'LINE' | 'ARC' | 'BEZIER'
/** 工具模式 */
export type ToolMode = 'SELECT' | 'DRAW' | 'PAN' | 'CHANGE'

/** 统一事件总线动作 */
export type EditorAction =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'DELETE_SELECTED' }
  | { type: 'SAVE'; projectName: string }
  | { type: 'IMPORT_DXF'; rawText: string; fileName: string }
  | { type: 'IMPORT_LJS'; rawText: string; fileName: string }
  | { type: 'EXPORT_LJS'; projectName: string }
  | { type: 'FOCUS_ENTITY'; entityId: string }
  | { type: 'FIT_VIEW' }
  | { type: 'SET_TOOL'; tool: ToolMode }

// ============ interface 定义 ============



/** 快捷键绑定 */
export interface ShortcutBinding {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: string
  label: string
  /** 额外数据（如 SET_TOOL 时携带 tool 名称） */
  data?: Record<string, string>
}
