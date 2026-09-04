import { reactive, watch } from 'vue'
import {
  TEN_PLUS_UR_CROSSHAIR_DEFAULTS,
  TEN_PLUS_UR_CROSSHAIR_STORAGE_KEY,
  TEN_PLUS_UR_CROSSHAIR_WIDTH_MAX,
  TEN_PLUS_UR_CROSSHAIR_WIDTH_MIN
} from '../constants/tenPlusCutting'
import type { TenPlusUrCrosshairSettings } from '../types/tenPlusCutting'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function clampWidth(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return TEN_PLUS_UR_CROSSHAIR_DEFAULTS.hWidth
  return Math.min(
    TEN_PLUS_UR_CROSSHAIR_WIDTH_MAX,
    Math.max(TEN_PLUS_UR_CROSSHAIR_WIDTH_MIN, Math.round(n * 2) / 2)
  )
}

function normalizeColor(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && HEX_COLOR.test(raw)) return raw.toLowerCase()
  return fallback
}

function createDefaults(): TenPlusUrCrosshairSettings {
  return {
    hColor: TEN_PLUS_UR_CROSSHAIR_DEFAULTS.hColor,
    vColor: TEN_PLUS_UR_CROSSHAIR_DEFAULTS.vColor,
    hWidth: TEN_PLUS_UR_CROSSHAIR_DEFAULTS.hWidth,
    vWidth: TEN_PLUS_UR_CROSSHAIR_DEFAULTS.vWidth
  }
}

function loadSettings(): TenPlusUrCrosshairSettings {
  const next = createDefaults()
  try {
    const raw = localStorage.getItem(TEN_PLUS_UR_CROSSHAIR_STORAGE_KEY)
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
    TEN_PLUS_UR_CROSSHAIR_STORAGE_KEY,
    JSON.stringify({
      hColor: normalizeColor(settings.hColor, TEN_PLUS_UR_CROSSHAIR_DEFAULTS.hColor),
      vColor: normalizeColor(settings.vColor, TEN_PLUS_UR_CROSSHAIR_DEFAULTS.vColor),
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
    value.hColor = normalizeColor(value.hColor, TEN_PLUS_UR_CROSSHAIR_DEFAULTS.hColor)
    value.vColor = normalizeColor(value.vColor, TEN_PLUS_UR_CROSSHAIR_DEFAULTS.vColor)
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
