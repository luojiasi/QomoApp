// =============================================================================
// entitiesEditor 模块类型定义
// 规则：type 别名在前，interface 在后
// =============================================================================

import type { XYZ } from "@/shared/types"

// ============ type 别名 ============

/** 核心三类型 */
export type EntityKind = 'LINE' | 'ARC' | 'BEZIER'

/** 拓展实体类型（含圆、不规则、样条） */
export type ExtendedEntityKind = EntityKind | 'CIRCLE' | 'IRREGULAR' | 'SPLINE'

/** 开口方向 */
export type OpenSide = 'LEFT' | 'RIGHT'

/** 不规则形状变体 */
export type IrregularVariant =
  | 'oval'
  | 'heart'
  | 'pear'
  | 'square'
  | 'marquise'
  | 'cushion'
  | 'octagon'

/** 工具模式 */
export type ToolMode = 'SELECT' | 'DRAW_LINE' | 'DRAW_ARC' | 'DRAW_BEZIER' | 'PAN'

/** 弧线绘制方法 */
export type ArcDrawMethod = 'THREE_POINT' | 'CENTER_RADIUS_ANGLE' | 'CENTER_START_END'

/** 3D 点（复用 shared XYZ） */
export type Point3D = XYZ

/** 基础实体联合 */
export type EditorEntity = LineEntity | ArcEntity | BezierEntity

/** 拓展实体联合 */
export type ExtendedEntity = EditorEntity | CircleEntity | IrregularEntity

/** 泛型附加挤出参数 */
export type SurfaceEntity<T extends BaseEntity = BaseEntity> = T & ExtrusionParams

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

/** 2D 点 */
export interface Point2D {
  X: number
  Y: number
}

/** 包围盒 */
export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** 视口状态 */
export interface ViewportState {
  zoom: number
  panX: number
  panY: number
  width: number
  height: number
}

/** 框选矩形 */
export interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

/** 图层 */
export interface EditorLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  entityCount: number
}

/** 项目元数据 */
export interface ProjectMeta {
  version: string
  name: string
  createdAt: string
  updatedAt: string
  sourceFileName: string
  entityCount: number
  unsupportedCount: number
}

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

/** 基础实体 */
export interface BaseEntity {
  id: string
  kind: EntityKind
  layerId: string
  openSide: OpenSide
  selected: boolean
}

/** 线实体 */
export interface LineEntity extends BaseEntity {
  kind: 'LINE'
  start: Point2D
  end: Point2D
}

/** 弧线实体 */
export interface ArcEntity extends BaseEntity {
  kind: 'ARC'
  center: Point2D
  radius: number
  startAngleDeg: number
  endAngleDeg: number
}

/** 贝塞尔实体 */
export interface BezierEntity extends BaseEntity {
  kind: 'BEZIER'
  controlPoints: Point2D[]
}

/** 圆实体 */
export interface CircleEntity extends BaseEntity {
  kind: 'CIRCLE'
  center: Point2D
  radius: number
}

/** 不规则实体 */
export interface IrregularEntity extends BaseEntity {
  kind: 'IRREGULAR'
  variant: IrregularVariant
  center: Point2D
  radiusX: number
  radiusY: number
  rotationDeg: number
}

/** 挤出参数（★ 新版：height 直接表示物体高度，底面 Z=0，顶面 Z=height） */
export interface ExtrusionParams {
  height: number
  tiltAngleDeg: number
  openSize: number
}

/** 序列化项目 */
export interface SerializedProject {
  format: 'QOMO5P-Project'
  version: string
  savedAt: string
  data: ProjectData
}

/** 项目数据 */
export interface ProjectData {
  meta: ProjectMeta
  layers: EditorLayer[]
  entities: SurfaceEntity[]
}
