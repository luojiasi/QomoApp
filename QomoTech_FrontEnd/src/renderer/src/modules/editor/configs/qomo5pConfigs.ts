import { QomoLayer, QomoViewport, QomoWeldingBase } from "../common"

//项目版本
export const QOMO5P_PROJECT_VERSION = '1.0.0'
//默认实体基础高度
export const DEFAULT_ENTITY_BASE_HEIGHT = 60

//创建默认图层
export const createDefaultLayer = (): QomoLayer => ({
    id: '0',
    name: 'default',
    visible: true,
    entityCount: 0
})
//创建默认焊接 ：TODO：可以删除吗
export const createDefaultWelding = (): QomoWeldingBase => ({
    id: 'default-welding',
    name: '默认焊接',
    openAngle: 0.54,
    openSize: 1
})
//创建默认视图
export const createDefaultViewport = (): QomoViewport => ({
    zoom: 10,
    panX: 400,
    panY: 300,
    width: 800,
    height: 600
})
  