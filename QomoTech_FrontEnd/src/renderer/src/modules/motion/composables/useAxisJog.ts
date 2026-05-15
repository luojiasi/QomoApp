import { ref, watch, type Ref } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useControllerSettingsStore } from '../stores/useControllerSettingsStore'
import { U_AXIS_NO, R_AXIS_NO, getAxisSpeed } from '../config'
import {
  moveMotionAxisAbs,
  moveMotionAxisRel,
  rotateRAxisByTurns,
  rotateUAxisByAngle,
  zeroMotionAxis
} from '../api'
import { MAX_DECIMALS, roundMax } from '../utils'

function linearPlaceholder(mode: 'rel' | 'abs'): string { return mode === 'rel' ? '相对位移(mm)' : '绝对位置(mm)' }
function rotationPlaceholder(): string { return '旋转角度(°)/圈数，正=顺时针' }
function linearLabel(mode: 'rel' | 'abs'): string { return mode === 'rel' ? '相对运动' : '绝对运动' }
function rotationLabel(): string { return '旋转轴' }

  /** 手动点动：轴相对/绝对运动、旋转轴运动、归零。监听轴数量变化动态调整 UI 状态。 */
export function useAxisJog(axisCount: Ref<number>) {
  const controllerStore = useControllerSettingsStore()
  const { success, error } = useNotification()

  const axisIndices = ref<number[]>([])
  const axisRelativeInputs = ref<number[]>([])
  const axisAbsoluteInputs = ref<number[]>([])
  const axisMotionPending = ref<Record<number, boolean>>({})
  const zeroingAxis = ref<Record<number, boolean>>({})

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

  function isBusy(axisNo: number): boolean { return Boolean(axisMotionPending.value[axisNo]) }
  function setBusy(axisNo: number, busy: boolean): void {
    axisMotionPending.value = { ...axisMotionPending.value, [axisNo]: busy }
  }

  function isRotation(axisNo: number): boolean { return axisCount.value === 5 && (axisNo === U_AXIS_NO || axisNo === R_AXIS_NO) }

  function placeholder(axisNo: number, mode: 'rel' | 'abs'): string { return isRotation(axisNo) ? rotationPlaceholder() : linearPlaceholder(mode) }
  function label(axisNo: number, mode: 'rel' | 'abs'): string { return isRotation(axisNo) ? rotationLabel() : linearLabel(mode) }

  function axisSpeed(axisNo: number): number {
    return getAxisSpeed(controllerStore.controllerSettings.axes, axisNo)
  }

  async function handleRotateMove(axisNo: number, absValue: number, mode: 'relative' | 'absolute'): Promise<boolean> {
    const dir = absValue >= 0 ? '顺时针' : '逆时针'
    const angle = Math.abs(absValue)
    if (axisNo === U_AXIS_NO) {
      const res = await rotateUAxisByAngle({ 旋转角度: angle, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: mode })
      if (!res?.success) { error('U轴旋转失败', res?.message ?? ''); return false }
      success('U轴旋转已下发', `${mode === 'absolute' ? '目标角度' : '角度'}: ${angle}°`)
      return true
    }
    const res = await rotateRAxisByTurns({ 旋转圈数: angle, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: mode })
    if (!res?.success) { error('R轴旋转失败', res?.message ?? ''); return false }
    success('R轴旋转已下发', `${mode === 'absolute' ? '目标圈数' : '圈数'}: ${angle} 圈`)
    return true
  }

  async function handleRelativeMove(axisNo: number): Promise<void> {
    const value = Number(axisRelativeInputs.value[axisNo])
    if (!Number.isFinite(value) || value === 0) { error('输入无效', '请输入非 0 的数值'); return }
    setBusy(axisNo, true)
    try {
      if (isRotation(axisNo)) { await handleRotateMove(axisNo, value, 'relative'); return }
      const res = await moveMotionAxisRel(axisNo, value, { controllerSettings: controllerStore.controllerSettings })
      if (!res?.success) { error(`轴 ${axisNo} 相对运动失败`, res?.message ?? ''); return }
      success(`轴 ${axisNo} 相对运动已下发`, `位移: ${roundMax(value)} mm`)
    } finally { setBusy(axisNo, false) }
  }

  async function handleAbsoluteMove(axisNo: number): Promise<void> {
    const value = Number(axisAbsoluteInputs.value[axisNo])
    if (!Number.isFinite(value)) { error('输入无效', '请输入有效数值'); return }
    setBusy(axisNo, true)
    try {
      if (isRotation(axisNo)) { await handleRotateMove(axisNo, value, 'absolute'); return }
      const res = await moveMotionAxisAbs(axisNo, value, { controllerSettings: controllerStore.controllerSettings })
      if (!res?.success) { error(`轴 ${axisNo} 绝对运动失败`, res?.message ?? ''); return }
      success(`轴 ${axisNo} 绝对运动已下发`, `目标: ${roundMax(value)} mm`)
    } finally { setBusy(axisNo, false) }
  }

  async function handleZeroAxis(axisNo: number): Promise<void> {
    if (zeroingAxis.value[axisNo]) return
    zeroingAxis.value = { ...zeroingAxis.value, [axisNo]: true }
    try {
      const res = await zeroMotionAxis(axisNo)
      if (res?.success) { success(`轴 ${axisNo} 归零`, '归零指令已下发') }
      else { error('归零失败', res?.message ?? '') }
    } catch (e: any) { error('归零异常', e?.message ?? '') }
    finally { zeroingAxis.value = { ...zeroingAxis.value, [axisNo]: false } }
  }

  return {
    axisIndices, axisRelativeInputs, axisAbsoluteInputs, axisMotionPending, zeroingAxis,
    normalizeManualInput, isBusy,
    placeholder, label,
    handleRelativeMove, handleAbsoluteMove, handleZeroAxis
  }
}
