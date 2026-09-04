import { computed, reactive, ref } from 'vue'
import {
  LEGACY_TASK_TABLE_FORMAT,
  TEN_PLUS_FILE_EXT,
  TEN_PLUS_FILE_FORMAT,
  TEN_PLUS_FILE_VERSION,
  TEN_PLUS_DEFAULT_CHORD_RATIO,
  TEN_PLUS_DEFAULT_DIAMETER_PERCENT,
  TEN_PLUS_DEFAULT_HEIGHT_PERCENT,
  TEN_PLUS_DEFAULT_DIAMOND_PERCENT,
  TEN_PLUS_DEFAULT_CORNER_RATIO,
  TEN_PLUS_DEFAULT_LINE_LENGTH,
  TEN_PLUS_DEFAULT_LINE_WIDTH,
  TEN_PLUS_DEFAULT_ARC_START,
  TEN_PLUS_DEFAULT_ARC_END,
  TEN_PLUS_DEFAULT_ARC_OFFSET,
  TEN_PLUS_DEFAULT_LINE_START_X,
  TEN_PLUS_DEFAULT_LINE_START_Y,
  TEN_PLUS_DEFAULT_LINE_END_X,
  TEN_PLUS_DEFAULT_LINE_END_Y,
  TEN_PLUS_DEFAULT_LINE_PARAM_MODE,
  TEN_PLUS_DEFAULT_LINE_MID_X,
  TEN_PLUS_DEFAULT_LINE_MID_Y,
  TEN_PLUS_DEFAULT_SINGLE_LINE_LENGTH,
  TEN_PLUS_DEFAULT_SUPERELLIPSE_N,
  TEN_PLUS_DEFAULT_CURVE_KIND,
  TEN_PLUS_DEFAULT_PATH_TYPE,
  TEN_PLUS_TABLE_ANGLE_LOCKED_DEFAULTS,
  resolveTenPlusCurveKind,
  resolveTenPlusLineParamMode,
  resolveTenPlusPathType
} from '../constants/tenPlusCutting'
import { TEN_PLUS_CUSHION_EXPONENT_MAX, TEN_PLUS_CUSHION_EXPONENT_MIN } from '../constants/shapePreset'
import type { TenPlusQuickShapeRowDraft } from '../types/shapePreset'
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
    pathType: TEN_PLUS_DEFAULT_PATH_TYPE,
    diameter: 0,
    length: TEN_PLUS_DEFAULT_LINE_LENGTH,
    width: TEN_PLUS_DEFAULT_LINE_WIDTH,
    cornerRatio: TEN_PLUS_DEFAULT_CORNER_RATIO,
    arcStart: TEN_PLUS_DEFAULT_ARC_START,
    arcEnd: TEN_PLUS_DEFAULT_ARC_END,
    arcOffsetX: TEN_PLUS_DEFAULT_ARC_OFFSET,
    arcOffsetY: TEN_PLUS_DEFAULT_ARC_OFFSET,
    lineStartX: TEN_PLUS_DEFAULT_LINE_START_X,
    lineStartY: TEN_PLUS_DEFAULT_LINE_START_Y,
    lineEndX: TEN_PLUS_DEFAULT_LINE_END_X,
    lineEndY: TEN_PLUS_DEFAULT_LINE_END_Y,
    lineParamMode: TEN_PLUS_DEFAULT_LINE_PARAM_MODE,
    lineMidX: TEN_PLUS_DEFAULT_LINE_MID_X,
    lineMidY: TEN_PLUS_DEFAULT_LINE_MID_Y,
    lineLength: TEN_PLUS_DEFAULT_SINGLE_LINE_LENGTH,
    curveKind: TEN_PLUS_DEFAULT_CURVE_KIND,
    superellipseN: TEN_PLUS_DEFAULT_SUPERELLIPSE_N,
    sameLayer: false,
    angle: 90,
    height: 0,
    divisions: 12,
    recipe: '',
    compX: 0,
    compY: 90,
    compZ: 0,
    compAngle: 0,
    diameterPercent: TEN_PLUS_DEFAULT_DIAMETER_PERCENT,
    heightPercent: TEN_PLUS_DEFAULT_HEIGHT_PERCENT,
    useDiamondRatio: false,
    diamondPercent: TEN_PLUS_DEFAULT_DIAMOND_PERCENT,
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
  const superellipseN = Number.isFinite(Number(raw.superellipseN))
    ? Number(raw.superellipseN)
    : TEN_PLUS_DEFAULT_SUPERELLIPSE_N
  const row: TenPlusTaskRow = {
    id: raw.id || nextId('task'),
    taskNo: raw.taskNo ?? fallbackNo,
    pathType: resolveTenPlusPathType(raw.pathType),
    diameter: Number(raw.diameter ?? 0),
    length: Number(raw.length ?? TEN_PLUS_DEFAULT_LINE_LENGTH),
    width: Number(raw.width ?? TEN_PLUS_DEFAULT_LINE_WIDTH),
    cornerRatio: Number.isFinite(Number(raw.cornerRatio))
      ? Number(raw.cornerRatio)
      : TEN_PLUS_DEFAULT_CORNER_RATIO,
    arcStart: Number.isFinite(Number(raw.arcStart))
      ? Number(raw.arcStart)
      : TEN_PLUS_DEFAULT_ARC_START,
    arcEnd: Number.isFinite(Number(raw.arcEnd)) ? Number(raw.arcEnd) : TEN_PLUS_DEFAULT_ARC_END,
    arcOffsetX: Number.isFinite(Number(raw.arcOffsetX))
      ? Number(raw.arcOffsetX)
      : TEN_PLUS_DEFAULT_ARC_OFFSET,
    arcOffsetY: Number.isFinite(Number(raw.arcOffsetY))
      ? Number(raw.arcOffsetY)
      : TEN_PLUS_DEFAULT_ARC_OFFSET,
    lineStartX: Number.isFinite(Number(raw.lineStartX))
      ? Number(raw.lineStartX)
      : TEN_PLUS_DEFAULT_LINE_START_X,
    lineStartY: Number.isFinite(Number(raw.lineStartY))
      ? Number(raw.lineStartY)
      : TEN_PLUS_DEFAULT_LINE_START_Y,
    lineEndX: Number.isFinite(Number(raw.lineEndX)) ? Number(raw.lineEndX) : TEN_PLUS_DEFAULT_LINE_END_X,
    lineEndY: Number.isFinite(Number(raw.lineEndY)) ? Number(raw.lineEndY) : TEN_PLUS_DEFAULT_LINE_END_Y,
    lineParamMode: resolveTenPlusLineParamMode(raw.lineParamMode),
    lineMidX: Number.isFinite(Number(raw.lineMidX)) ? Number(raw.lineMidX) : TEN_PLUS_DEFAULT_LINE_MID_X,
    lineMidY: Number.isFinite(Number(raw.lineMidY)) ? Number(raw.lineMidY) : TEN_PLUS_DEFAULT_LINE_MID_Y,
    lineLength: Number.isFinite(Number(raw.lineLength))
      ? Number(raw.lineLength)
      : TEN_PLUS_DEFAULT_SINGLE_LINE_LENGTH,
    curveKind: resolveTenPlusCurveKind(raw.curveKind, superellipseN),
    superellipseN,
    sameLayer: raw.sameLayer === true,
    angle,
    height: Number(raw.height ?? 0),
    divisions: Number(raw.divisions ?? 12),
    recipe: typeof raw.recipe === 'string' ? raw.recipe : '',
    compX: Number(raw.compX ?? 0),
    compY: Number(raw.compY ?? 90),
    compZ: Number(raw.compZ ?? 0),
    compAngle: Number(raw.compAngle ?? 0),
    diameterPercent: Number.isFinite(Number(raw.diameterPercent))
      ? Number(raw.diameterPercent)
      : TEN_PLUS_DEFAULT_DIAMETER_PERCENT,
    heightPercent: Number.isFinite(Number(raw.heightPercent))
      ? Number(raw.heightPercent)
      : TEN_PLUS_DEFAULT_HEIGHT_PERCENT,
    useDiamondRatio: raw.useDiamondRatio === true,
    diamondPercent: Number.isFinite(Number(raw.diamondPercent))
      ? Number(raw.diamondPercent)
      : TEN_PLUS_DEFAULT_DIAMOND_PERCENT,
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

  /** 用草稿追加到当前目标末尾 */
  function appendRowDrafts(drafts: Array<Partial<TenPlusTaskRow>>): void {
    const target = activeTarget.value
    if (!target || drafts.length === 0) return
    const start = target.rows.length
    target.rows.push(
      ...drafts.map((draft, i) => ({
        ...createRow(start + i + 1),
        ...draft
      }))
    )
    target.rows.forEach((row, i) => {
      row.taskNo = i + 1
    })
  }

  /** 用快捷形状草稿追加到当前目标末尾 */
  function appendQuickShapeRows(drafts: TenPlusQuickShapeRowDraft[]): void {
    appendRowDrafts(drafts)
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
    appendQuickShapeRows,
    appendRowDrafts,
    removeRow,
    bindActiveTargetToSlot,
    exportToFile,
    loadFromFile
  }
}

export function isDiameterInvalid(v: number): boolean {
  const n = Number(v)
  return Number.isNaN(n) || n < 0 || n > 200
}

export function isSuperellipseNInvalid(n: number): boolean {
  const v = Number(n)
  return !Number.isFinite(v) || v < TEN_PLUS_CUSHION_EXPONENT_MIN || v > TEN_PLUS_CUSHION_EXPONENT_MAX
}

export function isAngleInvalid(v: number): boolean {
  return Number.isNaN(v) || v < -90 || v > 90
}

export function isHeightInvalid(v: number): boolean {
  return Number.isNaN(v) || v < 0 || v > 20
}

/** 台面行（角度为 0）直径不能为 0。 */
export function isTableDiameterZero(diameter: number, angle: number): boolean {
  return isTableAngle(angle) && Number(diameter) === 0
}

/** 非台面行高度不能为 0。 */
export function isNonTableHeightZero(height: number, angle: number): boolean {
  return !isTableAngle(angle) && Number(height) === 0
}

export function isDivisionsInvalid(v: number): boolean {
  if (Number.isNaN(v)) return true
  if (v === 0) return false
  return v < 3 || v > 360
}

/**
 * 切角比例校验：0–50% 之间，且切掉的量不能吃穿长边。
 * 切角量 c = 切角比例% × 宽，需同时满足 2c < 宽（等价于比例 < 50%）与 2c < 长。
 */
export function isCornerRatioInvalid(cornerRatio: number, length: number, width: number): boolean {
  const ratio = Number(cornerRatio)
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 50) return true
  const corner = (ratio / 100) * Number(width)
  return !(corner > 0) || 2 * corner >= Number(length)
}

export function isArcAngleInvalid(start: number, end: number): boolean {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true
  if (start < -360 || start > 360 || end < -360 || end > 360) return true
  return start === end
}

export function isLineCoordInvalid(v: number): boolean {
  const n = Number(v)
  return !Number.isFinite(n) || n < -200 || n > 200
}

export function isSingleLineDegenerate(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): boolean {
  if (
    isLineCoordInvalid(startX) ||
    isLineCoordInvalid(startY) ||
    isLineCoordInvalid(endX) ||
    isLineCoordInvalid(endY)
  ) {
    return true
  }
  const dx = Number(endX) - Number(startX)
  const dy = Number(endY) - Number(startY)
  return dx * dx + dy * dy < 1e-12
}

export function isRecipeInvalid(recipe: string): boolean {
  return !recipe
}
