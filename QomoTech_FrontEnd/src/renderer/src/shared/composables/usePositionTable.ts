import { ref, computed } from 'vue'
import { useHardwareState } from '@/shared/api/hardware'

export interface PositionRow {
  id: number
  x: number
  y: number
  enabled: boolean
  stopPercent: number
}

export type CreateFlowType = 'image-process' | 'matrix-process'

let nextId = 1

const rows = ref<PositionRow[]>([])
const enabledRows = computed(() => rows.value.filter((r) => r.enabled))
const chooseOptionsTypes = ref<CreateFlowType>('image-process')

export function usePositionTable() {
  const { mposition } = useHardwareState()

  function addRow(): void {
    rows.value.push({
      id: nextId++,
      x: 0,
      y: 0,
      enabled: true,
      stopPercent: 80
    })
  }

  function removeRow(id: number): void {
    rows.value = rows.value.filter((r) => r.id !== id)
  }

  function toggleEnabled(id: number): void {
    const row = rows.value.find((r) => r.id === id)
    if (row) row.enabled = !row.enabled
  }

  function setStopPercent(id: number, value: number): void {
    const row = rows.value.find((r) => r.id === id)
    if (row) row.stopPercent = value
  }

  function recordCurrentPosition(id: number): void {
    const rawX = mposition.value?.X ?? mposition.value?.x ?? mposition.value?.['0']
    const rawY = mposition.value?.Y ?? mposition.value?.y ?? mposition.value?.['1']
    const x = Number(rawX)
    const y = Number(rawY)
    const row = rows.value.find((r) => r.id === id)
    if (row) {
      row.x = Number.isFinite(x) ? x : 0
      row.y = Number.isFinite(y) ? y : 0
    }
  }

  function clearRows(): void {
    rows.value = []
  }

  return {
    rows,
    enabledRows,
    chooseOptionsTypes,
    addRow,
    removeRow,
    toggleEnabled,
    setStopPercent,
    recordCurrentPosition,
    clearRows
  }
}
