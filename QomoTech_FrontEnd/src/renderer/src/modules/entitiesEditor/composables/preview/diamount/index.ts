// =============================================================================
// diamount/index.ts — 异形钻石形状工厂
// 按 DiamondShape 分发到各形状文件。
// =============================================================================

import type { DiamondShape } from '../../../commons/types'
import type { ShapeDefinition } from './types'
import { roundDef } from './round'
import { princessDef } from './princess'
import { emeraldDef } from './emerald'
import { heartDef } from './heart'

const registry: Record<DiamondShape, ShapeDefinition> = {
  ROUND:    roundDef,
  PRINCESS: princessDef,
  EMERALD:  emeraldDef,
  HEART:    heartDef,
}

export function getShapeDef(shape: DiamondShape): ShapeDefinition {
  return registry[shape] ?? roundDef
}
