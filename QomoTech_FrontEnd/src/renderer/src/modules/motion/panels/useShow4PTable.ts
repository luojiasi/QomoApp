import { ref, computed } from 'vue'
import { useAxisJog } from '../composables/index'
import { U_AXIS_NO  } from '../config'
import { EditorEntity, SurfaceEntity } from '@/modules/entitiesEditor/commons/types'
import { useHardwareState } from '@/shared/api/hardware'

function 根据当前轴位置计算实体偏移(entities: SurfaceEntity<EditorEntity>[],dx: number,dy: number): SurfaceEntity<EditorEntity>[] {
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
              contours: entity.contours.map((seg) => {
                const offsetStart = { X: seg.start.X + dx, Y: seg.start.Y + dy }
                const offsetEnd = { X: seg.end.X + dx, Y: seg.end.Y + dy }
                if (seg.kind === 'LINE') {
                  return { ...seg, start: offsetStart, end: offsetEnd }
                }
                return { ...seg, start: offsetStart, end: offsetEnd, center: { X: seg.center.X + dx, Y: seg.center.Y + dy } }
              })
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

  // ── Diamond wizard state ──
  const diamondEntities = ref<SurfaceEntity<EditorEntity>[]>([])
  const currentDiamondIndex = ref(0)
  const diamondPositions = ref<Record<number, XYZPosition>>({})

  const { axisAbsoluteInputs, handleAbsoluteMove } = useAxisJog(ref(5))

  // ── Computed ──
  const diamondCount = computed(() => diamondEntities.value.length)

  const currentTablePosition = computed(() =>
    diamondPositions.value[currentDiamondIndex.value] ?? { x: 0, y: 0, z: 0 }
  )

  const isCurrentAcquired = computed(() =>
    currentDiamondIndex.value in diamondPositions.value
  )

  const allAcquired = computed(() => {
    const n = diamondCount.value
    if (n === 0) return false
    for (let i = 0; i < n; i++) {
      if (!(i in diamondPositions.value)) return false
    }
    return true
  })

  // ── Hardware ──
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

  function resolveXYOffsetFromHardware(): { x: number; y: number } {
    const pos = resolveXYZFromHardwareState()
    return { x: pos.x, y: pos.y }
  }

  async function 移动到垂直位置进行台面确认(角度: number){
    axisAbsoluteInputs.value[U_AXIS_NO] = 角度
    await handleAbsoluteMove(U_AXIS_NO)
  }

  // ── Actions ──
  function acquireXYZPosition() {
    isAcquiring.value = true
    try {
      const pos = resolveXYZFromHardwareState()
      diamondPositions.value = {
        ...diamondPositions.value,
        [currentDiamondIndex.value]: pos
      }
    } finally {
      isAcquiring.value = false
    }
  }

  function goToDiamond(index: number) {if (index >= 0 && index < diamondCount.value) {currentDiamondIndex.value = index}}

  function goToNextDiamond() {goToDiamond(currentDiamondIndex.value + 1)}

  function goToPrevDiamond() {goToDiamond(currentDiamondIndex.value - 1)}

  async function openDialog(entities: SurfaceEntity<EditorEntity>[]) {
    diamondEntities.value = entities.filter(e => e.kind === 'DIAMOND')
    diamondPositions.value = {}
    currentDiamondIndex.value = 0
    dialogVisible.value = true
    await 移动到垂直位置进行台面确认(90)
  }

  async function closeDialog() {
    await 移动到垂直位置进行台面确认(0)
    dialogVisible.value = false
  }

  // ── Payload builders ──
  /** 只保留 DIAMOND 实体并按序号附加各自的 table_position。 */
  function buildEntitiesWithTablePosition(offsetEditorEntities: SurfaceEntity<EditorEntity>[]): unknown[] {
    let diamondIdx = 0
    return offsetEditorEntities
      .filter((entity) => entity.kind === 'DIAMOND')
      .map((entity) => {
        const pos = diamondPositions.value[diamondIdx] ?? { x: 0, y: 0, z: 0 }
        diamondIdx++
        return { ...entity, table_position: { ...pos } }
      })
  }

  function buildPayload(currentRunRecipePayload: Record<string, unknown>,entities: SurfaceEntity<EditorEntity>[],xyOffset: { x: number; y: number }): Record<string, unknown> {
    const offsetEditorEntities = 根据当前轴位置计算实体偏移(entities, xyOffset.x, xyOffset.y)
    return {
      recipe_payload: currentRunRecipePayload,
      entities: buildEntitiesWithTablePosition(offsetEditorEntities)
    }
  }

  return {
    dialogVisible,
    isAcquiring,
    diamondCount,
    currentDiamondIndex,
    currentTablePosition,
    diamondPositions,
    isCurrentAcquired,
    allAcquired,
    acquireXYZPosition,
    goToNextDiamond,
    goToPrevDiamond,
    openDialog,
    closeDialog,
    buildPayload,
    resolveXYOffsetFromHardware
  }
}
