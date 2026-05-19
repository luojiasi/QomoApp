// =============================================================================
// diamount/index.ts — 异形钻石形状工厂
// 按 DiamondShape 分发到各形状文件。
// =============================================================================

import type { DiamondShape } from '../../../commons/types'
import type { ShapeDefinition } from './types'
import { roundDef } from './round'
import { princessDef } from './princess'
import { cushionDef } from './cushion'
import { emeraldDef } from './emerald'
import { ovalDef } from './oval'
import { pearDef } from './pear'
import { marquiseDef } from './marquise'
import { heartDef } from './heart'

const registry: Record<DiamondShape, ShapeDefinition> = {
  ROUND:    roundDef,
  PRINCESS: princessDef,
  CUSHION:  cushionDef,
  EMERALD:  emeraldDef,
  OVAL:     ovalDef,
  PEAR:     pearDef,
  MARQUISE: marquiseDef,
  HEART:    heartDef,
}

export function getShapeDef(shape: DiamondShape): ShapeDefinition {
  return registry[shape] ?? roundDef
}
