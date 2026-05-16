import { ref } from 'vue'

/** 模块级单例 —— 跨组件共享状态 */
export const cameraDistance = ref(0)
export const lastShortcut = ref('—')

export function useStatusBar() {
  const statusText = ref('就绪')
  const cursorX = ref(0)
  const cursorY = ref(0)
  const zoomPercent = ref(100)

  return { statusText, cursorX, cursorY, zoomPercent, cameraDistance, lastShortcut }
}
