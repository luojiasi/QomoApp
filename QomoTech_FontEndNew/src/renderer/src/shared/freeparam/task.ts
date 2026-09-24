import { computed, reactive, ref } from 'vue'
import type {
  FreeParamTarget,
  FreeParamTaskRow,
  SerializedFreeParamTargets
} from './types'
import {
  FREE_PARAM_FILE_EXT,
  FREE_PARAM_FILE_VERSION,
  FREE_PARAM_FORMAT,
  LEGACY_TASK_TABLE_FORMAT
} from './types'

let seq = 0
function nextId(prefix: string): string {
  seq += 1
  return `${prefix}-${Date.now()}-${seq}`
}

function createRow(taskNo: number): FreeParamTaskRow {
  return {
    id: nextId('task'),
    taskNo,
    diameter: 0,
    angle: 0,
    height: 0,
    divisions: 12,
    recipe: '',
    compX: 0,
    compY: 0,
    compZ: 0,
    compAngle: 0,
    chordRatio: 2
  }
}

function createTarget(name: string): FreeParamTarget {
  return {
    id: nextId('target'),
    name,
    pointXy: '',
    slotIndex: null,
    十轴切割R旋转圈数: 0,
    十轴切割R旋转补偿值: 0,
    rows: [createRow(1)]
  }
}

function normalizeSlotIndex(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 10) return null
  return n
}

function normalizeRow(raw: Partial<FreeParamTaskRow>, fallbackNo: number): FreeParamTaskRow {
  return {
    id: raw.id || nextId('task'),
    taskNo: raw.taskNo ?? fallbackNo,
    diameter: Number(raw.diameter ?? 0),
    angle: Number(raw.angle ?? 0),
    height: Number(raw.height ?? 0),
    divisions: Number(raw.divisions ?? 12),
    recipe: typeof raw.recipe === 'string' ? raw.recipe : '',
    compX: Number(raw.compX ?? 0),
    compY: Number(raw.compY ?? 0),
    compZ: Number(raw.compZ ?? 0),
    compAngle: Number(raw.compAngle ?? 0),
    chordRatio: Number(raw.chordRatio ?? 2)
  }
}

/** 旧文件行内 pointXy → 提到目标级（取首个非空） */
function legacyPointXyFromRows(rows: Array<Partial<FreeParamTaskRow> & { pointXy?: string }>): string {
  for (const r of rows) {
    if (typeof r.pointXy === 'string' && r.pointXy.trim()) return r.pointXy.trim()
  }
  return ''
}

/** 旧文件行内 十轴切割R旋转圈数 / 十轴切割R旋转补偿值 → 目标级（取首个有值） */
function legacyRCompFromRows(
  rows: Array<Partial<FreeParamTaskRow> & { 十轴切割R旋转圈数?: number; 十轴切割R旋转补偿值?: number }>
): { 十轴切割R旋转圈数: number; 十轴切割R旋转补偿值: number } {
  for (const r of rows) {
    const hasInterval = typeof r.十轴切割R旋转圈数 === 'number' && !Number.isNaN(r.十轴切割R旋转圈数)
    const hasComp = typeof r.十轴切割R旋转补偿值 === 'number' && !Number.isNaN(r.十轴切割R旋转补偿值)
    if (hasInterval || hasComp) {
      return {
        十轴切割R旋转圈数: hasInterval ? Number(r.十轴切割R旋转圈数) : 0,
        十轴切割R旋转补偿值: hasComp ? Number(r.十轴切割R旋转补偿值) : 0
      }
    }
  }
  return { 十轴切割R旋转圈数: 0, 十轴切割R旋转补偿值: 0 }
}

function normalizeTarget(
  raw: Partial<FreeParamTarget> & {
    rows?: Array<
      Partial<FreeParamTaskRow> & {
        pointXy?: string
        十轴切割R旋转圈数?: number
        十轴切割R旋转补偿值?: number
      }
    >
  },
  fallbackName: string
): FreeParamTarget {
  const rowsSrc = Array.isArray(raw.rows) ? raw.rows : []
  const rows =
    rowsSrc.length > 0
      ? rowsSrc.map((r, i) => normalizeRow(r, i + 1))
      : [createRow(1)]
  rows.forEach((r, i) => {
    r.taskNo = i + 1
  })
  const pointXy =
    typeof raw.pointXy === 'string' && raw.pointXy.trim()
      ? raw.pointXy.trim()
      : legacyPointXyFromRows(rowsSrc)
  const legacyR = legacyRCompFromRows(rowsSrc)
  const 十轴切割R旋转圈数 =
    typeof raw.十轴切割R旋转圈数 === 'number' && !Number.isNaN(raw.十轴切割R旋转圈数)
      ? Number(raw.十轴切割R旋转圈数)
      : legacyR.十轴切割R旋转圈数
  const 十轴切割R旋转补偿值 =
    typeof raw.十轴切割R旋转补偿值 === 'number' && !Number.isNaN(raw.十轴切割R旋转补偿值)
      ? Number(raw.十轴切割R旋转补偿值)
      : legacyR.十轴切割R旋转补偿值
  return {
    id: raw.id || nextId('target'),
    name: (raw.name && String(raw.name).trim()) || fallbackName,
    pointXy,
    slotIndex: normalizeSlotIndex((raw as { slotIndex?: unknown }).slotIndex),
    十轴切割R旋转圈数,
    十轴切割R旋转补偿值,
    rows
  }
}

const targets = reactive<FreeParamTarget[]>([])
const activeTargetId = ref<string | null>(null)

export function useFreeParamTask() {
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

  function addTarget(name?: string): FreeParamTarget {
    const nextIndex = targets.length + 1
    const target = createTarget(name?.trim() || `Target ${nextIndex}`)
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

  /** 将当前目标绑定到工位；同工位其他目标覆盖清空 */
  function bindActiveTargetToSlot(slotIndex: number, pointXy?: string): boolean {
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
    if (typeof pointXy === 'string') {
      target.pointXy = pointXy
    }
    return true
  }

  /** 导出全部目标为 .jjs（浏览器下载） */
  function exportToFile(fileName?: string): void {
    const data: SerializedFreeParamTargets = {
      format: FREE_PARAM_FORMAT,
      version: FREE_PARAM_FILE_VERSION,
      savedAt: new Date().toISOString(),
      activeTargetId: activeTargetId.value,
      targets: JSON.parse(JSON.stringify(targets)) as FreeParamTarget[]
    }
    const json = JSON.stringify(data, null, 2)
    const name = fileName || `free_param_targets${FREE_PARAM_FILE_EXT}`
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

  /** 从文件内容加载；兼容旧版单表 QOMO5P-TaskTable */
  function loadFromFile(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr) as {
        format?: string
        activeTargetId?: string | null
        targets?: Partial<FreeParamTarget>[]
        rows?: Partial<FreeParamTaskRow>[]
      }

      if (parsed.format === FREE_PARAM_FORMAT && Array.isArray(parsed.targets)) {
        const next = parsed.targets.map((t, i) => normalizeTarget(t, `Target ${i + 1}`))
        if (next.length === 0) return false
        targets.splice(0, targets.length, ...next)
        const prefer = parsed.activeTargetId
        activeTargetId.value =
          prefer && next.some((t) => t.id === prefer) ? prefer : next[0].id
        return true
      }

      // FrontEnd 旧格式：整表写入当前目标（无当前目标则新建）
      if (parsed.format === LEGACY_TASK_TABLE_FORMAT && Array.isArray(parsed.rows)) {
        const rawRows = parsed.rows as Array<Partial<FreeParamTaskRow> & { pointXy?: string }>
        const rows =
          rawRows.length > 0
            ? rawRows.map((r, i) => normalizeRow(r, i + 1))
            : [createRow(1)]
        rows.forEach((r, i) => {
          r.taskNo = i + 1
        })
        const migratedXy = legacyPointXyFromRows(rawRows)
        if (targets.length === 0) {
          const t = createTarget('Target 1')
          t.rows = rows
          t.pointXy = migratedXy
          targets.push(t)
          activeTargetId.value = t.id
        } else {
          const cur = activeTarget.value ?? targets[0]
          cur.rows.splice(0, cur.rows.length, ...rows)
          if (migratedXy) cur.pointXy = migratedXy
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
