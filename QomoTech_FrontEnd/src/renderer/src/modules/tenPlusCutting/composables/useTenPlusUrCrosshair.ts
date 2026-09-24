import { reactive, watch } from 'vue'
import {
  UR十字线默认值,
  UR十字线存储键,
  UR十字线宽度最大,
  UR十字线宽度最小
} from '../constants/tenPlusCutting'
import type { TenPlusUrCrosshairSettings } from '../types/tenPlusCutting'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function clampWidth(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return UR十字线默认值.hWidth
  return Math.min(
    UR十字线宽度最大,
    Math.max(UR十字线宽度最小, Math.round(n * 2) / 2)
  )
}

function normalizeColor(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && HEX_COLOR.test(raw)) return raw.toLowerCase()
  return fallback
}

function createDefaults(): TenPlusUrCrosshairSettings {
  return {
    hColor: UR十字线默认值.hColor,
    vColor: UR十字线默认值.vColor,
    hWidth: UR十字线默认值.hWidth,
    vWidth: UR十字线默认值.vWidth
  }
}

function loadSettings(): TenPlusUrCrosshairSettings {
  const next = createDefaults()
  try {
    const raw = localStorage.getItem(UR十字线存储键)
    if (!raw) return next
    const parsed = JSON.parse(raw) as Partial<TenPlusUrCrosshairSettings>
    next.hColor = normalizeColor(parsed.hColor, next.hColor)
    next.vColor = normalizeColor(parsed.vColor, next.vColor)
    next.hWidth = clampWidth(parsed.hWidth)
    next.vWidth = clampWidth(parsed.vWidth)
  } catch {
    return createDefaults()
  }
  return next
}

function persistSettings(settings: TenPlusUrCrosshairSettings): void {
  localStorage.setItem(
    UR十字线存储键,
    JSON.stringify({
      hColor: normalizeColor(settings.hColor, UR十字线默认值.hColor),
      vColor: normalizeColor(settings.vColor, UR十字线默认值.vColor),
      hWidth: clampWidth(settings.hWidth),
      vWidth: clampWidth(settings.vWidth)
    })
  )
}

const settings = reactive<TenPlusUrCrosshairSettings>(loadSettings())

watch(
  settings,
  (value) => {
    value.hWidth = clampWidth(value.hWidth)
    value.vWidth = clampWidth(value.vWidth)
    value.hColor = normalizeColor(value.hColor, UR十字线默认值.hColor)
    value.vColor = normalizeColor(value.vColor, UR十字线默认值.vColor)
    persistSettings(value)
  },
  { deep: true }
)

function resetCrosshair(): void {
  Object.assign(settings, createDefaults())
}

/** UR / 十轴相机十字线：横/竖颜色与线宽，进程内单例并写入 localStorage。 */
export function useTenPlusUrCrosshair() {
  return { settings, resetCrosshair }
}
