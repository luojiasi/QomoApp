import { TEN_PLUS_SLOT_COUNT } from '../constants/tenPlusCutting'
import type { TenPlusCuttingConfig, TenPlusSlot } from '../types/tenPlusCutting'

export function createEmptyTenPlusConfig(): TenPlusCuttingConfig {
  return {
    version: '1.0.0',
    slots: Array.from({ length: TEN_PLUS_SLOT_COUNT }, (_, i) => ({
      index: i + 1,
      x: 0,
      y: 0,
      z: 0,
      u: 0,
      taught: false
    }))
  }
}

export function normalizeTenPlusConfig(raw: unknown): TenPlusCuttingConfig {
  const base = createEmptyTenPlusConfig()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as { version?: unknown; slots?: unknown }
  if (typeof obj.version === 'string' && obj.version.trim()) {
    base.version = obj.version.trim()
  }
  if (!Array.isArray(obj.slots)) return base
  const map = new Map<number, TenPlusSlot>()
  for (const item of obj.slots) {
    if (!item || typeof item !== 'object') continue
    const s = item as Partial<TenPlusSlot>
    const index = Number(s.index)
    if (!Number.isInteger(index) || index < 1 || index > TEN_PLUS_SLOT_COUNT) continue
    map.set(index, {
      index,
      x: Number(s.x ?? 0) || 0,
      y: Number(s.y ?? 0) || 0,
      z: Number(s.z ?? 0) || 0,
      u: Number(s.u ?? 0) || 0,
      taught: Boolean(s.taught)
    })
  }
  base.slots = base.slots.map((slot) => map.get(slot.index) ?? slot)
  return base
}

export function formatPointXyz(x: number, y: number, z: number): string {
  return `(${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)})`
}

export function parsePointXyz(raw: string): { x: string; y: string; z: string } {
  const empty = { x: '—', y: '—', z: '—' }
  if (!raw || !String(raw).trim()) return empty
  const inner = String(raw)
    .trim()
    .replace(/^[(\[]/, '')
    .replace(/[)\]]$/, '')
  const parts = inner.split(/[,，\s]+/).filter(Boolean)
  if (parts.length < 2) return empty
  return {
    x: parts[0] ?? '—',
    y: parts[1] ?? '—',
    z: parts[2] ?? '—'
  }
}
