// =============================================================================
// 全局键盘快捷键 — 相对运动控制
// App.vue 注册一次，全页面生效。Control.vue 用 useKeyboardJogState 显示步长。
// =============================================================================
import { ref, computed, readonly } from 'vue'
import { useHardwareState } from './hardware'
import { moveRel } from './api'

const stepDist = ref(1)
const showStepDialog = ref(false)
const customStepInput = ref('')
const jogSpeed = ref(50) // synced from Control.vue

const stepLabel = computed(() => {
  if (stepDist.value < 1) return stepDist.value.toFixed(2)
  return stepDist.value.toString()
})

function openStepDialog() {
  customStepInput.value = ''
  showStepDialog.value = true
}

function applyCustomStep() {
  const v = parseFloat(customStepInput.value)
  if (!isNaN(v) && v > 0) stepDist.value = v
  showStepDialog.value = false
}

async function kbdMove(axis: string, dir: number) {
  const { controllerConnected } = useHardwareState()
  if (!controllerConnected.value) return
  const dist = stepDist.value * dir
  await moveRel(axis, dist, jogSpeed.value)
}

let _registered = false

export function startKeyboardJog() {
  if (_registered) return
  _registered = true

  function handler(e: KeyboardEvent) {
    const { controllerConnected } = useHardwareState()
    if (!controllerConnected.value) return
    if (showStepDialog.value) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

    const ctrl = e.ctrlKey || e.metaKey
    let handled = true

    if (e.key === 'F1') { stepDist.value = 0.01 }
    else if (e.key === 'F2') { stepDist.value = 0.1 }
    else if (e.key === 'F3') { stepDist.value = 1 }
    else if (e.key === 'F4') { stepDist.value = 5 }
    else if (e.key === 'F5') { openStepDialog() }

    else if (!ctrl && e.key === 'ArrowUp')    { kbdMove('Y',  1) }
    else if (!ctrl && e.key === 'ArrowDown')  { kbdMove('Y', -1) }
    else if (!ctrl && e.key === 'ArrowLeft')  { kbdMove('X', -1) }
    else if (!ctrl && e.key === 'ArrowRight') { kbdMove('X',  1) }

    else if (ctrl && e.key === 'ArrowLeft')   { kbdMove('U', -1) }
    else if (ctrl && e.key === 'ArrowRight')  { kbdMove('U',  1) }

    else if (ctrl && e.key === 'ArrowUp')     { kbdMove('R',  1) }
    else if (ctrl && e.key === 'ArrowDown')   { kbdMove('R', -1) }

    else if (e.key === 'PageUp')    { kbdMove('Z',  1) }
    else if (e.key === 'PageDown')  { kbdMove('Z', -1) }

    else { handled = false }

    if (handled) e.preventDefault()
  }

  window.addEventListener('keydown', handler)
}

export function stopKeyboardJog() {
  _registered = false
}

export function useKeyboardJogState() {
  return {
    stepDist: readonly(stepDist),
    stepLabel: readonly(stepLabel),
    showStepDialog: readonly(showStepDialog),
    customStepInput,
    jogSpeed,
    openStepDialog,
    applyCustomStep
  }
}
