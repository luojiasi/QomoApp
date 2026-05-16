import { onMounted } from 'vue'
import { useIoOutputs } from '../composables/useIoOutputs'
import { useHome } from '../composables/useHome'

/** IO 按键面板逻辑：吹气/灯光/激光按钮切换、回零操作。 */
export function useOutputComponentLogic() {
  const { ioOutputs, handleIoOutputToggle } = useIoOutputs()
  const { isSetHome, autoHomeOnStart, homeStatusClass, handleHome, initAutoHome } = useHome()

  onMounted(async () => {
    await initAutoHome()
  })

  return {
    ioOutputs,
    handleIoOutputToggle,
    isSetHome,
    autoHomeOnStart,
    homeStatusClass,
    handleHome
  }
}
