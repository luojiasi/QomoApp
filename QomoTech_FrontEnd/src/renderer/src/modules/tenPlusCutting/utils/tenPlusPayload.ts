import type {
  TenPlusFreeParamPayload,
  TenPlusTarget,
  TenPlusTargetSummary,
  TenPlusTaskRow
} from '../types/tenPlusCutting'

export function toTenPlusTargetSummary(target: TenPlusTarget): TenPlusTargetSummary | null {
  if (target.slotIndex === null || target.slotIndex === undefined) return null
  if (!target.pointXyz || !String(target.pointXyz).trim()) return null
  return {
    id: target.id,
    name: target.name,
    slotIndex: target.slotIndex,
    pointXyz: target.pointXyz,
    oppositeCut: target.oppositeCut,
    rInterval: target.rInterval,
    rCompensation: target.rCompensation
  }
}

export function buildTenPlusRowsFromTarget(
  rows: TenPlusTaskRow[],
  opts: {
    rInterval: number
    rCompensation: number
    oppositeCut?: boolean
    pointXyz?: string
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
    k: row.k,
    b: row.b,
    x: row.x,
    rInterval: opts.rInterval,
    rCompensation: opts.rCompensation,
    oppositeCut: opts.oppositeCut,
    pointXyz: opts.pointXyz,
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
        oppositeCut: target.oppositeCut,
        pointXyz: target.pointXyz,
        slotIndex: target.slotIndex,
        targetId: target.id,
        targetName: target.name
      })
    )
  }
  return out
}
