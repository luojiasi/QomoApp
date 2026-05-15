// =============================================================================
// 视口坐标转换与相机控制
// =============================================================================

import type { BoundingBox, Point2D, ViewportState } from "@/modules/entitiesEditor/commons/types"
import { MIN_ZOOM, MAX_ZOOM } from "@/modules/entitiesEditor/configs/defaults"
import { useEditorStore } from "@/modules/entitiesEditor/stores/editorStore"

export function useViewport() {
  const store = useEditorStore()

  function getViewport(): ViewportState {
    return store.viewport
  }

  /** 屏幕坐标 → 世界坐标 */
  function screenToWorld(screenX: number, screenY: number): Point2D {
    const vp = store.viewport
    const X = (screenX - vp.width / 2) / vp.zoom - vp.panX
    const Y = -(screenY - vp.height / 2) / vp.zoom - vp.panY
    return { X, Y }
  }

  /** 世界坐标 → 屏幕坐标 */
  function worldToScreen(X: number, Y: number): { x: number; y: number } {
    const vp = store.viewport
    const x = (X + vp.panX) * vp.zoom + vp.width / 2
    const y = -(Y + vp.panY) * vp.zoom + vp.height / 2
    return { x, y }
  }

  /** 在指定屏幕点处缩放 */
  function zoomAt(screenX: number, screenY: number, factor: number): void {
    const vp = store.viewport
    const worldBefore = screenToWorld(screenX, screenY)
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, vp.zoom * factor))
    vp.zoom = newZoom
    vp.panX = (screenX - vp.width / 2) / newZoom - worldBefore.X
    vp.panY = -(screenY - vp.height / 2) / newZoom - worldBefore.Y
  }

  /** 适应包围盒 */
  function fitToBounds(bounds: BoundingBox, padding = 0.1): void {
    const vp = store.viewport
    const bw = bounds.maxX - bounds.minX
    const bh = bounds.maxY - bounds.minY
    if (bw <= 0 && bh <= 0) return

    const padW = bw * padding || 50
    const padH = bh * padding || 50
    const zoomX = vp.width / (bw + padW * 2)
    const zoomY = vp.height / (bh + padH * 2)
    vp.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY)))
    vp.panX = -(bounds.minX + bounds.maxX) / 2
    vp.panY = -(bounds.minY + bounds.maxY) / 2
  }

  /** 平移 */
  function panBy(dx: number, dy: number): void {
    const vp = store.viewport
    vp.panX += dx / vp.zoom
    vp.panY -= dy / vp.zoom
  }

  /** 设置视口尺寸 */
  function setSize(w: number, h: number): void {
    store.setViewportSize(w, h)
  }

  return { getViewport, screenToWorld, worldToScreen, zoomAt, fitToBounds, panBy, setSize }
}
