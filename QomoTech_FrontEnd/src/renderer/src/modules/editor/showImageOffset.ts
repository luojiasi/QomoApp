import { ref, watch } from 'vue'

/** Shift+方向键：只挪展示图（mm），不写回 5P；运行 Qomo5P 时叠加进 xyOffset。 */
export const showImageOffsetX = ref(0)
export const showImageOffsetY = ref(0)

/** Shift+Ctrl+方向键：挪展示图且点动轴；运行时同样叠加进 xyOffset。 */
export const showImageWithAxisOffsetX = ref(0)
export const showImageWithAxisOffsetY = ref(0)

/**
 * 运行时是否将展示偏移取反后再加到 xyOffset（对齐机台点动轴向符号）。
 * 仅影响 runQomo5P 的叠加符号，不影响键盘挪图的画面方向。
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
  showImageWithAxisOffsetX.value = 0
  showImageWithAxisOffsetY.value = 0
}

/** 画面上两套展示偏移之和（不应用反转） */
export function getShowImageOffsetForDisplay(): { x: number; y: number } {
  return {
    x: showImageOffsetX.value + showImageWithAxisOffsetX.value,
    y: showImageOffsetY.value + showImageWithAxisOffsetY.value
  }
}
