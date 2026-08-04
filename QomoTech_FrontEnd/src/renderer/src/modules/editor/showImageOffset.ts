import { ref, watch } from 'vue'

/** Home 叠加层「展示图」平移（mm），不写回 5P 实体参数；运行 Qomo5P 时叠加进 xyOffset。 */
export const showImageOffsetX = ref(0)
export const showImageOffsetY = ref(0)

/**
 * 运行时是否将展示偏移取反后再加到 xyOffset（对齐机台点动轴向符号）。
 * 仅影响 runQomo5P 的叠加符号，不影响 Shift 挪图的画面方向。
 */
export const invertShowImageOffsetX = ref(false)
export const invertShowImageOffsetY = ref(false)

const STORAGE_KEY = 'qomo.showImageOffset.invert'

const loadInvertSettings = (): { invertX: boolean; invertY: boolean } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { invertX: false, invertY: false }
    const obj = JSON.parse(raw) as { invertX?: unknown; invertY?: unknown }
    return {
      invertX: obj.invertX === true,
      invertY: obj.invertY === true
    }
  } catch {
    return { invertX: false, invertY: false }
  }
}

const persisted = loadInvertSettings()
invertShowImageOffsetX.value = persisted.invertX
invertShowImageOffsetY.value = persisted.invertY

watch(
  [invertShowImageOffsetX, invertShowImageOffsetY],
  ([invertX, invertY]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ invertX, invertY }))
    } catch {
      // ignore storage errors
    }
  }
)

export function resetShowImageOffset(): void {
  showImageOffsetX.value = 0
  showImageOffsetY.value = 0
}

/** 运行时叠加用的展示偏移（已按反转勾选应用符号） */
export function getShowImageOffsetForRun(): { x: number; y: number } {
  return {
    x: showImageOffsetX.value * (invertShowImageOffsetX.value ? -1 : 1),
    y: showImageOffsetY.value * (invertShowImageOffsetY.value ? -1 : 1)
  }
}
