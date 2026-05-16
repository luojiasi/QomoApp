import { ref } from 'vue'

export function useStatusBar() {
  const statusText = ref('就绪')
  const cursorX = ref(0)
  const cursorY = ref(0)
  const zoomPercent = ref(100)

  return { statusText, cursorX, cursorY, zoomPercent }
}
