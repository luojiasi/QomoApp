// ─────────────────────────────────────────────────────────────
// utils/canvasSettingsUtils.ts — 画布配置纯函数（合并 / 裁剪覆盖项）
// ─────────────────────────────────────────────────────────────

import type { CanvasSettings, CanvasSettingsOverride } from '../types/canvasSettings'
import { CANVAS_SETTINGS_DEFAULTS } from '../constants/canvasSettingsDefaults'

/** 合并默认值与覆盖项，得到生效配置 */
export function mergeCanvasSettings(
  override: CanvasSettingsOverride = {}
): CanvasSettings {
  return { ...CANVAS_SETTINGS_DEFAULTS, ...override }
}

/** 从 workflow 读取覆盖项（无则空对象） */
export function readCanvasSettingsOverride(
  canvasSettings?: CanvasSettingsOverride
): CanvasSettingsOverride {
  return { ...(canvasSettings ?? {}) }
}

/** 写入覆盖项：若与默认值相同则删除该字段 */
export function pruneCanvasSettingsOverride<K extends keyof CanvasSettings>(
  override: CanvasSettingsOverride,
  key: K,
  value: CanvasSettings[K]
): CanvasSettingsOverride {
  if (value === CANVAS_SETTINGS_DEFAULTS[key]) {
    const next = { ...override }
    delete (next as Record<string, unknown>)[key as string]
    return next
  }
  return { ...override, [key]: value }
}
