import { reactive, toRefs, watch } from 'vue'
import {默认相机可见,默认十字线栏可见,默认键盘启用,默认运行相机放大,页面界面存储键} from '../constants/tenPlusCutting'
import type { TenPlusPageUiSettings } from '../types/tenPlusCutting'

function asBool(raw: unknown, fallback: boolean): boolean {return typeof raw === 'boolean' ? raw : fallback}

function asCoord(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function createDefaults(): TenPlusPageUiSettings {
  return {
    keyboardEnabled: 默认键盘启用,
    cameraVisible: 默认相机可见,
    cameraX: null,
    cameraY: null,
    crosshairBarVisible: 默认十字线栏可见,
    runCameraEnlarge: 默认运行相机放大
  }
}

function loadSettings(): TenPlusPageUiSettings {
  const next = createDefaults()
  try {
    const raw = localStorage.getItem(页面界面存储键)
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
    页面界面存储键,
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
