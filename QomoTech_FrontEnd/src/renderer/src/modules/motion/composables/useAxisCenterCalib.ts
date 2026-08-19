import { computed, ref, watch } from 'vue'
import { useControllerSettingsStore } from '../stores/useControllerSettingsStore'
import { useAuxiliaryFunctionPanelStore } from '../stores/useAuxiliaryFunctionPanelStore'
import {
  moveMotionAxisAbs,
  moveMotionAxisRel,
  rotateRAxisByTurns,
  rotateUAxisByAngle,
  setMotionIoOutput,
  waitMotionIdle,
} from '../api'
import type { MotionAxis } from '../types'
import { getRAxisPosition, syncRAxisPosition } from '@/modules/program/api'
import type { RAxisPositionPayload } from '@/modules/program/types'
import { useNotification } from '@/shared/composables/useNotification'
import { useHardwareState } from '@/shared/api/hardware'
import { sleep } from '../utils'
import { XYZ } from '@/shared/types'

/** 五轴中心校准流程当前所处阶段 */
export type AxisCenterCalibPhase = 'idle' | 'prepare' | 'safety-confirmed' | 'move-to-start' | 'sampling' | 'returning' | 'finished' | 'failed'
/** 单个采样点在列表中的 UI/业务状态 */
export type AxisCenterCalibSampleState = 'pending' | 'current' | 'done' | 'failed'
/** 单次角度采样：目标角与记录到的机床坐标 */
export type AxisCenterCalibSample = {
  id: number
  angle: number
  state: AxisCenterCalibSampleState
  machinePositions: Partial<Record<MotionAxis, number>>
}

/** 轴号 0–4 与轴名 X/Y/Z/U/R 的对应表（与控制器轴号约定一致） */
export const axisNameByNo: MotionAxis[] = ['X', 'Y', 'Z', 'U', 'R']
/** 在采样记录与校验中参与展示/判断的轴名列表 */
export const axisCenterCalibDisplayAxes: MotionAxis[] = ['X', 'Y', 'Z', 'U', 'R']
/** Z 轴号（与控制器约定一致） */
const Z_AXIS_NO = 2
/** 已在目标绝对位置时不再下发 Z 运动的容差（mm） */
const AXIS_CENTER_CALIB_Z_ABS_EPS_MM = 1e-3

/**
 * 五轴中心校准：按旋转轴多角度停点，人工打点/对图后记录 XYZRU，最后汇总中心相关量并写入辅助功能面板 store。
 */
export function useAxisCenterCalib() {
  /** 全局错误/成功提示 */
  const { error, success } = useNotification()
  /** 硬件上报的各轴机械坐标（mposition） */
  const { mposition } = useHardwareState()
  /** 控制器参数（轴单位、轴列表等） */
  const controllerStore = useControllerSettingsStore()
  /** 辅助功能面板持久化（如基于中心的 XY 累计） */
  const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()

  /** 已保存的 R 轴旋转中心点（后端） */
  const savedRAxisPosition = ref<RAxisPositionPayload | null>(null)
  /** 正在保存 R 轴旋转中心点 */
  const isSavingRAxisPosition = ref(false)

  /** 从后端加载上一次保存的中心校准偏移量。组件 onMounted 时调用。 */
  const loadAxisCenterCalibOffset = () => {
    auxiliaryFunctionPanelStore.loadAxisCenterCalibCenterBasedXYSum()
  }

  const axisCenterCalibEditX = ref(0)
  const axisCenterCalibEditY = ref(0)
  const axisCenterCalibEditZ = ref(0)
  const isApplyingAxisCenterCalibCenter = ref(false)

  watch(
    () => auxiliaryFunctionPanelStore.axisCenterCalibCenterBasedXYSum,
    (saved) => {
      if (!saved) return
      axisCenterCalibEditX.value = Number(saved.X)
      axisCenterCalibEditY.value = Number(saved.Y)
      axisCenterCalibEditZ.value = Number(saved.Z)
    },
    { immediate: true, deep: true },
  )

  async function applyAxisCenterCalibCenter(): Promise<void> {
    if (isAxisCenterCalib.value || isApplyingAxisCenterCalibCenter.value) return
    const X = Number(axisCenterCalibEditX.value)
    const Y = Number(axisCenterCalibEditY.value)
    const Z = Number(axisCenterCalibEditZ.value)
    if (![X, Y, Z].every(Number.isFinite)) {
      error('X/Y/Z 必须是有效数字')
      return
    }
    isApplyingAxisCenterCalibCenter.value = true
    try {
      await auxiliaryFunctionPanelStore.saveAxisCenterCalibCenterBasedXYSum({ X, Y, Z })
      logAxisCenterCalib(`已手动覆盖 U 轴旋转中心 X=${X.toFixed(3)} Y=${Y.toFixed(3)} Z=${Z.toFixed(3)}`)
      success('已覆盖 U 轴旋转中心', `${X.toFixed(3)}, ${Y.toFixed(3)}, ${Z.toFixed(3)}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : '覆盖 U 轴旋转中心失败'
      error('覆盖失败', message)
    } finally {
      isApplyingAxisCenterCalibCenter.value = false
    }
  }

  /** 是否正在执行自动校准流程（防重复点击） */
  const isAxisCenterCalib = ref(false)
  /** 当前流程阶段 */
  const axisCenterCalibPhase = ref<AxisCenterCalibPhase>('idle')
  /** 流程失败时的错误文案 */
  const axisCenterCalibErrorMessage = ref('')
  /** 用于旋转采样的轴号：3=U，4=R */
  const axisCenterCalibRotationAxisNo = ref<3 | 4>(3)
  /** 第一个采样点对应的目标起始角（度） */
  const axisCenterCalibStartAngle = ref(-90)
  /** 相邻采样点之间的角度步长（度） */
  const axisCenterCalibAngleStep = ref(90)
  /** 采样点数量（会被规范为奇数且 ≥3） */
  const axisCenterCalibSampleCount = ref(3)
  /** 采样速度（0.1-1） */
  const axisCenterCalibSpeed = ref(1)
  /** 「标记并继续」后 Z 轴绝对目标位置（mm） */
  const axisCenterCalibZLiftAbsMm = ref(-5)
  /** Z 轴抬升到绝对位置时的速度 */
  const axisCenterCalibZLiftSpeed = ref(50)
  /** 每次运动到位后的稳定等待时间（毫秒） */
  const axisCenterCalibSettleMs = ref(1000)
  /** 自动出光时激光 IO 保持时间（毫秒） */
  const axisCenterCalibLaserPulseMs = ref(200)
  /** 是否在每点到位后自动触发校准用激光脉冲 */
  const axisCenterCalibAutoPulse = ref(false)
  /** 采样结束后是否回到 0° */
  const axisCenterCalibReturnToStart = ref(true)
  /** 用户是否已勾选安全确认（未确认不允许开始） */
  const axisCenterCalibSafetyConfirmed = ref(false)
  /** 各角度采样点数据列表 */
  const axisCenterCalibSamples = ref<AxisCenterCalibSample[]>([])
  /** 流程日志（时间戳 + 文案），新日志插在头部 */
  const axisCenterCalibLogs = ref<string[]>([])
  /** 当前正在等待用户「记录位置」的采样点 id；null 表示未在等待 */
  const axisCenterCalibPendingRecordSampleId = ref<number | null>(null)
  /** 与「记录位置」配套的 Promise resolve，记录完成后调用以继续流程 */
  let axisCenterCalibRecordResolver: ((snapshot: Partial<Record<MotionAxis, number>>) => void) | null = null

  /**
   * 将用户输入的采样点数规范为奇数且不少于 3（中心点算法需要）。
   */
  function normalizeAxisCenterCalibSampleCount(value: number): number {
    const rounded = Math.floor(Number(value))
    if (!Number.isFinite(rounded)) return 3
    const atLeastThree = Math.max(3, rounded)
    return atLeastThree % 2 === 0 ? atLeastThree + 1 : atLeastThree
  }

  /** 当前选中的旋转轴在界面上的名称（X/Y/Z/U/R） */
  const axisCenterCalibRotationAxisLabel = computed(() => axisNameByNo[axisCenterCalibRotationAxisNo.value] ?? `Axis ${axisCenterCalibRotationAxisNo.value}`)

  /** 当前阶段对应的中文说明（用于步骤条或状态展示） */
  const axisCenterCalibPhaseLabel = computed(() => {
    switch (axisCenterCalibPhase.value) {
      case 'prepare':
        return '准备中'
      case 'safety-confirmed':
        return '安全确认'
      case 'move-to-start':
        return '移动至起始角'
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

  /** 步骤条展示的固定步骤定义（id 与 AxisCenterCalibPhase 中部分阶段对应） */
  const axisCenterCalibStepItems = [
    { id: 'prepare', label: '准备' },
    { id: 'safety-confirmed', label: '安全确认' },
    { id: 'move-to-start', label: '开始采样' },
    { id: 'sampling', label: '正在采样' },
    { id: 'finished', label: '完成结果' },
  ]

  /** 当前高亮的步骤条下标（含 sampling/returning 映射到「采样」步） */
  const axisCenterCalibActiveStepIndex = computed(() => {
    if (axisCenterCalibPhase.value === 'idle' || axisCenterCalibPhase.value === 'prepare') 
      return  axisCenterCalibSafetyConfirmed.value ? 1 :0
    switch (axisCenterCalibPhase.value) {
      case 'move-to-start':
        return 2
      case 'sampling':
      case 'returning':
        return 3
      case 'finished':
        return 4
      case 'failed':
        return 3
      default:
        return -1
    }
  })

  /** 各轴当前机械坐标格式化为 3 位小数字符串，无效时显示 '-' */
  const axisCenterCalibLivePositions = computed(() =>
    axisNameByNo.map((name) => {
      const mpos = Number(mposition.value[name] ?? NaN)
      return {
        name,
        value: Number.isFinite(mpos) ? mpos.toFixed(3) : '-',
      }
    })
  )

  /** 根据 mposition 与轴脉冲/单位换算，显示旋转轴当前角度（度） */
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

  /** 步骤条上第 index 步的完成/当前/未开始状态 */
  function getAxisCenterCalibStepState(index: number): 'done' | 'current' | 'pending' {
    const active = axisCenterCalibActiveStepIndex.value
    if (active < 0) return 'pending'
    if (index < active) return 'done'
    if (index === active) return 'current'
    return 'pending'
  }

  /** 采样卡片根据 state 返回 Tailwind 边框/背景类名 */
  function getAxisCenterCalibSampleClass(state: AxisCenterCalibSampleState): string {
    if (state === 'done') return 'border-emerald-500/40 bg-emerald-500/10'
    if (state === 'current') return 'border-yellow-400/60 bg-yellow-400/10'
    if (state === 'failed') return 'border-red-500/50 bg-red-500/10'
    return 'border-(--app-border) bg-(--app-input-bg)'
  }

  /** 读取指定轴号当前机械坐标；无效返回 null */
  function getAxisPosition(axisNo: number): number | null {
    const name = axisNameByNo[axisNo]
    const mpos = Number(mposition.value[name] ?? NaN)
    return Number.isFinite(mpos) ? mpos : null
  }

  /** 从后端加载已保存的 R 轴旋转中心点。 */
  async function loadRAxisPosition(): Promise<void> {
    const res = await getRAxisPosition()
    if (!res.success || !res.data) {
      error(res.message || '读取 R 轴旋转中心点失败')
      return
    }
    savedRAxisPosition.value = {
      X: Number(res.data.X),
      Y: Number(res.data.Y),
      Z: Number(res.data.Z),
    }
  }

  /** 将当前 XYZ 机械坐标保存为 R 轴旋转中心点。 */
  async function handleSaveRAxisPosition(): Promise<void> {
    if (isSavingRAxisPosition.value || isAxisCenterCalib.value) return

    const X = getAxisPosition(0)
    const Y = getAxisPosition(1)
    const Z = getAxisPosition(2)
    if (X === null || Y === null || Z === null) {
      error('当前 XYZ 位置不可用，保存失败')
      return
    }

    isSavingRAxisPosition.value = true
    try {
      const payload: RAxisPositionPayload = {
        X: Number(X.toFixed(3)),
        Y: Number(Y.toFixed(3)),
        Z: Number(Z.toFixed(3)),
      }
      const res = await syncRAxisPosition(payload)
      if (!res.success || !res.data) {
        error(res.message || '保存 R 轴旋转中心点失败')
        return
      }
      savedRAxisPosition.value = {
        X: Number(res.data.X),
        Y: Number(res.data.Y),
        Z: Number(res.data.Z),
      }
      success('已保存当前 XYZ 为 R 轴旋转中心点')
    } finally {
      isSavingRAxisPosition.value = false
    }
  }

  function displaySavedRAxisAxis(axisName: 'X' | 'Y' | 'Z'): string {
    const value = savedRAxisPosition.value?.[axisName]
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '-'
  }

  /** 抓取当前时刻各轴坐标快照（保留三位小数），用于写入采样点 */
  function captureAxisSnapshot(): Partial<Record<MotionAxis, number>> {
    const snapshot: Partial<Record<MotionAxis, number>> = {}
    axisNameByNo.forEach((axisName, axisNo) => {
      const value = getAxisPosition(axisNo)
      if (typeof value === 'number') snapshot[axisName] = Number(value.toFixed(3))
    })
    return snapshot
  }

  /** 格式化某采样点上某一轴的机床坐标展示字符串 */
  function displaySampleAxisPosition(sample: AxisCenterCalibSample, axisName: MotionAxis): string {
    const value = sample.machinePositions[axisName]
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '-'
  }

  /** 判断该采样是否已记录至少一个展示轴上的机床坐标 */
  function hasSampleMachinePositions(sample: AxisCenterCalibSample): boolean {
    return axisCenterCalibDisplayAxes.some((axisName) => typeof sample.machinePositions[axisName] === 'number')
  }

  /**
   * 进入「等待用户点击记录」状态，返回的 Promise 在记录完成后 resolve 为坐标快照。
   */
  function waitForAxisCenterCalibManualRecord(sampleId: number): Promise<Partial<Record<MotionAxis, number>>> {
    axisCenterCalibPendingRecordSampleId.value = sampleId
    return new Promise((resolve) => {
      axisCenterCalibRecordResolver = resolve
    })
  }

  /** 取消等待手动记录（清理 pending 与 resolver） */
  function clearAxisCenterCalibManualRecordWait(): void {
    axisCenterCalibPendingRecordSampleId.value = null
    axisCenterCalibRecordResolver = null
  }

  /**
   * 用户点击「记录」某采样点：校验顺序、写入 machinePositions，并在流程中时 resolve 等待中的 Promise。
   */
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

  /** 按当前起始角、步长、点数重建采样点列表（各点 state 重置为 pending） */
  function rebuildAxisCenterCalibSamples(): void {
    const count = normalizeAxisCenterCalibSampleCount(axisCenterCalibSampleCount.value)
    axisCenterCalibSampleCount.value = count
    axisCenterCalibSamples.value = Array.from({ length: count }, (_, index) => ({
      id: index,
      angle: Number((axisCenterCalibStartAngle.value + index * axisCenterCalibAngleStep.value).toFixed(3)),
      state: 'pending' as AxisCenterCalibSampleState,
      machinePositions: {},
    }))
  }

  watch([axisCenterCalibStartAngle, axisCenterCalibAngleStep, axisCenterCalibSampleCount], rebuildAxisCenterCalibSamples, { immediate: true })

  /** prepend 一条带时间戳的流程日志 */
  function logAxisCenterCalib(message: string): void {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    axisCenterCalibLogs.value.unshift(`[${timestamp}] ${message}`)
  }

  /** 空闲时重置阶段、错误、日志与采样结构 */
  function resetAxisCenterCalibWorkflow(): void {
    axisCenterCalibPhase.value = 'idle'
    axisCenterCalibErrorMessage.value = ''
    axisCenterCalibLogs.value = []
    clearAxisCenterCalibManualRecordWait()
    rebuildAxisCenterCalibSamples()
  }

  /** 打开激光 IO 一段时间后再关闭，用于校准打点出光 */
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

  /**
   * 按相对角度增量旋转：U 轴用角度 API，R 轴用圈数 API，其余轴走相对定位。
   * @param deltaAngle 相对当前位姿的角度增量（度），可正可负
   */
  async function moveAxisByRelativeAngle(axisNo: number, deltaAngle: number): Promise<void> {
    const axisSpeed = axisCenterCalibSpeed.value
    const speed = Number.isFinite(axisSpeed) && axisSpeed > 0 ? axisSpeed : 20
    if (!Number.isFinite(deltaAngle) || Math.abs(deltaAngle) <= 1e-9) return

    const rotateDirection = deltaAngle >= 0 ? '顺时针' : '逆时针'
    const absAngle = Math.abs(deltaAngle)
    let result
    if (axisNo === 3) {
      result = await rotateUAxisByAngle({
        旋转角度: absAngle,
        旋转速度: speed,
        旋转方向: rotateDirection,
        运动模式: 'relative',
      })
    } else if (axisNo === 4) {
      result = await rotateRAxisByTurns({
        旋转圈数: absAngle / 360,
        旋转速度: speed,
        旋转方向: rotateDirection,
        运动模式: 'relative',
      })
    } else {
      result = await moveMotionAxisRel(axisNo, deltaAngle, { controllerSettings: controllerStore.controllerSettings })
    }
    if (!result?.success) throw new Error(result?.message || `${axisNameByNo[axisNo] ?? `Axis ${axisNo}`} 移动失败`)
  }

  /** 「标记并继续」后：Z 轴绝对定位并等待静止，避免后续旋转碰撞。已在目标则跳过。 */
  async function liftZAfterMark(): Promise<void> {
    const targetZ = axisCenterCalibZLiftAbsMm.value
    if (!Number.isFinite(targetZ)) {
      throw new Error('Z 抬升绝对位置无效')
    }
    const axisSpeed = axisCenterCalibZLiftSpeed.value
    const speed = Number.isFinite(axisSpeed) && axisSpeed > 0 ? axisSpeed : 20
    const currentZ = getAxisPosition(Z_AXIS_NO)
    if (currentZ !== null && Math.abs(currentZ - targetZ) <= AXIS_CENTER_CALIB_Z_ABS_EPS_MM) {
      return
    }
    const result = await moveMotionAxisAbs(Z_AXIS_NO, targetZ, {
      speed,
      controllerSettings: controllerStore.controllerSettings,
    })
    if (!result?.success) {
      throw new Error(result?.message || `Z 轴移动到绝对位置 ${targetZ} mm 失败`)
    }
    const idleRes = await waitMotionIdle('Z')
    if (!idleRes.success || idleRes.data === false) {
      throw new Error(idleRes.message || 'Z 轴抬升后等待静止超时')
    }
  }

  /** 读取校准旋转轴当前角度（度）；读不到时回退 0。 */
  function readCurrentCalibrationAngleDegrees(axisNo: number): number {
    const name = axisNameByNo[axisNo]
    const axis = controllerStore.controllerSettings.axes.find((item) => item.axis_no === axisNo)
    const mpos = Number(mposition.value[name] ?? NaN)
    const units = Number(axis?.units)
    if (!Number.isFinite(mpos) || !Number.isFinite(units) || units <= 0) return 0

    const pulsesPerRev =
      Number(axis?.pulses_per_rev) > 0
        ? Number(axis?.pulses_per_rev) *
          (Number(axis?.electronic_gear_ratio) > 0 ? Number(axis?.electronic_gear_ratio) : 1) *
          (Number(axis?.gear_ratio) > 0 ? Number(axis?.gear_ratio) : 1)
        : axisNo === 3
          ? 10000
          : 6400
    return (mpos * units / pulsesPerRev) * 360
  }

  /** 与 store 同步的「基于中心」的 X/Y 累计结果（供面板只读展示） */
  const axisCenterCalibCenterBasedXYSum = auxiliaryFunctionPanelStore.axisCenterCalibCenterBasedXYSum

  /**
   * 一键执行完整采样流程：校验参数 → 逐点运动 → 可选激光 → 等待手动记录 → 算中心量并写入 store。
   */
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
    if (!Number.isFinite(axisCenterCalibZLiftAbsMm.value)) {
      error('Z 抬升绝对位置无效')
      return
    }
    if (!Number.isFinite(axisCenterCalibZLiftSpeed.value) || axisCenterCalibZLiftSpeed.value <= 0) {
      error('Z 抬升速度必须大于 0')
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

      axisCenterCalibPhase.value = 'sampling'
      const rotationAxisNo = axisCenterCalibRotationAxisNo.value
      let previousAngle = readCurrentCalibrationAngleDegrees(rotationAxisNo)
      for (let index = 0; index < axisCenterCalibSamples.value.length; index++) {
        const sample = axisCenterCalibSamples.value[index]
        axisCenterCalibSamples.value[index] = {
          ...sample,
          state: 'current',
          machinePositions: {},
        }

        // 第 1 点：先转到采样角；后续点在上一轮「抬 Z 后再旋转」中已到位
        if (index === 0) {
          const deltaAngle = sample.angle - previousAngle
          logAxisCenterCalib(
            `第 1 点相对旋转 ${deltaAngle.toFixed(3)}° → 目标 ${sample.angle.toFixed(3)}°`
          )
          await moveAxisByRelativeAngle(rotationAxisNo, deltaAngle)
          previousAngle = sample.angle
          await sleep(axisCenterCalibSettleMs.value)
        }

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

        // 标记并继续：先把 Z 移到绝对安全高度并静止，再旋转到下一点 / 回起始角
        logAxisCenterCalib(
          `第 ${index + 1} 点标记完成，先 Z 轴绝对移动到 ${axisCenterCalibZLiftAbsMm.value} mm`
        )
        await liftZAfterMark()
        await sleep(axisCenterCalibSettleMs.value)

        const nextSample = axisCenterCalibSamples.value[index + 1]
        if (nextSample) {
          const deltaToNext = nextSample.angle - previousAngle
          logAxisCenterCalib(
            `Z 抬升完成，再相对旋转 ${deltaToNext.toFixed(3)}° → 第 ${index + 2} 点 ${nextSample.angle.toFixed(3)}°`
          )
          await moveAxisByRelativeAngle(rotationAxisNo, deltaToNext)
          previousAngle = nextSample.angle
          await sleep(axisCenterCalibSettleMs.value)
        } else if (axisCenterCalibReturnToStart.value) {
          axisCenterCalibPhase.value = 'returning'
          const returnDelta = 0 - previousAngle
          logAxisCenterCalib(`Z 抬升完成，再相对返回起始角 0°（增量 ${returnDelta.toFixed(3)}°）`)
          await moveAxisByRelativeAngle(rotationAxisNo, returnDelta)
          previousAngle = 0
          await sleep(axisCenterCalibSettleMs.value)
        }
      }


      const samples = axisCenterCalibSamples.value
      const middleIndex = Math.floor(samples.length / 2)
      // const middleSample = samples[middleIndex]
      // const middleX = middleSample.machinePositions.X as number
      // const middleY = middleSample.machinePositions.Y as number
      // const middleZ = middleSample.machinePositions.Z as number
      const beforeMiddleSamples = samples.slice(0, middleIndex)
      const afterMiddleSamples = samples.slice(middleIndex + 1)

      const beforeMiddleXSum = beforeMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.X as number), 0)
      const beforeMiddleYSum = beforeMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.Y as number), 0)

      const afterMiddleXSum = afterMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.X as number), 0)
      const afterMiddleYSum = afterMiddleSamples.reduce((sum, sample) => sum + (sample.machinePositions.Y as number), 0)

      const axisCenterCalibX = ((beforeMiddleXSum + afterMiddleXSum) / 2)
      const axisCenterCalibY = ((beforeMiddleYSum + afterMiddleYSum) / 2)
      const axisCenterCalibZ = samples[samples.length - 1].machinePositions.Z as number

      const centerRotationResult:XYZ = {
        X: Number(axisCenterCalibX.toFixed(3)),
        Y: Number(axisCenterCalibY.toFixed(3)),
        Z: Number(axisCenterCalibZ.toFixed(3)),
      }
      await auxiliaryFunctionPanelStore.saveAxisCenterCalibCenterBasedXYSum(centerRotationResult)

      axisCenterCalibPhase.value = 'finished'
      logAxisCenterCalib('采样完成，U 轴旋转中心已写入')
      success('五轴中心校准采样完成', '可在下方查看或修改旋转中心后点应用')
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
    axisCenterCalibSpeed,
    axisCenterCalibZLiftAbsMm,
    axisCenterCalibZLiftSpeed,
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
    axisCenterCalibEditX,
    axisCenterCalibEditY,
    axisCenterCalibEditZ,
    isApplyingAxisCenterCalibCenter,
    applyAxisCenterCalibCenter,
    loadAxisCenterCalibOffset,
    savedRAxisPosition,
    isSavingRAxisPosition,
    loadRAxisPosition,
    handleSaveRAxisPosition,
    displaySavedRAxisAxis,
  }
}
