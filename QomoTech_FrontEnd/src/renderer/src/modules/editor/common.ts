// =============================================================================
// Editor 模块类型定义
// 先 type（简单别名/字面量），后 interface（复杂对象结构）
// =============================================================================

import { XY, XYZ } from "@/shared/types"

// ============ type 定义 ============
// 我能不能将这个合并
export type EntityType = 'LINE' | 'ARC' | 'NONE' | 'CIRCLE' | 'IRREGULAR' | 'BEZIER' 
export type OpenDirectionType = 'LEFT' | 'RIGHT'
export type IrregularShapeType ='oval'| 'heart'| 'pear'| 'square'| 'marquise'| 'cushion'| 'octagon'
export type QomoEntity = QomoLineEntity| QomoArcEntity| QomoCircleEntity| QomoIrregularEntity| QomoBezierEntity

// ============ interface 定义 ============
// 图层
export interface QomoLayer {
    id: string
    name: string
    visible: boolean
    entityCount: number
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
//项目数据
export interface QomoProjectData {
    meta: QomoProjectMeta
    layers: QomoLayer[]
    entities: QomoEntity[]
}


// 基础实体 ：包含所有实体的公共属性
export interface QomonBaseEntity {
    id: string
    type: EntityType
    QomoLayer: QomoLayer
    openDirection: OpenDirectionType
    selected: boolean
}

// 线
export interface QomoLineEntity extends QomonBaseEntity {
    type: 'LINE'
    start: XY | XYZ
    end: XY | XYZ
}
// 弧线
export interface QomoArcEntity extends QomonBaseEntity {
    type: 'ARC'
    center: XY | XYZ
    radius: number
    startAngle: number
    endAngle: number
    startPoint?: XY | XYZ
    endPoint?: XY | XYZ
}
// 圆
export interface QomoCircleEntity extends QomonBaseEntity {
    type: 'CIRCLE'
    center: XY | XYZ
    radius: number
}
// 通用贝塞尔曲线（2~6 个点，对应 1~5 次）
export interface QomoBezierEntity extends QomonBaseEntity {
    type: 'BEZIER'
    points: XY[] | XYZ[]
}
// 不规则实体
export interface QomoIrregularEntity extends QomonBaseEntity {
    type: 'IRREGULAR'
    shape: IrregularShapeType
    center: XY | XYZ
    radiusX: number
    radiusY: number
}




















// 焊接
export interface QomoWeldingBase {
    id: string
    name: string
    openAngle: number
    openSize?: number
}
//视图
export interface QomoViewport {
    zoom: number
    panX: number
    panY: number
    width: number
    height: number
}







