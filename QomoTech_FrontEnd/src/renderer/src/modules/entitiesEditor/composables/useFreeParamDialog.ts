import { ref } from 'vue'
import type { Ref } from 'vue'

export function useFreeParamDialog(): { isOpen: Ref<boolean>; open: () => void; close: () => void } {
  const isOpen = ref(false)

  function open(): void {
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
  }

  return { isOpen, open, close }
}