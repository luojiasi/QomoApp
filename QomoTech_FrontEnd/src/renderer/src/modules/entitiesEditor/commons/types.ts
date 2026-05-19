// ============================================================
// entitiesEditor 实体类型 —— 基于标准 CAD 图元
// ============================================================
import type { XY } from "@/shared/types"
// ─── 基础几何 ────────────────────────────────────────
export type Point2D =XY
/**
 * `BoundingBox`
 * 用途：
 * 1. 适应全部实体（FIT_VIEW 快捷键）
 * 遍历所有实体 → 合并包围盒 → fitToBounds(box) → 调整 zoom + panX/Y
 * 让所有图形恰好填满 Canvas 视口
 * 2. 导出区域裁切
 * getSceneBounds(entities) → 确定 .ljs 文件的整体尺寸
 * 3. 框选命中检测（可选优化）
 * getEntityBounds(entity) → 快速剔除鼠标远离的实体，避免逐点距离计算
 * 
 * `ViewportState`
 * 用途：
 * 1. 坐标转换（每次鼠标移动/点击都用到）
 * screenToWorld(screenX, screenY)
 * = (screenX - width/2) / zoom - panX,
 * (height/2 - screenY) / zoom - panY
 * 2. 滚轮缩放（zoomAt 以鼠标为中心缩放）
 * zoomAt(screenX, screenY, factor)
 * → 先算出鼠标处世界坐标 → 改 zoom → 重算 panX/Y，保持鼠标处世界坐标不变
 * 3. 平移（中键拖拽 / PAN 工具）
 * onMouseMove → panX += deltaX / zoom; panY -= deltaY / zoom
 * 4. 状态栏显示
 * StatusBar: "缩放: 100%"  ← zoomPercent = viewport.zoom * 100
 * 5. Canvas 重绘触发
 * watch(viewport) → render() // 缩放/平移变化 → 重绘全部实体
 * ────────────────────────────────────────────────────────────
 * 关系
 *     BoundingBox（数据层）        ViewportState（视图层）
 *     实体边界 → 确定"看什么"  ←→  zoom/pan → 控制"怎么看"
 *                       ↓
 *                 fitToBounds(box)
 *                 → 算出合适的 zoom + panX/Y
 *                 → 让 box 内容恰好填满画布
 */


export interface BoundingBox {
  minX: number; minY: number
  maxX: number; maxY: number
}
export interface ViewportState {
  zoom: number
  panX: number; panY: number
  width: number; height: number
}
// ─── 枚举 ──────────────────────────────────────────
export type EntityKind = 'LINE' | 'ARC' | 'CIRCLE' | 'POLYLINE' | 'BEZIER' | 'ELLIPSE' | 'DIAMOND'
export type ToolMode = 'SELECT' | 'DRAW' | 'PAN'
/** 钻石形状 */
export type DiamondShape = 'ROUND'| 'PRINCESS'| 'CUSHION'| 'EMERALD'| 'OVAL'| 'PEAR'| 'MARQUISE'| 'HEART'
/** 开口方向（激光切割特有） */
export type OpenSide = 'LEFT' | 'RIGHT'

// ─── 联合 ──────────────────────────────────────────
export type EditorEntity = LineEntity| ArcEntity| CircleEntity| EllipseEntity| PolylineEntity| BezierEntity| DiamondEntity


// ─── 实体定义 ──────────────────────────────────────
export interface BaseEntity {
  id: string
  kind: EntityKind
  layerId: string
  openSide: OpenSide
}
/** 线 对应DXF LINE */
export interface LineEntity extends BaseEntity {
  kind: 'LINE'
  start: Point2D
  end: Point2D
}
/** 弧 对应DXF ARC */
export interface ArcEntity extends BaseEntity {
  kind: 'ARC'
  center: Point2D
  radius: number
  startAngle: number
  endAngle: number
  startPoint?: Point2D
  endPoint?: Point2D
}
/** 圆 对应DXF CIRCLE */
export interface CircleEntity extends BaseEntity {
  kind: 'CIRCLE'
  center: Point2D
  radius: number
}
/** 椭圆 — 对应 DXF ELLIPSE */
export interface EllipseEntity extends BaseEntity {
  kind: 'ELLIPSE'
  center: Point2D
  majorAxisEnd: Point2D     // 长轴端点（相对 center）
  minorAxisRatio: number    // 短轴/长轴 比例
  startParamDeg: number     // 起始参数角（度）
  endParamDeg: number       // 终止参数角（度）
}

export interface PolylineVertex {
  point: Point2D
  bulge: number   // 凸度：0 = 直线段，≠0 = 弧段（bulge = tan(弧角/4)）
}
/** POLYLINE — 对应 DXF LWPOLYLINE，每顶点可直可弧 */
export interface PolylineEntity extends BaseEntity {
  kind: 'POLYLINE'
  closed: boolean
  vertices: PolylineVertex[]
}

/** BEZIER — 对应 DXF SPLINE 的简化（NURBS → 贝塞尔采样） */
export interface BezierEntity extends BaseEntity {
  kind: 'BEZIER'
  controlPoints: Point2D[]
}

/** DIAMOND — 钻石实体，2D 轮廓由 shape 决定，3D 走刻面构建 */
export interface DiamondEntity extends BaseEntity {
  kind: 'DIAMOND'
  center: Point2D
  radius: number
  contours?: PolylineVertex[][]  // 非 ROUND 形状的多段线轮廓
  diamondParams: DiamondParams
}

/** 钻石参数 */
export interface DiamondParams {
  shape: DiamondShape
  L: number       // 长度
  W: number       // 宽度
  Depth: number   // 深度比率(%)
  Pavilion: number // 亭部比率(%)
  Crown: number   // 冠部比率(%)
  Girdle: number  // 腰部比率(%)
  Table: number   // 台面比率(%)
  R?: number      // 冠角参数
  P?: number      // 亭角参数
  Tilt?: number   // 倾斜角
  SW?: number     // 侧宽
}

// ─── 3D 挤出参数 ───────────────────────────────────
export interface ExtrusionParams {
  height: number         // 物体高度（底面 Z=0，顶面 Z=height）
  openSize: number       // 开口补偿尺寸
  tiltAngleDeg: number   // 倾斜角度
  diamondParams?: DiamondParams // 钻石刻面参数（圆形钻石时与 CIRCLE 共用）
}
/** 带挤出参数的实体（用于 3D 预览和激光路径计算） */
export type SurfaceEntity<T extends BaseEntity = BaseEntity> = T & ExtrusionParams

// ─── 图层 / 项目 / 序列化 ──────────────────────────
export interface EditorLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  entityCount: number
}

export interface ProjectMeta {
  version: string
  name: string
  createdAt: string
  updatedAt: string
  sourceFileName: string
  entityCount: number
  unsupportedCount: number
}

export interface ProjectData {
  meta: ProjectMeta
  layers: EditorLayer[]
  entities: SurfaceEntity[]
}

export interface SerializedProject {
  format: 'QOMO5P-Project'
  version: string
  savedAt: string
  data: ProjectData
}