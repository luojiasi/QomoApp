import { ref, computed, watch } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useControllerSettingsStore } from '../stores/useControllerSettingsStore'
import { useAuxiliaryFunctionPanelStore } from '../stores/useAuxiliaryFunctionPanelStore'
import { zeroMotionAxis, moveMotionAxisRel, getMotionIoInput } from '../api'
import { waitControllerConnected } from '@/shared/api/hardware'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useHome() {
  const { success, error } = useNotification()
  const controllerStore = useControllerSettingsStore()
  const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()

  const isMovingHome = ref(false)

  const persistHomeStateToLocal = () => {
    controllerStore.saveHomeState({
      ISARRIVEDHOME: ISARRIVEDHOME.value,
      AUTO_HOME_ON_START: autoHomeOnStart.value
    })
  }

  const homeState = controllerStore.loadHomeState()
  const isSetHome = ref(homeState.ISARRIVEDHOME ? '回零完成' : '未回零')
  const ISARRIVEDHOME = ref<boolean>(homeState.ISARRIVEDHOME)
  const autoHomeOnStart = ref<boolean>(homeState.AUTO_HOME_ON_START)

  watch(
    () => isSetHome.value,
    (status) => {
      ISARRIVEDHOME.value = status === '回零完成'
      persistHomeStateToLocal()
    },
    { immediate: true }
  )
  watch(() => autoHomeOnStart.value, persistHomeStateToLocal)

  const homeStatusClass = computed(() => {
    if (isSetHome.value === '回零中') {
      return 'border-yellow-500 bg-yellow-500 text-white shadow-yellow-900/20'
    }
    if (isSetHome.value === '回零完成') {
      return 'border-green-500 bg-green-500 text-white shadow-green-900/20'
    }
    return 'border-red-500 bg-red-500 text-white shadow-red-900/20'
  })

  const getAxisLimitInputNo = (AxisNum: number, fwd_in: boolean): number | null => {
    const axis = controllerStore.controllerSettings.axes.find((a) => a.axis_no === AxisNum)
    if (!axis) return null
    let n = -1
    if (fwd_in) {
      n = Number(axis.fwd_in)
    } else {
      n = Number(axis.rev_in)
    }
    if (!Number.isFinite(n) || n < 0) return null
    return Math.floor(n)
  }

  const waitAxisUpperLimitInputFalse = async (AxisNum: number, fwd_in: boolean = false, timeoutMs = 20000) => {
    const ioNo = getAxisLimitInputNo(AxisNum, fwd_in)
    if (ioNo === null) return false
    const startAt = Date.now()
    let seenNotAtLimit = false
    while (Date.now() - startAt < timeoutMs) {
      const res = await getMotionIoInput(ioNo)
      if (res?.success && res.data && typeof res.data.value === 'boolean') {
        if (res.data.value === true) seenNotAtLimit = true
        if (seenNotAtLimit && res.data.value === false) return true
      }
      await sleep(200)
    }
    return false
  }

  const handleHome = async () => {
    if (isMovingHome.value) return
    isMovingHome.value = true
    isSetHome.value = '回零中'
    try {
      if (getAxisLimitInputNo(0, false) === null && getAxisLimitInputNo(1, true) === null && getAxisLimitInputNo(2, true) === null) {
        error('未配置XYZ限位', '请在控制器设置中为轴配置有效的限位输入口')
        isSetHome.value = '未回零'
        return
      }

      const UP_TRAVEL_MM = 5000
      const [moveX, moveY, moveZ] = await Promise.all([
        moveMotionAxisRel(0, -UP_TRAVEL_MM, { speed: 5 }),
        moveMotionAxisRel(1, UP_TRAVEL_MM, { speed: 5 }),
        moveMotionAxisRel(2, UP_TRAVEL_MM, { speed: 5 })
      ])
      if (!moveX?.success || !moveY?.success || !moveZ?.success) {
        const message = [!moveX && 'X', !moveY && 'Y', !moveZ && 'Z'].filter(Boolean).join('/')
        isSetHome.value = '未回零'
        error('回零运动发送失败', message)
        return
      }
      const [okX, okY, okZ] = await Promise.all([
        waitAxisUpperLimitInputFalse(0, false),
        waitAxisUpperLimitInputFalse(1, true),
        waitAxisUpperLimitInputFalse(2, true)
      ])
      if (!okX || !okY || !okZ) {
        const message = [!okX && 'X', !okY && 'Y', !okZ && 'Z'].filter(Boolean).join('/')
        isSetHome.value = '未回零'
        error('等待轴上限位超时', message)
        return
      }

      const [zx, zy, zz] = await Promise.all([
        zeroMotionAxis(0),
        zeroMotionAxis(1),
        zeroMotionAxis(2)
      ])
      if (!zz?.success && !zx?.success && !zy?.success) {
        const message = [!zx && 'X', !zy && 'Y', !zz && 'Z'].filter(Boolean).join('/')
        isSetHome.value = '未回零'
        error('清零失败,请检查控制器设置', message)
        return
      }

      const quickMoveToPosition = auxiliaryFunctionPanelStore.loadAuxiliaryFunctionPanelQuickMoveToPosition()
      if (!quickMoveToPosition || (quickMoveToPosition.X === 0 && quickMoveToPosition.Y === 0 && quickMoveToPosition.Z === 0)) {
        const [moveX2, moveY2, moveZ2] = await Promise.all([
          moveMotionAxisRel(0, 80, { controllerSettings: controllerStore.controllerSettings }),
          moveMotionAxisRel(1, -80, { controllerSettings: controllerStore.controllerSettings }),
          moveMotionAxisRel(2, -40, { controllerSettings: controllerStore.controllerSettings })
        ])
        if (!moveX2?.success || !moveY2?.success || !moveZ2?.success) {
          const message = [!moveX2 && 'X', !moveY2 && 'Y', !moveZ2 && 'Z'].filter(Boolean).join('/')
          isSetHome.value = '未回零'
          error('回零运动失败', message)
          return
        }
        success('回零完成', '建议前往辅助功能区添加确定点移动位置')
      } else {
        const [moveX2, moveY2, moveZ2] = await Promise.all([
          moveMotionAxisRel(0, quickMoveToPosition.X, { controllerSettings: controllerStore.controllerSettings }),
          moveMotionAxisRel(1, quickMoveToPosition.Y, { controllerSettings: controllerStore.controllerSettings }),
          moveMotionAxisRel(2, quickMoveToPosition.Z, { controllerSettings: controllerStore.controllerSettings })
        ])
        if (!moveX2?.success || !moveY2?.success || !moveZ2?.success) {
          const message = [!moveX2 && 'X', !moveY2 && 'Y', !moveZ2 && 'Z'].filter(Boolean).join('/')
          isSetHome.value = '未回零'
          error('回零运动失败', message)
          return
        }
        success('回零完成')
      }

      isSetHome.value = '回零完成'
    } finally {
      isMovingHome.value = false
    }
  }

  async function initAutoHome(): Promise<void> {
    if (autoHomeOnStart.value && !ISARRIVEDHOME.value) {
      const connected = await waitControllerConnected()
      if (!connected) {
        error('启动自动回零失败', '控制器未就绪，请稍后手动回零')
        return
      }
      await handleHome()
    }
  }

  return {
    isMovingHome,
    isSetHome,
    ISARRIVEDHOME,
    autoHomeOnStart,
    homeStatusClass,
    handleHome,
    initAutoHome
  }
}
