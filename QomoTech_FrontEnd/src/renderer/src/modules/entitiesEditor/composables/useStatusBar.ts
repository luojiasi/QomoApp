import { ref, watch } from 'vue'
import { useEditorStore } from '../stores/editorStore'

/** 模块级单例 —— 跨组件共享状态 */
export const cameraDistance = ref(0)
export const lastShortcut = ref('—')
export const cursorX = ref(0)
export const cursorY = ref(0)

export function useStatusBar() {
  const store = useEditorStore()

  const statusText = ref('就绪')
  const zoomPercent = ref(Math.round(store.viewport.zoom * 100))

  watch(() => store.viewport.zoom, (z) => {
    zoomPercent.value = Math.round(z * 100)
  })

  return { statusText, cursorX, cursorY, zoomPercent, cameraDistance, lastShortcut }
}
