// =============================================================================
// entitiesEditor 默认配置
// =============================================================================

// ============ 通用常量 ============
export const STORAGE_KEY_SHORTCUTS = 'qomo_shortcuts_v1'
export const STORAGE_KEY_SCENE3D = 'qomo_scene3d_v1'


// ── 快捷键 ──
import type { ActionDef } from '../shares/types'
export const ACTIONS: ActionDef[] = [
    // ── 文件 ──
    { id: 'SAVE', label: '保存', group: 'file', key: 's', ctrl: true },
    { id: 'IMPORT_DXF', label: '导入DXF', group: 'file', key: 'o', ctrl: true },
    { id: 'EXPORT_LJS', label: '导出', group: 'file', key: 'e', ctrl: true },
    { id: 'UNDO', label: '撤销', group: 'file', key: 'z', ctrl: true },
    { id: 'REDO', label: '重做', group: 'file', key: 'y', ctrl: true },
  
    // ── 图形 ──
    { id: 'DRAW_LINE', label: '线', group: 'shape', key: 'l' },
    { id: 'DRAW_ARC', label: '弧', group: 'shape', key: 'a' },
    { id: 'DRAW_BEZIER', label: '曲线', group: 'shape', key: 'b' },
  
    // ── 工具 ──
    { id: 'SELECT', label: '选择', group: 'tool', key: 'v' },
    { id: 'PAN', label: '平移', group: 'tool', key: 'h' },
    { id: 'DELETE_SELECTED', label: '删除', group: 'tool', key: 'Delete' },
    { id: 'FIT_VIEW', label: '适应', group: 'tool', key: '0' },
    // ── 3D ──
    { id: 'TOGGLE_GRID', label: '显示网格', group: 'view', key: 'g' },
    { id: 'TOGGLE_AXES', label: '显示坐标轴', group: 'view', key: 'x' },
    // ── 设置 ──
    { id: 'SETTINGS', label: '打开设置', group: 'settings' },
    { id: 'BACKHOME', label: '返回首页', group: 'settings' },
  ]


// ============ 3D 场景 ============

// ── 相机 ──
export const CAMERA_INITIAL_POS = { x: 120, y: -120, z: 120 } as const
export const CAMERA_FOV = 50
export const CAMERA_NEAR = 0.1
export const CAMERA_FAR = 2000
export const CAMERA_TARGET = { x: 0, y: 0, z: 0 } as const

// ── 渲染器 ──
export const RENDERER_ANTIALIAS = true
export const RENDERER_ALPHA = false
export const MAX_PIXEL_RATIO = 2

// ── OrbitControls ──
export const CONTROLS_ENABLE_DAMPING = true
export const CONTROLS_DAMPING_FACTOR = 0.08

// ── 背景 ──
export const SCENE_BACKGROUND = 0x020617

// ── 光照 ──
export const AMBIENT_LIGHT_COLOR = 0xffffff
export const AMBIENT_LIGHT_INTENSITY = 1.05
export const DIRECTIONAL_LIGHT_COLOR = 0xffffff
export const DIRECTIONAL_LIGHT_INTENSITY = 1.2
export const DIRECTIONAL_LIGHT_POS = { x: 100, y: 180, z: 120 } as const

// ── 坐标轴 ──
export const AXES_SIZE = 120

// ── 可见性 ──
export const SHOW_GRID = true
export const SHOW_AXES = true

// ── 网格 ──
export const GRID_SIZE = 600
export const GRID_DIVISIONS = 60
export const GRID_COLOR_CENTER = 0x334155
export const GRID_COLOR_EDGE = 0x1e293b
export const GRID_ROTATION_X = Math.PI / 2 // Z-up：GridHelper 从 XY 翻到 XZ 面
