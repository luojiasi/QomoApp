import { ref, watch, type Ref } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useHardwareState } from '@/shared/api/hardware'
import type { ApiCallResult } from '@/shared/api/httpClient'
import { useControllerSettingsStore } from '../stores/useControllerSettingsStore'
import { U_AXIS_NO, R_AXIS_NO, getAxisSpeed } from '../config'
import {
  moveMotionAxisAbs,
  moveMotionAxisRel,
  rotateRAxisByTurns,
  rotateUAxisByAngle,
  isUAxisAtTargetAngle,
  zeroMotionAxis
} from '../api'
import { roundMax, sleep } from '../utils'

const ROTATION_SETTLE_POLL_MS = 100
const ROTATION_SETTLE_TIMEOUT_MS = 120_000
const ROTATION_FAST_SETTLE_MS = 400
const ROTATION_FAST_SETTLE_IDLE_POLLS = 3

function linearPlaceholder(mode: 'rel' | 'abs'): string { return mode === 'rel' ? '相对位移(mm)' : '绝对位置(mm)' }
function rotationPlaceholder(): string { return '旋转角度(°)/圈数，正=顺时针' }
function linearLabel(mode: 'rel' | 'abs'): string { return mode === 'rel' ? '相对运动' : '绝对运动' }
function rotationLabel(): string { return '旋转轴' }

function readRotationResultData(
  res: ApiCallResult<Record<string, unknown>> | undefined
): Record<string, unknown> | undefined {
  const outer = res?.data
  if (!outer || typeof outer !== 'object') return undefined
  const inner = (outer as Record<string, unknown>).data
  if (inner && typeof inner === 'object') return inner as Record<string, unknown>
  return outer as Record<string, unknown>
}

function readRotationDelta(resultData: Record<string, unknown> | undefined): number {
  const delta = Number(resultData?.delta)
  return Number.isFinite(delta) ? delta : NaN
}

/** 手动点动：轴相对/绝对运动、旋转轴运动、归零。监听轴数量变化动态调整 UI 状态。 */
export function useAxisJog(axisCount: Ref<number>) {
  const controllerStore = useControllerSettingsStore()
  const { success, error } = useNotification()
  const { axes } = useHardwareState()

  const axisIndices = ref<number[]>([])
  const axisRelativeInputs = ref<number[]>([])
  const axisAbsoluteInputs = ref<number[]>([])
  const axisMotionPending = ref<Record<number, boolean>>({})
  const zeroingAxis = ref<Record<number, boolean>>({})
  const axisMotionInFlight = ref<Set<number>>(new Set())

  watch(() => axisCount.value, (count) => {
    const indices = Array.from({ length: count }, (_, i) => i)
    axisIndices.value = indices
    const prevRel = axisRelativeInputs.value
    const prevAbs = axisAbsoluteInputs.value
    axisRelativeInputs.value = indices.map((axisNo) => {
      const v = Number(prevRel[axisNo])
      return Number.isFinite(v) ? v : 1
    })
    axisAbsoluteInputs.value = indices.map((axisNo) => {
      const v = Number(prevAbs[axisNo])
      return Number.isFinite(v) ? v : 0
    })
  }, { immediate: true })

  function normalizeManualInput(type: 'rel' | 'abs', axisNo: number): void {
    const target = type === 'rel' ? axisRelativeInputs.value : axisAbsoluteInputs.value
    const v = Number(target[axisNo])
    if (!Number.isFinite(v)) return
    target[axisNo] = roundMax(v)
  }

  function isBusy(axisNo: number): boolean {
    return Boolean(axisMotionPending.value[axisNo]) || axisMotionInFlight.value.has(axisNo)
  }

  function acquireMotion(axisNo: number): boolean {
    if (axisMotionInFlight.value.has(axisNo)) return false
    axisMotionInFlight.value = new Set([...axisMotionInFlight.value, axisNo])
    axisMotionPending.value = { ...axisMotionPending.value, [axisNo]: true }
    return true
  }

  function releaseMotion(axisNo: number): void {
    const next = new Set(axisMotionInFlight.value)
    next.delete(axisNo)
    axisMotionInFlight.value = next
    axisMotionPending.value = { ...axisMotionPending.value, [axisNo]: false }
  }

  function isRotation(axisNo: number): boolean {
    return axisCount.value === 5 && (axisNo === U_AXIS_NO || axisNo === R_AXIS_NO)
  }

  function placeholder(axisNo: number, mode: 'rel' | 'abs'): string {
    return isRotation(axisNo) ? rotationPlaceholder() : linearPlaceholder(mode)
  }

  function label(axisNo: number, mode: 'rel' | 'abs'): string {
    return isRotation(axisNo) ? rotationLabel() : linearLabel(mode)
  }

  function axisSpeed(axisNo: number): number {
    return getAxisSpeed(controllerStore.controllerSettings.axes, axisNo)
  }

  function isRotationAxisIdle(axisNo: number): boolean {
    const snap = axes.value.find((axis) => axis.axis_no === axisNo)
    return snap?.idle === true
  }

  async function waitForRotationAxisIdle(axisNo: number): Promise<boolean> {
    const startAt = Date.now()
    let seenMoving = false
    let idleStreak = 0

    while (Date.now() - startAt < ROTATION_SETTLE_TIMEOUT_MS) {
      const idle = isRotationAxisIdle(axisNo)
      if (!idle) {
        seenMoving = true
        idleStreak = 0
      } else {
        idleStreak += 1
        if (seenMoving) return true
        if (
          Date.now() - startAt >= ROTATION_FAST_SETTLE_MS &&
          idleStreak >= ROTATION_FAST_SETTLE_IDLE_POLLS
        ) {
          return true
        }
      }
      await sleep(ROTATION_SETTLE_POLL_MS)
    }
    return false
  }

  async function waitForUAxisAtAngle(targetAngle: number): Promise<boolean> {
    const startAt = Date.now()
    while (Date.now() - startAt < ROTATION_SETTLE_TIMEOUT_MS) {
      const res = await isUAxisAtTargetAngle(targetAngle)
      if (res?.success && res.data === true) return true
      await sleep(ROTATION_SETTLE_POLL_MS)
    }
    return false
  }

  async function waitForRotationSettled(
    axisNo: number,
    rotateRes: ApiCallResult<Record<string, unknown>>
  ): Promise<void> {
    const resultData = readRotationResultData(rotateRes)
    const delta = readRotationDelta(resultData)
    if (Number.isFinite(delta) && Math.abs(delta) <= 1e-9) return

    let settled = false
    if (axisNo === U_AXIS_NO) {
      const targetAngle = Number(resultData?.actual_target_angle)
      if (Number.isFinite(targetAngle)) {
        settled = await waitForUAxisAtAngle(targetAngle)
      }
    }
    if (!settled) {
      settled = await waitForRotationAxisIdle(axisNo)
    }
    if (!settled) {
      error(`轴 ${axisNo} 等待到位超时`, '已解除按钮禁用，请确认实际位置后再操作')
    }
  }

  async function handleRotateMove(
    axisNo: number,
    absValue: number,
    mode: 'relative' | 'absolute'
  ): Promise<ApiCallResult<Record<string, unknown>> | null> {
    const dir = absValue >= 0 ? '顺时针' : '逆时针'
    const angle = Math.abs(absValue)
    if (axisNo === U_AXIS_NO) {
      const res = await rotateUAxisByAngle({
        旋转角度: angle,
        旋转速度: axisSpeed(axisNo),
        旋转方向: dir,
        运动模式: mode
      })
      if (!res?.success) {
        error('U轴旋转失败', res?.message ?? '')
        return res ?? null
      }
      success('U轴旋转已下发', `${mode === 'absolute' ? '目标角度' : '角度'}: ${angle}°`)
      return res
    }
    const res = await rotateRAxisByTurns({
      旋转圈数: angle,
      旋转速度: axisSpeed(axisNo),
      旋转方向: dir,
      运动模式: mode
    })
    if (!res?.success) {
      error('R轴旋转失败', res?.message ?? '')
      return res ?? null
    }
    success('R轴旋转已下发', `${mode === 'absolute' ? '目标圈数' : '圈数'}: ${angle} 圈`)
    return res
  }

  async function handleRelativeMove(axisNo: number): Promise<void> {
    if (!acquireMotion(axisNo)) return
    const value = Number(axisRelativeInputs.value[axisNo])
    if (!Number.isFinite(value) || value === 0) {
      error('输入无效', '请输入非 0 的数值')
      releaseMotion(axisNo)
      return
    }
    try {
      if (isRotation(axisNo)) {
        const res = await handleRotateMove(axisNo, value, 'relative')
        if (res?.success) await waitForRotationSettled(axisNo, res)
        return
      }
      const res = await moveMotionAxisRel(axisNo, value, {
        controllerSettings: controllerStore.controllerSettings
      })
      if (!res?.success) {
        error(`轴 ${axisNo} 相对运动失败`, res?.message ?? '')
        return
      }
      success(`轴 ${axisNo} 相对运动已下发`, `位移: ${roundMax(value)} mm`)
    } finally {
      releaseMotion(axisNo)
    }
  }

  async function handleAbsoluteMove(axisNo: number): Promise<void> {
    if (!acquireMotion(axisNo)) return
    const value = Number(axisAbsoluteInputs.value[axisNo])
    if (!Number.isFinite(value)) {
      error('输入无效', '请输入有效数值')
      releaseMotion(axisNo)
      return
    }
    try {
      if (isRotation(axisNo)) {
        const res = await handleRotateMove(axisNo, value, 'absolute')
        if (res?.success) await waitForRotationSettled(axisNo, res)
        return
      }
      const res = await moveMotionAxisAbs(axisNo, value, {
        controllerSettings: controllerStore.controllerSettings
      })
      if (!res?.success) {
        error(`轴 ${axisNo} 绝对运动失败`, res?.message ?? '')
        return
      }
      success(`轴 ${axisNo} 绝对运动已下发`, `目标: ${roundMax(value)} mm`)
    } finally {
      releaseMotion(axisNo)
    }
  }

  async function handleZeroAxis(axisNo: number): Promise<void> {
    if (zeroingAxis.value[axisNo]) return
    zeroingAxis.value = { ...zeroingAxis.value, [axisNo]: true }
    try {
      const res = await zeroMotionAxis(axisNo)
      if (res?.success) success(`轴 ${axisNo} 归零`, '归零指令已下发')
      else error('归零失败', res?.message ?? '')
    } catch (e: any) {
      error('归零异常', e?.message ?? '')
    } finally {
      zeroingAxis.value = { ...zeroingAxis.value, [axisNo]: false }
    }
  }

  return {
    axisIndices,
    axisRelativeInputs,
    axisAbsoluteInputs,
    axisMotionPending,
    zeroingAxis,
    normalizeManualInput,
    isBusy,
    placeholder,
    label,
    handleRelativeMove,
    handleAbsoluteMove,
    handleZeroAxis
  }
}
