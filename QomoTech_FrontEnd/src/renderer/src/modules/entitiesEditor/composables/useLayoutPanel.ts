import { computed } from 'vue'
import { useEditorStore } from '../stores/editorStore'
import type { EditorEntity, EntityKind } from '../commons/types'

// ── 实体只读摘要 ────────────────────────────────────

/** 图层下实体的只读摘要（不可编辑，仅用于图层面板预览） */
export interface EntitySummary {
  id: string
  kind: EntityKind
  kindLabel: string
  layerId: string
  geometry: string
}

/** 实体类型 → 中文标签 */
const KIND_LABEL: Record<EntityKind, string> = {
  LINE: '线',
  ARC: '弧',
  CIRCLE: '圆',
  ELLIPSE: '椭圆',
  POLYLINE: '多段线',
  BEZIER: '曲线',
}

/** 安全格式化数值：undefined/null → '?'，否则保留 1 位小数 */
function safeFmt(v: unknown): string {
  if (v == null || typeof v !== 'number' || !Number.isFinite(v)) return '?'
  return String(Number(v.toFixed(1)))
}

/**
 * 从实体提取一行几何摘要文本。
 * 对缺失几何属性的实体返回 fallback，不抛异常。
 */
function summarizeGeometry(e: EditorEntity): string {
  const f = safeFmt
  switch (e.kind) {
    case 'LINE': {
      const s = e.start, en = e.end
      if (!s || !en) return '(数据不完整)'
      return `(${f(s.X)},${f(s.Y)})→(${f(en.X)},${f(en.Y)})`
    }
    case 'ARC': {
      const c = e.center
      if (!c) return '(数据不完整)'
      return `圆心(${f(c.X)},${f(c.Y)}) r=${f(e.radius)} ${f(e.startAngle)}°→${f(e.endAngle)}°`
    }
    case 'CIRCLE': {
      const c = e.center
      if (!c) return '(数据不完整)'
      return `圆心(${f(c.X)},${f(c.Y)}) r=${f(e.radius)}`
    }
    case 'ELLIPSE': {
      const c = e.center, m = e.majorAxisEnd
      if (!c || !m) return '(数据不完整)'
      return `中心(${f(c.X)},${f(c.Y)}) 长轴(${f(m.X)},${f(m.Y)})`
    }
    case 'POLYLINE': {
      const vs = e.vertices
      return vs?.length
        ? `${e.closed ? '闭合' : '开放'} ${vs.length}顶点`
        : '(数据不完整)'
    }
    case 'BEZIER': {
      const cp = e.controlPoints
      return cp?.length
        ? `${cp.length}控制点`
        : '(数据不完整)'
    }
  }
}

// ── 图层视图投影 ────────────────────────────────────

export interface LayerItem {
  id: string
  name: string
  visible: boolean
  count: number
}

export function useLayoutPanel() {
  const store = useEditorStore()

  /** EditorLayer[] → LayerItem[] 视图投影 */
  const layers = computed<LayerItem[]>(() =>
    store.layers.map(l => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      count: l.entityCount,
    }))
  )

  /**
   * 获取指定图层下的实体只读摘要列表。
   * 每次调用基于当前 store.entities 响应式计算。
   */
  function getLayerEntities(layerId: string): EntitySummary[] {
    return store.entities
      .filter(e => e.layerId === layerId)
      .map(e => {
        const kind: EntityKind = e.kind ?? ('LINE' as EntityKind)
        return {
          id: e.id,
          kind,
          kindLabel: KIND_LABEL[kind] ?? '未知',
          layerId: e.layerId,
          geometry: e.kind ? summarizeGeometry(e as EditorEntity) : '(未知类型)',
        }
      })
  }

  /** 新建图层（由 editorStore 统一管理撤销快照） */
  function addLayer() {
    store.createLayer()
  }

  /** 删除指定图层（至少保留一层，由 editorStore.deleteLayer 内部守护） */
  function deleteLayer(layerId: string) {
    store.deleteLayer(layerId)
  }

  /** 切换图层可见性 */
  function toggleLayer(layerId: string) {
    const layer = store.layers.find(l => l.id === layerId)
    if (layer) {
      store.updateLayer(layerId, { visible: !layer.visible })
    }
  }

  /** 移动实体到指定图层 */
  function moveEntity(entityId: string, targetLayerId: string) {
    store.moveEntityToLayer(entityId, targetLayerId)
  }

  return { layers, getLayerEntities, addLayer, deleteLayer, toggleLayer, moveEntity }
}
