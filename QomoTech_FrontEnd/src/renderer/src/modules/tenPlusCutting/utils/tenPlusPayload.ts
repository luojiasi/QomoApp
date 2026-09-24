/**
 * 十工位开始任务：POST /api/startProgram/tenPlusEntitiesEditParams
 * 体 { recipes, targets, rows }。行字段语义见 TenPlusFreeParamRow。
 * 工位示教 XYZU 不在此 payload，后端读 config/TENPLUSCUTTING.json。
 */

import type {
  TenPlusFreeParamRow,
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
    十轴切割R旋转圈数: target.十轴切割R旋转圈数,
    十轴切割R旋转补偿值: target.十轴切割R旋转补偿值
  }
}

function 构建一行(
  row: TenPlusTaskRow,
  opts: {
    十轴切割R旋转圈数: number
    十轴切割R旋转补偿值: number
    oppositeCut: boolean
    pointXyz: string
    slotIndex: number
    targetId: string
    targetName: string
    cameraFocusError: number
  }
): TenPlusFreeParamRow {
  return {
    taskNo: row.taskNo,
    pathType: row.pathType,
    diameter: row.diameter,
    length: row.length,
    width: row.width,
    cornerRatio: row.cornerRatio,
    arcStart: row.arcStart,
    arcEnd: row.arcEnd,
    arcOffsetX: row.arcOffsetX,
    arcOffsetY: row.arcOffsetY,
    curveKind: row.curveKind,
    superellipseN: row.superellipseN,
    sameLayer: row.sameLayer,
    angle: row.angle,
    height: row.height,
    divisions: row.divisions,
    recipeId: row.recipe,
    compAngle: row.compAngle,
    diameterPercent: row.diameterPercent,
    heightPercent: row.heightPercent,
    cutStartPercent: row.cutStartPercent,
    cutEndPercent: row.cutEndPercent,
    chordRatio: row.chordRatio,
    rTurns: row.rTurns,
    k: row.k,
    b: row.b,
    x: row.x,
    十轴切割R旋转圈数: opts.十轴切割R旋转圈数,
    十轴切割R旋转补偿值: opts.十轴切割R旋转补偿值,
    oppositeCut: opts.oppositeCut,
    pointXyz: opts.pointXyz,
    slotIndex: opts.slotIndex,
    targetId: opts.targetId,
    targetName: opts.targetName,
    cameraFocusError: opts.cameraFocusError
  }
}

function 构建目标行(
  rows: TenPlusTaskRow[],
  opts: {
    十轴切割R旋转圈数: number
    十轴切割R旋转补偿值: number
    oppositeCut: boolean
    pointXyz: string
    slotIndex: number
    targetId: string
    targetName: string
    cameraFocusError: number
  }
): TenPlusFreeParamRow[] {
  return rows.map((row) => 构建一行(row, opts))
}

export function buildTenPlusRowsFromTargets(
  selected: TenPlusTarget[],
  cameraFocusErrorBySlot: ReadonlyMap<number, number>
): TenPlusFreeParamRow[] {
  const ordered = [...selected].sort((a, b) => {
    const sa = a.slotIndex ?? 999
    const sb = b.slotIndex ?? 999
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name)
  })
  const out: TenPlusFreeParamRow[] = []
  for (const target of ordered) {
    const slot = target.slotIndex
    if (slot == null) {
      throw new Error(`目标「${target.name}」未绑定工位，无法下发`)
    }
    const cameraFocusError = cameraFocusErrorBySlot.get(slot)
    if (cameraFocusError == null || !Number.isFinite(cameraFocusError)) {
      throw new Error(`工位 ${slot} 缺少相机清晰误差，无法下发`)
    }
    out.push(
      ...构建目标行(target.rows, {
        十轴切割R旋转圈数: target.十轴切割R旋转圈数,
        十轴切割R旋转补偿值: target.十轴切割R旋转补偿值,
        oppositeCut: target.oppositeCut,
        pointXyz: target.pointXyz,
        slotIndex: slot,
        targetId: target.id,
        targetName: target.name,
        cameraFocusError
      })
    )
  }
  return out
}
