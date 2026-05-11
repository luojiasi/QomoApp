<script setup lang="ts">
import { computed, onMounted, ref,watch} from 'vue'
import SvgIcon from '../../components/ui/SvgIcon.vue'
import { setMotionIoOutput } from '../../api/motion'
import { zeroMotionAxis,moveMotionAxisRel,getMotionIoInput } from '../../api/motion'
import { useHardwareState, waitControllerConnected } from '../../api/hardware'
import { useAuxiliaryFunctionPanelStore } from '../../stores/auxiliaryFunctionPanelStore'
const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()

import { useNotification } from '@renderer/composables/useNotification'
import { useControllerSettingsStore } from '../../stores/controllerSettingsStore'
const { success, error } = useNotification()
const controllerStore = useControllerSettingsStore()
const { ioOut: wsIoOut } = useHardwareState()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// 用来等待连接控制器之后执行自动回零
const waitMotionConnected = async (timeoutMs = 15000, pollMs = 300): Promise<boolean> => {
  return waitControllerConnected(timeoutMs, pollMs)
}

// IO 输出 0/1/2 状态由 WS 实时驱动
const ioOut0 = computed(() => Boolean(wsIoOut.value['0']))
const ioOut1 = computed(() => Boolean(wsIoOut.value['1']))
const ioOut2 = computed(() => Boolean(wsIoOut.value['2']))

const handleOutput0 = async () => {
  await setMotionIoOutput(0, !ioOut0.value)
  // 状态由下一帧 WS 推送确认
}
const handleOutput1 = async () => {
  await setMotionIoOutput(1, !ioOut1.value)
}
const handleOutput2 = async () => {
  await setMotionIoOutput(2, !ioOut2.value)
}

// 添加回零按钮 同时添加是否启动开机就自动回零
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
/**
 * 约定：未压限位时为 true，压到上限位后变为 false。
 */
 const getAxisLimitInputNo = (AxisNum:number,fwd_in:boolean): number | null => {
  const axis = controllerStore.controllerSettings.axes.find((a) => a.axis_no === AxisNum)
  if (!axis) return null
  let n = -1
  if (fwd_in){
    n = Number(axis.fwd_in)
  }else{
    n = Number(axis.rev_in)
  }
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}
/**
 * 轮询读取轴 上限位输入：先确认曾离开限位（值为 true），再等到变为 false 视为到位。
 */
const waitAxisUpperLimitInputFalse = async (AxisNum:number,fwd_in:boolean=false,timeoutMs = 20000) => {
  const ioNo = getAxisLimitInputNo(AxisNum,fwd_in)
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
    // //首先判断XY轴的限位不能为-1
    if (getAxisLimitInputNo(0,false) === null && getAxisLimitInputNo(1,true)===null && getAxisLimitInputNo(2,true)===null) {
      error('未配置XYZ限位','请在控制器设置中为轴配置有效的限位输入口')
      isSetHome.value = '未回零'
      return
    }

    // 2) Z 轴向上走，直到停止（通常是到限位/到达行程终点）
    const UP_TRAVEL_MM = 5000
    const [moveX, moveY, moveZ] = await Promise.all([
      // 除了x其他都往正方向走
      moveMotionAxisRel(0, -UP_TRAVEL_MM, {speed: 5}),
      moveMotionAxisRel(1, UP_TRAVEL_MM, {speed: 5}),
      moveMotionAxisRel(2, UP_TRAVEL_MM, {speed: 5})
    ])  
    if (!moveX?.success || !moveY?.success || !moveZ?.success){
      const message = [!moveX && 'X', !moveY && 'Y', !moveZ && 'Z'].filter(Boolean).join('/')
      isSetHome.value = '未回零'
      error('回零运动发送失败',message)
      return
    }
    const [okX, okY, okZ] = await Promise.all([
      waitAxisUpperLimitInputFalse(0,false),
      waitAxisUpperLimitInputFalse(1,true),
      waitAxisUpperLimitInputFalse(2,true)
    ])
    if (!okX || !okY || !okZ) {
      const message = [!okX && 'X', !okY && 'Y', !okZ && 'Z'].filter(Boolean).join('/')
      isSetHome.value = '未回零'
      error('等待轴上限位超时',message)
      return
    }

    // 3)  清零 X/Y（控制器层面的“位置清零”）
    const [zx,zy,zz] = await Promise.all([
      zeroMotionAxis(0),
      zeroMotionAxis(1),
      zeroMotionAxis(2)
    ])
    if (!zz?.success && !zx?.success && !zy?.success) {
      const message = [!zx && 'X', !zy && 'Y', !zz && 'Z'].filter(Boolean).join('/')
      isSetHome.value = '未回零'
      error("清零失败,请检查控制器设置",message)
      return
    }

    // 这是获取辅助功能区的确点移动的位置，如果都为0则运动一小段距离，用于回零
    const quickMoveToPosition = auxiliaryFunctionPanelStore.loadAuxiliaryFunctionPanelQuickMoveToPosition()
    if (!quickMoveToPosition || (quickMoveToPosition.X === 0 && quickMoveToPosition.Y === 0 && quickMoveToPosition.Z === 0)) {
      const [moveX2, moveY2, moveZ2] = await Promise.all([
        moveMotionAxisRel(0, 80, {controllerSettings: controllerStore.controllerSettings}),
        moveMotionAxisRel(1, -80, {controllerSettings: controllerStore.controllerSettings}),
        moveMotionAxisRel(2, -40, {controllerSettings: controllerStore.controllerSettings})
      ])
      if (!moveX2?.success || !moveY2?.success || !moveZ2?.success) {
        const message = [!moveX2 && 'X', !moveY2 && 'Y', !moveZ2 && 'Z'].filter(Boolean).join('/')
        isSetHome.value = '未回零'
        error('回零运动失败',message)
        return
      }
      success('回零完成','建议前往辅助功能区添加确定点移动位置')
    }else{
      const [moveX2, moveY2, moveZ2] = await Promise.all([
        moveMotionAxisRel(0, quickMoveToPosition.X, {controllerSettings: controllerStore.controllerSettings}),
        moveMotionAxisRel(1, quickMoveToPosition.Y , {controllerSettings: controllerStore.controllerSettings}),
        moveMotionAxisRel(2, quickMoveToPosition.Z, {controllerSettings: controllerStore.controllerSettings})
      ])
      if (!moveX2?.success || !moveY2?.success || !moveZ2?.success) {
        const message = [!moveX2 && 'X', !moveY2 && 'Y', !moveZ2 && 'Z'].filter(Boolean).join('/')
        isSetHome.value = '未回零'
        error('回零运动失败',message)
        return
      }
      success('回零完成')
    }
    
    isSetHome.value = '回零完成'
  } finally {
    isMovingHome.value = false
  }
}
onMounted(async () => {
  if (autoHomeOnStart.value && !ISARRIVEDHOME.value) {
    const connected = await waitMotionConnected()
    if (!connected) {
      error('启动自动回零失败', '控制器未就绪，请稍后手动回零')
      return
    }
    await handleHome()
  }
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      @click="handleOutput0"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200',
        ioOut0
          ? 'border-green-500 bg-green-500 text-white shadow-green-900/20'
          : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)'
      ]"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-power" class-name="text-2xl" />
    </button>
    <button
      type="button"
      @click="handleOutput1"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200',
        ioOut1
          ? 'border-green-500 bg-green-500 text-white shadow-green-900/20'
          : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)'
      ]"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-kejian" class-name="text-2xl" />
    </button>
    <button
      type="button"
      @click="handleOutput2"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-lg border-2 shadow-sm transition-colors duration-200',
        ioOut2
          ? 'border-green-500 bg-green-500 text-white shadow-green-900/20'
          : 'border-(--app-border) bg-(--app-card-soft) text-(--app-text-muted) hover:border-sky-400/50 hover:text-(--app-text-secondary)'
      ]"
      @keydown.enter.prevent
    >
      <SvgIcon icon-name="icon-Point" class-name="text-2xl" />
    </button>
    <button
      type="button"
      @click="handleHome"
      :class="[
        'flex h-12 w-12 items-center justify-center rounded-full border text-xs font-medium shadow-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        homeStatusClass
      ]"
      @keydown.enter.prevent
    >
      {{ isSetHome }}
    </button>
    <label class="flex items-center gap-1 text-xs text-(--app-text-secondary) select-none">
      <input
        v-model="autoHomeOnStart"
        type="checkbox"
        class="h-4 w-4 accent-sky-500"
      />
      启动自动回零
    </label>
  </div>
</template>
