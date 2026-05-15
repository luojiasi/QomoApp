import type { QomoEntityWithSurface } from '../qomo5pTypes'
import { translateAllEntities } from './entityTransforms'

export function offsetEntitiesByXYMpos(
  entities: QomoEntityWithSurface[],
  x: number,
  y: number
): QomoEntityWithSurface[] {
  return translateAllEntities(entities, x, y)
}
