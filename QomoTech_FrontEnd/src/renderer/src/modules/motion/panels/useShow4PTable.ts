import { ref, computed } from 'vue'
import { useAxisJog } from '../composables/index'
import { U_AXIS_NO  } from '../config'
import { EditorEntity, SurfaceEntity } from '@/modules/entitiesEditor/commons/types'
import { useHardwareState } from '@/shared/api/hardware'
import { useAuxiliaryFunctionPanelStore } from '../stores/useAuxiliaryFunctionPanelStore'

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

  // ── Positioning wizard state ──
  const positioningEntities = ref<SurfaceEntity<EditorEntity>[]>([])
  const currentPositioningIndex = ref(0)
  const tablePositions = ref<Record<number, XYZPosition>>({})
  const centerPositions = ref<Record<number, XYZPosition>>({})

  const { axisAbsoluteInputs, handleAbsoluteMove } = useAxisJog(ref(5))
  const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()

  // ── Computed ──
  const positioningCount = computed(() => positioningEntities.value.length)

  const currentTablePosition = computed(() =>
    tablePositions.value[currentPositioningIndex.value] ?? { x: 0, y: 0, z: 0 }
  )

  const currentCenterPosition = computed(() =>
    centerPositions.value[currentPositioningIndex.value] ?? { x: 0, y: 0, z: 0 }
  )

  const isCurrentCenterAcquired = computed(() =>
    currentPositioningIndex.value in centerPositions.value
  )

  const isCurrentTableAcquired = computed(() =>
    currentPositioningIndex.value in tablePositions.value
  )

  const allAcquired = computed(() => {
    const n = positioningCount.value
    if (n === 0) return false
    for (let i = 0; i < n; i++) {
      if (!(i in centerPositions.value)) return false
      if (!(i in tablePositions.value)) return false
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
      centerPositions.value = {
        ...centerPositions.value,
        [currentPositioningIndex.value]: pos
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
      tablePositions.value = {
        ...tablePositions.value,
        [currentPositioningIndex.value]: pos
      }
      // 自动旋转 U→0°，准备去下一个目标
      await 移动到垂直位置进行台面确认(0)
    } finally {
      isAcquiring.value = false
    }
  }

  function goToPosition(index: number) {if (index >= 0 && index < positioningCount.value) {currentPositioningIndex.value = index}}

  function goToNextPosition() {goToPosition(currentPositioningIndex.value + 1)}

  function goToPrevPosition() {goToPosition(currentPositioningIndex.value - 1)}

  async function openDialog(entities: SurfaceEntity<EditorEntity>[]) {
    positioningEntities.value = entities.filter(e => e.kind === 'CIRCLE')
    tablePositions.value = {}
    centerPositions.value = {}
    currentPositioningIndex.value = 0
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
  /** 只保留 CIRCLE 实体并按序号附加各自的 table_position。center 已由 根据当前轴位置计算实体偏移 处理。 */
  function buildEntitiesWithTablePosition(offsetEditorEntities: SurfaceEntity<EditorEntity>[]): unknown[] {
    let entityIdx = 0
    return offsetEditorEntities
      .filter((entity) => entity.kind === 'CIRCLE')
      .map((entity) => {
        const tablePos = tablePositions.value[entityIdx] ?? { x: 0, y: 0, z: 0 }
        entityIdx++
        return { ...entity, table_position: { ...tablePos } }
      })
  }

  function buildPayload(currentRunRecipePayload: Record<string, unknown>,entities: SurfaceEntity<EditorEntity>[],xyOffset: { x: number; y: number }): Record<string, unknown> {
    const offsetEditorEntities = 根据当前轴位置计算实体偏移(
      entities,
      xyOffset.x,
      xyOffset.y
    )
    return {
      recipe_payload: currentRunRecipePayload,
      entities: buildEntitiesWithTablePosition(offsetEditorEntities)
    }
  }

  return {
    dialogVisible,
    isAcquiring,
    positioningCount,
    currentPositioningIndex,
    currentTablePosition,
    currentCenterPosition,
    tablePositions,
    centerPositions,
    isCurrentCenterAcquired,
    isCurrentTableAcquired,
    allAcquired,
    acquireCenterPosition,
    acquireTablePosition,
    goToNextPosition,
    goToPrevPosition,
    openDialog,
    closeDialog,
    buildPayload,
    resolveXYOffsetFromHardware
  }
}
