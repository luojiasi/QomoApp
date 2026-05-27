// ─────────────────────────────────────────────────────────────
// utils/edgePathUtils.ts — 连线路径选项构建（纯函数）
// ─────────────────────────────────────────────────────────────

import { ConnectionLineType, Position } from '@vue-flow/core'
import type { EdgeConnectionType } from '../types/canvasSettings'
import { EDGE_PATH_OFFSET } from '../constants/workflowEdge'

/** step / smoothstep 连线路径选项（含向下拐弯的 offset） */
export function buildEdgePathOptions(
  edgeType: EdgeConnectionType,
  borderRadius: number
): { borderRadius: number; offset: number } | undefined {
  if (edgeType === 'step' || edgeType === 'smoothstep') {
    return { borderRadius, offset: EDGE_PATH_OFFSET }
  }
  return undefined
}

/**
 * 工作流节点输入/输出均在底部 Handle。
 * 固定 Bottom → Bottom：从源端口先向下拉出竖线，再水平/竖向拐弯接入目标。
 */
/** 拖拽预览连线类型（与画布 edgeType 对齐） */
export function toConnectionLineType(edgeType: EdgeConnectionType): ConnectionLineType {
  switch (edgeType) {
    case 'step':
      return ConnectionLineType.Step
    case 'straight':
      return ConnectionLineType.Straight
    case 'default':
    case 'smoothstep':
    default:
      return ConnectionLineType.SmoothStep
  }
}

export function resolveEdgeHandlePositions(): {
  sourcePosition: Position
  targetPosition: Position
} {
  return {
    sourcePosition: Position.Bottom,
    targetPosition: Position.Bottom
  }
}