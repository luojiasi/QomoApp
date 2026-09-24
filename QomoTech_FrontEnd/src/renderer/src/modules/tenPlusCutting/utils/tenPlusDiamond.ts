import { 是非等分直线 } from '../constants/tenPlusCutting'
import type { TenPlusTaskRow } from '../types/tenPlusCutting'
import type { 钻石比例结果 } from '../types/diamondPreset'

/** 钻石比例的水平参考尺寸：切角矩形用宽（腰宽），其余用 diameter。 */
function 比例参考尺寸(行: Pick<TenPlusTaskRow, 'pathType' | 'diameter' | 'width'>): number {
  return 是非等分直线(行.pathType) ? Number(行.width) : Number(行.diameter)
}

/**
 * 高度百分比 = (参考尺寸 × 钻石比例) / 高度
 *
 * 参考尺寸：等分线段用 diameter，切角矩形用 width。
 * 钻石比例表示目标高度占参考尺寸的比例；后端按 高度 × 高度百分比 / 100 还原。
 */
function 计算高度百分比(行: TenPlusTaskRow): number | null {
  const 参考 = 比例参考尺寸(行)
  const 比例 = Number(行.diamondPercent)
  const 高度 = Number(行.height)
  if (!Number.isFinite(参考) || !Number.isFinite(比例) || !Number.isFinite(高度)) {
    return null
  }
  if (高度 === 0) return null
  return (参考 * 比例) / 高度
}

/**
 * 直径百分比。
 *
 * 负角度不收口，保持 100%；正角度按目标高度沿斜面回推两侧收进量：
 *   目标高度 = 参考尺寸 × 钻石比例 / 100
 *   计算尺寸 = 参考尺寸 - 2 × 目标高度 / tan(角度)
 *   直径百分比 = 计算尺寸 / 参考尺寸 × 100
 * 角度为 0（台面行）没有斜面，同样保持 100%。
 */
function 计算直径百分比(行: TenPlusTaskRow): number | null {
  const 参考 = 比例参考尺寸(行)
  const 比例 = Number(行.diamondPercent)
  const 角度 = Number(行.angle)
  if (!Number.isFinite(参考) || !Number.isFinite(比例) || !Number.isFinite(角度)) {
    return null
  }
  if (角度 <= 0) return 100
  if (参考 === 0) return null
  const 目标高度 = (参考 * 比例) / 100
  const 收进量 = 目标高度 / Math.tan((角度 * Math.PI) / 180)
  const 原始值 = ((参考 - 2 * 收进量) / 参考) * 100
  if (!Number.isFinite(原始值)) return null
  return Math.max(0, Math.min(100, 原始值))
}

export function 计算钻石比例(行: TenPlusTaskRow): 钻石比例结果 {
  return {
    直径百分比: 计算直径百分比(行),
    高度百分比: 计算高度百分比(行)
  }
}
