import { ref, computed, watch } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useControllerSettingsStore } from '../stores/useControllerSettingsStore'
import { useAuxiliaryFunctionPanelStore } from '../stores/useAuxiliaryFunctionPanelStore'
import { zeroMotionAxis, moveMotionAxisRel, getMotionIoInput, waitMotionIdle } from '../api'
import { waitControllerConnected } from '@/shared/api/hardware'
import { AXIS_NO_TO_NAME } from '../config/controllerDefaults'

import { sleep } from '../utils'

const SEEK_TRAVEL_MM = 5000
const BACKOFF_MM = 5
const FAST_SEEK_SPEED = 50
const SLOW_SEEK_SPEED = 5
const FAST_SEEK_TIMEOUT_MS = 30000
const SLOW_SEEK_TIMEOUT_MS = 20000
const DEFAULT_LEAVE_X_MM = 80
const DEFAULT_LEAVE_Y_MM = -80
const DEFAULT_LEAVE_Z_MM = -40
const LEAVE_SPEED = 50

  /** 回零流程编排：三轴回零、回零状态持久化、启动时自动回零。 */
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

  function failHome(title: string, results: [boolean | undefined | null, string][]): void {
    const names = results.filter(([ok]) => !ok).map(([, name]) => name)
    isSetHome.value = '未回零'
    error(title, names.join('/'))
  }

  const waitAxisIdle = async (axisNo: number): Promise<boolean> => {
    const axisName = AXIS_NO_TO_NAME[axisNo]
    if (!axisName) return false
    const res = await waitMotionIdle(axisName)
    return Boolean(res?.success && res.data !== false)
  }

  const seekAxisToLimit = async (
    axisNo: number,
    seekDeltaMm: number,
    useFwdLimit: boolean,
    speed: number,
    timeoutMs: number
  ): Promise<boolean> => {
    const move = await moveMotionAxisRel(axisNo, seekDeltaMm, { speed })
    if (!move?.success) return false
    return waitAxisUpperLimitInputFalse(axisNo, useFwdLimit, timeoutMs)
  }

  const homeAxisTwoSpeed = async (
    axisNo: number,
    seekSign: number,
    useFwdLimit: boolean
  ): Promise<boolean> => {
    const seekDeltaMm = seekSign * SEEK_TRAVEL_MM
    if (!(await seekAxisToLimit(axisNo, seekDeltaMm, useFwdLimit, FAST_SEEK_SPEED, FAST_SEEK_TIMEOUT_MS))) {
      return false
    }
    const backoff = await moveMotionAxisRel(axisNo, -seekSign * BACKOFF_MM, { speed: FAST_SEEK_SPEED })
    if (!backoff?.success) return false
    if (!(await waitAxisIdle(axisNo))) return false
    return seekAxisToLimit(axisNo, seekDeltaMm, useFwdLimit, SLOW_SEEK_SPEED, SLOW_SEEK_TIMEOUT_MS)
  }

  const moveRelAndWait = async (
    axisNo: number,
    deltaMm: number,
    options?: { speed?: number; controllerSettings?: typeof controllerStore.controllerSettings }
  ): Promise<boolean> => {
    const move = await moveMotionAxisRel(axisNo, deltaMm, options)
    if (!move?.success) return false
    return waitAxisIdle(axisNo)
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

      const zSeekOk = await homeAxisTwoSpeed(2, 1, true)
      if (!zSeekOk) {
        failHome('寻限位失败', [[false, 'Z']])
        return
      }
      const [xSeekOk, ySeekOk] = await Promise.all([
        homeAxisTwoSpeed(0, -1, false),
        homeAxisTwoSpeed(1, 1, true)
      ])
      if (!xSeekOk || !ySeekOk) {
        failHome('寻限位失败', [[xSeekOk, 'X'], [ySeekOk, 'Y']])
        return
      }

      const [zx, zy, zz] = await Promise.all([
        zeroMotionAxis(0),
        zeroMotionAxis(1),
        zeroMotionAxis(2)
      ])
      if (!zx?.success || !zy?.success || !zz?.success) {
        failHome('清零失败,请检查控制器设置', [[zx?.success, 'X'], [zy?.success, 'Y'], [zz?.success, 'Z']])
        return
      }

      const quickMoveToPosition = await auxiliaryFunctionPanelStore.loadAuxiliaryFunctionPanelQuickMoveToPosition()
      const useDefaultLeave =
        !quickMoveToPosition ||
        (quickMoveToPosition.X === 0 && quickMoveToPosition.Y === 0 && quickMoveToPosition.Z === 0)
      const leaveX = useDefaultLeave ? DEFAULT_LEAVE_X_MM : quickMoveToPosition.X
      const leaveY = useDefaultLeave ? DEFAULT_LEAVE_Y_MM : quickMoveToPosition.Y
      const leaveZ = useDefaultLeave ? DEFAULT_LEAVE_Z_MM : quickMoveToPosition.Z
      const leaveSpeed = { speed: LEAVE_SPEED }

      const [leaveXOk, leaveYOk] = await Promise.all([
        moveRelAndWait(0, leaveX, leaveSpeed),
        moveRelAndWait(1, leaveY, leaveSpeed)
      ])
      if (!leaveXOk || !leaveYOk) {
        failHome('回零离开限位失败', [[leaveXOk, 'X'], [leaveYOk, 'Y']])
        return
      }
      const leaveZOk = await moveRelAndWait(2, leaveZ, leaveSpeed)
      if (!leaveZOk) {
        failHome('回零离开限位失败', [[false, 'Z']])
        return
      }
      if (useDefaultLeave) {
        success('回零完成', '建议前往辅助功能区添加确定点移动位置')
      } else {
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
