import { ref, computed } from 'vue'
import { useAxisJog } from '../composables/index'
import { U_AXIS_NO  } from '../config'
import { EditorEntity, SurfaceEntity } from '@/modules/entitiesEditor/commons/types'
import { useHardwareState } from '@/shared/api/hardware'
import { useAuxiliaryFunctionPanelStore } from '../stores/useAuxiliaryFunctionPanelStore'

function 根据当前轴位置计算实体偏移(
  entities: SurfaceEntity<EditorEntity>[],
  dx: number,
  dy: number,
  diamondCenterPositions: Record<number, XYZPosition>
): SurfaceEntity<EditorEntity>[] {
  let diamondIdx = 0
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
      const centerPos = diamondCenterPositions[diamondIdx] ?? { x: 0, y: 0, z: 0 }
      const offsetX = centerPos.x - entity.center.X
      const offsetY = centerPos.y - entity.center.Y
      diamondIdx++
      return {
        ...entity,
        center: { X: entity.center.X + offsetX, Y: entity.center.Y + offsetY },
        ...(entity.contours
          ? {
              contours: entity.contours.map((seg) => {
                const offsetStart = { X: seg.start.X + offsetX, Y: seg.start.Y + offsetY }
                const offsetEnd = { X: seg.end.X + offsetX, Y: seg.end.Y + offsetY }
                if (seg.kind === 'LINE') {
                  return { ...seg, start: offsetStart, end: offsetEnd }
                }
                return { ...seg, start: offsetStart, end: offsetEnd, center: { X: seg.center.X + offsetX, Y: seg.center.Y + offsetY } }
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
  const diamondTablePositions = ref<Record<number, XYZPosition>>({})
  const diamondCenterPositions = ref<Record<number, XYZPosition>>({})

  const { axisAbsoluteInputs, handleAbsoluteMove } = useAxisJog(ref(5))
  const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()

  // ── Computed ──
  const diamondCount = computed(() => diamondEntities.value.length)

  const currentTablePosition = computed(() =>
    diamondTablePositions.value[currentDiamondIndex.value] ?? { x: 0, y: 0, z: 0 }
  )

  const currentCenterPosition = computed(() =>
    diamondCenterPositions.value[currentDiamondIndex.value] ?? { x: 0, y: 0, z: 0 }
  )

  const isCurrentCenterAcquired = computed(() =>
    currentDiamondIndex.value in diamondCenterPositions.value
  )

  const isCurrentTableAcquired = computed(() =>
    currentDiamondIndex.value in diamondTablePositions.value
  )

  const allAcquired = computed(() => {
    const n = diamondCount.value
    if (n === 0) return false
    for (let i = 0; i < n; i++) {
      if (!(i in diamondCenterPositions.value)) return false
      if (!(i in diamondTablePositions.value)) return false
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
  async function acquireCenterPosition() {
    isAcquiring.value = true
    try {
      const pos = resolveXYZFromHardwareState()
      diamondCenterPositions.value = {
        ...diamondCenterPositions.value,
        [currentDiamondIndex.value]: pos
      }
      // 自动旋转 U→90°，准备定台面
      await 移动到垂直位置进行台面确认(90)
    } finally {
      isAcquiring.value = false
    }
  }

  async function acquireTablePosition() {
    isAcquiring.value = true
    try {
      const pos = resolveXYZFromHardwareState()
      diamondTablePositions.value = {
        ...diamondTablePositions.value,
        [currentDiamondIndex.value]: pos
      }
      // 自动旋转 U→0°，准备去下一颗钻石
      await 移动到垂直位置进行台面确认(0)
    } finally {
      isAcquiring.value = false
    }
  }

  function goToDiamond(index: number) {if (index >= 0 && index < diamondCount.value) {currentDiamondIndex.value = index}}

  function goToNextDiamond() {goToDiamond(currentDiamondIndex.value + 1)}

  function goToPrevDiamond() {goToDiamond(currentDiamondIndex.value - 1)}

  async function openDialog(entities: SurfaceEntity<EditorEntity>[]) {
    diamondEntities.value = entities.filter(e => e.kind === 'DIAMOND')
    diamondTablePositions.value = {}
    diamondCenterPositions.value = {}
    currentDiamondIndex.value = 0
    dialogVisible.value = true
    // 从 U=0° 开始，先确定中心点
    await 移动到垂直位置进行台面确认(0)
  }

  async function closeDialog() {
    // 移动到快速移动点位置 (XYZ)
    const quickPos = auxiliaryFunctionPanelStore.AuxiliaryFunctionPanel_quickMoveToPosition
    if (quickPos) {
      axisAbsoluteInputs.value[0] = quickPos.X
      axisAbsoluteInputs.value[1] = quickPos.Y
      axisAbsoluteInputs.value[2] = quickPos.Z
      await handleAbsoluteMove(0)
      await handleAbsoluteMove(1)
      await handleAbsoluteMove(2)
    }
    // U轴归位
    await 移动到垂直位置进行台面确认(0)
    dialogVisible.value = false
  }

  // ── Payload builders ──
  /** 只保留 DIAMOND 实体并按序号附加各自的 table_position。center 已由 根据当前轴位置计算实体偏移 处理。 */
  function buildEntitiesWithTablePosition(offsetEditorEntities: SurfaceEntity<EditorEntity>[]): unknown[] {
    let diamondIdx = 0
    return offsetEditorEntities
      .filter((entity) => entity.kind === 'DIAMOND')
      .map((entity) => {
        const tablePos = diamondTablePositions.value[diamondIdx] ?? { x: 0, y: 0, z: 0 }
        diamondIdx++
        return { ...entity, table_position: { ...tablePos } }
      })
  }

  function buildPayload(currentRunRecipePayload: Record<string, unknown>,entities: SurfaceEntity<EditorEntity>[],xyOffset: { x: number; y: number }): Record<string, unknown> {
    const offsetEditorEntities = 根据当前轴位置计算实体偏移(
      entities,
      xyOffset.x,
      xyOffset.y,
      diamondCenterPositions.value
    )
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
    currentCenterPosition,
    diamondTablePositions,
    diamondCenterPositions,
    isCurrentCenterAcquired,
    isCurrentTableAcquired,
    allAcquired,
    acquireCenterPosition,
    acquireTablePosition,
    goToNextDiamond,
    goToPrevDiamond,
    openDialog,
    closeDialog,
    buildPayload,
    resolveXYOffsetFromHardware
  }
}
