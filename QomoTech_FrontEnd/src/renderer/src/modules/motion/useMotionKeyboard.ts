import { ref } from 'vue'
import { subscribeGlobalKeyboard } from '@/shared/composables/useGlobalKeyboard'
import { useNotification } from '@/shared/composables/useNotification'
import { useControllerSettingsStore } from '@/modules/motion/useMotionStore'
import { useAuxiliaryFunctionPanelStore } from '@/modules/motion/auxiliaryStore'
import {
  moveMotionAxisRel,
  moveMotionAxisAbs,
  rotateUAxisByAngle,
  rotateRAxisByTurns,
  zeroMotionAxis,
  setMotionIoOutput
} from '@/modules/motion'

const U_AXIS_NO = 3
const R_AXIS_NO = 4

export function useMotionKeyboard() {
  const { error, success } = useNotification()
  const controllerSettingsStore = useControllerSettingsStore()
  const auxiliaryFunctionPanelStore = useAuxiliaryFunctionPanelStore()

  const Qkey = ref(false)
  const Wkey = ref(false)
  const Ekey = ref(false)
  const Rkey = ref(false)
  const moveStep = ref(1)

  function getAxisSpeed(axisNo: number): number {
    const value = Number(controllerSettingsStore.controllerSettings.axes[axisNo]?.speed)
    return Number.isFinite(value) && value > 0 ? value : 20
  }

  const handler = (e: KeyboardEvent): void => {
    const keyword = e.key.toUpperCase()
    const onlyctrlKey = e.ctrlKey && !e.shiftKey && !e.altKey
    const nokey = !e.ctrlKey && !e.shiftKey && !e.altKey
    const altKey = e.altKey && !e.ctrlKey && !e.shiftKey

    // Alt + arrows: motion with controller settings override
    if (keyword === 'ARROWUP' && altKey) {
      e.preventDefault()
      void moveMotionAxisRel(1, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
    }
    if (keyword === 'ARROWDOWN' && altKey) {
      e.preventDefault()
      void moveMotionAxisRel(1, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
    }
    if (keyword === 'ARROWLEFT' && altKey) {
      e.preventDefault()
      void moveMotionAxisRel(0, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
    }
    if (keyword === 'ARROWRIGHT' && altKey) {
      e.preventDefault()
      void moveMotionAxisRel(0, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
    }
    if (keyword === 'PAGEUP' && altKey) {
      e.preventDefault()
      void moveMotionAxisRel(2, moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
    }
    if (keyword === 'PAGEDOWN' && altKey) {
      e.preventDefault()
      void moveMotionAxisRel(2, -moveStep.value, { controllerSettings: controllerSettingsStore.controllerSettings })
    }

    if (e.repeat) return

    // H: quick move to saved position
    if (keyword === 'H' && nokey) {
      e.preventDefault()
      void (async () => {
        try {
          const pos = auxiliaryFunctionPanelStore.loadAuxiliaryFunctionPanelQuickMoveToPosition()
          if (!pos) { error('未找到设定点'); return }
          if (pos.X === 0 && pos.Y === 0 && pos.Z === 0) { error('请设定位置点快捷移动到指定位置'); return }
          const [zx, zy, zz, zu, zr] = await Promise.all([
            moveMotionAxisAbs(0, pos.X),
            moveMotionAxisAbs(1, pos.Y),
            moveMotionAxisAbs(2, pos.Z),
            rotateUAxisByAngle({ 旋转角度: 0, 旋转速度: 0.1, 旋转方向: '顺时针', 运动模式: 'absolute' }),
            zeroMotionAxis(4)
          ])
          if (!zx?.success || !zy?.success || !zz?.success || !zu?.success || !zr?.success) {
            error('回到设定点失败'); return
          }
          success('已回到设定点')
        } catch { error('回到设定点失败') }
      })()
      return
    }

    // Speed presets
    if (keyword === 'F1' && nokey) { e.preventDefault(); moveStep.value = 0.01; success('速度设置为0.01mm/s') }
    if (keyword === 'F2' && nokey) { e.preventDefault(); moveStep.value = 0.1; success('速度设置为0.1mm/s') }
    if (keyword === 'F3' && nokey) { e.preventDefault(); moveStep.value = 1; success('速度设置为1mm/s') }
    if (keyword === 'F4' && nokey) { e.preventDefault(); moveStep.value = 5; success('速度设置为5mm/s') }

    // Arrow keys (no modifier): jog motion
    if (keyword === 'ARROWUP' && nokey) { e.preventDefault(); void moveMotionAxisRel(1, -moveStep.value) }
    if (keyword === 'ARROWDOWN' && nokey) { e.preventDefault(); void moveMotionAxisRel(1, moveStep.value) }
    if (keyword === 'ARROWLEFT' && nokey) { e.preventDefault(); void moveMotionAxisRel(0, moveStep.value) }
    if (keyword === 'ARROWRIGHT' && nokey) { e.preventDefault(); void moveMotionAxisRel(0, -moveStep.value) }
    if (keyword === 'PAGEUP' && nokey) { e.preventDefault(); void moveMotionAxisRel(2, moveStep.value) }
    if (keyword === 'PAGEDOWN' && nokey) { e.preventDefault(); void moveMotionAxisRel(2, -moveStep.value) }

    // Ctrl + arrows: rotate U/R axes
    if (keyword === 'ARROWUP' && onlyctrlKey) { e.preventDefault(); void rotateUAxisByAngle({ 旋转角度: Math.abs(moveStep.value * 18), 旋转速度: getAxisSpeed(U_AXIS_NO), 旋转方向: '顺时针', 运动模式: 'relative' }) }
    if (keyword === 'ARROWDOWN' && onlyctrlKey) { e.preventDefault(); void rotateUAxisByAngle({ 旋转角度: Math.abs(moveStep.value * 18), 旋转速度: getAxisSpeed(U_AXIS_NO), 旋转方向: '逆时针', 运动模式: 'relative' }) }
    if (keyword === 'ARROWLEFT' && onlyctrlKey) { e.preventDefault(); void rotateRAxisByTurns({ 旋转圈数: Math.abs(moveStep.value), 旋转速度: getAxisSpeed(R_AXIS_NO), 旋转方向: '逆时针', 运动模式: 'relative' }) }
    if (keyword === 'ARROWRIGHT' && onlyctrlKey) { e.preventDefault(); void rotateRAxisByTurns({ 旋转圈数: Math.abs(moveStep.value), 旋转速度: getAxisSpeed(R_AXIS_NO), 旋转方向: '顺时针', 运动模式: 'relative' }) }

    // IO toggles
    if (keyword === 'Q' && nokey) { e.preventDefault(); void setMotionIoOutput(0, !Qkey.value); Qkey.value = !Qkey.value; success('吹气状态设置为' + Qkey.value) }
    if (keyword === 'W' && nokey) { e.preventDefault(); void setMotionIoOutput(1, !Wkey.value); Wkey.value = !Wkey.value; success('灯光状态设置为' + Wkey.value) }
    if (keyword === 'E' && onlyctrlKey) { e.preventDefault(); void setMotionIoOutput(2, !Ekey.value); Ekey.value = !Ekey.value; success('激光状态设置为', Ekey.value ? '开启' : '关闭') }
    if (keyword === 'R' && nokey) {
      e.preventDefault()
      void (async () => {
        await setMotionIoOutput(2, !Rkey.value); Rkey.value = true
        await new Promise(resolve => setTimeout(resolve, 500))
        await setMotionIoOutput(2, !Rkey.value); Rkey.value = false
      })()
      success('点射激光', Rkey.value ? '开启' : '关闭')
    }
  }

  const unsubscribe = subscribeGlobalKeyboard(handler)

  return { Qkey, Wkey, Ekey, Rkey, moveStep, unsubscribe }
}
