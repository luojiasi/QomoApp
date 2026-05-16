// =============================================================================
// entitiesEditor 默认配置与工厂函数
// =============================================================================


// ============ 常量 ============

export const PROJECT_VERSION = '2.0.0'
export const STORAGE_KEY_SHORTCUTS = 'qomo_shortcuts_v1'

/** ★ 物体实际高度（旧版 baseHeight=60 + extrudeHeight=5 → 新版 height=5） */
export const DEFAULT_HEIGHT = 5

export const DEFAULT_OPEN_SIZE = 1
export const DEFAULT_TILT_ANGLE = 0

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 100

export const MAX_UNDO_STEPS = 50
export const MAX_BEZIER_POINTS = 128

/** ★ 简化渲染阈值：实体数超过此值时自动降级 */
export const ENTITY_SIMPLIFY_THRESHOLD = 200

/** ★ LOD 采样段数 */
export const LOD_SEGMENTS_NEAR = 64
export const LOD_SEGMENTS_MID = 32
export const LOD_SEGMENTS_FAR = 16

// ============ 工厂函数 ============

export function createDefaultExtrusion() {
  return { height: DEFAULT_HEIGHT, tiltAngleDeg: DEFAULT_TILT_ANGLE, openSize: DEFAULT_OPEN_SIZE }
}

export function createDefaultLayer(name?: string) {
  return { id: crypto.randomUUID?.() ?? `lyr_${Date.now()}`, name: name ?? 'Layer 1', visible: true, locked: false, entityCount: 0 }
}

export function createDefaultViewport(w = 800, h = 600) {
  return { zoom: 1, panX: 0, panY: 0, width: w, height: h }
}

export function createEmptyMeta(name = 'Untitled') {
  const now = new Date().toISOString()
  return { version: PROJECT_VERSION, name, createdAt: now, updatedAt: now, sourceFileName: '', entityCount: 0, unsupportedCount: 0 }
}

