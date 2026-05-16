import { computed } from 'vue'
import { useHardwareState } from '@/shared/api/hardware'

/** 驱动器控制面板逻辑：读取硬件轴位置并格式化显示。 */
export function useDriverControlPanelLogic() {
  const { mposition } = useHardwareState()

  const axisMposLabels = computed(() => {
    const axisNames = ['X', 'Y', 'Z', 'U', 'R']
    return axisNames.map((name) => {
      const v = mposition.value[name]
      return {
        name,
        value: v != null && Number.isFinite(v) ? v.toFixed(3) : '-'
      }
    })
  })

  return {axisMposLabels}
}
