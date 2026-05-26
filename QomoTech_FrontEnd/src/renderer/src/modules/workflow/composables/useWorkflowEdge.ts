// ─────────────────────────────────────────────────────────────
// composables/useWorkflowEdge.ts — 画布连线交互逻辑
//
// 职责：
//   - 维护当前选中的边 ID
//   - 将 store 的 WorkflowEdge 转换为 VueFlow Edge 格式
//   - 处理连线创建（onConnect）和点击（onEdgeClick）
//   - Delete 键删除选中边（由 useWorkflowCanvas 注册后调用）
// ─────────────────────────────────────────────────────────────

import { computed, ref } from 'vue'
import type { Edge, Connection } from '@vue-flow/core'
import { useWorkflowStore } from '../store/useWorkflowStore'
import { useCanvasSettings } from './useCanvasSettings'
import type { WorkflowEdge } from '../types/workflow'
import {
  DEFAULT_EDGE_STYLE,
  SELECTED_EDGE_STYLE,
  SELECTED_EDGE_STROKE_WIDTH_OFFSET
} from '../constants/workflowEdge'
import { buildEdgeMarkerEnd } from '../utils/edgeMarkerUtils'
import { buildEdgePathOptions } from '../utils/edgePathUtils'
import type { EdgeArrowStyle, EdgeConnectionType } from '../types/canvasSettings'

export function useWorkflowEdge() {
  const store = useWorkflowStore()
  const settings = useCanvasSettings()

  const selectedEdgeId = ref<string | null>(null)

  // 将 store 的 WorkflowEdge 转换为 VueFlow Edge
  function toVfEdge(
    e: WorkflowEdge,
    stroke: string,
    strokeWidth: number,
    arrowStyle: EdgeArrowStyle,
    borderRadius: number,
    edgeType: EdgeConnectionType
  ): Edge {
    const isSelected = e.id === selectedEdgeId.value
    const lineColor = isSelected ? SELECTED_EDGE_STYLE.stroke : stroke
    const lineWidth = isSelected
      ? strokeWidth + SELECTED_EDGE_STROKE_WIDTH_OFFSET
      : strokeWidth
    const baseStyle = { ...DEFAULT_EDGE_STYLE, stroke: lineColor, strokeWidth: lineWidth }
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: edgeType,
      pathOptions: buildEdgePathOptions(edgeType, borderRadius),
      style: baseStyle,
      markerEnd: buildEdgeMarkerEnd(arrowStyle, lineColor, lineWidth),
      animated: false
    }
  }

  // VueFlow 所需的边列表（依赖 effective，连线样式/类型变更时重算）
  const vfEdges = computed<Edge[]>({
    get: () => {
      const { edgeColor, edgeStrokeWidth, edgeArrowStyle, edgeBorderRadius, edgeType } =
        settings.effective.value
      return (store.currentWorkflow?.edges ?? []).map(e =>
        toVfEdge(e, edgeColor, edgeStrokeWidth, edgeArrowStyle, edgeBorderRadius, edgeType)
      )
    },
    set: () => {}
  })

  // 用户拖线连接两个节点
  function onConnect(conn: Connection): void {
    store.addEdge(
      conn.source,
      conn.target,
      conn.sourceHandle ?? undefined,
      conn.targetHandle ?? undefined
    )
  }

  // 点击边：选中 / 再次点击取消
  function onEdgeClick({ edge }: { edge: Edge }): void {
    selectedEdgeId.value = selectedEdgeId.value === edge.id ? null : edge.id
  }

  // 清除选中（切换节点 / 点击画布时调用）
  function clearSelectedEdge(): void {
    selectedEdgeId.value = null
  }

  // 键盘 Delete：删除选中边
  function deleteSelectedEdge(): void {
    if (!selectedEdgeId.value) return
    store.removeEdge(selectedEdgeId.value)
    selectedEdgeId.value = null
  }

  return {
    vfEdges,
    selectedEdgeId,
    onConnect,
    onEdgeClick,
    clearSelectedEdge,
    deleteSelectedEdge
  }
}
