import { computed, reactive, ref } from 'vue'
import {
  LEGACY_TASK_TABLE_FORMAT,
  TEN_PLUS_FILE_EXT,
  TEN_PLUS_FILE_FORMAT,
  TEN_PLUS_FILE_VERSION,
  TEN_PLUS_DEFAULT_CHORD_RATIO,
  TEN_PLUS_TABLE_ANGLE_LOCKED_DEFAULTS
} from '../constants/tenPlusCutting'
import type { SerializedTenPlusTargets, TenPlusTarget, TenPlusTaskRow } from '../types/tenPlusCutting'

let seq = 0
function nextId(prefix: string): string {
  seq += 1
  return `${prefix}-${Date.now()}-${seq}`
}

function createRow(taskNo: number): TenPlusTaskRow {
  return {
    id: nextId('task'),
    taskNo,
    diameter: 0,
    angle: 90,
    height: 0,
    divisions: 12,
    recipe: '',
    compX: 0,
    compY: 90,
    compZ: 0,
    compAngle: 0,
    chordRatio: TEN_PLUS_DEFAULT_CHORD_RATIO,
    k: 0,
    b: 0,
    x: 0
  }
}

function createTarget(name: string): TenPlusTarget {
  return {
    id: nextId('target'),
    name,
    pointXyz: '',
    oppositeCut: true,
    slotIndex: null,
    rInterval: 0,
    rCompensation: 0,
    rows: [createRow(1)]
  }
}

function normalizeSlotIndex(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 10) return null
  return n
}

export function isTableAngle(v: number): boolean {
  return Number(v) === 0
}

export function applyTableAngleLockedFields(row: TenPlusTaskRow): void {
  Object.assign(row, TEN_PLUS_TABLE_ANGLE_LOCKED_DEFAULTS)
}

function normalizeRow(raw: Partial<TenPlusTaskRow>, fallbackNo: number): TenPlusTaskRow {
  const angle = Number(raw.angle ?? 90)
  const row: TenPlusTaskRow = {
    id: raw.id || nextId('task'),
    taskNo: raw.taskNo ?? fallbackNo,
    diameter: Number(raw.diameter ?? 0),
    angle,
    height: Number(raw.height ?? 0),
    divisions: Number(raw.divisions ?? 12),
    recipe: typeof raw.recipe === 'string' ? raw.recipe : '',
    compX: Number(raw.compX ?? 0),
    compY: Number(raw.compY ?? 90),
    compZ: Number(raw.compZ ?? 0),
    compAngle: Number(raw.compAngle ?? 0),
    chordRatio: Number(raw.chordRatio ?? TEN_PLUS_DEFAULT_CHORD_RATIO),
    k: Number(raw.k ?? 0),
    b: Number(raw.b ?? 0),
    x: Number(raw.x ?? 0)
  }
  if (isTableAngle(angle)) applyTableAngleLockedFields(row)
  return row
}

function legacyPointFromRows(
  rows: Array<Partial<TenPlusTaskRow> & { pointXyz?: string; pointXy?: string }>
): string {
  for (const r of rows) {
    if (typeof r.pointXyz === 'string' && r.pointXyz.trim()) return r.pointXyz.trim()
    if (typeof r.pointXy === 'string' && r.pointXy.trim()) return r.pointXy.trim()
  }
  return ''
}

function resolvePointXyz(
  raw: Partial<TenPlusTarget> & { pointXy?: string },
  rowsSrc: Array<Partial<TenPlusTaskRow> & { pointXyz?: string; pointXy?: string }>
): string {
  if (typeof raw.pointXyz === 'string' && raw.pointXyz.trim()) return raw.pointXyz.trim()
  if (typeof raw.pointXy === 'string' && raw.pointXy.trim()) return raw.pointXy.trim()
  return legacyPointFromRows(rowsSrc)
}

function resolveOppositeCut(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  return true
}

function legacyRCompFromRows(
  rows: Array<Partial<TenPlusTaskRow> & { rInterval?: number; rCompensation?: number }>
): { rInterval: number; rCompensation: number } {
  for (const r of rows) {
    const hasInterval = typeof r.rInterval === 'number' && !Number.isNaN(r.rInterval)
    const hasComp = typeof r.rCompensation === 'number' && !Number.isNaN(r.rCompensation)
    if (hasInterval || hasComp) {
      return {
        rInterval: hasInterval ? Number(r.rInterval) : 0,
        rCompensation: hasComp ? Number(r.rCompensation) : 0
      }
    }
  }
  return { rInterval: 0, rCompensation: 0 }
}

function normalizeTarget(
  raw: Partial<TenPlusTarget> & {
    pointXy?: string
    rows?: Array<
      Partial<TenPlusTaskRow> & {
        pointXyz?: string
        pointXy?: string
        rInterval?: number
        rCompensation?: number
        oppositeCut?: boolean
      }
    >
  },
  fallbackName: string
): TenPlusTarget {
  const rowsSrc = Array.isArray(raw.rows) ? raw.rows : []
  const rows =
    rowsSrc.length > 0 ? rowsSrc.map((r, i) => normalizeRow(r, i + 1)) : [createRow(1)]
  rows.forEach((r, i) => {
    r.taskNo = i + 1
  })
  const pointXyz = resolvePointXyz(raw, rowsSrc)
  const legacyR = legacyRCompFromRows(rowsSrc)
  const rInterval =
    typeof raw.rInterval === 'number' && !Number.isNaN(raw.rInterval)
      ? Number(raw.rInterval)
      : legacyR.rInterval
  const rCompensation =
    typeof raw.rCompensation === 'number' && !Number.isNaN(raw.rCompensation)
      ? Number(raw.rCompensation)
      : legacyR.rCompensation
  const oppositeCut = resolveOppositeCut(raw.oppositeCut)
  return {
    id: raw.id || nextId('target'),
    name: (raw.name && String(raw.name).trim()) || fallbackName,
    pointXyz,
    oppositeCut,
    slotIndex: normalizeSlotIndex((raw as { slotIndex?: unknown }).slotIndex),
    rInterval,
    rCompensation,
    rows
  }
}

const targets = reactive<TenPlusTarget[]>([])
const activeTargetId = ref<string | null>(null)

export function useTenPlusTask() {
  const activeTarget = computed(() => {
    const id = activeTargetId.value
    if (!id) return undefined
    return targets.find((t) => t.id === id)
  })

  const taskRows = computed(() => activeTarget.value?.rows ?? [])

  function initDefault(defaultName = '目标 1'): void {
    if (targets.length > 0) return
    const first = createTarget(defaultName)
    targets.push(first)
    activeTargetId.value = first.id
  }

  function addTarget(name?: string): TenPlusTarget {
    const nextIndex = targets.length + 1
    const target = createTarget(name?.trim() || `目标 ${nextIndex}`)
    targets.push(target)
    activeTargetId.value = target.id
    return target
  }

  function selectTarget(id: string): void {
    if (!targets.some((t) => t.id === id)) return
    activeTargetId.value = id
  }

  function renameTarget(id: string, name: string): void {
    const hit = targets.find((t) => t.id === id)
    if (!hit) return
    const next = name.trim()
    if (!next) return
    hit.name = next
  }

  function removeTarget(id: string): void {
    if (targets.length <= 1) return
    const idx = targets.findIndex((t) => t.id === id)
    if (idx < 0) return
    targets.splice(idx, 1)
    if (activeTargetId.value === id) {
      activeTargetId.value = targets[Math.max(0, idx - 1)]?.id ?? targets[0]?.id ?? null
    }
  }

  function addRow(): void {
    const target = activeTarget.value
    if (!target) return
    const nextNo =
      target.rows.length > 0 ? Math.max(...target.rows.map((r) => r.taskNo)) + 1 : 1
    target.rows.push(createRow(nextNo))
  }

  function removeRow(rowId: string): void {
    const target = activeTarget.value
    if (!target) return
    const idx = target.rows.findIndex((r) => r.id === rowId)
    if (idx < 0) return
    if (target.rows.length <= 1) return
    target.rows.splice(idx, 1)
    target.rows.forEach((r, i) => {
      r.taskNo = i + 1
    })
  }

  function bindActiveTargetToSlot(slotIndex: number, pointXyz?: string): boolean {
    const target = activeTarget.value
    if (!target) return false
    const idx = normalizeSlotIndex(slotIndex)
    if (idx === null) return false
    for (const t of targets) {
      if (t.id !== target.id && t.slotIndex === idx) {
        t.slotIndex = null
      }
    }
    target.slotIndex = idx
    if (typeof pointXyz === 'string') {
      target.pointXyz = pointXyz
    }
    return true
  }

  function exportToFile(fileName?: string): void {
    const data: SerializedTenPlusTargets = {
      format: TEN_PLUS_FILE_FORMAT,
      version: TEN_PLUS_FILE_VERSION,
      savedAt: new Date().toISOString(),
      activeTargetId: activeTargetId.value,
      targets: JSON.parse(JSON.stringify(targets)) as TenPlusTarget[]
    }
    const json = JSON.stringify(data, null, 2)
    const name = fileName || `free_param_targets${TEN_PLUS_FILE_EXT}`
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  function loadFromFile(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr) as {
        format?: string
        activeTargetId?: string | null
        targets?: Partial<TenPlusTarget>[]
        rows?: Partial<TenPlusTaskRow>[]
      }

      if (parsed.format === TEN_PLUS_FILE_FORMAT && Array.isArray(parsed.targets)) {
        const next = parsed.targets.map((t, i) => normalizeTarget(t, `目标 ${i + 1}`))
        if (next.length === 0) return false
        targets.splice(0, targets.length, ...next)
        const prefer = parsed.activeTargetId
        activeTargetId.value =
          prefer && next.some((t) => t.id === prefer) ? prefer : next[0].id
        return true
      }

      if (parsed.format === LEGACY_TASK_TABLE_FORMAT && Array.isArray(parsed.rows)) {
        const rawRows = parsed.rows as Array<Partial<TenPlusTaskRow> & { pointXyz?: string; pointXy?: string }>
        const rows =
          rawRows.length > 0 ? rawRows.map((r, i) => normalizeRow(r, i + 1)) : [createRow(1)]
        rows.forEach((r, i) => {
          r.taskNo = i + 1
        })
        const migratedXyz = legacyPointFromRows(rawRows)
        if (targets.length === 0) {
          const t = createTarget('目标 1')
          t.rows = rows
          t.pointXyz = migratedXyz
          targets.push(t)
          activeTargetId.value = t.id
        } else {
          const cur = activeTarget.value ?? targets[0]
          cur.rows.splice(0, cur.rows.length, ...rows)
          if (migratedXyz) cur.pointXyz = migratedXyz
          activeTargetId.value = cur.id
        }
        return true
      }

      return false
    } catch {
      return false
    }
  }

  return {
    targets,
    activeTargetId,
    activeTarget,
    taskRows,
    initDefault,
    addTarget,
    selectTarget,
    renameTarget,
    removeTarget,
    addRow,
    removeRow,
    bindActiveTargetToSlot,
    exportToFile,
    loadFromFile
  }
}

export function isDiameterInvalid(v: number): boolean {
  return Number.isNaN(v) || v < 0 || v > 200
}

export function isAngleInvalid(v: number): boolean {
  return Number.isNaN(v) || v < -90 || v > 90
}

export function isHeightInvalid(v: number): boolean {
  return Number.isNaN(v) || v < 0 || v > 20
}

export function isDivisionsInvalid(v: number): boolean {
  if (Number.isNaN(v)) return true
  if (v === 0) return false
  return v < 3 || v > 360
}

export function isRecipeInvalid(recipe: string): boolean {
  return !recipe
}
