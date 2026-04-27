import type { DiamondDetailParameters } from './diamondTypes'

export type EntityType = 'LINE' | 'ARC' | 'NONE' | 'CIRCLE' | 'IRREGULAR' | 'BEZIER'
export type OpenDirectionType = 'LEFT' | 'RIGHT'
export type IrregularShapeType =
  | 'oval'
  | 'heart'
  | 'pear'
  | 'square'
  | 'marquise'
  | 'cushion'
  | 'octagon'

export interface QomoWeldingBase {
  id: string
  name: string
  openAngle: number
  openSize?: number
}

// 点
export interface Point {
  x: number
  y: number
}

// 基础实体
export interface QomonBaseEntity {
  id: string
  type: EntityType
  layerId: string
  layerName: string
  openDirection: OpenDirectionType
  selected: boolean
}
// --------------------------------------
// “面/挤出”统一扩展（给 LINE / ARC 等复用）
// --------------------------------------
export interface QomoSurfaceExtrusion {
  baseHeight: number // 起始高度
  extrudeHeight: number // 挤出高度（面的高度）
  surfaceAngle: number
  welding: QomoWeldingBase
}
export type WithSurface<T extends QomonBaseEntity> = T & QomoSurfaceExtrusion

// 线
export interface QomoLineEntity extends QomonBaseEntity {
  type: 'LINE'
  start: Point
  end: Point
}
export type QomoLineSurfacesEntity = WithSurface<QomoLineEntity>

//弧线
export interface QomoArcEntity extends QomonBaseEntity {
  type: 'ARC'
  center: Point
  radius: number
  startAngle: number
  endAngle: number
  startPoint?: Point
  endPoint?: Point
}
export type QomoArcSurfacesEntity = WithSurface<QomoArcEntity>

// 圆（可携带钻石参数，用于 3D 钻石预览）
export interface QomoCircleEntity extends QomonBaseEntity {
  type: 'CIRCLE'
  center: Point
  radius: number
  diamondData?: DiamondDetailParameters
}
export type QomoCircleSurfacesEntity = WithSurface<QomoCircleEntity>

// 通用贝塞尔曲线（2~6 个点，对应 1~5 次）
export interface QomoBezierEntity extends QomonBaseEntity {
  type: 'BEZIER'
  points: Point[]
}
export type QomoBezierSurfacesEntity = WithSurface<QomoBezierEntity>

/** 当前不单独区分 ELLIPSE，椭圆统一按 IRREGULAR/oval 存储 */
export interface QomoIrregularEntity extends QomonBaseEntity {
  type: 'IRREGULAR'
  shape: IrregularShapeType
  center: Point
  radiusX: number
  radiusY: number
  rotationDeg: number
}
export type QomoIrregularSurfacesEntity = WithSurface<QomoIrregularEntity>

export type QomoEntity =
  | QomoLineEntity
  | QomoArcEntity
  | QomoCircleEntity
  | QomoIrregularEntity
  | QomoBezierEntity
// 如果你需要把“带面信息”的实体也纳入同一套联合类型，可以用这个：
export type QomoEntityWithSurface =
  | QomoLineSurfacesEntity
  | QomoArcSurfacesEntity
  | QomoCircleSurfacesEntity
  | QomoBezierSurfacesEntity
  | QomoIrregularSurfacesEntity

//序列化项目
export interface QomoSerializedProject {
  format: 'QOMO-Project'
  version: string
  savedAt: string
  data: QomoProjectData
}
//项目数据
export interface QomoProjectData {
  meta: QomoProjectMeta
  layers: QomoLayer[]
  entities: QomoEntity[]
}
//项目元数据
export interface QomoProjectMeta {
  version: string
  sourceFileName: string
  importedAt?: string
  createdAt?: string
  updatedAt: string
  unsupportedEntities: number
  entityCount: number
}
// 图层
export interface QomoLayer {
  id: string
  name: string
  visible: boolean
  entityCount: number
}

// ==============================================================
export interface QomoBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}
export interface QomoSelectionRect {
  x: number
  y: number
  width: number
  height: number
}
export interface QomoViewport {
  zoom: number
  panX: number
  panY: number
  width: number
  height: number
}
export interface QomoSelectionRect {
  x: number
  y: number
  width: number
  height: number
}
//   ==============================================================
