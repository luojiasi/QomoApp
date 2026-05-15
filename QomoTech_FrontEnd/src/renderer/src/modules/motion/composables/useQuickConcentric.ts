import { ref } from 'vue'
import { moveMotionAxisRel, setMotionIoOutput } from '../api'
import { useNotification } from '@/shared/composables/useNotification'
import { sleep } from '../utils'

export function useQuickConcentric() {
  const { error } = useNotification()

  const isQuickConcentric = ref(false)

  const handleQuickConcentric = async () => {
    if (isQuickConcentric.value) {
      error('正在快速找同心度中')
      return
    }
    try {
      isQuickConcentric.value = true

      await sleep(500)
      setMotionIoOutput(2, true)
      await sleep(1000)
      setMotionIoOutput(2, false)

      const result = await moveMotionAxisRel(2, -10)
      if (result.success) {
        await sleep(500)
        setMotionIoOutput(2, true)
        await sleep(1000)
        setMotionIoOutput(2, false)
        await moveMotionAxisRel(2, 10)
      }
    } finally {
      isQuickConcentric.value = false
    }
  }

  return {
    isQuickConcentric,
    handleQuickConcentric,
  }
}
