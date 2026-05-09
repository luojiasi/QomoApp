import type { QomoViewport, QomoLayer, QomoWeldingBase } from '../types/Qomo5P'

export const QOMO5P_PROJECT_VERSION = '1.0.0'

export const DEFAULT_ENTITY_BASE_HEIGHT = 60

export const createDefaultViewport = (): QomoViewport => ({
  zoom: 10,
  panX: 400,
  panY: 300,
  width: 800,
  height: 600
})

export const createDefaultLayer = (): QomoLayer => ({
  id: '0',
  name: 'default',
  visible: true,
  entityCount: 0
})

export const createDefaultWelding = (): QomoWeldingBase => ({
  id: 'default-welding',
  name: '默认焊接',
  openAngle: 0.54,
  openSize: 1
})
