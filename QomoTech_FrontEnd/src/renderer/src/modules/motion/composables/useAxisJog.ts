import { ref, watch, type Ref } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import { useControllerSettingsStore } from '../stores/useControllerSettingsStore'
import {
  moveMotionAxisAbs,
  moveMotionAxisRel,
  rotateRAxisByTurns,
  rotateUAxisByAngle,
  zeroMotionAxis
} from '../api'

const U_AXIS_NO = 3
const R_AXIS_NO = 4
const MAX_DECIMALS = 4

function roundMax(n: number, decimals = MAX_DECIMALS): number {
  const m = 10 ** decimals
  return Math.round(n * m) / m
}

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

  function isU(axisNo: number): boolean { return axisCount.value === 5 && axisNo === U_AXIS_NO }
  function isR(axisNo: number): boolean { return axisCount.value === 5 && axisNo === R_AXIS_NO }

  function relPlaceholder(axisNo: number): string {
    if (isU(axisNo)) return '旋转角度(°)，正=顺时针'
    if (isR(axisNo)) return '旋转圈数(圈)，正=顺时针'
    return '相对位移(mm)'
  }
  function relLabel(axisNo: number): string {
    if (isU(axisNo)) return 'U轴旋转'
    if (isR(axisNo)) return 'R轴旋转'
    return '相对运动'
  }
  function absPlaceholder(axisNo: number): string {
    if (isU(axisNo)) return '旋转角度(°)，正=顺时针'
    if (isR(axisNo)) return '旋转圈数(圈)，正=顺时针'
    return '绝对位置(mm)'
  }
  function absLabel(axisNo: number): string {
    if (isU(axisNo)) return 'U轴旋转'
    if (isR(axisNo)) return 'R轴旋转'
    return '绝对运动'
  }
  function axisSpeed(axisNo: number): number {
    const v = Number(controllerStore.controllerSettings.axes[axisNo]?.speed)
    return Number.isFinite(v) && v > 0 ? v : 20
  }

  async function handleRelativeMove(axisNo: number): Promise<void> {
    const value = Number(axisRelativeInputs.value[axisNo])
    if (!Number.isFinite(value) || value === 0) { error('输入无效', '请输入非 0 的数值'); return }
    setBusy(axisNo, true)
    try {
      const dir = value >= 0 ? '顺时针' : '逆时针'
      const absV = Math.abs(value)
      if (isU(axisNo)) {
        const res = await rotateUAxisByAngle({ 旋转角度: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'relative' })
        if (!res?.success) { error('U轴旋转失败', res?.message ?? ''); return }
        success('U轴旋转已下发', `角度: ${absV}°`)
        return
      }
      if (isR(axisNo)) {
        const res = await rotateRAxisByTurns({ 旋转圈数: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'relative' })
        if (!res?.success) { error('R轴旋转失败', res?.message ?? ''); return }
        success('R轴旋转已下发', `圈数: ${absV} 圈`)
        return
      }
      const res = await moveMotionAxisRel(axisNo, value, { controllerSettings: controllerStore.controllerSettings })
      if (!res?.success) { error(`轴 ${axisNo} 相对运动失败`, res?.message ?? ''); return }
      success(`轴 ${axisNo} 相对运动已下发`, `位移: ${roundMax(value)} mm`)
    } finally { setBusy(axisNo, false) }
  }

  async function handleAbsoluteMove(axisNo: number): Promise<void> {
    const inputValue = Number(axisAbsoluteInputs.value[axisNo])
    if (!Number.isFinite(inputValue)) { error('输入无效', '请输入有效数值'); return }
    setBusy(axisNo, true)
    try {
      const dir = inputValue >= 0 ? '顺时针' : '逆时针'
      const absV = Math.abs(inputValue)
      if (isU(axisNo)) {
        const res = await rotateUAxisByAngle({ 旋转角度: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'absolute' })
        if (!res?.success) { error('U轴旋转失败', res?.message ?? ''); return }
        success('U轴旋转已下发', `角度: ${absV}°`)
        return
      }
      if (isR(axisNo)) {
        const res = await rotateRAxisByTurns({ 旋转圈数: absV, 旋转速度: axisSpeed(axisNo), 旋转方向: dir, 运动模式: 'absolute' })
        if (!res?.success) { error('R轴旋转失败', res?.message ?? ''); return }
        success('R轴旋转已下发', `圈数: ${absV} 圈`)
        return
      }
      const res = await moveMotionAxisAbs(axisNo, inputValue, { controllerSettings: controllerStore.controllerSettings })
      if (!res?.success) { error(`轴 ${axisNo} 绝对运动失败`, res?.message ?? ''); return }
      success(`轴 ${axisNo} 绝对运动已下发`, `目标: ${roundMax(inputValue)} mm`)
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
    relPlaceholder, relLabel, absPlaceholder, absLabel,
    handleRelativeMove, handleAbsoluteMove, handleZeroAxis
  }
}
