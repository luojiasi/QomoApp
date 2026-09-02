import type { TenPlusTaskRow } from '../types/tenPlusCutting'

/** 钻石比例换算结果；null 表示算不出来，调用方不写回任务行 */
export interface TenPlusDiamondRatio {
  diameterPercent: number | null
  heightPercent: number | null
}

/**
 * 高度百分比 = (直径 × 钻石比例) / 高度
 *
 * 钻石比例表示目标高度占直径的比例，目标高度 = 直径 × 比例 / 100；
 * 后端按 高度 × 高度百分比 / 100 还原，所以这里再除以行高度换算成百分比。
 */
export function computeDiamondHeightPercent(row: TenPlusTaskRow): number | null {
  const diameter = Number(row.diameter)
  const percent = Number(row.diamondPercent)
  const height = Number(row.height)
  if (!Number.isFinite(diameter) || !Number.isFinite(percent) || !Number.isFinite(height)) {
    return null
  }
  if (height === 0) return null
  return (diameter * percent) / height
}

/**
 * 直径百分比。
 *
 * 负角度不收口，保持 100%；正角度按目标高度沿斜面回推两侧收进量：
 *   目标高度 = 直径 × 钻石比例 / 100
 *   计算直径 = 直径 - 2 × 目标高度 / tan(角度)
 *   直径百分比 = 计算直径 / 直径 × 100
 * 角度为 0（台面行）没有斜面，同样保持 100%。
 */
export function computeDiamondDiameterPercent(row: TenPlusTaskRow): number | null {
  const diameter = Number(row.diameter)
  const percent = Number(row.diamondPercent)
  const angle = Number(row.angle)
  if (!Number.isFinite(diameter) || !Number.isFinite(percent) || !Number.isFinite(angle)) {
    return null
  }
  if (angle <= 0) return 100
  if (diameter === 0) return null
  const targetHeight = (diameter * percent) / 100
  const inset = targetHeight / Math.tan((angle * Math.PI) / 180)
  return ((diameter - 2 * inset) / diameter) * 100
}

export function computeDiamondRatio(row: TenPlusTaskRow): TenPlusDiamondRatio {
  return {
    diameterPercent: computeDiamondDiameterPercent(row),
    heightPercent: computeDiamondHeightPercent(row)
  }
}
