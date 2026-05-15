import { computed, onMounted, ref, watch } from 'vue'
import { useControllerSettingsStore } from '../stores/useControllerSettingsStore'
import { useAuxiliaryFunctionPanelStore } from '../stores/useAuxiliaryFunctionPanelStore'
import {
  moveMotionAxisAbs,
  moveMotionAxisRel,
  rotateRAxisByTurns,
  rotateUAxisByAngle,
  setMotionIoOutput,
} from '../api'
import type { MotionAxis } from '../types'
import { useNotification } from '@/shared/composables/useNotification'
import { useHardwareState } from '@/shared/api/hardware'
import { sleep } from '../utils'

export type AxisCenterCalibPhase = 'idle' | 'prepare' | 'move-to-start' | 'sampling' | 'returning' | 'finished' | 'failed'
export type AxisCenterCalibSampleState = 'pending' | 'current' | 'done' | 'failed'
export type AxisCenterCalibSample = {
  id: number
  angle: number
  state: AxisCenterCalibSampleState
  machinePositions: Partial<Record<MotionAxis, number>>
  observedOffsetX: number | null
  observedOffsetY: number | null
}

export const axisNameByNo: MotionAxis[] = ['X', 'Y', 'Z', 'U', 'R']
export const axisCenterCalibDisplayAxes: MotionAxis[] = ['X', 'Y', 'Z', 'U', 'R']

export function useAxisCenterCalib() {
  const { error, success } = useNotification()
  const { mposition } = useHardwareState()
  const controllerStore = useControllerSettingsStore()
  const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()

  onMounted(() => {
    auxiliaryFunctionPanelStore.loadAxisCenterCalibCenterBasedXYSum()
  })

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
    axisNameByNo.map((name) => {
      const mpos = Number(mposition.value[name] ?? NaN)
      return {
        name,
        value: Number.isFinite(mpos) ? mpos.toFixed(3) : '-',
      }
    })
  )

  const axisCenterCalibCurrentAngleText = computed(() => {
    const axisNo = axisCenterCalibRotationAxisNo.value
    const name = axisNameByNo[axisNo]
    const axis = controllerStore.controllerSettings.axes.find((item) => item.axis_no === axisNo)
    const mpos = Number(mposition.value[name] ?? NaN)
    const units = Number(axis?.units)
    if (!Number.isFinite(mpos) || !Number.isFinite(units) || units <= 0) return '-'

    const pulsesPerRev = axisNo === 3 ? 10000 : 6400
    const angle = (mpos * units / pulsesPerRev) * 360
    return `${angle.toFixed(3)}°`
  })

  const axisCenterCalibManualSummary = computed(() => {
    const xs = axisCenterCalibSamples.value
      .map((sample) => sample.observedOffsetX)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const ys = axisCenterCalibSamples.value
      .map((sample) => sample.observedOffsetY)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
    const span = (values: number[]) => values.length ? Math.max(...values) - Math.min(...values) : null

    return { avgX: average(xs), avgY: average(ys), spanX: span(xs), spanY: span(ys) }
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
    const name = axisNameByNo[axisNo]
    const mpos = Number(mposition.value[name] ?? NaN)
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
      state: 'pending' as AxisCenterCalibSampleState,
      machinePositions: {},
      observedOffsetX: null,
      observedOffsetY: null,
    }))
  }

  watch([axisCenterCalibStartAngle, axisCenterCalibAngleStep, axisCenterCalibSampleCount], rebuildAxisCenterCalibSamples, { immediate: true })

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
      result = await moveMotionAxisAbs(axisNo, angle, { controllerSettings: controllerStore.controllerSettings })
    }
    if (!result?.success) throw new Error(result?.message || `${axisNameByNo[axisNo] ?? `Axis ${axisNo}`} 移动失败`)
  }

  const axisCenterCalibCenterBasedXYSum = auxiliaryFunctionPanelStore.axisCenterCalibCenterBasedXYSum

  const handleAxisCenterCalib = async () => {
    if (isAxisCenterCalib.value) {
      error('正在五轴中心校准中')
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

    try {
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
      const middleX = middleSample.machinePositions.X as number
      const middleY = middleSample.machinePositions.Y as number
      const middleZ = middleSample.machinePositions.Z as number
      const beforeMiddleSamples = samples.slice(0, middleIndex)
      const afterMiddleSamples = samples.slice(middleIndex + 1)

      const beforeMiddleXSum = beforeMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.X as number), 0)
      const beforeMiddleZSum = beforeMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.Z as number), 0)

      const afterMiddleXSum = afterMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.X as number), 0)
      const afterMiddleYSum = afterMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.Y as number), 0)
      const afterMiddleZSum = afterMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.Z as number), 0)

      const axisCenterCalibX = (middleX - beforeMiddleXSum + afterMiddleXSum) / 2
      const axisCenterCalibY = (middleY - afterMiddleYSum + afterMiddleYSum) / 2
      const axisCenterCalibZ = (middleZ + beforeMiddleZSum + afterMiddleZSum) / 2

      const centerRotationResult = {
        X: axisCenterCalibX,
        Y: axisCenterCalibY,
        Z: axisCenterCalibZ,
      }
      auxiliaryFunctionPanelStore.saveAxisCenterCalibCenterBasedXYSum(centerRotationResult)

      axisCenterCalibPhase.value = 'finished'
      logAxisCenterCalib('采样完成，请根据相机或打点结果录入人工偏差')
      success('五轴中心校准采样完成', '已生成采样记录，可继续录入偏差并查看统计结果')
    } catch (err) {
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
    } finally {
      clearAxisCenterCalibManualRecordWait()
      isAxisCenterCalib.value = false
    }
  }

  return {
    isAxisCenterCalib,
    axisCenterCalibPhase,
    axisCenterCalibErrorMessage,
    axisCenterCalibRotationAxisNo,
    axisCenterCalibStartAngle,
    axisCenterCalibAngleStep,
    axisCenterCalibSampleCount,
    axisCenterCalibSettleMs,
    axisCenterCalibLaserPulseMs,
    axisCenterCalibAutoPulse,
    axisCenterCalibReturnToStart,
    axisCenterCalibSafetyConfirmed,
    axisCenterCalibSamples,
    axisCenterCalibLogs,
    axisCenterCalibPendingRecordSampleId,
    axisCenterCalibRotationAxisLabel,
    axisCenterCalibPhaseLabel,
    axisCenterCalibStepItems,
    axisCenterCalibLivePositions,
    axisCenterCalibCurrentAngleText,
    axisCenterCalibManualSummary,
    getAxisCenterCalibStepState,
    getAxisCenterCalibSampleClass,
    getAxisPosition,
    captureAxisSnapshot,
    displaySampleAxisPosition,
    hasSampleMachinePositions,
    handleManualRecordAxisCenterCalibSample,
    rebuildAxisCenterCalibSamples,
    logAxisCenterCalib,
    resetAxisCenterCalibWorkflow,
    handleAxisCenterCalib,
    axisCenterCalibCenterBasedXYSum,
  }
}
