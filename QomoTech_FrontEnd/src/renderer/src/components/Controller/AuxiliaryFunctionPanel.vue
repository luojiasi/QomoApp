<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import CollapsiblePanelHeader from '../Others/CollapsiblePanelHeader.vue'
import { useControllerSettingsStore } from '../../stores/controllerSettingsStore'
import { useAuxiliaryFunctionPanelStore } from '../../stores/auxiliaryFunctionPanelStore'
import {
  moveMotionAxisAbs,
  moveMotionAxisRel,
  rotateRAxisByTurns,
  rotateUAxisByAngle,
  setMotionIoOutput,
  type MotionAxis,
} from '../../api/motion'
import { useNotification } from '../../composables/useNotification'
const { error,success } = useNotification()
const controllerStore = useControllerSettingsStore()
const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()
type AuxiliaryTabId =
  | 'axisCenterCalib'
  | 'quickDot'
  | 'quickFocus'
  | 'quickConcentric'
  | 'userCustom'
  | 'quickMoveToPosition'

const isPanelExpanded = ref(false)
const activeTab = ref<AuxiliaryTabId>('axisCenterCalib')

type QuickFocusPointState = 'pending' | 'done' | 'current'
type QuickFocusPoint = { id: number; state: QuickFocusPointState }

const tabs: { id: AuxiliaryTabId; label: string }[] = [
  { id: 'axisCenterCalib', label: '五轴校准' },
  { id: 'quickMoveToPosition', label: '确点移动' },
  { id: 'quickDot', label: '快速打点' },
  { id: 'quickFocus', label: '快速找焦' },
  { id: 'quickConcentric', label: '快速调同' },
  { id: 'userCustom', label: '自定功能' },

]


// ================================五轴校准================================================


const axisNameByNo: MotionAxis[] = ['X', 'Y', 'Z', 'R', 'U']
const axisCenterCalibDisplayAxes: MotionAxis[] = ['X', 'Y', 'Z', 'R', 'U']

onMounted(() => {
  auxiliaryFunctionPanelStore.loadAxisCenterCalibCenterBasedXYSum()
})

type AxisCenterCalibPhase = 'idle' | 'prepare' | 'move-to-start' | 'sampling' | 'returning' | 'finished' | 'failed'
type AxisCenterCalibSampleState = 'pending' | 'current' | 'done' | 'failed'
type AxisCenterCalibSample = {
  id: number
  angle: number
  state: AxisCenterCalibSampleState
  machinePositions: Partial<Record<MotionAxis, number>>
  observedOffsetX: number | null
  observedOffsetY: number | null
}

const isAxisCenterCalib = ref(false)
const axisCenterCalibPhase = ref<AxisCenterCalibPhase>('idle')
const axisCenterCalibErrorMessage = ref('')
const axisCenterCalibRotationAxisNo = ref<3 | 4>(3)
const axisCenterCalibStartAngle = ref(-90)
const axisCenterCalibAngleStep = ref(90)
const axisCenterCalibSampleCount = ref(3)
const axisCenterCalibSettleMs = ref(500)
const axisCenterCalibLaserPulseMs = ref(200)
const axisCenterCalibAutoPulse = ref(false)
const axisCenterCalibReturnToStart = ref(true)
const axisCenterCalibSafetyConfirmed = ref(false)
const axisCenterCalibSamples = ref<AxisCenterCalibSample[]>([])
const axisCenterCalibLogs = ref<string[]>([])
const axisCenterCalibPendingRecordSampleId = ref<number | null>(null)
let axisCenterCalibRecordResolver: ((snapshot: Partial<Record<MotionAxis, number>>) => void) | null = null
// 五轴校准的时候采样点数必须是>=3的奇数
function normalizeAxisCenterCalibSampleCount(value: number): number {
  const rounded = Math.floor(Number(value))
  if (!Number.isFinite(rounded)) return 3
  const atLeastThree = Math.max(3, rounded)
  return atLeastThree % 2 === 0 ? atLeastThree + 1 : atLeastThree
}

const axisCenterCalibRotationAxisLabel = computed(() => axisNameByNo[axisCenterCalibRotationAxisNo.value] ?? `Axis ${axisCenterCalibRotationAxisNo.value}`)

const axisCenterCalibPhaseLabel = computed(() => {
  switch (axisCenterCalibPhase.value) {
    case 'prepare':
      return '准备中'
    case 'move-to-start':
      return '回到起始角'
    case 'sampling':
      return '逐角度采样'
    case 'returning':
      return '返回起点'
    case 'finished':
      return '采样完成'
    case 'failed':
      return '采样失败'
    default:
      return '待开始'
  }
})

const axisCenterCalibStepItems = [
  { id: 'prepare', label: '准备' },
  { id: 'move-to-start', label: '起始角' },
  { id: 'sampling', label: '采样' },
  { id: 'finished', label: '结果' },
]

const axisCenterCalibActiveStepIndex = computed(() => {
  switch (axisCenterCalibPhase.value) {
    case 'prepare':
      return 0
    case 'move-to-start':
      return 1
    case 'sampling':
    case 'returning':
      return 2
    case 'finished':
      return 3
    case 'failed':
      return 2
    default:
      return -1
  }
})

const axisCenterCalibLivePositions = computed(() =>
  axisNameByNo.map((name, axisNo) => {
    const axis = controllerStore.controllerSettings.axes.find((item) => item.axis_no === axisNo)
    const mpos = Number(axis?.mpos)
    return {
      name,
      value: Number.isFinite(mpos) ? mpos.toFixed(3) : '-',
    }
  })
)

const axisCenterCalibCurrentAngleText = computed(() => {
  const axisNo = axisCenterCalibRotationAxisNo.value
  const axis = controllerStore.controllerSettings.axes.find((item) => item.axis_no === axisNo)
  const mpos = Number(axis?.mpos)
  const units = Number(axis?.units)
  if (!Number.isFinite(mpos) || !Number.isFinite(units) || units <= 0) return '-'

  // U 轴：10000 pulse/rev；R 轴：1.8°+32细分 => 6400 pulse/rev
  const pulsesPerRev = axisNo === 3 ? 10000 : 6400
  const angle = (mpos * units / pulsesPerRev) * 360
  return `${angle.toFixed(3)}°`
})

// 计算偏差点位的位置
const axisCenterCalibManualSummary = computed(() => {
  const xs = axisCenterCalibSamples.value
    .map((sample) => sample.observedOffsetX)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const ys = axisCenterCalibSamples.value
    .map((sample) => sample.observedOffsetY)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  const span = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : null

  return {avgX: average(xs),avgY: average(ys),spanX: span(xs),spanY: span(ys)}
})

function getAxisCenterCalibStepState(index: number): 'done' | 'current' | 'pending' {
  const active = axisCenterCalibActiveStepIndex.value
  if (active < 0) return 'pending'
  if (index < active) return 'done'
  if (index === active) return 'current'
  return 'pending'
}

function getAxisCenterCalibSampleClass(state: AxisCenterCalibSampleState): string {
  if (state === 'done') return 'border-emerald-500/40 bg-emerald-500/10'
  if (state === 'current') return 'border-yellow-400/60 bg-yellow-400/10'
  if (state === 'failed') return 'border-red-500/50 bg-red-500/10'
  return 'border-(--app-border) bg-(--app-input-bg)'
}

function getAxisPosition(axisNo: number): number | null {
  const axis = controllerStore.controllerSettings.axes.find((item) => item.axis_no === axisNo)
  const mpos = Number(axis?.mpos)
  return Number.isFinite(mpos) ? mpos : null
}

function captureAxisSnapshot(): Partial<Record<MotionAxis, number>> {
  const snapshot: Partial<Record<MotionAxis, number>> = {}
  axisNameByNo.forEach((axisName, axisNo) => {
    const value = getAxisPosition(axisNo)
    if (typeof value === 'number') snapshot[axisName] = Number(value.toFixed(3))
  })
  return snapshot
}

function displaySampleAxisPosition(sample: AxisCenterCalibSample, axisName: MotionAxis): string {
  const value = sample.machinePositions[axisName]
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '-'
}

function hasSampleMachinePositions(sample: AxisCenterCalibSample): boolean {
  return axisCenterCalibDisplayAxes.some((axisName) => typeof sample.machinePositions[axisName] === 'number')
}

function waitForAxisCenterCalibManualRecord(sampleId: number): Promise<Partial<Record<MotionAxis, number>>> {
  axisCenterCalibPendingRecordSampleId.value = sampleId
  return new Promise((resolve) => {
    axisCenterCalibRecordResolver = resolve
  })
}

function clearAxisCenterCalibManualRecordWait(): void {
  axisCenterCalibPendingRecordSampleId.value = null
  axisCenterCalibRecordResolver = null
}

function handleManualRecordAxisCenterCalibSample(sampleId: number): void {
  const sampleIndex = axisCenterCalibSamples.value.findIndex((sample) => sample.id === sampleId)
  if (sampleIndex < 0) {
    error('未找到对应的校准采样点')
    return
  }

  if (
    isAxisCenterCalib.value &&
    axisCenterCalibPendingRecordSampleId.value !== null &&
    axisCenterCalibPendingRecordSampleId.value !== sampleId
  ) {
    error(`请先记录第 ${axisCenterCalibPendingRecordSampleId.value + 1} 点位置`)
    return
  }

  const snapshot = captureAxisSnapshot()
  const hasAnyPosition = axisCenterCalibDisplayAxes.some((axisName) => typeof snapshot[axisName] === 'number')
  if (!hasAnyPosition) {
    error('当前位置不可用，无法记录 XYZRU')
    return
  }

  const sample = axisCenterCalibSamples.value[sampleIndex]
  axisCenterCalibSamples.value[sampleIndex] = {
    ...sample,
    machinePositions: snapshot,
    state: isAxisCenterCalib.value ? 'done' : sample.state,
  }

  logAxisCenterCalib(`手动记录第 ${sample.id + 1} 点 XYZRU 位置`)

  if (axisCenterCalibPendingRecordSampleId.value === sampleId && axisCenterCalibRecordResolver) {
    const resolve = axisCenterCalibRecordResolver
    clearAxisCenterCalibManualRecordWait()
    resolve(snapshot)
    success(`第 ${sample.id + 1} 点位置已记录，继续下一个点`)
    return
  }

  success(`第 ${sample.id + 1} 点位置已记录`)
}

function rebuildAxisCenterCalibSamples(): void {
  const count = normalizeAxisCenterCalibSampleCount(axisCenterCalibSampleCount.value)
  axisCenterCalibSampleCount.value = count
  axisCenterCalibSamples.value = Array.from({ length: count }, (_, index) => ({
    id: index,
    angle: Number((axisCenterCalibStartAngle.value + index * axisCenterCalibAngleStep.value).toFixed(3)),
    state: 'pending',
    machinePositions: {},
    observedOffsetX: null,
    observedOffsetY: null,
  }))
}

watch([axisCenterCalibStartAngle, axisCenterCalibAngleStep, axisCenterCalibSampleCount], rebuildAxisCenterCalibSamples, {immediate: true})

function logAxisCenterCalib(message: string): void {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  axisCenterCalibLogs.value.unshift(`[${timestamp}] ${message}`)
}

function resetAxisCenterCalibWorkflow(): void {
  axisCenterCalibPhase.value = 'idle'
  axisCenterCalibErrorMessage.value = ''
  axisCenterCalibLogs.value = []
  clearAxisCenterCalibManualRecordWait()
  rebuildAxisCenterCalibSamples()
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function pulseCalibrationLaser(durationMs: number): Promise<void> {
  const onResult = await setMotionIoOutput(2, true)
  if (!onResult?.success) throw new Error(onResult?.message || '激光输出打开失败')
  try {
    await sleep(durationMs)
  } finally {
    const offResult = await setMotionIoOutput(2, false)
    if (!offResult?.success) {
      throw new Error(offResult?.message || '激光输出关闭失败')
    }
  }
}

async function moveAxisToAngle(axisNo: number, angle: number): Promise<void> {
  const axisSpeed = 1
  const speed = Number.isFinite(axisSpeed) && axisSpeed > 0 ? axisSpeed : 20
  const rotateDirection = angle >= 0 ? '顺时针' : '逆时针'
  const absAngle = Math.abs(angle)
  let result
  if (axisNo === 3) {
    result = await rotateUAxisByAngle({
      旋转角度: absAngle,
      旋转速度: speed,
      旋转方向: rotateDirection,
      运动模式: 'absolute',
    })
  } else if (axisNo === 4) {
    result = await rotateRAxisByTurns({
      旋转圈数: absAngle / 360,
      旋转速度: speed,
      旋转方向: rotateDirection,
      运动模式: 'absolute',
    })
  } else {
    result = await moveMotionAxisAbs(axisNo, angle, {controllerSettings: controllerStore.controllerSettings})
  }
  if (!result?.success) throw new Error(result?.message || `${axisNameByNo[axisNo] ?? `Axis ${axisNo}`} 移动失败`)
}
// ================================五轴校准END================================================

const isQuickFocusing = ref(false)
/** XY 每边数量，形成 N×N 矩阵（对应 xCount / yCount） */
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

const quickFocusDotGridStyle = computed(() => ({gridTemplateColumns: `repeat(${quickFocusGridSize.value}, minmax(0, 1fr))`}))

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
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  quickFocusPoints.value = quickFocusPoints.value.map((point) => ({
    ...point,
    state: 'pending',
  }))
  quickFocusPoints.value[0].state = 'current'
  isQuickFocusing.value = true
  try {
    // 从当前点开始，按矩阵逐点扫描，避免累计偏移导致轨迹变形
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

      // 每一行结束回到该行起点，确保下一行仍是标准矩阵
      if (yCount > 1) {
        await moveMotionAxisRel(0, -step * (yCount - 1))
        await moveMotionAxisRel(2, -Z_step)
      }
    }
  } finally {
    isQuickFocusing.value = false
  }
}

const isQuickConcentric = ref(false)
const handleQuickConcentric = async()=>{
  if (isQuickConcentric.value) {
    error("正在快速找同心度中")
    return
  }
  try{
    isQuickConcentric.value = true
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))


    await sleep(500)
    setMotionIoOutput(2, true)
    await sleep(1000)
    setMotionIoOutput(2, false)

    const result =await moveMotionAxisRel(2,-10)
    if (result.success){
      await sleep(500)
      setMotionIoOutput(2, true)
      await sleep(1000)
      setMotionIoOutput(2, false)
      await moveMotionAxisRel(2,10)
    }

  }
  finally{ 
    isQuickConcentric.value = false
  }
}
// ================================五轴校准================================================
const axisCenterCalibCenterBasedXYSum = auxiliaryFunctionPanelStore.axisCenterCalibCenterBasedXYSum

const handleAxisCenterCalib = async()=>{
  if (isAxisCenterCalib.value) {
    error("正在五轴中心校准中")
    return
  }
  if (!axisCenterCalibSafetyConfirmed.value) {
    error('请先确认工件、相机与低功率激光状态安全')
    return
  }

  if (axisCenterCalibAngleStep.value === 0) {
    error('角度步长不能为 0')
    return
  }
  if (axisCenterCalibSettleMs.value < 0 || axisCenterCalibLaserPulseMs.value < 0) {
    error('等待时间和激光时间不能小于 0')
    return
  }

  axisCenterCalibErrorMessage.value = ''
  axisCenterCalibLogs.value = []
  rebuildAxisCenterCalibSamples()

  try{
    isAxisCenterCalib.value = true
    axisCenterCalibPhase.value = 'prepare'
    logAxisCenterCalib(`开始 ${axisCenterCalibRotationAxisLabel.value} 轴中心校准采样`)

    axisCenterCalibPhase.value = 'move-to-start'
    logAxisCenterCalib(`移动到起始角 ${axisCenterCalibStartAngle.value.toFixed(3)}`)
    await moveAxisToAngle(axisCenterCalibRotationAxisNo.value, axisCenterCalibStartAngle.value)
    await sleep(axisCenterCalibSettleMs.value)

    axisCenterCalibPhase.value = 'sampling'
    for (let index = 0; index < axisCenterCalibSamples.value.length; index++) {
      const sample = axisCenterCalibSamples.value[index]
      axisCenterCalibSamples.value[index] = {
        ...sample,
        state: 'current',
        machinePositions: {},
      }

      logAxisCenterCalib(`第 ${index + 1} 点移动到 ${sample.angle.toFixed(3)}°`)
      await moveAxisToAngle(axisCenterCalibRotationAxisNo.value, sample.angle)
      await sleep(axisCenterCalibSettleMs.value)

      if (axisCenterCalibAutoPulse.value && axisCenterCalibLaserPulseMs.value > 0) {
        logAxisCenterCalib(`第 ${index + 1} 点触发激光 ${axisCenterCalibLaserPulseMs.value} ms`)
        await pulseCalibrationLaser(axisCenterCalibLaserPulseMs.value)
      }

      logAxisCenterCalib(`第 ${index + 1} 点已到位，等待手动记录 XYZRU 位置`)
      const snapshot = await waitForAxisCenterCalibManualRecord(sample.id)
      axisCenterCalibSamples.value[index] = {
        ...axisCenterCalibSamples.value[index],
        state: 'done',
        machinePositions: snapshot,
      }
    }

    if (axisCenterCalibReturnToStart.value) {
      axisCenterCalibPhase.value = 'returning'
      logAxisCenterCalib(`返回起始角`)
      await moveAxisToAngle(axisCenterCalibRotationAxisNo.value, 0)
      await sleep(axisCenterCalibSettleMs.value)
    }
    const samples = axisCenterCalibSamples.value
    const middleIndex = Math.floor(samples.length / 2)
    const middleSample = samples[middleIndex]
    // 中间的值
    const middleX = middleSample.machinePositions.X as number
    const middleY = middleSample.machinePositions.Y as number
    const middleZ = middleSample.machinePositions.Z as number
    // 中间之前的点
    const beforeMiddleSamples = samples.slice(0, middleIndex)
    // 中间之后的点
    const afterMiddleSamples = samples.slice(middleIndex + 1)


    // 中间之前的点的相加数
    const beforeMiddleXSum = beforeMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.X as number), 0)
    const beforeMiddleYSum = beforeMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.Y as number), 0)
    const beforeMiddleZSum = beforeMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.Z as number), 0)
    console.log(beforeMiddleXSum+"beforeMiddleXSum")
    console.log(beforeMiddleYSum+"beforeMiddleYSum")
    console.log(beforeMiddleZSum+"beforeMiddleZSum")
    // 中间之后的点的相加数
    const afterMiddleXSum = afterMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.X as number), 0)
    const afterMiddleYSum = afterMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.Y as number), 0)
    const afterMiddleZSum = afterMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.Z as number), 0)
    console.log(afterMiddleXSum+"afterMiddleXSum")
    console.log(afterMiddleYSum+"afterMiddleYSum")
    console.log(afterMiddleZSum+"afterMiddleZSum")

    const axisCenterCalibX = (middleX-beforeMiddleXSum+afterMiddleXSum)/2
    const axisCenterCalibY = (middleY-afterMiddleYSum+afterMiddleYSum)/2
    const axisCenterCalibZ = (middleZ+beforeMiddleZSum+afterMiddleZSum)/2
    console.log(axisCenterCalibX+"axisCenterCalibX")
    console.log(axisCenterCalibY+"axisCenterCalibY")
    console.log(axisCenterCalibZ+"axisCenterCalibZ")

    const centerRotationResult = {
      X: axisCenterCalibX,
      Y: axisCenterCalibY,
      Z: axisCenterCalibZ,
    }
    auxiliaryFunctionPanelStore.saveAxisCenterCalibCenterBasedXYSum(centerRotationResult)






    axisCenterCalibPhase.value = 'finished'
    logAxisCenterCalib('采样完成，请根据相机或打点结果录入人工偏差')
    success('五轴中心校准采样完成', '已生成采样记录，可继续录入偏差并查看统计结果')
  }
  catch (err) {
    const message = err instanceof Error ? err.message : '五轴中心校准失败'
    axisCenterCalibPhase.value = 'failed'
    axisCenterCalibErrorMessage.value = message
    const currentIndex = axisCenterCalibSamples.value.findIndex((sample) => sample.state === 'current')
    if (currentIndex >= 0) {
      axisCenterCalibSamples.value[currentIndex] = {
        ...axisCenterCalibSamples.value[currentIndex],
        state: 'failed',
      }
    }
    logAxisCenterCalib(`失败：${message}`)
    error('五轴中心校准失败', message)
  }
  finally{
    clearAxisCenterCalibManualRecordWait()
    isAxisCenterCalib.value = false
  }
}
// ================================五轴校准================================================

// ================================快读移动至定位位置STR=======================================
function displayQuickMoveAxis(axisName: 'X' | 'Y' | 'Z'): string {
  const value = auxiliaryFunctionPanelStore.AuxiliaryFunctionPanel_quickMoveToPosition?.[axisName]
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '-'
}

function handleSaveQuickMoveToPosition(): void {
  const X = getAxisPosition(0)
  const Y = getAxisPosition(1)
  const Z = getAxisPosition(2)
  if (X === null || Y === null || Z === null) {
    error('当前 XYZ 位置不可用，保存失败')
    return
  }

  const value = {
    X: Number(X.toFixed(3)),
    Y: Number(Y.toFixed(3)),
    Z: Number(Z.toFixed(3)),
  }
  auxiliaryFunctionPanelStore.saveAuxiliaryFunctionPanelQuickMoveToPosition(value)
  success('已保存当前 XYZ 到确点位置')
}
// ================================快读移动至定位位置END=======================================

</script>

<template>
  <div
    class="flex min-h-0 shrink-0 flex-col rounded-2xl border border-(--app-border) bg-(--app-card) p-4 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.14)] transition-[min-height] duration-200 dark:shadow-[0_6px_16px_-6px_rgba(0,0,0,0.42)]"
    :class="isPanelExpanded ? 'min-h-[min(220px,44vh)]' : ''"
  >
    <CollapsiblePanelHeader
      v-model:expanded="isPanelExpanded"
      title="辅助功能区"
    />
    <div v-show="isPanelExpanded" class="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <p class="mb-2 text-xs text-(--app-text-muted)">功能入口</p>
        <div class="flex flex-col-5 gap-2">
          <button
            v-for="item in tabs"
            :key="item.id"
            type="button"
            class="rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30"
            :class="
              activeTab === item.id
                ? 'border-sky-500/70 bg-sky-500/10 text-(--app-text-primary)'
                : 'border-(--app-border) bg-(--app-input-bg) text-(--app-text-primary) hover:border-sky-500/35 hover:bg-(--app-card)'
            "
            @click="activeTab = item.id"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div
        class="rounded-xl border border-(--app-border) bg-(--app-card-soft) p-3 shadow-sm shadow-slate-900/5 ring-1 ring-slate-950/4 dark:shadow-md dark:shadow-black/25 dark:ring-white/5"
      >
        <div v-if="activeTab === 'axisCenterCalib'" class="mt-2 space-y-3">
          <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3 text-xs text-(--app-text-muted)">
            <p>五轴校准。设备按设定角度依次旋转，并触发激光打点。</p>
            <p class="mt-1">请结合相机或实物打点结果录入人工偏差，便于后续补偿计算</p>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <div
              v-for="(step, index) in axisCenterCalibStepItems"
              :key="step.id"
              class="rounded-lg border px-2 py-2 text-center text-xs"
              :class="
                getAxisCenterCalibStepState(index) === 'done'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-(--app-text-primary)'
                  : getAxisCenterCalibStepState(index) === 'current'
                    ? 'border-sky-500/50 bg-sky-500/10 text-(--app-text-primary)'
                    : 'border-(--app-border) bg-(--app-input-bg) text-(--app-text-muted)'
              "
            >
              {{ index + 1 }}. {{ step.label }}
            </div>
          </div>
          <div class="grid gap-3 grid-cols-4">
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              旋转轴
              <select
                v-model.number="axisCenterCalibRotationAxisNo"
                :disabled="isAxisCenterCalib"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option :value="3">U 轴</option>
                <option :value="4">R 轴</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              起始角
              <input
                v-model.number="axisCenterCalibStartAngle"
                type="number"
                step="any"
                :disabled="isAxisCenterCalib"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              角度步长
              <input
                v-model.number="axisCenterCalibAngleStep"
                type="number"
                step="any"
                :disabled="isAxisCenterCalib"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              采样点数
              <input
                v-model.number="axisCenterCalibSampleCount"
                type="number"
                min="3"
                step="2"
                :disabled="isAxisCenterCalib"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              等待时间(ms)
              <input
                v-model.number="axisCenterCalibSettleMs"
                type="number"
                min="0"
                step="1"
                :disabled="isAxisCenterCalib"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              激光时间(ms)
              <input
                v-model.number="axisCenterCalibLaserPulseMs"
                type="number"
                min="0"
                step="1"
                :disabled="isAxisCenterCalib || !axisCenterCalibAutoPulse"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          </div>
          <div class="grid gap-3 grid-cols-2">
            <label class="flex items-center gap-2 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary)">
              <input v-model="axisCenterCalibAutoPulse" type="checkbox" :disabled="isAxisCenterCalib" />
              自动打点
            </label>
            <label class="flex items-center gap-2 rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary)">
              <input v-model="axisCenterCalibReturnToStart" type="checkbox" :disabled="isAxisCenterCalib" />
              结束后回起始角
            </label>
          </div>
          <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
            <label class="flex items-start gap-2 text-sm text-(--app-text-primary)">
              <input v-model="axisCenterCalibSafetyConfirmed" type="checkbox" :disabled="isAxisCenterCalib" class="mt-1" />
              <span>已确认相机对焦完成、工件固定可靠、激光功率处于安全校准档位。</span>
            </label>
          </div>
          <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">当前阶段</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibPhaseLabel }}</p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">目标旋转轴</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibRotationAxisLabel }}</p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">当前角度</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibCurrentAngleText }}</p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">失败信息</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibErrorMessage || '-' }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="isAxisCenterCalib"
              @click="handleAxisCenterCalib"
              class="flex-1 rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ isAxisCenterCalib ? '校准采样中...' : '开始五轴中心校准' }}
            </button>
            <button
              type="button"
              :disabled="isAxisCenterCalib"
              @click="resetAxisCenterCalibWorkflow"
              class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-4 py-2 text-sm font-medium text-(--app-text-primary) transition hover:border-sky-500/35 hover:bg-(--app-card) disabled:cursor-not-allowed disabled:opacity-50"
            >
              重置
            </button>
          </div>
          <div class="grid gap-2 lg:grid-cols-5">
            <div
              v-for="position in axisCenterCalibLivePositions"
              :key="position.name"
              class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2"
            >
              <p class="text-xs text-(--app-text-muted)">{{ position.name }} 当前位置</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ position.value }}</p>
            </div>
          </div>
          <div class="space-y-2">
            <div
              v-for="sample in axisCenterCalibSamples"
              :key="sample.id"
              class="rounded-xl border p-3"
              :class="getAxisCenterCalibSampleClass(sample.state)"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-medium text-(--app-text-primary)">
                  第 {{ sample.id + 1 }} 点 / {{ sample.angle.toFixed(3) }}°
                </p>
                <span class="text-xs text-(--app-text-muted)">
                  {{
                    sample.state === 'done'
                      ? '已完成'
                      : sample.state === 'current'
                        ? '执行中'
                        : sample.state === 'failed'
                          ? '失败'
                          : '待执行'
                  }}
                </span>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-(--app-text-muted) lg:grid-cols-5">
                <div
                  v-for="axisName in axisCenterCalibDisplayAxes"
                  :key="axisName"
                  class="rounded-lg border border-(--app-border) bg-(--app-card) px-2 py-2"
                >
                  <p>{{ axisName }}</p>
                  <p class="mt-1 text-sm text-(--app-text-primary)">{{ displaySampleAxisPosition(sample, axisName) }}</p>
                </div>
              </div>
              <div class="mt-3 grid gap-2 lg:grid-cols-3">
                <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
                  人工偏差 X(mm)
                  <input
                    v-model.number="sample.observedOffsetX"
                    type="number"
                    step="any"
                    :disabled="isAxisCenterCalib"
                    class="w-full rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2 text-sm text-(--app-text-primary) outline-none"
                  />
                </label>
                <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
                  人工偏差 Y(mm)
                  <input
                    v-model.number="sample.observedOffsetY"
                    type="number"
                    step="any"
                    :disabled="isAxisCenterCalib"
                    class="w-full rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2 text-sm text-(--app-text-primary) outline-none"
                  />
                </label>
                <div class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
                  手动记录位置
                  <button
                    type="button"
                    :disabled="!((!isAxisCenterCalib) || axisCenterCalibPendingRecordSampleId === sample.id)"
                    @click="handleManualRecordAxisCenterCalibSample(sample.id)"
                    class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2 text-sm text-(--app-text-primary) transition hover:border-sky-500/35 hover:bg-(--app-input-bg) disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {{
                      axisCenterCalibPendingRecordSampleId === sample.id
                        ? '标记并继续'
                        : hasSampleMachinePositions(sample)
                          ? '重记位置'
                          : '记当前位置'
                    }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
            <p class="text-xs text-(--app-text-muted)">中心点基准 XY 累加值</p>
            <div v-if="axisCenterCalibCenterBasedXYSum" class="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2">
                <p class="text-xs text-(--app-text-muted)">X补偿值</p>
                <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibCenterBasedXYSum.X.toFixed(3) }}</p>
              </div>
              <div class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2">
                <p class="text-xs text-(--app-text-muted)">Y补偿值</p>
                <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibCenterBasedXYSum.Y.toFixed(3) }}</p>
              </div>
              <div class="rounded-lg border border-(--app-border) bg-(--app-card) px-3 py-2">
                <p class="text-xs text-(--app-text-muted)">Z补偿值</p>
                <p class="mt-1 text-sm text-(--app-text-primary)">{{ axisCenterCalibCenterBasedXYSum.Z.toFixed(3) }}</p>
              </div>
            </div>
            <p v-else class="mt-2 text-xs text-(--app-text-muted)">请先完成全部采样点的 XY 位置记录</p>
          </div>
          <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">人工偏差均值 X</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">
                {{ axisCenterCalibManualSummary.avgX === null ? '-' : axisCenterCalibManualSummary.avgX.toFixed(3) }}
              </p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">人工偏差均值 Y</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">
                {{ axisCenterCalibManualSummary.avgY === null ? '-' : axisCenterCalibManualSummary.avgY.toFixed(3) }}
              </p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">偏差峰峰值 X</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">
                {{ axisCenterCalibManualSummary.spanX === null ? '-' : axisCenterCalibManualSummary.spanX.toFixed(3) }}
              </p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">偏差峰峰值 Y</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">
                {{ axisCenterCalibManualSummary.spanY === null ? '-' : axisCenterCalibManualSummary.spanY.toFixed(3) }}
              </p>
            </div>
          </div>
          <div class="rounded-xl border border-(--app-border) bg-(--app-input-bg) p-3">
            <p class="text-xs text-(--app-text-muted)">执行日志</p>
            <div class="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-(--app-text-primary)">
              <p v-for="item in axisCenterCalibLogs" :key="item">{{ item }}</p>
              <p v-if="axisCenterCalibLogs.length === 0" class="text-(--app-text-muted)">尚未开始采样</p>
            </div>
          </div>
        </div>
        <div v-if="activeTab === 'quickFocus'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            @click="handleQuickFocus"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            设定找焦点
          </button>
          <div
            class="grid gap-3 justify-items-center"
            :style="quickFocusDotGridStyle"
          >
            <span
              v-for="point in quickFocusPoints"
              :key="point.id"
              class="h-2.5 w-2.5 rounded-full ring-1"
              :class="getQuickFocusPointClass(point.state)"
            />
          </div>
          <div class="grid grid-cols-3 gap-2">
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              X/Y 数量
              <input
                v-model.number="quickFocusGridSize"
                type="number"
                min="1"
                step="1"
                :disabled="isQuickFocusing"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              step
              <input
                v-model.number="quickFocusStep"
                type="number"
                min="0"
                step="any"
                :disabled="isQuickFocusing"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-(--app-text-muted)">
              Z_step
              <input
                v-model.number="quickFocusZStep"
                type="number"
                min="0"
                step="any"
                :disabled="isQuickFocusing"
                class="w-full rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2 text-sm text-(--app-text-primary) outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          </div>
        </div>
        <div v-if="activeTab === 'quickDot'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            快速打点
          </button>
        </div>
        <div v-if="activeTab === 'quickConcentric'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            @click="handleQuickConcentric"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            快速找同心度
          </button>
        </div>
        <div v-if="activeTab === 'userCustom'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            用户自定义
          </button>
        </div>
        <div v-if="activeTab === 'quickMoveToPosition'" class="mt-2 space-y-3">
          <button
            type="button"
            :disabled="isQuickFocusing"
            @click="handleSaveQuickMoveToPosition"
            class="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 py-2 text-sm font-medium text-(--app-text-primary) transition hover:bg-sky-500/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            获取并保存当前位置 XYZ
          </button>
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">X</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ displayQuickMoveAxis('X') }}</p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">Y</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ displayQuickMoveAxis('Y') }}</p>
            </div>
            <div class="rounded-lg border border-(--app-border) bg-(--app-input-bg) px-3 py-2">
              <p class="text-xs text-(--app-text-muted)">Z</p>
              <p class="mt-1 text-sm text-(--app-text-primary)">{{ displayQuickMoveAxis('Z') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
