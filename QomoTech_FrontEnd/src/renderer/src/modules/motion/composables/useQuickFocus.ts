import { computed, ref, watch } from 'vue'
import { moveMotionAxisRel, setMotionIoOutput } from '../api'
import { useNotification } from '@/shared/composables/useNotification'
import { sleep } from '../utils'

export type QuickFocusPointState = 'pending' | 'done' | 'current'
export type QuickFocusPoint = { id: number; state: QuickFocusPointState }

export function useQuickFocus() {
  const { error } = useNotification()

  const isQuickFocusing = ref(false)
  const quickFocusGridSize = ref(5)
  const quickFocusStep = ref(0.2)
  const quickFocusZStep = ref(0.1)
  const quickFocusPoints = ref<QuickFocusPoint[]>([])

  const rebuildQuickFocusPoints = () => {
    const n = Math.max(1, Math.floor(quickFocusGridSize.value))
    quickFocusGridSize.value = n
    const total = n * n
    const middleIndex = Math.floor((total - 1) / 2)
    quickFocusPoints.value = Array.from({ length: total }, (_, index) => ({
      id: index,
      state: index === middleIndex ? 'current' : 'pending',
    }))
  }

  watch(quickFocusGridSize, rebuildQuickFocusPoints, { immediate: true })

  const quickFocusDotGridStyle = computed(() => ({ gridTemplateColumns: `repeat(${quickFocusGridSize.value}, minmax(0, 1fr))` }))

  const getQuickFocusPointClass = (state: QuickFocusPointState) => {
    if (state === 'done') return 'bg-emerald-500/85 ring-emerald-400/60'
    if (state === 'current') return 'bg-yellow-400/90 ring-yellow-300/70'
    return 'bg-red-500/85 ring-red-400/60'
  }

  const handleQuickFocus = async () => {
    if (isQuickFocusing.value) {
      error('正在快速找焦，请稍等')
      return
    }
    const step = quickFocusStep.value
    const Z_step = quickFocusZStep.value
    if (step <= 0 || Z_step <= 0) {
      error('步长与 Z 步长必须大于 0')
      return
    }
    const xCount = quickFocusGridSize.value
    const yCount = quickFocusGridSize.value

    quickFocusPoints.value = quickFocusPoints.value.map((point) => ({
      ...point,
      state: 'pending' as QuickFocusPointState,
    }))
    quickFocusPoints.value[0].state = 'current'
    isQuickFocusing.value = true
    try {
      for (let X = 0; X < xCount; X++) {
        if (X > 0) await moveMotionAxisRel(1, step)

        for (let Y = 0; Y < yCount; Y++) {
          if (Y > 0) await moveMotionAxisRel(0, step)
          const pointIndex = X * yCount + Y
          quickFocusPoints.value[pointIndex].state = 'current'

          await sleep(500)
          setMotionIoOutput(2, true)
          await sleep(1000)
          setMotionIoOutput(2, false)
          quickFocusPoints.value[pointIndex].state = 'done'

          const nextIndex = pointIndex + 1
          if (nextIndex < quickFocusPoints.value.length) quickFocusPoints.value[nextIndex].state = 'current'
          await sleep(500)
        }

        if (yCount > 1) {
          await moveMotionAxisRel(0, -step * (yCount - 1))
          await moveMotionAxisRel(2, -Z_step)
        }
      }
    } finally {
      isQuickFocusing.value = false
    }
  }

  return {
    isQuickFocusing,
    quickFocusGridSize,
    quickFocusStep,
    quickFocusZStep,
    quickFocusPoints,
    quickFocusDotGridStyle,
    getQuickFocusPointClass,
    handleQuickFocus,
  }
}
