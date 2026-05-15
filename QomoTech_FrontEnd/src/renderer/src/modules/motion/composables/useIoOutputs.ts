import { ref, computed } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useHardwareState } from '@/shared/api/hardware'
import { setMotionIoOutput } from '../api'
import { IO_MAP_GROUP_COUNT } from '@/shared/constants/constants'

  /** IO 输出控制：读取硬件状态中的 IO 输入/输出，切换输出口。 */
export function useIoOutputs() {
  const { error, info } = useNotification()
  const { ioIn: wsIoIn, ioOut: wsIoOut } = useHardwareState()

  const ioOutputs = computed(() => {
    const arr: boolean[] = Array(IO_MAP_GROUP_COUNT).fill(false)
    for (let i = 0; i < IO_MAP_GROUP_COUNT; i++) {
      arr[i] = Boolean(wsIoOut.value[String(i)])
    }
    return arr
  })

  const ioInputs = computed(() => {
    const arr: boolean[] = Array(IO_MAP_GROUP_COUNT).fill(false)
    for (let i = 0; i < IO_MAP_GROUP_COUNT; i++) {
      arr[i] = Boolean(wsIoIn.value[String(i)])
    }
    return arr
  })

  const togglingIo = ref<Record<number, boolean>>({})

  async function handleIoOutputToggle(ioNo: number): Promise<void> {
    if (togglingIo.value[ioNo]) return
    togglingIo.value = { ...togglingIo.value, [ioNo]: true }
    const nextValue = !ioOutputs.value[ioNo]
    try {
      const res = await setMotionIoOutput(ioNo, nextValue)
      if (res?.success) {
        info(`IO 输出 ${ioNo}`, nextValue ? '已开启' : '已关闭')
      } else {
        error(`IO 输出 ${ioNo} 失败`, res?.message ?? '')
      }
    } catch (e: any) { error(`IO 输出 ${ioNo} 异常`, e?.message ?? '') }
    finally { togglingIo.value = { ...togglingIo.value, [ioNo]: false } }
  }

  return { ioOutputs, ioInputs, togglingIo, handleIoOutputToggle }
}
