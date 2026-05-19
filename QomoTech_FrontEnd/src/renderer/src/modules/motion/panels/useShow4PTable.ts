import { ref } from 'vue'
import { EditorEntity, SurfaceEntity } from '@/modules/entitiesEditor/commons/types'
import { useHardwareState } from '@/shared/api/hardware'

function 根据当前轴位置计算实体偏移(
  entities: SurfaceEntity<EditorEntity>[],
  dx: number,
  dy: number
): SurfaceEntity<EditorEntity>[] {
  return entities.map((entity) => {
    const k = entity.kind
    if (k === 'LINE') {
      return {
        ...entity,
        start: { X: entity.start.X + dx, Y: entity.start.Y + dy },
        end: { X: entity.end.X + dx, Y: entity.end.Y + dy }
      }
    }
    if (k === 'ARC') {
      return {
        ...entity,
        center: { X: entity.center.X + dx, Y: entity.center.Y + dy },
        ...(entity.startPoint
          ? { startPoint: { X: entity.startPoint.X + dx, Y: entity.startPoint.Y + dy } }
          : {}),
        ...(entity.endPoint
          ? { endPoint: { X: entity.endPoint.X + dx, Y: entity.endPoint.Y + dy } }
          : {})
      }
    }
    if (k === 'CIRCLE') {
      return {
        ...entity,
        center: { X: entity.center.X + dx, Y: entity.center.Y + dy }
      }
    }
    if (k === 'ELLIPSE') {
      return {
        ...entity,
        center: { X: entity.center.X + dx, Y: entity.center.Y + dy },
        majorAxisEnd: { X: entity.majorAxisEnd.X + dx, Y: entity.majorAxisEnd.Y + dy }
      }
    }
    if (k === 'POLYLINE') {
      return {
        ...entity,
        vertices: entity.vertices.map((v) => ({
          ...v,
          point: { X: v.point.X + dx, Y: v.point.Y + dy }
        }))
      }
    }
    if (k === 'BEZIER') {
      return {
        ...entity,
        controlPoints: entity.controlPoints.map((p) => ({ X: p.X + dx, Y: p.Y + dy }))
      }
    }
    if (k === 'DIAMOND') {
      return {
        ...entity,
        center: { X: entity.center.X + dx, Y: entity.center.Y + dy },
        ...(entity.contours
          ? {
              contours: entity.contours.map((ring) =>
                ring.map((v) => ({
                  ...v,
                  point: { X: v.point.X + dx, Y: v.point.Y + dy }
                }))
              )
            }
          : {})
      }
    }
    return entity
  })
}

export interface XYZPosition {
  x: number
  y: number
  z: number
}

export function useShow4PTable() {
  const { mposition: wsMposition } = useHardwareState()

  const dialogVisible = ref(false)
  const isAcquiring = ref(false)
  const isAcquired = ref(false)
  const tablePosition = ref<XYZPosition>({ x: 0, y: 0, z: 0 })

  function resolveXYZFromHardwareState(): XYZPosition {
    const positions = wsMposition.value
    const rawX = positions?.X ?? positions?.x ?? positions?.['0']
    const rawY = positions?.Y ?? positions?.y ?? positions?.['1']
    const rawZ = positions?.Z ?? positions?.z ?? positions?.['2']
    const x = Number(rawX)
    const y = Number(rawY)
    const z = Number(rawZ)
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      z: Number.isFinite(z) ? z : 0
    }
  }

  function acquireXYZPosition() {
    isAcquiring.value = true
    try {
      const pos = resolveXYZFromHardwareState()
      tablePosition.value = pos
      isAcquired.value = true
    } finally {
      isAcquiring.value = false
    }
  }

  function openDialog() {
    dialogVisible.value = true
    isAcquired.value = false
    isAcquiring.value = false
    tablePosition.value = { x: 0, y: 0, z: 0 }
  }

  function closeDialog() {
    dialogVisible.value = false
  }

  function buildPayload(
    currentRunRecipePayload: Record<string, unknown>,
    entities: SurfaceEntity<EditorEntity>[]
  ): Record<string, unknown> {
    const offsetEditorEntities = 根据当前轴位置计算实体偏移(
      entities,
      tablePosition.value.x,
      tablePosition.value.y
    )
    return {
      recipe_payload: currentRunRecipePayload,
      entities: offsetEditorEntities,
      tablePosition: { ...tablePosition.value }
    }
  }

  return {
    dialogVisible,
    isAcquiring,
    isAcquired,
    tablePosition,
    acquireXYZPosition,
    openDialog,
    closeDialog,
    buildPayload
  }
}
