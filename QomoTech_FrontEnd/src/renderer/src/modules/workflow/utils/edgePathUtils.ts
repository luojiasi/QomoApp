// ─────────────────────────────────────────────────────────────
// utils/edgePathUtils.ts — 连线路径选项构建（纯函数）
// ─────────────────────────────────────────────────────────────

import { Position } from '@vue-flow/core'
import type { EdgeConnectionType } from '../types/canvasSettings'

/** step / smoothstep 连线支持 pathOptions.borderRadius */
export function buildEdgePathOptions(
  edgeType: EdgeConnectionType,
  borderRadius: number
): { borderRadius: number } | undefined {
  if (edgeType === 'step' || edgeType === 'smoothstep') {
    return { borderRadius }
  }
  return undefined
}

/**
 * 根据起止点相对位置推断路径进出方向。
 * 底部端口在水平布局时若仍用 Bottom→Bottom，末端会出现竖段导致箭头朝上；
 * 水平为主时改为 Right→Left，使末端沿水平方向进入目标端口。
 */
export function resolveEdgeHandlePositions(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): { sourcePosition: Position; targetPosition: Position } {
  const dx = targetX - sourceX
  const dy = targetY - sourceY

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      sourcePosition: dx > 0 ? Position.Right : Position.Left,
      targetPosition: dx > 0 ? Position.Left : Position.Right
    }
  }

  return {
    sourcePosition: dy > 0 ? Position.Bottom : Position.Top,
    targetPosition: dy > 0 ? Position.Top : Position.Bottom
  }
}