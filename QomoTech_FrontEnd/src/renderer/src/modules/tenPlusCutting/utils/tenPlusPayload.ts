import type {
  TenPlusFreeParamPayload,
  TenPlusTarget,
  TenPlusTargetSummary,
  TenPlusTaskRow
} from '../types/tenPlusCutting'

export function toTenPlusTargetSummary(target: TenPlusTarget): TenPlusTargetSummary | null {
  if (target.slotIndex === null || target.slotIndex === undefined) return null
  if (!target.pointXy || !String(target.pointXy).trim()) return null
  return {
    id: target.id,
    name: target.name,
    slotIndex: target.slotIndex,
    pointXy: target.pointXy,
    rInterval: target.rInterval,
    rCompensation: target.rCompensation
  }
}

export function buildTenPlusRowsFromTarget(
  rows: TenPlusTaskRow[],
  opts: {
    rInterval: number
    rCompensation: number
    pointXy?: string
    slotIndex?: number | null
    targetId?: string
    targetName?: string
  }
): TenPlusFreeParamPayload['rows'] {
  return rows.map((row) => ({
    taskNo: row.taskNo,
    diameter: row.diameter,
    angle: row.angle,
    height: row.height,
    divisions: row.divisions,
    recipeId: row.recipe,
    compX: row.compX,
    compY: row.compY,
    compZ: row.compZ,
    compAngle: row.compAngle,
    chordRatio: row.chordRatio,
    rInterval: opts.rInterval,
    rCompensation: opts.rCompensation,
    pointXy: opts.pointXy,
    slotIndex: opts.slotIndex,
    targetId: opts.targetId,
    targetName: opts.targetName
  }))
}

export function buildTenPlusRowsFromTargets(selected: TenPlusTarget[]): TenPlusFreeParamPayload['rows'] {
  const ordered = [...selected].sort((a, b) => {
    const sa = a.slotIndex ?? 999
    const sb = b.slotIndex ?? 999
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name)
  })
  const out: TenPlusFreeParamPayload['rows'] = []
  for (const target of ordered) {
    out.push(
      ...buildTenPlusRowsFromTarget(target.rows, {
        rInterval: target.rInterval,
        rCompensation: target.rCompensation,
        pointXy: target.pointXy,
        slotIndex: target.slotIndex,
        targetId: target.id,
        targetName: target.name
      })
    )
  }
  return out
}
