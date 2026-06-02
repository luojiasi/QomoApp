import router from '@/app/router'
import type { ActionDef } from '../../shares/types'
import { lastShortcut } from '../useStatusBar'
import { toolTitle } from '../../utils/shortcuts'
import { useEditorStore } from '../../stores/editorStore'
import { getSceneBounds } from '../../utils/geometry'
import { MIN_ZOOM, MAX_ZOOM } from '../../configs/defaults'
import type { SurfaceEntity, EditorEntity } from '../../commons/types'

/**
 * 统一 action 分发入口 —— 工具栏点击 & 键盘快捷键 在此汇聚。
 *
 * 调用方传入依赖外部组件引用的回调（如设置弹窗、场景配置）；
 * 仅依赖 store / 工具函数的 action 在此直接处理，避免 EditorPage 样板代码。
 */
export function useShortCutsDetails(handlers: {
  onSettingsOpen: () => void
  onToggleGrid: () => void
  onToggleAxes: () => void
  onSave: () => void
  onExport: () => void
  onImportDxf: () => void
  onFreeEditParams: () => void
  onShowCamera: () => void
}) {
  const store = useEditorStore()

  function dispatchAction(a: ActionDef) {
    lastShortcut.value = toolTitle(a)
    switch (a.id) {
      // ── 文件 ──
      case 'SAVE':        handlers.onSave(); break
      case 'IMPORT_DXF':  handlers.onImportDxf(); break
      case 'EXPORT_LJS':  handlers.onExport(); break
      case 'UNDO':        store.undo(); break
      case 'REDO':        store.redo(); break

      // ── 工具 ──
      case 'SELECT':          store.setTool('SELECT'); break
      case 'PAN':             store.setTool('PAN'); break
      case 'DELETE_SELECTED': store.deleteSelected(); break
      case 'FIT_VIEW':        fitView(); break
      case 'RECENTER_ENTITIES': recenterEntities(); break
      case 'SHOW_CAMERA':      handlers.onShowCamera(); break

      // ── 图形（DRAW 模式 + 子工具） ──
      case 'DRAW_LINE':     store.setTool('DRAW'); store.setDrawSubTool('LINE'); break
      case 'DRAW_ARC':      store.setTool('DRAW'); store.setDrawSubTool('ARC'); break
      case 'DRAW_BEZIER':   store.setTool('DRAW'); store.setDrawSubTool('BEZIER'); break
      case 'DRAW_CIRCLE':   store.setTool('DRAW'); store.setDrawSubTool('CIRCLE'); break
      case 'DRAW_ELLIPSE':  store.setTool('DRAW'); store.setDrawSubTool('ELLIPSE'); break
      case 'DRAW_POLYLINE': store.setTool('DRAW'); store.setDrawSubTool('POLYLINE'); break

      // ── 视图 ──
      case 'TOGGLE_GRID': handlers.onToggleGrid(); break
      case 'TOGGLE_AXES': handlers.onToggleAxes(); break

      // ── 设置 ──
      case 'SETTINGS': handlers.onSettingsOpen(); break
      case 'FREE_EDIT_PARAMS': handlers.onFreeEditParams(); break
      case 'BACKHOME': router.back(); break
    }
  }

  /** Ctrl+0：将所有实体平移，使包围盒中心对齐原点 */
  function recenterEntities() {
    if (store.entities.length === 0) return
    const bb = getSceneBounds(store.entities)
    const cx = (bb.minX + bb.maxX) / 2
    const cy = (bb.minY + bb.maxY) / 2
    if (Math.abs(cx) < 1e-9 && Math.abs(cy) < 1e-9) return

    const offsetX = -cx
    const offsetY = -cy

    store.captureSnapshot()
    for (let i = 0; i < store.entities.length; i++) {
      const e = { ...store.entities[i] } as SurfaceEntity<EditorEntity>
      switch (e.kind) {
        case 'LINE':
          e.start = { X: e.start.X + offsetX, Y: e.start.Y + offsetY }
          e.end   = { X: e.end.X   + offsetX, Y: e.end.Y   + offsetY }
          break
        case 'ARC':
        case 'CIRCLE':
          e.center = { X: e.center.X + offsetX, Y: e.center.Y + offsetY }
          break
        case 'ELLIPSE':
          e.center = { X: e.center.X + offsetX, Y: e.center.Y + offsetY }
          e.majorAxisEnd = { X: e.majorAxisEnd.X + offsetX, Y: e.majorAxisEnd.Y + offsetY }
          break
        case 'POLYLINE':
          e.vertices = e.vertices.map(v => ({
            point: { X: v.point.X + offsetX, Y: v.point.Y + offsetY },
            bulge: v.bulge,
          }))
          break
        case 'BEZIER':
          e.controlPoints = e.controlPoints.map(p => ({
            X: p.X + offsetX,
            Y: p.Y + offsetY,
          }))
          break
      }
      store.entities[i] = e
    }
  }

  /** 自适应全部实体到视口 */
  function fitView() {
    if (store.entities.length === 0) return
    const bb = getSceneBounds(store.entities)
    const worldW = bb.maxX - bb.minX || 1
    const worldH = bb.maxY - bb.minY || 1

    const pad = 0.1
    const zoomX = store.viewport.width / (worldW * (1 + pad * 2))
    const zoomY = store.viewport.height / (worldH * (1 + pad * 2))
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(zoomX, zoomY)))

    store.viewport.zoom = newZoom
    store.viewport.panX = -(bb.minX + worldW / 2)
    store.viewport.panY = -(bb.minY + worldH / 2)
  }

  return { dispatchAction }
}
