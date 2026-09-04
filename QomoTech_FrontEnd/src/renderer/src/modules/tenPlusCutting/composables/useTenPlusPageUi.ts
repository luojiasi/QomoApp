import { reactive, toRefs, watch } from 'vue'
import {
  TEN_PLUS_DEFAULT_CAMERA_VISIBLE,
  TEN_PLUS_DEFAULT_CROSSHAIR_BAR_VISIBLE,
  TEN_PLUS_DEFAULT_KEYBOARD_ENABLED,
  TEN_PLUS_DEFAULT_RUN_CAMERA_ENLARGE,
  TEN_PLUS_PAGE_UI_STORAGE_KEY
} from '../constants/tenPlusCutting'
import type { TenPlusPageUiSettings } from '../types/tenPlusCutting'

function asBool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback
}

function asCoord(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function createDefaults(): TenPlusPageUiSettings {
  return {
    keyboardEnabled: TEN_PLUS_DEFAULT_KEYBOARD_ENABLED,
    cameraVisible: TEN_PLUS_DEFAULT_CAMERA_VISIBLE,
    cameraX: null,
    cameraY: null,
    crosshairBarVisible: TEN_PLUS_DEFAULT_CROSSHAIR_BAR_VISIBLE,
    runCameraEnlarge: TEN_PLUS_DEFAULT_RUN_CAMERA_ENLARGE
  }
}

function loadSettings(): TenPlusPageUiSettings {
  const next = createDefaults()
  try {
    const raw = localStorage.getItem(TEN_PLUS_PAGE_UI_STORAGE_KEY)
    if (!raw) return next
    const parsed = JSON.parse(raw) as Partial<TenPlusPageUiSettings>
    next.keyboardEnabled = asBool(parsed.keyboardEnabled, next.keyboardEnabled)
    next.cameraVisible = asBool(parsed.cameraVisible, next.cameraVisible)
    next.cameraX = asCoord(parsed.cameraX)
    next.cameraY = asCoord(parsed.cameraY)
    next.crosshairBarVisible = asBool(parsed.crosshairBarVisible, next.crosshairBarVisible)
    next.runCameraEnlarge = asBool(parsed.runCameraEnlarge, next.runCameraEnlarge)
  } catch {
    return createDefaults()
  }
  return next
}

function persistSettings(settings: TenPlusPageUiSettings): void {
  localStorage.setItem(
    TEN_PLUS_PAGE_UI_STORAGE_KEY,
    JSON.stringify({
      keyboardEnabled: settings.keyboardEnabled,
      cameraVisible: settings.cameraVisible,
      cameraX: asCoord(settings.cameraX),
      cameraY: asCoord(settings.cameraY),
      crosshairBarVisible: settings.crosshairBarVisible,
      runCameraEnlarge: settings.runCameraEnlarge
    })
  )
}

const settings = reactive<TenPlusPageUiSettings>(loadSettings())

watch(
  settings,
  (value) => {
    persistSettings(value)
  },
  { deep: true }
)

/** 十轴页键盘、相机显隐/放大、十字线调节条与窗口位置，进程内单例并写入 localStorage。 */
export function useTenPlusPageUi() {
  return toRefs(settings)
}
